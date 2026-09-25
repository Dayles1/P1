<?php

use App\Domain\Setting\Models\Setting;
use Illuminate\Testing\TestResponse;

/**
 * One screen of the auth SPA, by its <section data-auth-page="…"> — all
 * seven are rendered on every auth URL, so asserting against the whole
 * document would not say which screen a piece of markup belongs to.
 */
function authScreen(TestResponse $response, string $page): string
{
    preg_match(
        '/<section[^>]*data-auth-page="'.preg_quote($page, '/').'".*?<\/section>/s',
        $response->getContent(),
        $matches,
    );

    return $matches[0] ?? '';
}

beforeEach(function () {
    // Pin the language to the cookie alone, as a guest picking it would.
    Setting::where('key', 'localization.auto_detect_browser_locale')->update(['value' => '0']);
});

test('every auth url renders the one SPA with its own screen already active', function (string $url, string $page) {
    $html = $this->get($url)->assertOk()->getContent();

    expect($html)->toContain('data-current-page="'.$page.'"')
        ->and($html)->toContain('class="auth-page is-active" data-auth-page="'.$page.'"')
        ->and(substr_count($html, 'auth-page is-active'))->toBe(1)
        ->and(substr_count($html, 'data-auth-page="'))->toBe(7);
})->with([
    ['/login', 'login'],
    ['/login/code', 'login-code'],
    ['/register', 'register'],
    ['/forgot-password', 'forgot-password'],
    ['/reset-password/some-token', 'reset-password'],
    ['/verify-email', 'verify-email'],
    ['/confirm-password', 'confirm-password'],
]);

test('the forms keep every hook auth-pages.js relies on', function () {
    $html = $this->get('/login')->assertOk()->getContent();

    foreach ([
        'login', 'login-verify', 'login-code-request', 'login-code-verify', 'register',
        'forgot-password', 'reset-password', 'verify-email-code', 'verification-notification', 'confirm-password',
    ] as $form) {
        expect($html)->toContain('data-auth-form="'.$form.'"');
    }

    foreach ([
        'login-email', 'login-password', 'login-code-email', 'register-name', 'register-email',
        'register-password', 'register-password-confirmation', 'forgot-email', 'reset-email',
        'reset-password', 'reset-password-confirmation', 'verification-email', 'confirm-password-password',
    ] as $id) {
        expect($html)->toContain('id="'.$id.'"');
    }

    expect($html)->toContain('id="auth-spa"')
        ->and($html)->toContain('id="auth-spa-viewport"')
        ->and(substr_count($html, 'data-code-input'))->toBe(3)
        ->and(substr_count($html, 'data-resend-code'))->toBe(2)
        ->and($html)->toContain('data-auth-step="password"')
        ->and($html)->toContain('data-auth-step="request"')
        ->and($html)->toContain('data-back-to-password')
        ->and($html)->toContain('data-back-to-request')
        ->and($html)->toContain('data-auth-link="login-code"')
        ->and($html)->toContain('data-auth-link="register"')
        ->and($html)->toContain('data-auth-link="forgot-password"')
        ->and($html)->toContain('data-auth-link="login"')
        ->and($html)->toContain('data-password-reveal')
        ->and($html)->toContain('data-strength-for="register-password"')
        ->and($html)->toContain('data-strength-for="reset-password"')
        ->and($html)->toContain('data-verify-email-field')
        ->and($html)->toContain('data-auth-email');

    foreach (['email', 'password', 'name', 'password_confirmation', 'code'] as $field) {
        expect($html)->toContain('data-field-error="'.$field.'"');
    }
});

test('the login screen is built from the shared components', function () {
    $login = authScreen($this->get('/login')->assertOk(), 'login');

    expect($login)->toContain('class="field-box"')
        ->and($login)->toContain('<use href="#i-mail">')
        ->and($login)->toContain('<use href="#i-lock">')
        ->and($login)->toContain('class="checkbox"')
        ->and($login)->toContain('name="remember"')
        ->and($login)->toContain('btn btn--primary btn--lg btn--block')
        ->and($login)->toContain('btn btn--outline btn--lg btn--block')
        ->and($login)->toContain('class="auth-divider"')
        ->and($login)->toContain('class="code-input"');
});

test('the auth screens speak the visitor\'s language', function () {
    $ru = $this->withUnencryptedCookie('locale', 'ru')->get('/login')->assertOk()->getContent();

    expect($ru)->toContain('С возвращением')
        ->and($ru)->toContain('Войти по коду из письма')
        ->and($ru)->toContain('Создайте аккаунт')
        ->and($ru)->toContain('Всё рабочее пространство — в одном месте')
        ->and($ru)->not->toContain('Welcome back')
        ->and($ru)->not->toContain('Create your account')
        ->and($ru)->not->toContain('Back to sign in')
        ->and($ru)->not->toContain('Secure workspace');

    $uz = $this->withUnencryptedCookie('locale', 'uz')->get('/register')->assertOk()->getContent();

    expect($uz)->toContain('Xush kelibsiz')
        ->and($uz)->toContain('Hisob yarating')
        ->and($uz)->toContain('Parolni unutdingizmi?');

    $en = $this->withUnencryptedCookie('locale', 'en')->get('/forgot-password')->assertOk()->getContent();

    expect($en)->toContain('Welcome back')
        ->and($en)->toContain('Forgot your password?');
});

test('the frame carries the brand, the language switch and the theme picker', function () {
    $html = $this->withUnencryptedCookie('locale', 'ru')->get('/login')->assertOk()->getContent();

    expect($html)->toContain('class="auth-showcase"')
        ->and($html)->toContain('data-theme-picker-trigger')
        ->and($html)->toContain('data-locale-option="ru"')
        ->and($html)->toContain('data-locale-option="uz"')
        ->and($html)->toContain('data-locale-option="en"')
        ->and($html)->toMatch('/aria-pressed="true"\s+data-locale-option="ru"/')
        ->and($html)->toMatch('/aria-pressed="false"\s+data-locale-option="en"/')
        ->and($html)->toContain('<use href="#i-chat">')
        ->and($html)->toContain('<use href="#i-globe">');
});

test('a reset link that carries the address names it instead of asking for it', function () {
    $withEmail = authScreen($this->get('/reset-password/some-token?email=aziza@example.com')->assertOk(), 'reset-password');

    expect($withEmail)->toContain('type="hidden" name="email" value="aziza@example.com"')
        ->and($withEmail)->toContain('<strong class="auth-card__email" data-auth-email>aziza@example.com</strong>')
        ->and($withEmail)->toContain('data-field-error="email"')
        ->and($withEmail)->not->toContain('type="email"');

    $withoutEmail = authScreen($this->get('/reset-password/some-token')->assertOk(), 'reset-password');

    expect($withoutEmail)->toContain('type="email"')
        ->and($withoutEmail)->toContain('id="reset-email"')
        ->and($withoutEmail)->not->toContain('type="hidden" name="email"');
});

test('the address from the reset link is escaped', function () {
    $html = $this->get('/reset-password/some-token?email='.urlencode('<b>x</b>@example.com'))->assertOk()->getContent();

    expect($html)->not->toContain('<b>x</b>')
        ->and($html)->toContain('&lt;b&gt;x&lt;/b&gt;@example.com');
});

test('each screen carries the tab title auth-pages.js shows when switching to it', function () {
    $html = $this->withUnencryptedCookie('locale', 'ru')->get('/login')->assertOk()->getContent();
    $appName = config('app.name');

    expect($html)->toMatch('/data-auth-page="login"\s+data-auth-title="С возвращением · '.preg_quote($appName, '/').'"/u')
        ->and($html)->toContain('data-auth-title="Создайте аккаунт · '.$appName.'"')
        ->and($html)->toContain('data-auth-title="Новый пароль · '.$appName.'"')
        ->and(substr_count($html, 'data-auth-title="'))->toBe(7);
});

test('every auth field is announced as required without drawing an asterisk', function () {
    $html = $this->get('/login')->assertOk()->getContent();

    foreach ([
        'login-email', 'login-password', 'login-code-email', 'register-name', 'register-email',
        'register-password', 'register-password-confirmation', 'forgot-email', 'reset-email',
        'reset-password', 'reset-password-confirmation', 'verification-email', 'confirm-password-password',
    ] as $id) {
        expect($html)->toMatch('/<input[^>]*id="'.$id.'"[^>]*aria-required="true"/s');
    }

    expect($html)->not->toContain('field-label__required');
});

test('every auth field, passwords included, is described by its own error message', function () {
    $html = $this->get('/login')->assertOk()->getContent();

    foreach ([
        'login-email', 'login-password', 'login-code-email', 'register-name', 'register-email',
        'register-password', 'register-password-confirmation', 'forgot-email', 'reset-email',
        'reset-password', 'reset-password-confirmation', 'verification-email', 'confirm-password-password',
    ] as $id) {
        expect($html)->toMatch('/<input[^>]*id="'.$id.'"[^>]*aria-describedby="'.$id.'-error"/s')
            ->and($html)->toMatch('/<span class="field-error"\s+id="'.$id.'-error"\s+data-field-error="[a-z_]+">/');
    }
});

test('the code boxes are one labelled group tied to their error message', function () {
    $response = $this->get('/login')->assertOk();

    foreach ([
        ['login', 'login-verify', 'login-verify-text login-verify-code-error'],
        ['login-code', 'login-code-verify', 'login-code-verify-text login-code-verify-code-error'],
        ['verify-email', 'verify-email', 'verify-email-code-error'],
    ] as [$page, $prefix, $describedBy]) {
        $screen = authScreen($response, $page);

        expect($screen)->toContain('id="'.$prefix.'-title"')
            ->and($screen)->toMatch('/class="code-input"[^>]*role="group"[^>]*aria-labelledby="'.$prefix.'-title"[^>]*aria-describedby="'.$describedBy.'"/s')
            ->and($screen)->toContain('<span class="field-error" id="'.$prefix.'-code-error" role="alert" data-field-error="code"></span>');
    }

    expect($response->getContent())->toContain('data-auth-form="verification-notification" data-auth-banners-in="verify-email-code"');
});

test('the frame puts the page heading first and names the language buttons by their text', function () {
    $html = $this->withUnencryptedCookie('locale', 'ru')->get('/login')->assertOk()->getContent();

    expect($html)->toContain('<p class="auth-showcase__title">Всё рабочее пространство — в одном месте</p>')
        ->and($html)->not->toContain('<h2');

    preg_match_all('/<button[^>]*data-locale-option="[a-z]+"[^>]*>/s', $html, $buttons);

    expect($buttons[0])->toHaveCount(3);

    foreach ($buttons[0] as $button) {
        expect($button)->not->toContain('aria-label')
            ->and($button)->toContain('title="');
    }
});

test('the verify screen describes the e-mail button instead of naming one', function () {
    $verify = authScreen($this->withUnencryptedCookie('locale', 'en')->get('/verify-email')->assertOk(), 'verify-email');

    expect($verify)->toContain('click the confirmation button in it')
        ->and($verify)->not->toContain('“Confirm”');
});

test('auth markup carries no inline styles', function (string $url) {
    expect($this->get($url)->assertOk()->getContent())->not->toContain('style="');
})->with(['/login', '/register', '/reset-password/some-token?email=aziza@example.com', '/verify-email']);

test('every ?redirect= the auth pages follow goes through sanitizeRedirect', function () {
    $script = file_get_contents(resource_path('js/blade/auth/auth-pages.js'));

    // A raw `location.href = params.get('redirect') …` is an open
    // redirect (and a javascript: URL would run script).
    expect($script)->not->toMatch('/location\.href\s*=\s*params\.get\(\s*[\'"]redirect/')
        ->and(substr_count($script, "sanitizeRedirect(\n"))->toBeGreaterThanOrEqual(3)
        ->and($script)->toContain('url.origin !== window.location.origin');
});
