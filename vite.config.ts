import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',

                // Auth Blade
                'resources/css/blade/auth/auth.css',
                'resources/css/blade/auth/auth-pages.css',
                'resources/js/blade/auth/auth.js',
                'resources/js/blade/auth/auth-pages.js',

                // App Blade
                'resources/css/blade/app/app.css',
                'resources/js/blade/app/app.js',
                'resources/js/blade/app/authenticated.js',
                'resources/js/blade/app/profile.js',
                'resources/js/blade/app/sessions.js',
                'resources/js/blade/app/session-detail.js',
                'resources/js/blade/app/settings.js',
                'resources/js/blade/app/dashboard.js',
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
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),

        tailwindcss(),

        wayfinder({
            formVariants: true,
        }),
    ],
});
