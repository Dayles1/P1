<?php

namespace App\Games\City3;

/**
 * Who gets the tester tools in the game's menu: decided by the user id
 * alone (the one thing the game shares with the host application) and the
 * `city3.testers` config.
 */
class Testers
{
    public function includes(int $userId): bool
    {
        if (! config('city3.testers.enabled')) {
            return false;
        }

        $ids = config('city3.testers.ids', []);

        return $ids === [] || in_array($userId, $ids, true);
    }
}
