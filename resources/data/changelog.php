<?php

/**
 * Simple versioned release notes — no database table for this, it's
 * static content maintained alongside the code that shipped it.
 * Newest first. Each entry's `items` map a change to a short type used
 * only to pick an icon in the UI (new|improved|fixed).
 */
return [
    [
        'version' => '3.0.0',
        'date' => '2026-09-25',
        'items' => [
            ['type' => 'new', 'text' => 'A brand-new design: the Onest typeface, an SVG icon set, and a single token-based design system replacing the old palettes.'],
            ['type' => 'new', 'text' => 'Themes are now Auto, Light and Dark with six accent colours; your choice is saved to your account and applied before the page paints.'],
            ['type' => 'new', 'text' => 'A new app shell: a sidebar for product sections, a header with search and a command palette (Ctrl K), a Create menu, a notification popover and an account menu, plus a tab bar on phones.'],
            ['type' => 'new', 'text' => 'A shared component library: buttons, fields, password strength, OTP, money and phone inputs, date and time pickers, file uploads, avatars, badges, toasts, modals, tabs, pagination, empty states and skeletons.'],
            ['type' => 'improved', 'text' => 'Sign-in, registration, password reset, email verification and password confirmation rebuilt on the new design.'],
            ['type' => 'improved', 'text' => 'The dashboard shows your profile completeness, stats, recent chats and requests, quick actions and your sessions.'],
            ['type' => 'improved', 'text' => 'Notifications are grouped by day with type filters, and the header popover uses the same rows.'],
            ['type' => 'improved', 'text' => 'Russian text now uses the Cyrillic Onest font, and dates and numbers read correctly in Oʻzbek.'],
            ['type' => 'fixed', 'text' => 'A server error no longer signs you out: only an expired or revoked session does.'],
            ['type' => 'fixed', 'text' => 'Your profile and /auth/me no longer fail when no timezone or currency is set.'],
            ['type' => 'fixed', 'text' => 'Paginated lists no longer show a broken “from–to of total” line.'],
            ['type' => 'fixed', 'text' => 'The redirect after confirming your password can only point back into the app.'],
        ],
    ],
    [
        'version' => '2.2.0',
        'date' => '2026-09-19',
        'items' => [
            ['type' => 'new', 'text' => 'Currencies: pick the currency you read prices in, and keep a shortlist of favourites.'],
            ['type' => 'new', 'text' => 'Daily exchange rates are synced automatically, and past rates are kept for conversion.'],
            ['type' => 'new', 'text' => 'Prices keep the amount and currency their owner set, converted for everyone else at the current rate.'],
            ['type' => 'new', 'text' => 'Administrators choose the app currency under Application → Localization.'],
            ['type' => 'improved', 'text' => 'Every settings section has its own link, and back/forward work as expected.'],
            ['type' => 'improved', 'text' => 'Personal settings and application settings each show only their own sections.'],
            ['type' => 'fixed', 'text' => 'Pages no longer boot twice on a full reload, so a single click no longer saves twice.'],
        ],
    ],
    [
        'version' => '2.1.0',
        'date' => '2026-09-17',
        'items' => [
            ['type' => 'new', 'text' => 'The app shell stays in place while you move between pages, with realtime chat and notifications throughout.'],
            ['type' => 'new', 'text' => 'Settings split into Personal and Application groups; Application is visible to administrators only.'],
            ['type' => 'new', 'text' => 'A searchable timezone picker and readable labels for every setting.'],
            ['type' => 'new', 'text' => 'An option to require a verification code on every sign-in.'],
            ['type' => 'improved', 'text' => 'Reading a message in chat also marks its notification as read, live in every open tab.'],
            ['type' => 'improved', 'text' => 'Site name, fallback language and the system timezone settings now take effect.'],
            ['type' => 'fixed', 'text' => 'Email verification by code after registration works again.'],
            ['type' => 'fixed', 'text' => 'Resending a sign-in code no longer fails with a server error.'],
            ['type' => 'fixed', 'text' => 'Required settings no longer reject valid values, and empty ones are caught before saving.'],
            ['type' => 'fixed', 'text' => 'The active sidebar link and role-only sections now update after every navigation.'],
            ['type' => 'fixed', 'text' => 'The developer panel no longer disappears after the first page change.'],
        ],
    ],
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
