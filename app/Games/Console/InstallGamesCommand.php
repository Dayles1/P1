<?php

namespace App\Games\Console;

use App\Games\GamesDatabase;
use Illuminate\Console\Command;

/**
 * Creates the games database if it is missing and runs the games
 * migrations into it.
 */
class InstallGamesCommand extends Command
{
    protected $signature = 'games:install';

    protected $description = 'Create the games database and run its migrations';

    public function handle(GamesDatabase $games): int
    {
        $database = $games->config()['database'];

        if (! $games->ensureExists()) {
            $this->components->warn("Create the \"{$database}\" database by hand, then run this again.");
        }

        $this->call('migrate', [
            '--path' => 'app/Games/database/migrations',
            '--force' => true,
        ]);

        $this->components->info("Games database \"{$database}\" is ready.");

        return self::SUCCESS;
    }
}
