/**
 * The main sidebar and header are `data-turbo-permanent` (see
 * layouts/authenticated.blade.php), so once Turbo Drive is running they
 * are never recreated by a page navigation — which also means the server
 * can no longer hand them a fresh `data-mode`/`data-secondary-sidebar`
 * attribute the way it still can for `<main>` on every request.
 *
 * Pages instead set `$sidebarMode` / `$secondarySidebar` Blade variables
 * (the same convention already used for `$fullBleed`/`$narrow`), which
 * `layouts/authenticated.blade.php` serializes into a small
 * `#page-layout-config` JSON blob. This module reads that blob from the
 * *incoming* page on `turbo:before-render` — before the swap happens —
 * and writes it straight onto the permanent sidebar node, so the mode
 * changes in the same paint as the content, never a frame late.
 */
function readConfig(sourceDoc) {
    try {
        const raw = sourceDoc.querySelector('#page-layout-config')?.textContent;

        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function apply(sourceDoc) {
    const config = readConfig(sourceDoc);
    const sidebar = document.getElementById('app-sidebar');
    const newMain = sourceDoc.querySelector('.app-main');

    if (sidebar) {
        sidebar.dataset.mode = config.sidebar || 'default';
    }

    if (newMain) {
        if (config.secondarySidebar) {
            newMain.dataset.secondarySidebar = config.secondarySidebar;
        } else {
            delete newMain.dataset.secondarySidebar;
        }
    }
}

document.addEventListener('turbo:before-render', (event) => {
    apply(event.detail.newBody);
});

// Also apply once for the very first real page load (no turbo:before-render fires for that).
apply(document);
