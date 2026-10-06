<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Chat\Queries\FindPrivateConversationQuery;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Services\SharedWithUser;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ShowUserProfile
{
    /** Fewer replies than this in 30 days say nothing about how fast someone answers. */
    private const REPLY_TIME_MIN_SAMPLES = 3;

    public function __construct(
        protected FindPrivateConversationQuery $findPrivateConversation,
        protected SharedWithUser $sharedWithUser,
    ) {}

    /**
     * Another user's public profile, as the requester sees it — a banned
     * account does not exist for anyone but a super admin. Everything taken
     * from chats comes from conversations both are current members of.
     *
     * @return array{
     *     user: User,
     *     private_conversation_id: int|null,
     *     common_groups: Collection<int, Conversation>,
     *     mutual_contacts: array{users: Collection<int, User>, count: int},
     *     shared: array{media_count: int, files_count: int, recent_media: Collection<int, MessageAttachment>, recent_files: Collection<int, MessageAttachment>},
     *     recent_activity: array<int, array{kind: string, at: Carbon, conversation: array{id: int, title: string|null, type: string}|null, text: string|null}>,
     *     reply_time: string|null,
     *     is_blocked: bool,
     *     can_message: bool,
     * }
     *
     * @throws ModelNotFoundException
     */
    public function handle(User $requester, User $user): array
    {
        $user->load(['avatar', 'roles', 'ban', 'department', 'settings.timezone']);

        $this->ensureVisible($requester, $user);

        $isMe = (int) $requester->id === (int) $user->id;
        $sharedIds = $this->sharedWithUser->conversationIds($requester, $user);
        $commonGroups = $this->commonGroups($sharedIds);

        return [
            'user' => $user,
            'private_conversation_id' => $this->findPrivateConversation->execute($requester->id, $user->id)?->id,
            'common_groups' => $commonGroups,
            'mutual_contacts' => $this->mutualContacts($requester, $user, $commonGroups->modelKeys()),
            'shared' => $this->shared($requester, $user),
            'recent_activity' => $this->recentActivity($requester, $user, $commonGroups),
            'reply_time' => $this->replyTime($user),
            'is_blocked' => ! $isMe && $requester->hasBlocked($user),
            'can_message' => ! $isMe && ! $user->isBanned() && ! $requester->isBlockedWith($user),
        ];
    }

    /**
     * A banned account is hidden from everyone but a super admin.
     *
     * @throws ModelNotFoundException
     */
    public function ensureVisible(User $requester, User $user): void
    {
        $user->loadMissing('ban');

        if ($user->isBanned() && ! $requester->hasRole(Role::SUPER_ADMIN)) {
            throw (new ModelNotFoundException)->setModel(User::class, [$user->id]);
        }
    }

    /**
     * Groups and channels among the shared conversations.
     *
     * @param  array<int, int>  $sharedIds
     * @return Collection<int, Conversation>
     */
    private function commonGroups(array $sharedIds): Collection
    {
        return Conversation::query()
            ->whereKey($sharedIds)
            ->whereIn('type', [Conversation::TYPE_GROUP, Conversation::TYPE_CHANNEL])
            ->with('avatarAttachment')
            ->withCount('users')
            ->orderBy('title')
            ->orderBy('id')
            ->get(['id', 'title', 'type', 'avatar', 'created_by', 'created_at']);
    }

    /**
     * Other people in the common groups (not banned), a few by name plus how many.
     *
     * @param  array<int, int>  $groupIds
     * @return array{users: Collection<int, User>, count: int}
     */
    private function mutualContacts(User $requester, User $user, array $groupIds): array
    {
        if ($groupIds === []) {
            return ['users' => new Collection, 'count' => 0];
        }

        $query = User::query()
            ->notBanned()
            ->whereKeyNot([$requester->id, $user->id])
            ->whereHas('conversations', fn ($conversations) => $conversations->whereIn('conversations.id', $groupIds));

        return [
            'users' => (clone $query)->with('avatar')->orderBy('name')->limit(3)->get(['id', 'name']),
            'count' => $query->count(),
        ];
    }

    /**
     * @return array{media_count: int, files_count: int, recent_media: Collection<int, MessageAttachment>, recent_files: Collection<int, MessageAttachment>}
     */
    private function shared(User $requester, User $user): array
    {
        $media = $this->sharedWithUser->attachments($requester, $user, SharedWithUser::KIND_MEDIA);
        $files = $this->sharedWithUser->attachments($requester, $user, SharedWithUser::KIND_FILES);

        return [
            'media_count' => (clone $media)->count(),
            'files_count' => (clone $files)->count(),
            'recent_media' => $media->with('message:id,conversation_id,user_id,created_at')->limit(6)->get(),
            'recent_files' => $files->with('message:id,conversation_id,user_id,created_at')->limit(3)->get(),
        ];
    }

    /**
     * What the person did lately where the requester could see it: groups
     * they created or joined, and their latest message in each shared chat.
     *
     * @param  Collection<int, Conversation>  $commonGroups
     * @return array<int, array{kind: string, at: Carbon, conversation: array{id: int, title: string|null, type: string}|null, text: string|null}>
     */
    private function recentActivity(User $requester, User $user, Collection $commonGroups): array
    {
        $describe = fn (?Conversation $conversation): ?array => $conversation ? [
            'id' => (int) $conversation->id,
            'title' => $conversation->title,
            'type' => (string) $conversation->type,
        ] : null;

        $activity = collect();

        foreach ($commonGroups as $group) {
            if ((int) $group->created_by === (int) $user->id && $group->created_at) {
                $activity->push(['kind' => 'group_created', 'at' => $group->created_at, 'conversation' => $describe($group), 'text' => null]);
            }
        }

        $joined = ConversationUser::query()
            ->where('user_id', $user->id)
            ->whereIn('conversation_id', $commonGroups->modelKeys())
            ->whereNull('left_at')
            ->whereNotNull('joined_at')
            ->where('role', '!=', ConversationUser::ROLE_CREATOR)
            ->latest('joined_at')
            ->limit(5)
            ->get(['conversation_id', 'joined_at']);

        foreach ($joined as $membership) {
            $group = $commonGroups->find($membership->conversation_id);

            if ($group && (int) $group->created_by !== (int) $user->id) {
                $activity->push(['kind' => 'group_joined', 'at' => $membership->joined_at, 'conversation' => $describe($group), 'text' => null]);
            }
        }

        $messages = $this->sharedWithUser->messages($requester, $user)
            ->select(['messages.id', 'messages.conversation_id', 'messages.body', 'messages.created_at'])
            ->where('messages.user_id', $user->id)
            ->where('messages.type', Message::TYPE_TEXT)
            ->whereNotNull('messages.body')
            ->where('messages.body', '!=', '')
            ->orderByDesc('messages.id')
            ->limit(20)
            ->get()
            ->unique('conversation_id')
            ->take(5);

        $conversations = Conversation::query()
            ->whereKey($messages->pluck('conversation_id')->all())
            ->get(['id', 'title', 'type'])
            ->keyBy('id');

        foreach ($messages as $message) {
            $activity->push([
                'kind' => 'message',
                'at' => $message->created_at,
                'conversation' => $describe($conversations->get($message->conversation_id)),
                'text' => Str::limit(trim((string) preg_replace('/@\[([^\]]+)\]\(\d+\)/u', '@$1', (string) $message->body)), 80),
            ]);
        }

        return $activity
            ->sortByDesc(fn (array $item): int => $item['at']->getTimestamp())
            ->take(5)
            ->values()
            ->all();
    }

    /**
     * How fast the person usually answers in private chats: the median
     * delay, over the last 30 days, between someone writing to them and
     * their next message — null with too few replies to tell.
     */
    private function replyTime(User $user): ?string
    {
        return Cache::remember("user-profile:reply-time:{$user->id}", now()->addMinutes(10), function () use ($user): ?string {
            $privateIds = DB::table('conversation_users')
                ->join('conversations', 'conversations.id', '=', 'conversation_users.conversation_id')
                ->where('conversation_users.user_id', $user->id)
                ->where('conversations.type', Conversation::TYPE_PRIVATE)
                ->pluck('conversations.id');

            if ($privateIds->isEmpty()) {
                return null;
            }

            $messages = DB::table('messages')
                ->whereIn('conversation_id', $privateIds)
                ->where('created_at', '>=', now()->subDays(30))
                ->whereNull('deleted_at')
                ->where('type', '!=', Message::TYPE_SYSTEM)
                ->orderBy('conversation_id')
                ->orderBy('id')
                ->limit(5000)
                ->get(['conversation_id', 'user_id', 'created_at']);

            $delays = [];
            $waitingSince = [];

            foreach ($messages as $message) {
                $conversationId = (int) $message->conversation_id;
                $sentAt = Carbon::parse($message->created_at);

                if ((int) $message->user_id !== (int) $user->id) {
                    $waitingSince[$conversationId] ??= $sentAt;

                    continue;
                }

                if (isset($waitingSince[$conversationId])) {
                    $delays[] = $waitingSince[$conversationId]->diffInSeconds($sentAt, true);
                    unset($waitingSince[$conversationId]);
                }
            }

            if (count($delays) < self::REPLY_TIME_MIN_SAMPLES) {
                return null;
            }

            sort($delays);
            $median = $delays[intdiv(count($delays), 2)];

            return match (true) {
                $median <= 15 * 60 => 'minutes',
                $median <= 60 * 60 => 'hour',
                $median <= 24 * 60 * 60 => 'day',
                default => 'slow',
            };
        });
    }
}
