<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Reactions
    |--------------------------------------------------------------------------
    |
    | The only emoji a message can be reacted with (Telegram's default set).
    |
    */
    'reactions' => [
        '👍', '👎', '❤️', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😱', '🤬', '😢',
        '🎉', '🤩', '🤮', '💩', '🙏', '👌', '🕊', '🤡', '🥱', '🥴', '😍', '🐳',
        '❤️‍🔥', '🌚', '🌭', '💯', '🤣', '⚡', '🍌', '🏆', '💔', '🤨', '😐', '🍓',
        '🍾', '💋', '🖕', '😈', '😴', '😭', '🤓', '👻', '👨‍💻', '👀', '🎃', '🙈',
        '😇', '😨', '🤝', '✍️', '🤗', '🫡', '🎅', '🎄', '☃️', '💅', '🤪', '🗿',
        '🆒', '💘', '🙉', '🦄', '😘', '💊', '🙊', '😎', '👾', '🤷‍♂️', '🤷', '🤷‍♀️',
        '😡', '😂', '😮',
    ],

    /*
    |--------------------------------------------------------------------------
    | Uploads that are never accepted
    |--------------------------------------------------------------------------
    |
    | Files that a browser would run as active content when opened from the
    | app's own origin. Rejected whatever the admin's allowed-extension list
    | says.
    |
    */
    'blocked_extensions' => [
        'svg', 'svgz', 'html', 'htm', 'xhtml', 'xht', 'xml', 'js', 'mjs', 'php',
        'phtml', 'phar', 'exe', 'bat', 'cmd', 'sh',
    ],

    'blocked_mime_types' => [
        'image/svg+xml',
        'text/html',
        'application/xhtml+xml',
        'text/xml',
        'application/xml',
        'application/javascript',
        'text/javascript',
        'application/x-httpd-php',
        'text/x-php',
        'application/x-php',
        'application/x-msdownload',
        'application/x-dosexec',
        'application/x-sh',
        'text/x-shellscript',
    ],

    /*
    |--------------------------------------------------------------------------
    | Rate limits (requests per minute, per user)
    |--------------------------------------------------------------------------
    */
    'rate_limits' => [
        'send' => (int) env('CHAT_RATE_LIMIT_SEND', 60),
        'typing' => (int) env('CHAT_RATE_LIMIT_TYPING', 60),
        'reactions' => (int) env('CHAT_RATE_LIMIT_REACTIONS', 120),
        'search' => (int) env('CHAT_RATE_LIMIT_SEARCH', 60),
    ],

    /*
    |--------------------------------------------------------------------------
    | Limits
    |--------------------------------------------------------------------------
    */
    'max_pinned_conversations' => 10,

    /*
    |--------------------------------------------------------------------------
    | Link previews
    |--------------------------------------------------------------------------
    |
    | Fetched after the response is sent, from public http(s) addresses only.
    |
    */
    'link_previews' => [
        'enabled' => (bool) env('CHAT_LINK_PREVIEWS', true),
        'timeout' => 3,
        'max_bytes' => 512 * 1024,
    ],
];
