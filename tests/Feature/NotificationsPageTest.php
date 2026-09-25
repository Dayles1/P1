<?php

use Illuminate\Support\Arr;
use Illuminate\Testing\TestResponse;

/**
 * The Notification Center's own markup — everything inside `<main>`,
 * without the shell (and its header bell) around it.
 */
function notificationsContent(TestResponse $response): string
{
    preg_match('/<main class="app-main".*?<\/main>/s', $response->getContent(), $matches);

    return $matches[0] ?? '';
}

/**
 * Every literal `'notifications.…'` key the page script and the shared
 * row renderer ask the dictionary for.
 *
 * @return list<string>
 */
function notificationScriptKeys(): array
{
    $source = file_get_contents(resource_path('js/blade/app/notifications.js'))
        .file_get_contents(resource_path('js/blade/shared/notification-renderers.js'));

    preg_match_all("/'(notifications\.[a-z0-9_]+(?:\.[a-z0-9_]+)*)'/", $source, $matches);

    return array_values(array_unique($matches[1]));
}

test('the notification center renders the hooks its script fills', function () {
    $html = notificationsContent($this->get('/notifications')->assertOk());

    expect($html)->toContain('data-notif-center-list')
        ->and($html)->toContain('data-notif-unread-summary')
        ->and($html)->toContain('data-notif-mark-all-page')
        ->and($html)->toMatch('/<div class="pagination notif-feed__pagination" data-notif-pagination hidden><\/div>/')
        ->and(substr_count($html, 'class="skeleton-list__row"'))->toBe(5);
});

test('the notification list can take focus after a page change', function () {
    $html = notificationsContent($this->get('/notifications')->assertOk());

    expect($html)->toContain('<div class="notif-feed__list" data-notif-center-list tabindex="-1" aria-busy="true">');
});

test('the notification filters are chips with "all" pressed', function () {
    $html = notificationsContent($this->get('/notifications')->assertOk());

    preg_match_all('/<button type="button" class="chip" data-notif-filter="([a-z]*)" aria-pressed="(true|false)">/', $html, $chips);

    expect($chips[1])->toBe(['', 'unread', 'message', 'mention', 'system'])
        ->and($chips[2])->toBe(['true', 'false', 'false', 'false', 'false'])
        ->and($html)->toContain('role="group" aria-label="'.e(__('ui.notifications.filters_label')).'"');
});

test('the notification center reads everything and links to notification settings', function () {
    $html = notificationsContent($this->get('/notifications')->assertOk());

    expect($html)->toContain('aria-label="'.e(__('ui.notifications.read_all')).'"')
        ->and($html)->toContain('<use href="#i-checks">')
        ->and($html)->toContain('href="'.route('settings.notifications').'"')
        ->and($html)->toContain('<use href="#i-sliders">');
});

test('the notification center markup carries no inline styles or emoji', function () {
    $html = notificationsContent($this->get('/notifications')->assertOk());

    expect($html)->not->toContain('style="')
        ->and($html)->not->toMatch('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/u');
});

test('the notification center is translated in every locale', function (string $locale) {
    $html = notificationsContent($this->withUnencryptedCookie('locale', $locale)->get('/notifications')->assertOk());
    $dictionary = require lang_path("{$locale}/ui.php");

    expect($html)->not->toContain('ui.notifications.')
        ->and($html)->toContain(e(Arr::get($dictionary, 'notifications.feed_scope')))
        ->and($html)->toContain(e(Arr::get($dictionary, 'notifications.settings')));

    foreach (['all', 'unread', 'message', 'mention', 'system'] as $filter) {
        expect($html)->toContain(e(Arr::get($dictionary, "notifications.filters.{$filter}")));
    }

    foreach (notificationScriptKeys() as $key) {
        $value = Arr::get($dictionary, $key);

        // A plural group (passed to pluralKey()) needs at least its "other" form.
        expect(is_array($value) ? ($value['other'] ?? null) : $value)->toBeString("{$locale}: {$key} is missing");
    }

    foreach (['one', 'few', 'many', 'other'] as $form) {
        expect(Arr::get($dictionary, "notifications.unread_summary.{$form}"))->toContain(':count');
    }

    foreach (range(0, 11) as $month) {
        expect(Arr::get($dictionary, "notifications.date.months.{$month}"))->toBeString();
    }
})->with(['ru', 'uz', 'en']);

test('the header bell keeps the notification strings it renders with', function (string $locale) {
    $dictionary = require lang_path("{$locale}/ui.php");

    foreach (['label', 'new_count', 'read_all', 'all', 'empty', 'type_mention', 'just_now', 'minutes_ago', 'hours_ago'] as $key) {
        expect(Arr::get($dictionary, "notifications.{$key}"))->toBeString("{$locale}: notifications.{$key} is missing");
    }

    foreach (['one', 'few', 'many', 'other'] as $form) {
        expect(Arr::get($dictionary, "notifications.new_count_forms.{$form}"))->toContain(':count');
    }

    // An empty-state title, like its siblings — no closing period.
    expect(Arr::get($dictionary, 'notifications.empty'))->not->toEndWith('.');
})->with(['ru', 'uz', 'en']);

test('chat rows keep the placeholders the row renderer fills', function (string $locale) {
    $dictionary = require lang_path("{$locale}/ui.php");

    foreach (['message_in', 'mention_in'] as $key) {
        expect(Arr::get($dictionary, "notifications.text.{$key}"))->toContain(':name')->toContain(':chat');
    }

    // An attachment-only message ("{sender}: ") reads "<b>Name</b>: Attachment".
    expect(Arr::get($dictionary, 'notifications.text.attachment'))->toBeString()->not->toBeEmpty()->not->toContain(':')
        ->and(Arr::get($dictionary, 'components.showing'))->toContain(':from')->toContain(':to')->toContain(':total');
})->with(['ru', 'uz', 'en']);

test('the popover count reads grammatically for every count in russian', function () {
    $dictionary = require lang_path('ru/ui.php');

    expect(Arr::get($dictionary, 'notifications.new_count_forms.one'))->toBe(':count новое')
        ->and(Arr::get($dictionary, 'notifications.new_count_forms.many'))->toBe(':count новых')
        ->and(Arr::get($dictionary, 'notifications.new_count'))->toBe('Новых: :count');
});
