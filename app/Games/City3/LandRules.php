<?php

namespace App\Games\City3;

/**
 * Where buildings may stand on the fixed map (gdd §5, §14) — the server's
 * copy of the browser's placement rules (client/engine/world/land.ts):
 * the owned columns from the strips bought on each side, rows 0..59, and
 * each building's zone — land rows, land or beach, the waterline, the
 * mountain foot (exactly on a deposit of its kind for mines, coal mines
 * and oil wells, off the deposits and tunnel portals for the rest), and
 * the airport plot, where only roads and parks may stand until the
 * airport. Free tiles are not checked: a save sends only what changed.
 */
class LandRules
{
    public function __construct(private ContentRepository $content) {}

    /**
     * The owned columns for the strips bought west and east of the start.
     *
     * @return array{minX: int, maxX: int}
     */
    public function ownedColumns(int $west, int $east): array
    {
        $land = $this->content->land();
        $count = fn (int $strips): int => max(0, min($land['perSide'], $strips));

        return [
            'minX' => max(0, $land['start']['minX'] - $count($west) * $land['stripWidth']),
            'maxX' => min($land['width'] - 1, $land['start']['maxX'] + $count($east) * $land['stripWidth']),
        ];
    }

    /**
     * Why a building of `$type` cannot stand at (x, y) on a land of
     * `$west` + `$east` strips: 'outside' the owned land and rows, or out
     * of its 'zone'; null when it may (or the type is unknown — that is
     * another rule's to report).
     */
    public function placementError(string $type, int $x, int $y, int $west, int $east): ?string
    {
        $placement = $this->content->placement($type);

        if ($placement === null) {
            return null;
        }

        $land = $this->content->land();
        $owned = $this->ownedColumns($west, $east);
        $waterline = $land['landRows'] + $land['beachRows'] - 1;
        $rect = ['x' => $x, 'y' => $y, 'w' => $placement['w'], 'h' => $placement['h']];
        $bottom = $y + $placement['h'] - 1;

        if ($x < $owned['minX'] || $x + $placement['w'] - 1 > $owned['maxX'] || $y < 0 || $bottom > $waterline) {
            return 'outside';
        }

        $plot = $land['airportPlot'];

        if ($placement['zone'] === 'airportPlot') {
            return $this->sameRect($rect, $plot) ? null : 'zone';
        }

        if ($this->overlaps($rect, $plot) && ! in_array($type, $plot['allow'], true)) {
            return 'zone';
        }

        $fits = match ($placement['zone']) {
            'land' => $bottom < $land['landRows'],
            'landOrBeach' => $bottom < $waterline,
            'coast' => $bottom === $waterline && $this->spotFits($placement['deposit'], $rect, $land),
            'mountain' => $y === 0 && $this->spotFits($placement['deposit'], $rect, $land),
            // Metro entrances (slice 10) are checked against the road layer then.
            default => true,
        };

        return $fits ? null : 'zone';
    }

    /**
     * At the mountain foot and the waterline: an extractor stands exactly
     * on a spot of its kind; anything else leaves spots and portals free.
     *
     * @param  array{x: int, y: int, w: int, h: int}  $rect
     * @param  array{portals: list<int>, deposits: list<array{kind: string, x: int, y: int, w: int, h: int}>}  $land
     */
    private function spotFits(?string $deposit, array $rect, array $land): bool
    {
        if ($deposit !== null) {
            foreach ($land['deposits'] as $spot) {
                if ($spot['kind'] === $deposit && $this->sameRect($spot, $rect)) {
                    return true;
                }
            }

            return false;
        }

        foreach ($land['deposits'] as $spot) {
            if ($this->overlaps($spot, $rect)) {
                return false;
            }
        }

        foreach ($land['portals'] as $portal) {
            if ($rect['y'] === 0 && $portal >= $rect['x'] && $portal < $rect['x'] + $rect['w']) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array{x: int, y: int, w: int, h: int}  $a
     * @param  array{x: int, y: int, w: int, h: int}  $b
     */
    private function overlaps(array $a, array $b): bool
    {
        return $a['x'] < $b['x'] + $b['w'] && $b['x'] < $a['x'] + $a['w']
            && $a['y'] < $b['y'] + $b['h'] && $b['y'] < $a['y'] + $a['h'];
    }

    /**
     * @param  array{x: int, y: int, w: int, h: int}  $a
     * @param  array{x: int, y: int, w: int, h: int}  $b
     */
    private function sameRect(array $a, array $b): bool
    {
        return $a['x'] === $b['x'] && $a['y'] === $b['y'] && $a['w'] === $b['w'] && $a['h'] === $b['h'];
    }
}
