<?php

test('the changelog page renders', function () {
    $this->get('/changelog')->assertOk();
});

test('the changelog data file is a well-formed list of releases', function () {
    $releases = require base_path('resources/data/changelog.php');

    expect($releases)->toBeArray()->not->toBeEmpty();

    foreach ($releases as $release) {
        expect($release)->toHaveKeys(['version', 'date', 'items']);
        expect($release['items'])->toBeArray()->not->toBeEmpty();

        foreach ($release['items'] as $item) {
            expect($item['type'])->toBeIn(['new', 'improved', 'fixed']);
        }
    }
});

test('the changelog lists releases newest first with unique versions', function () {
    $releases = require base_path('resources/data/changelog.php');
    $versions = array_column($releases, 'version');

    $newestFirst = $versions;
    usort($newestFirst, fn (string $a, string $b): int => version_compare($b, $a));

    expect($versions)->toBe($newestFirst)
        ->and($versions)->toBe(array_values(array_unique($versions)));
});

test('the changelog page shows the latest release version', function () {
    $latest = (require base_path('resources/data/changelog.php'))[0]['version'];

    $this->get('/changelog')->assertOk()->assertSee('v'.$latest);
});
