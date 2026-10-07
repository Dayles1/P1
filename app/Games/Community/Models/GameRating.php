<?php

namespace App\Games\Community\Models;

use App\Games\Community\Database\Factories\GameRatingFactory;
use App\Games\Game;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A player's rating of a game: 1–5 stars and an optional comment, one per
 * player per game. `user_id` is the main application's user id (another
 * database, so no relation).
 *
 * @property int $id
 * @property int $user_id
 * @property Game $game
 * @property int $stars
 * @property string|null $comment
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class GameRating extends Model
{
    /** @use HasFactory<GameRatingFactory> */
    use HasFactory;

    protected $connection = 'games';

    protected $fillable = [
        'user_id',
        'game',
        'stars',
        'comment',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'game' => Game::class,
            'stars' => 'integer',
        ];
    }

    protected static function newFactory(): GameRatingFactory
    {
        return GameRatingFactory::new();
    }
}
