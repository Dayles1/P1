<?php

namespace App\Http\Controllers\Api;

use App\Domain\Notification\Actions\ListNotifications;
use App\Domain\Notification\Actions\MarkNotificationsRead;
use App\Http\Controllers\Controller;
use App\Http\Resources\Notification\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(
        protected ListNotifications $listNotifications,
        protected MarkNotificationsRead $markNotificationsRead,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $notifications = $this->listNotifications->handle(
            user: $request->user(),
            unreadOnly: $request->boolean('unread'),
            type: $request->string('type')->value() ?: null,
            perPage: (int) $request->integer('per_page', 20),
        );

        return $this->responsePagination(
            paginator: $notifications,
            data: NotificationResource::collection($notifications),
        );
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return $this->success(
            data: ['count' => $request->user()->unreadNotifications()->count()],
        );
    }

    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        $user = $request->user();
        $record = $user->notifications()->findOrFail($notification);

        $this->markNotificationsRead->handle($user, $user->notifications()->whereKey($record->id));

        return $this->success(
            data: new NotificationResource($record->fresh()),
            message: __('messages.notifications.marked_read'),
        );
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();

        $this->markNotificationsRead->handle($user, $user->notifications());

        return $this->success(message: __('messages.notifications.all_marked_read'));
    }
}
