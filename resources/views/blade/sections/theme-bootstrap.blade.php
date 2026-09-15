{{-- =====================================================
     THEME BOOTSTRAP — flicker-free, before first paint.
     Kept as a tiny inline script (not a module import) so it can run
     synchronously ahead of CSS/paint; the full picker logic lives in
     resources/js/blade/shared/theme.js.

     The theme/dark-code lists are rendered from ThemeCatalog — the ONE
     server-side source of truth — and published as `window.__themeCatalog`
     so shared/theme.js reads the exact same lists instead of keeping its
     own hardcoded copy. A hand-duplicated copy here previously drifted out
     of date as new palettes were added, so any saved theme outside the
     stale list silently fell back to system light/dark on every reload;
     publishing one source both scripts read closes that off for good.
     ===================================================== --}}
<script>
    (() => {
        const THEMES = @json(\App\Domain\Setting\Services\ThemeCatalog::codes());
        const DARK_THEMES = @json(\App\Domain\Setting\Services\ThemeCatalog::darkCodes());
        window.__themeCatalog = { codes: THEMES, darkCodes: DARK_THEMES };

        const saved = localStorage.getItem('theme');

        const applied = (THEMES.includes(saved) && saved !== 'system')
            ? saved
            : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

        document.documentElement.dataset.theme = applied;
        document.documentElement.style.colorScheme = DARK_THEMES.includes(applied) ? 'dark' : 'light';
    })();
</script>
