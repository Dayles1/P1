<?php

namespace App\Games\Community\Models;

use App\Games\Community\Database\Factories\GamePlaytimeFactory;
use App\Games\Game;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * How long a player has played a game, in seconds, as counted by the
 * server from the SPA's heartbeats. `user_id` is the main application's
 * user id (another database, so no relation).
 *
 * @property int $id
 * @property int $user_id
 * @property Game $game
 * @property int $seconds
 * @property Carbon|null $last_ping_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class GamePlaytime extends Model
{
    /** @use HasFactory<GamePlaytimeFactory> */
    use HasFactory;

    protected $connection = 'games';

    protected $fillable = [
        'user_id',
        'game',
        'seconds',
        'last_ping_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'game' => Game::class,
            'seconds' => 'integer',
            'last_ping_at' => 'datetime',
        ];
    }

    protected static function newFactory(): GamePlaytimeFactory
    {
        return GamePlaytimeFactory::new();
    }
}
