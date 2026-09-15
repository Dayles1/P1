<?php

/**
 * Simple versioned release notes — no database table for this, it's
 * static content maintained alongside the code that shipped it.
 * Newest first. Each entry's `items` map a change to a short type used
 * only to pick an icon in the UI (new|improved|fixed).
 */
return [
    [
        'version' => '2.0.0',
        'date' => '2026-09-15',
        'items' => [
            ['type' => 'new', 'text' => 'A real theme system — 20 palettes with a live preview picker, applied everywhere including before you sign in.'],
            ['type' => 'new', 'text' => 'Settings is now a full mini-app: General, Appearance, Localization, Notifications, Authentication, Security, System, and Developer sections.'],
            ['type' => 'new', 'text' => 'A real notification system: database notifications, a header bell, a Notification Center, and browser push.'],
            ['type' => 'new', 'text' => 'Chat rebuilt as a realtime 3-pane app: reply, edit, delete, reactions, typing indicators, read receipts, attachments, pinned messages, mentions, and full-text search — all live via WebSockets.'],
            ['type' => 'new', 'text' => 'Online/last-seen presence across the app.'],
            ['type' => 'improved', 'text' => 'The dashboard now surfaces recent conversations and unread notifications alongside sessions and request history.'],
            ['type' => 'improved', 'text' => 'Toasts moved to the top-right; destructive actions now show a loading state instead of closing instantly.'],
            ['type' => 'fixed', 'text' => 'Language switching now works everywhere, including before you sign in.'],
            ['type' => 'fixed', 'text' => 'The dashboard no longer flashes a generic heading before your name loads.'],
        ],
    ],
    [
        'version' => '1.5.0',
        'date' => '2026-09-14',
        'items' => [
            ['type' => 'new', 'text' => 'Per-request request logging, visible in Sessions and Admin.'],
            ['type' => 'new', 'text' => 'Full session and admin management.'],
            ['type' => 'improved', 'text' => 'Internationalization (English, Russian, Oʻzbek) across the app.'],
            ['type' => 'improved', 'text' => 'A refreshed dashboard and chat UI.'],
        ],
    ],
];
