{{-- =====================================================
     THEME BOOTSTRAP — flicker-free, before first paint.
     Kept as a tiny inline script (not a module import) so it can run
     synchronously ahead of CSS/paint; the full picker logic lives in
     resources/js/blade/shared/theme.js.

     Both lists are rendered from ThemeCatalog — the ONE server-side source
     of truth — and published as `window.__themeCatalog` so shared/theme.js
     reads the exact same lists instead of keeping its own copy.

     Theme and accent are read from the localStorage cache: for a guest
     that cache is the only store; for a signed-in user it mirrors
     `user_settings`, and app-state.js refreshes it from the server once
     the user has loaded — so this never waits on the network.
     ===================================================== --}}
<script>
    (() => {
        const THEMES = @json(\App\Domain\Setting\Services\ThemeCatalog::codes());
        const ACCENTS = @json(\App\Domain\Setting\Services\ThemeCatalog::accents());
        window.__themeCatalog = { codes: THEMES, accents: ACCENTS };

        const read = (key) => {
            try {
                return localStorage.getItem(key);
            } catch {
                return null;
            }
        };

        const root = document.documentElement;
        const theme = THEMES.includes(read('theme')) ? read('theme') : 'auto';
        const accent = read('accent');

        root.dataset.theme = theme === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme;

        if (ACCENTS.includes(accent) && accent !== 'default') {
            root.dataset.accent = accent;
        }
    })();
</script>
