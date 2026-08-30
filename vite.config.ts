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
                'resources/js/blade/auth/auth.js',

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
