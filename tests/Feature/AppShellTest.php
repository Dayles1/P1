<?php

use Illuminate\Testing\TestResponse;

/**
 * One region of the authenticated shell, by its opening tag's marker —
 * the shell is rendered on every app page, so asserting against the whole
 * document would not say which part a link actually lives in.
 */
function shellRegion(TestResponse $response, string $pattern): string
{
    preg_match($pattern, $response->getContent(), $matches);

    return $matches[0] ?? '';
}

function shellSidebar(TestResponse $response): string
{
    return shellRegion($response, '/<aside class="app-sidebar".*?<\/aside>/s');
}

function shellHeader(TestResponse $response): string
{
    return shellRegion($response, '/<header class="app-header".*?<\/header>/s');
}

function shellTabbar(TestResponse $response): string
{
    return shellRegion($response, '/<nav class="app-tabbar".*?<\/nav>/s');
}

test('the sidebar holds search and the product sections, with the inbox', function () {
    $sidebar = shellSidebar($this->get('/dashboard')->assertOk());

    expect(substr_count($sidebar, 'data-nav-link="sidebar-link"'))->toBe(5)
        ->and($sidebar)->toContain('data-command-palette-trigger')
        ->and($sidebar)->toContain('href="'.route('dashboard').'"')
        ->and($sidebar)->toContain('href="'.route('profile').'"')
        ->and($sidebar)->toContain('href="'.route('chat').'"')
        ->and($sidebar)->toContain('href="'.route('notifications').'"')
        ->and($sidebar)->toContain('href="'.route('currencies').'"')
        ->and($sidebar)->toContain('data-sidebar-pinned')
        ->and($sidebar)->not->toContain(route('settings'))
        ->and($sidebar)->not->toContain(route('sessions'))
        ->and($sidebar)->not->toContain('/admin/')
        ->and($sidebar)->not->toContain('data-logout');
});

test('everything personal lives in the account menu, with sign-out last', function () {
    $header = shellHeader($this->get('/dashboard')->assertOk());

    expect($header)->toContain('href="'.route('settings.profile').'"')
        ->and($header)->toContain('href="'.route('sessions').'"')
        ->and($header)->toContain('href="'.route('notifications').'"')
        ->and($header)->toContain('href="'.route('changelog').'"')
        ->and($header)->toContain('data-theme-set="light"')
        ->and($header)->toContain('data-theme-set="dark"')
        ->and($header)->toContain('data-theme-set="auto"')
        ->and($header)->toContain('data-locale-option="ru"')
        ->and($header)->toContain('data-locale-option="uz"')
        ->and($header)->toContain('data-locale-option="en"');

    $lastItem = strrpos($header, 'class="menu-item');

    expect(substr($header, $lastItem))->toContain('data-logout');
});

test('administration is in the account menu but hidden until the role check', function () {
    $header = shellHeader($this->get('/dashboard')->assertOk());

    preg_match('/<a\s+href="'.preg_quote(route('admin.users'), '/').'"[^>]*>/s', $header, $link);

    expect($link[0] ?? '')->toContain('data-requires-role="SUPER_ADMIN,ADMIN"')
        ->and($link[0] ?? '')->toContain('hidden');
});

test('the header offers search, create and notifications', function () {
    $header = shellHeader($this->get('/dashboard')->assertOk());

    expect($header)->toContain('data-command-palette-trigger')
        ->and($header)->toContain('data-create="private"')
        ->and($header)->toContain('data-create="group"')
        ->and($header)->toContain('data-notif-dropdown')
        ->and($header)->toContain('data-notif-mark-all');
});

test('the phone tab bar links home, chat, profile and notifications', function () {
    $tabbar = shellTabbar($this->get('/dashboard')->assertOk());

    expect(substr_count($tabbar, 'class="app-tabbar__link"'))->toBe(4)
        ->and($tabbar)->toContain('href="'.route('dashboard').'"')
        ->and($tabbar)->toContain('href="'.route('chat').'"')
        ->and($tabbar)->toContain('href="'.route('profile').'"')
        ->and($tabbar)->toContain('href="'.route('notifications').'"');
});

test('the permanent shell parts keep their Turbo markers and the page layout config', function () {
    $html = $this->get('/chat')->assertOk()->getContent();

    expect($html)->toContain('<aside class="app-sidebar" id="app-sidebar" data-turbo-permanent>')
        ->and($html)->toContain('<header class="app-header" id="app-header" data-turbo-permanent>')
        ->and($html)->toContain('id="app-tabbar" data-turbo-permanent')
        ->and($html)->toContain('<script type="application/json" id="page-layout-config">{"sidebar":"default"');
});

test('the shell uses sprite icons, not glyphs', function () {
    $html = $this->get('/dashboard')->assertOk()->getContent();

    expect($html)->toContain('<symbol id="i-home"')
        ->and(shellSidebar($this->get('/dashboard')))->toContain('<use href="#i-home">')
        ->and(shellHeader($this->get('/dashboard')))->not->toMatch('/[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/u');
});

test('the notification popover is a labelled dialog, not a menu', function () {
    $header = shellHeader($this->get('/dashboard')->assertOk());

    preg_match('/<div[^>]*class="dropdown__menu[^"]*notif-popover[^"]*"[^>]*>/s', $header, $panel);

    expect($panel[0] ?? '')->toContain('role="dialog"')
        ->and($panel[0] ?? '')->toContain('aria-label="'.__('ui.notifications.label').'"');
});
