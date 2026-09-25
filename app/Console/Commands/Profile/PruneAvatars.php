<?php

namespace App\Console\Commands\Profile;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Identity\Models\User;
use App\Domain\Profile\Actions\StoreAvatar;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * One-off clean-up for avatars saved before only the current one was
 * kept: every user's older avatars (file and row), and any file under
 * avatars/ that no row points at any more.
 */
class PruneAvatars extends Command
{
    protected $signature = 'avatars:prune {--dry-run : List what would be deleted without deleting it}';

    protected $description = "Delete every avatar except each user's current one, and avatar files nothing points at";

    public function handle(StoreAvatar $storeAvatar): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $rows = $this->pruneOlderAvatars($storeAvatar, $dryRun);
        $files = $this->pruneOrphanFiles($dryRun);

        $this->components->info(sprintf(
            '%s %d older avatar(s) and %d orphaned file(s).',
            $dryRun ? 'Would delete' : 'Deleted',
            $rows,
            $files,
        ));

        return self::SUCCESS;
    }

    private function pruneOlderAvatars(StoreAvatar $storeAvatar, bool $dryRun): int
    {
        $userIds = Attachment::query()
            ->where('collection', 'avatar')
            ->where('attachable_type', (new User)->getMorphClass())
            ->groupBy('attachable_id')
            ->havingRaw('count(*) > 1')
            ->pluck('attachable_id');

        $deleted = 0;

        foreach ($userIds as $userId) {
            $user = User::withTrashed()->whereKey($userId)->first();
            $current = $user?->avatars()->latest('id')->first();

            if ($user === null || $current === null) {
                continue;
            }

            $deleted += $dryRun
                ? $user->avatars()->whereKeyNot($current->getKey())->count()
                : $storeAvatar->deleteOthers($user, $current);
        }

        return $deleted;
    }

    private function pruneOrphanFiles(bool $dryRun): int
    {
        $disk = Storage::disk('public');

        $known = Attachment::query()
            ->where('collection', 'avatar')
            ->pluck('path')
            ->flip();

        $orphans = array_filter(
            $disk->allFiles('avatars'),
            fn (string $path): bool => ! $known->has($path),
        );

        foreach ($orphans as $path) {
            $this->line($path, verbosity: 'v');

            if (! $dryRun) {
                $disk->delete($path);
            }
        }

        return count($orphans);
    }
}
