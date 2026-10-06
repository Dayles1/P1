<?php

namespace App\Http\Controllers\Api\User;

use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Actions\User\ShowUserProfile;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Services\SharedWithUser;
use App\Domain\Setting\Services\UserDateFormatter;
use App\Http\Controllers\Controller;
use App\Http\Resources\User\SharedAttachmentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserSharedController extends Controller
{
    private const PER_PAGE = 24;

    private const URL_PATTERN = '~https?://[^\s<>"\]\)]+~i';

    public function __construct(
        protected ShowUserProfile $showUserProfile,
        protected SharedWithUser $sharedWithUser,
    ) {}

    /**
     * Media, files, voice messages or links from the conversations the
     * requester and `$user` are both current members of, newest first.
     */
    public function index(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['nullable', 'string', Rule::in([
                SharedWithUser::KIND_MEDIA,
                SharedWithUser::KIND_FILES,
                SharedWithUser::KIND_VOICE,
                SharedWithUser::KIND_LINKS,
            ])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $viewer = $request->user();
        $this->showUserProfile->ensureVisible($viewer, $user);
        $kind = $validated['kind'] ?? SharedWithUser::KIND_MEDIA;

        if ($kind === SharedWithUser::KIND_LINKS) {
            $messages = $this->sharedWithUser->links($viewer, $user)
                ->with('user:id,name')
                ->paginate(self::PER_PAGE);
            $formatter = app(UserDateFormatter::class);

            return $this->responsePagination($messages, $messages->getCollection()->map(fn (Message $message): array => [
                'id' => $message->id,
                'conversation_id' => $message->conversation_id,
                'url' => Str::match(self::URL_PATTERN, (string) $message->body) ?: null,
                'body' => Str::limit((string) $message->body, 200),
                'sender' => $message->user ? ['id' => $message->user->id, 'name' => $message->user->name] : null,
                'created_at_iso' => $formatter->iso($message->created_at, $viewer),
            ])->values());
        }

        $attachments = $this->sharedWithUser->attachments($viewer, $user, $kind)
            ->with('message:id,conversation_id,user_id,created_at')
            ->paginate(self::PER_PAGE);

        return $this->responsePagination($attachments, SharedAttachmentResource::collection($attachments->getCollection()));
    }
}
