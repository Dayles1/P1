<?php

namespace App\Games\Epochs;

/**
 * Who may edit the content files from the Workshop: decided by the user id
 * alone (the one thing games share with the main app) and config/games.php.
 */
class Workshop
{
    public function canEdit(int $userId): bool
    {
        if (! config('games.workshop.enabled')) {
            return false;
        }

        $editors = config('games.workshop.editors', []);

        return $editors === [] || in_array($userId, $editors, true);
    }
}
