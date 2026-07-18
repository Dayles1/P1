<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\Log;

class LogoutUser
{
    public function handle(User $user)
    {
        $token = $user->currentAccessToken();

        if (!$token) {
            return;
        }
        // Log::info($user->sessions());
        $user->sessions()
            ->where('personal_access_token_id', $token->id)
            ->update([
                'logged_out_at' => now(),
            ]);
        
        $token->delete();
    }
}
