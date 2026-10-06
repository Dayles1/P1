<?php

use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;

/**
 * The changelog page's own markup — everything inside `<main>`,
 * without the shell around it.
 */
function changelogContent(TestResponse $response): string
{
    preg_match('/<main class="app-main".*?<\/main>/s', $response->getContent(), $matches);

    return $matches[0] ?? '';
}

/**
 * Every literal `'changelog.…'` / `'components.…'` key the changelog
 * page script asks the dictionary for.
 *
 * @return list<string>
 */
function changelogScriptKeys(): array
{
    $source = file_get_contents(resource_path('js/blade/app/changelog.js'));

    preg_match_all("/'((?:changelog|components)\.[a-z0-9_]+)'/", $source, $matches);

    return array_values(array_unique($matches[1]));
}

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

test('the changelog page renders every release and change without a script', function () {
    $releases = require base_path('resources/data/changelog.php');
    $html = changelogContent($this->get('/changelog')->assertOk());
    $changes = array_merge(...array_column($releases, 'items'));

    expect(substr_count($html, 'data-changelog-release="'))->toBe(count($releases))
        ->and(substr_count($html, 'data-changelog-item="'))->toBe(count($changes))
        ->and(substr_count($html, 'data-changelog-jump="'))->toBe(count($releases));

    foreach ($releases as $release) {
        $anchor = 'v'.str_replace('.', '-', $release['version']);

        expect($html)->toContain('id="'.$anchor.'"')
            ->and($html)->toContain('href="#'.$anchor.'"');
    }

    foreach ($changes as $change) {
        expect($html)->toContain(e($change['text']));
    }
});

test('the changelog page renders the hooks its script uses', function () {
    $html = changelogContent($this->get('/changelog')->assertOk());

    expect($html)->toContain('data-changelog-search')
        ->and($html)->toContain('data-changelog-version-search')
        ->and($html)->toContain('data-changelog-jump-select')
        ->and($html)->toContain('data-changelog-status')
        ->and($html)->toContain('data-changelog-empty')
        ->and($html)->toContain('data-changelog-pager')
        ->and($html)->toContain('data-changelog-toggle-all')
        ->and($html)->toContain('data-changelog-reset')
        ->and($html)->toContain('data-changelog-copy');

    foreach (['all', 'new', 'improved', 'fixed'] as $type) {
        expect($html)->toContain('data-changelog-type="'.$type.'"');
    }
});

test('the changelog type chips count the changes of each type', function () {
    $releases = require base_path('resources/data/changelog.php');
    $types = array_count_values(array_column(array_merge(...array_column($releases, 'items')), 'type'));
    $html = changelogContent($this->get('/changelog')->assertOk());

    foreach (['new', 'improved', 'fixed'] as $type) {
        expect($html)->toMatch('/data-changelog-type="'.$type.'".*?<span class="chip__count">'.$types[$type].'<\/span>/s');
    }

    expect($html)->toMatch('/data-changelog-type="all".*?<span class="chip__count">'.array_sum($types).'<\/span>/s');
});

test('the changelog page marks the latest release and every major one', function () {
    $html = changelogContent($this->get('/changelog')->assertOk());

    expect(substr_count($html, e(__('ui.changelog.latest'))))->toBe(1)
        ->and(substr_count($html, e(__('ui.changelog.major_release'))))->toBe(
            count(array_filter(
                array_column(require base_path('resources/data/changelog.php'), 'version'),
                fn (string $version): bool => str_ends_with($version, '.0.0'),
            )),
        );
});

test('the changelog dates and counts read naturally in Russian', function () {
    $releases = require base_path('resources/data/changelog.php');
    $html = changelogContent($this->withUnencryptedCookie('locale', 'ru')->get('/changelog')->assertOk());
    $changes = count(array_merge(...array_column($releases, 'items')));

    app()->setLocale('ru');

    expect($html)->toContain(trans_choice('ui.changelog.versions', count($releases)))
        ->and($html)->toContain(trans_choice('ui.changelog.changes', $changes))
        ->and($html)->toContain('25 сентября 2026');
});

test('the changelog dates are written in Latin script in Uzbek', function () {
    $html = changelogContent($this->withUnencryptedCookie('locale', 'uz')->get('/changelog')->assertOk());

    expect($html)->toContain('2026-yil 25-Sentabr')
        ->and($html)->not->toContain('сентябр');
});

test('the changelog page is translated in every locale', function (string $locale) {
    $html = changelogContent($this->withUnencryptedCookie('locale', $locale)->get('/changelog')->assertOk());
    $dictionary = require lang_path("{$locale}/ui.php");

    expect($html)->not->toContain('ui.changelog.')
        ->and($html)->toContain(e(Arr::get($dictionary, 'changelog.title')))
        ->and($html)->toContain(e(Arr::get($dictionary, 'changelog.search_placeholder')));

    foreach (changelogScriptKeys() as $key) {
        expect(Arr::get($dictionary, $key))->toBeString("{$locale}: {$key} is missing");
    }
})->with(['en', 'ru', 'uz']);
