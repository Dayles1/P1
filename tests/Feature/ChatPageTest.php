<?php

use Illuminate\Support\Arr;

test('the chat page has the People tab next to the chat filters', function () {
    $html = $this->get('/chat')->assertOk()->getContent();

    foreach (['all', 'private', 'group', 'people'] as $type) {
        expect($html)->toContain("data-chat-type=\"{$type}\"");
    }

    expect($html)->toContain('data-chat-people');
});

test('the chat page renders the hooks for pins, typing, voice and the info pane', function () {
    $html = $this->get('/chat/7')->assertOk()->getContent();

    expect($html)->toContain('data-chat-pinned-segments')
        ->and($html)->toContain('data-chat-pinned-list')
        ->and($html)->toContain('data-chat-typing-text')
        ->and($html)->toContain('data-chat-mic')
        ->and($html)->toContain('data-chat-recording')
        ->and($html)->toContain('data-chat-details-title')
        ->and($html)->toContain('data-chat-open-info');
});

test('every string the chat script asks for exists in every locale', function (string $locale) {
    $dictionary = require lang_path("{$locale}/ui.php");
    $script = file_get_contents(resource_path('js/blade/app/chat.js'));

    preg_match_all("/\bt\(\s*'((?:chat|common)\.[a-z0-9_.]+)'/", $script, $keys);

    expect($keys[1])->not->toBeEmpty();

    foreach (array_unique($keys[1]) as $key) {
        expect(Arr::has($dictionary, $key))->toBeTrue("{$locale}: {$key} is missing");
    }
})->with(['ru', 'uz', 'en']);

test('the chat page renders the jump buttons, the selection bar, the blocked banner and the header menu', function () {
    $html = $this->get('/chat/7')->assertOk()->getContent();

    expect($html)->toContain('data-chat-jump-top')
        ->and($html)->toContain('data-chat-scroll-bottom')
        ->and($html)->toContain('data-chat-select-bar')
        ->and($html)->toContain('data-chat-select-action="forward"')
        ->and($html)->toContain('data-chat-select-action="delete"')
        ->and($html)->toContain('data-chat-blocked')
        ->and($html)->toContain('data-chat-unblock')
        ->and($html)->toContain('data-chat-header-menu')
        ->and($html)->toContain('data-open-saved')
        ->and($html)->toContain('data-open-archive')
        ->and($html)->toContain('role="log"');
});

test('every string the chat modules ask for exists in every locale', function (string $locale) {
    $dictionary = require lang_path("{$locale}/ui.php");
    $sources = [resource_path('js/blade/shared/sidebar.js'), ...glob(resource_path('js/blade/app/chat/*.js'))];
    $keys = [];

    foreach ($sources as $source) {
        preg_match_all("/\b(?:t|tChoice|label)\(\s*'((?:chat|common)\.[a-z0-9_.]+)'/", file_get_contents($source), $found);
        $keys = [...$keys, ...$found[1]];
    }

    // Keys built at runtime: service messages, typing kinds, mute periods, types.
    foreach (['group_created', 'members_added', 'member_removed', 'member_left', 'member_joined', 'title_changed', 'description_changed', 'avatar_changed', 'avatar_removed', 'message_pinned', 'ownership_transferred'] as $event) {
        $keys[] = "chat.system.{$event}";
    }

    foreach (['typing', 'recording', 'uploading'] as $kind) {
        $keys[] = "chat.typing_kind.{$kind}";
        $keys[] = "chat.typing_kind.{$kind}_named";
    }

    foreach (['1h', '8h', '1d', '3d', 'forever'] as $period) {
        $keys[] = "chat.list_menu.mute_{$period}";
    }

    foreach (['text', 'system', 'poll'] as $type) {
        $keys[] = "chat.msg_info.type_{$type}";
    }

    foreach (['private', 'group', 'channel', 'saved'] as $type) {
        $keys[] = "chat.conv_info.type_{$type}";
    }

    foreach (['messages', 'media', 'files', 'voice', 'links'] as $stat) {
        $keys[] = "chat.conv_info.stat_{$stat}";
    }

    foreach (['creator', 'admin', 'member'] as $role) {
        $keys[] = "chat.group.role_{$role}";
    }

    expect($keys)->not->toBeEmpty();

    foreach (array_unique($keys) as $key) {
        expect(Arr::has($dictionary, $key))->toBeTrue("{$locale}: {$key} is missing");
    }
})->with(['ru', 'uz', 'en']);

test('the chat icons the frontend needs are in the sprite', function () {
    $sprite = file_get_contents(resource_path('svg/icons.svg'));

    foreach (['download', 'forward', 'archive', 'bell-off', 'poll', 'check-circle', 'flag', 'info', 'arrow-up', 'arrow-down', 'bookmark', 'video'] as $name) {
        expect($sprite)->toContain("id=\"i-{$name}\"");
    }
});

test('the chat script subscribes to the user channel only, never to per-conversation channels', function () {
    $script = file_get_contents(resource_path('js/blade/app/chat.js'));

    expect($script)->toContain('App.Models.User.')
        ->and($script)->not->toContain('`conversation.${');
});
