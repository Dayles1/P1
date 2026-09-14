{{-- =====================================================
     THEME BOOTSTRAP — flicker-free, before first paint.
     Kept as a tiny inline script (not a module import) so it can run
     synchronously ahead of CSS/paint; the full picker logic lives in
     resources/js/blade/shared/theme.js.
     ===================================================== --}}
<script>
    (() => {
        const THEMES = ['light', 'gray', 'dark', 'black', 'green', 'orange'];
        const saved = localStorage.getItem('theme');

        const applied = THEMES.includes(saved)
            ? saved
            : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

        document.documentElement.dataset.theme = applied;
        document.documentElement.style.colorScheme = (applied === 'dark' || applied === 'black') ? 'dark' : 'light';
    })();
</script>
