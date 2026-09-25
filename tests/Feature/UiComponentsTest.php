<?php

use App\View\Components\Blade\UI\Avatar;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\MessageBag;
use Illuminate\Support\ViewErrorBag;

function renderBlade(string $template, array $data = []): string
{
    return Blade::render($template, $data);
}

test('a plain input is a bare .field-input, an adorned one sits in a .field-box', function () {
    $plain = renderBlade('<x-blade.u-i.input name="email" label="Email" />');
    $boxed = renderBlade('<x-blade.u-i.input name="q" icon="search" clearable />');

    expect($plain)->toContain('class="field-input"')
        ->and($plain)->not->toContain('field-box')
        ->and($plain)->toContain('data-field-error="email"')
        ->and($boxed)->toContain('class="field-box"')
        ->and($boxed)->toContain('class="field-box__input"')
        ->and($boxed)->toContain('<use href="#i-search">')
        ->and($boxed)->toContain('data-field-clear');
});

test('a server-side error marks the input invalid and fills its error slot', function () {
    $errors = (new ViewErrorBag)->put('default', new MessageBag(['email' => ['Enter a valid email']]));

    // As in a real request, where ShareErrorsFromSession shares the bag.
    view()->share('errors', $errors);

    $html = renderBlade('<x-blade.u-i.input name="email" label="Email" />');

    expect($html)->toContain('aria-invalid="true"')
        ->and($html)->toContain('Enter a valid email')
        ->and($html)->toContain('<use href="#i-alert">');
});

test('fields render without an error bag (outside an HTTP request)', function () {
    expect(renderBlade('<x-blade.u-i.textarea name="bio" :max="500" />'))->toContain('data-char-counter')
        ->and(renderBlade('<x-blade.u-i.select name="role" :options="[\'a\' => \'A\']" />'))->toContain('field-select')
        ->and(renderBlade('<x-blade.u-i.password-input strength />'))->toContain('data-strength-for');
});

test('a required field marks its label', function () {
    expect(renderBlade('<x-blade.u-i.input name="title" label="Title" required />'))
        ->toContain('class="field-label__required"')
        ->toContain(' required');
});

test('the textarea counter starts from the current length', function () {
    $html = renderBlade('<x-blade.u-i.textarea name="bio" :max="500" value="Hello" />');

    expect($html)->toContain('maxlength="500"')
        ->and($html)->toContain(__('ui.components.char_count', ['count' => 5, 'max' => 500]));
});

test('avatar initials are multibyte-safe and the hue is stable per name', function () {
    expect(Avatar::initialsFor('Алишер Каримов'))->toBe('АК')
        ->and(Avatar::initialsFor('dilnoza'))->toBe('D')
        ->and(Avatar::initialsFor(''))->toBe('?')
        ->and(Avatar::hueFor('Мария Ким'))->toBe(Avatar::hueFor('Мария Ким'))
        ->and(Avatar::HUES)->toContain(Avatar::hueFor('Мария Ким'));

    $html = renderBlade('<x-blade.u-i.avatar name="Мария Ким" status="online" />');

    expect($html)->toContain('avatar--hue-'.Avatar::hueFor('Мария Ким'))
        ->and($html)->toContain('avatar__status--online');
});

test('an avatar group shows the first few and counts the rest', function () {
    $people = [['name' => 'A B'], ['name' => 'C D'], ['name' => 'E F'], ['name' => 'G H'], ['name' => 'I J']];

    $html = renderBlade('<x-blade.u-i.avatar-group :people="$people" :max="3" />', ['people' => $people]);

    expect(substr_count($html, 'class="avatar__initials"'))->toBe(3)
        ->and($html)->toContain('+2');
});

test('a checkbox can start indeterminate and carry a hint', function () {
    $html = renderBlade('<x-blade.u-i.checkbox name="all" indeterminate hint="Some selected">All</x-blade.u-i.checkbox>');

    expect($html)->toContain('data-indeterminate')
        ->and($html)->toContain('aria-checked="mixed"')
        ->and($html)->toContain('class="checkbox__hint"');
});

test('badges are sentence-case chips and "muted" still means neutral', function () {
    expect(renderBlade('<x-blade.u-i.badge variant="success">Active</x-blade.u-i.badge>'))->toContain('class="badge badge--success"')
        ->and(renderBlade('<x-blade.u-i.badge variant="muted">x</x-blade.u-i.badge>'))->toContain('class="badge"')
        ->and(renderBlade('<x-blade.u-i.badge variant="nope">x</x-blade.u-i.badge>'))->toContain('class="badge"');
});

test('an icon-only button gets an accessible name, a loading one is busy', function () {
    $iconOnly = renderBlade('<x-blade.u-i.button variant="ghost" icon="more" label="More" />');
    $loading = renderBlade('<x-blade.u-i.button :loading="true">Saving</x-blade.u-i.button>');

    expect($iconOnly)->toContain('btn--icon')
        ->and($iconOnly)->toContain('aria-label="More"')
        ->and($loading)->toContain('aria-busy="true"')
        ->and($loading)->toContain('class="spinner"');
});

test('date inputs post ISO values from hidden fields', function () {
    $single = renderBlade('<x-blade.u-i.date-input name="birthday" value="2026-09-23" />');
    $range = renderBlade('<x-blade.u-i.date-input range name-from="from" name-to="to" from="2026-09-14" to="2026-09-20" presets />');

    expect($single)->toContain('data-date-picker')
        ->and($single)->toContain('data-mode="single"')
        ->and($single)->toMatch('/name="birthday"\s+value="2026-09-23" data-date-value/')
        ->and($range)->toContain('data-mode="range"')
        ->and($range)->toContain('data-presets')
        ->and($range)->toContain('name="from" value="2026-09-14" data-date-from')
        ->and($range)->toContain('name="to" value="2026-09-20" data-date-to');
});

test('tabs mark the selected one and wire panels by id', function () {
    $tabs = [['id' => 'profile', 'label' => 'Profile'], ['id' => 'sessions', 'label' => 'Sessions', 'count' => 4]];

    $html = renderBlade('<x-blade.u-i.tabs id="account" :tabs="$tabs" selected="sessions" />', ['tabs' => $tabs]);

    expect($html)->toContain('aria-controls="account-sessions"')
        ->and(substr_count($html, 'aria-selected="true"'))->toBe(1)
        ->and($html)->toMatch('/aria-controls="account-sessions"\s+aria-selected="true"/');
});

test('the stepper marks done steps with a check and the current one', function () {
    $html = renderBlade('<x-blade.u-i.stepper :steps="[\'One\', \'Two\', \'Three\']" :current="1" />');

    expect(substr_count($html, 'stepper__step--done'))->toBe(1)
        ->and($html)->toContain('aria-current="step"')
        ->and($html)->toContain('<use href="#i-check">');
});

test('progress uses a native progress element and the ring computes its arc', function () {
    expect(renderBlade('<x-blade.u-i.progress :value="64" label="Upload" />'))
        ->toContain('<progress class="progress__bar" value="64" max="100"');

    $ring = renderBlade('<x-blade.u-i.progress-ring :value="50" />');
    $circumference = round(2 * M_PI * 30, 2);

    expect($ring)->toContain('stroke-dasharray="'.$circumference.'"')
        ->and($ring)->toContain('stroke-dashoffset="'.round($circumference / 2, 2).'"');
});

test('the code input renders translated digit labels', function () {
    $html = renderBlade('<x-blade.u-i.code-input name="code" />');

    expect(substr_count($html, 'data-code-box'))->toBe(6)
        ->and($html)->toContain(__('ui.components.digit', ['n' => 1]))
        ->and($html)->toContain('name="code" data-code-value');
});

test('an alert with a title keeps the slot as secondary text', function () {
    $html = renderBlade('<x-blade.feedback.alert type="success" title="Saved">Applied right away</x-blade.feedback.alert>');

    expect($html)->toContain('class="alert__title"')
        ->and($html)->toContain('class="alert__text"')
        ->and($html)->toContain('role="status"');
});

test('no component writes inline styles', function (string $template) {
    expect(renderBlade($template))->not->toContain('style=');
})->with([
    '<x-blade.u-i.input name="a" icon="search" clearable copyable success loading prefix="x" suffix="y" />',
    '<x-blade.u-i.textarea name="a" :max="10" hint="h" />',
    '<x-blade.u-i.select name="a" :options="[1 => \'x\']" placeholder="p" />',
    '<x-blade.u-i.checkbox>x</x-blade.u-i.checkbox>',
    '<x-blade.u-i.radio name="a" value="1">x</x-blade.u-i.radio>',
    '<x-blade.u-i.switch name="a">x</x-blade.u-i.switch>',
    '<x-blade.u-i.segmented name="a" :options="[\'d\' => \'Day\']" selected="d" />',
    '<x-blade.u-i.chip pressed :count="3">x</x-blade.u-i.chip>',
    '<x-blade.u-i.password-input strength />',
    '<x-blade.u-i.number-input name="a" :value="1" />',
    '<x-blade.u-i.money-input :currencies="[\'UZS\' => \'UZS\']" />',
    '<x-blade.u-i.phone-input :countries="[\'UZ\' => \'UZ +998\']" />',
    '<x-blade.u-i.code-input />',
    '<x-blade.u-i.date-input name="d" />',
    '<x-blade.u-i.date-input range presets />',
    '<x-blade.u-i.time-input name="t" value="07:00" />',
    '<x-blade.u-i.dropzone multiple :max-size="1024" hint="h" />',
    '<x-blade.u-i.file-row name="a.pdf" status="uploading" :progress="40" />',
    '<x-blade.u-i.avatar name="A B" status="busy" />',
    '<x-blade.u-i.badge>x</x-blade.u-i.badge>',
    '<x-blade.u-i.button icon="plus">x</x-blade.u-i.button>',
    '<x-blade.u-i.tabs :tabs="[[\'id\' => \'a\', \'label\' => \'A\', \'href\' => \'/a\']]" selected="a" />',
    '<x-blade.u-i.stepper :steps="[\'a\', \'b\']" :current="1" />',
    '<x-blade.u-i.empty-state icon="search" hint="h" />',
    '<x-blade.u-i.error-state hint="h" />',
    '<x-blade.u-i.skeleton type="list" />',
    '<x-blade.u-i.progress :value="1" />',
    '<x-blade.u-i.progress-ring :value="1" />',
    '<x-blade.u-i.spinner size="lg" />',
    '<x-blade.u-i.accordion :items="[[\'title\' => \'q\', \'body\' => \'a\', \'open\' => true]]" />',
    '<x-blade.u-i.status state="online">x</x-blade.u-i.status>',
    '<x-blade.feedback.alert type="warning" title="t">x</x-blade.feedback.alert>',
]);

test('a password input is described by its hint and error slot', function () {
    $html = renderBlade('<x-blade.u-i.password-input id="pw" name="password" hint="At least 8 characters" />');

    expect($html)->toContain('aria-describedby="pw-hint pw-error"')
        ->and($html)->toContain('id="pw-error"');
});

test('an explicit aria-describedby on a password input wins over the default', function () {
    $html = renderBlade('<x-blade.u-i.password-input id="pw" name="password" aria-describedby="custom" />');

    expect($html)->toContain('aria-describedby="custom"')
        ->and($html)->not->toContain('aria-describedby="pw-error"');
});

test('a dropdown can present its panel as a dialog', function () {
    $html = renderBlade('<x-blade.u-i.dropdown menu-role="dialog" label="Notifications"><x-slot:trigger>x</x-slot:trigger> body</x-blade.u-i.dropdown>');

    expect($html)->toContain('role="dialog"')
        ->and($html)->toContain('aria-haspopup="dialog"')
        ->and($html)->toMatch('/role="dialog"\s+aria-label="Notifications"/')
        ->and(renderBlade('<x-blade.u-i.dropdown><x-slot:trigger>x</x-slot:trigger> y</x-blade.u-i.dropdown>'))
        ->toContain('role="menu"');
});
