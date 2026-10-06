<?php

namespace App\Infrastructure\Broadcasting;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Throwable;

/**
 * Sends realtime events straight to Reverb, in the request that caused
 * them — never through the queue, so a chat keeps working live without a
 * queue worker. A broadcast that fails (Reverb down or unreachable) is
 * reported and skipped: the message is saved all the same, and clients
 * catch up when they reconnect.
 */
class LiveUpdates
{
    /**
     * Broadcasts `$event` to everyone on its channels except the socket
     * that made this request (the `X-Socket-ID` header).
     */
    public static function toOthers(ShouldBroadcastNow $event): void
    {
        self::send($event, exceptCurrentSocket: true);
    }

    /**
     * Broadcasts `$event` to everyone on its channels.
     */
    public static function toEveryone(ShouldBroadcastNow $event): void
    {
        self::send($event, exceptCurrentSocket: false);
    }

    /**
     * Runs `$send` (a notification, or anything else that broadcasts), so
     * that a failed broadcast inside it never fails the request.
     */
    public static function safely(callable $send): void
    {
        try {
            $send();
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private static function send(ShouldBroadcastNow $event, bool $exceptCurrentSocket): void
    {
        self::safely(function () use ($event, $exceptCurrentSocket): void {
            if ($exceptCurrentSocket && method_exists($event, 'dontBroadcastToCurrentUser')) {
                $event->dontBroadcastToCurrentUser();
            }

            event($event);
        });
    }
}
