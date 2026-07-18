<?php

namespace App\Http\Controllers\Api\Profile;

use App\Domain\Profile\Actions\DestroyAvatar;
use App\Domain\Profile\Actions\ListAvatars;
use App\Domain\Profile\Actions\StoreAvatar;
use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\StoreAvatarRequest;
use App\Http\Resources\Attachment\AttachmentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AvatarController extends Controller
{
    public function __construct(
        protected ListAvatars $listAvatars,
        protected StoreAvatar $storeAvatar,
        protected DestroyAvatar $destroyAvatar,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $avatars = $this->listAvatars->handle(
            user: $request->user(),
            perPage: (int) $request->integer('per_page', 15)
        );

        return $this->responsePagination(
            paginator: $avatars,
            data: AttachmentResource::collection($avatars),
        );
    }

    public function store(StoreAvatarRequest $request): JsonResponse
    {
        $avatar = $this->storeAvatar->handle(
            user: $request->user(),
            file: $request->file('file')
        );

        return $this->success(
            data: new AttachmentResource($avatar),
            message: __('messages.profile.avatar_uploaded')
        );
    }

    public function destroy(Request $request, int $avatar): JsonResponse
    {
        $this->destroyAvatar->handle(
            user: $request->user(),
            avatarId: $avatar
        );

        return $this->success(
            message: __('messages.profile.avatar_deleted')
        );
    }
}