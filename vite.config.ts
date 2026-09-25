import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                // Auth Blade
                'resources/css/blade/auth/auth.css',
                'resources/css/blade/auth/auth-pages.css',
                'resources/js/blade/auth/auth.js',
                'resources/js/blade/auth/auth-pages.js',

                // App Blade
                'resources/css/blade/app/app.css',
                'resources/js/blade/app/app.js',
                'resources/js/blade/app/authenticated.js',
                'resources/js/blade/app/sessions.js',
                'resources/js/blade/app/session-detail.js',
                'resources/js/blade/app/settings.js',
                'resources/js/blade/app/dashboard.js',
                'resources/js/blade/app/notifications.js',
                'resources/js/blade/app/chat.js',
                'resources/js/blade/app/admin-users.js',
                'resources/js/blade/app/admin-sessions.js',
                'resources/js/blade/app/admin-session-detail.js',
                'resources/js/blade/app/admin-request-logs.js',

                // Если здесь будут другие Blade-страницы,
                // добавляй их сюда
            ],

            refresh: true,

            fonts: [
                // Cyrillic for ru, Latin for uz/en — without it every
                // Cyrillic glyph falls back to the system font.
                bunny('Onest', {
                    weights: [400, 500, 600, 700],
                    subsets: ['latin', 'cyrillic'],
                }),
            ],
        }),

        wayfinder({
            formVariants: true,
        }),
    ],
});
