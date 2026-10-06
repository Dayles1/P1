<?php

namespace App\Http\Resources\User;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;

/**
 * Another user's public profile, as the requester sees it.
 *
 * @mixin User
 */
class UserProfileResource extends DirectoryUserResource
{
    /**
     * @param  array<string, mixed>  $profile  what ShowUserProfile::handle() returned
     */
    public function __construct(User $user, public array $profile)
    {
        parent::__construct($user);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $formatter = app(UserDateFormatter::class);
        $isMe = (int) $this->id === (int) $viewer?->id;
        $phoneShown = $this->phone && ($this->phone_visible || $isMe);
        $groups = $this->profile['common_groups'];
        $shared = $this->profile['shared'];

        return [
            ...parent::toArray($request),
            'position' => $this->position,
            'bio' => $this->bio,
            'tags' => array_values($this->profile_tags ?? []),
            'telegram' => $this->telegram,
            'phone' => $phoneShown ? $this->phone : null,
            'phone_hidden' => (bool) $this->phone && ! $phoneShown,
            'locale' => $this->settings?->locale,
            'joined_at' => $formatter->format($this->created_at, $viewer),
            'joined_at_iso' => $formatter->iso($this->created_at, $viewer),
            'timezone' => $this->settings?->timezone?->name,
            'is_me' => $isMe,
            'is_blocked' => $this->profile['is_blocked'],
            'can_message' => $this->profile['can_message'],
            'private_conversation_id' => $this->profile['private_conversation_id'],
            'common_groups' => $groups->map(fn (Conversation $conversation): array => [
                'id' => $conversation->id,
                'title' => $conversation->title,
                'type' => $conversation->type,
                'avatar' => $conversation->avatarAttachment->url ?? $conversation->avatar,
                'members_count' => (int) $conversation->users_count,
            ])->values()->all(),
            'common_groups_count' => $groups->count(),
            'mutual_contacts' => [
                'users' => $this->profile['mutual_contacts']['users']->map(fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar' => $user->avatar?->url,
                ])->values()->all(),
                'count' => $this->profile['mutual_contacts']['count'],
            ],
            'shared' => [
                'media_count' => $shared['media_count'],
                'files_count' => $shared['files_count'],
                'recent_media' => SharedAttachmentResource::collection($shared['recent_media'])->resolve($request),
                'recent_files' => SharedAttachmentResource::collection($shared['recent_files'])->resolve($request),
            ],
            'recent_activity' => array_map(fn (array $item): array => [
                'kind' => $item['kind'],
                'at_iso' => $formatter->iso($item['at'], $viewer),
                'conversation' => $item['conversation'],
                'text' => $item['text'],
            ], $this->profile['recent_activity']),
            'reply_time' => $this->profile['reply_time'],
        ];
    }
}
