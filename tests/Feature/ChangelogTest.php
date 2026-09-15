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
