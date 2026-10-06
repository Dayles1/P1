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

    // The permanent header names the page being shown; "Settings /
    // Profile" shows the parents muted before the page itself.
    document.querySelectorAll('[data-header-title]').forEach((el) => {
        const parts = String(config.title || '').split(' / ');
        const current = parts.pop();

        el.replaceChildren(
            ...parts.flatMap((part) => {
                const parent = document.createElement('span');
                const separator = document.createElement('span');

                parent.className = 'app-header__crumb';
                parent.textContent = part;
                separator.className = 'app-header__crumb';
                separator.textContent = ' / ';

                return [parent, separator];
            }),
            document.createTextNode(current),
        );
    });

    if (newMain) {
        if (config.secondarySidebar) {
            newMain.dataset.secondarySidebar = config.secondarySidebar;
        } else {
            delete newMain.dataset.secondarySidebar;
        }
    }

    updateActiveNav();
}

/**
 * Every permanent nav link (sidebar, phone tab bar) carries
 * `data-nav-link="<block class>"`; its `<block>--active` modifier is
 * recomputed here on every navigation.
 *
 * `<x-sidebar-link>` used to decide its own `--active` state server-side
 * via `request()->is(...)`, which only ever ran once now that the sidebar
 * is permanent — every subsequent Turbo visit left the *first* page's link
 * highlighted no matter where you actually navigated to. Recompute it
 * client-side instead.
 *
 * Deliberately reads `window.location`, not the incoming document passed
 * in as `sourceDoc` elsewhere in this file: Turbo parses that document via
 * `DOMParser`, which gives it its own unrelated `baseURI` (effectively
 * `about:blank`), not the URL actually being navigated to. `window.
 * location` is safe to read here because Turbo already calls
 * `visit.changeHistory()` — updating the address bar — before it fires
 * `turbo:before-render`.
 */
function updateActiveNav() {
    const path = window.location.pathname;

    document.querySelectorAll('[data-nav-link]').forEach((link) => {
        let linkPath;

        try {
            linkPath = new URL(
                link.getAttribute('href'),
                window.location.origin,
            ).pathname;
        } catch {
            return;
        }

        const isActive = path === linkPath || path.startsWith(`${linkPath}/`);

        link.classList.toggle(`${link.dataset.navLink}--active`, isActive);

        if (isActive) {
            link.setAttribute('aria-current', 'page');
        } else {
            link.removeAttribute('aria-current');
        }
    });
}

document.addEventListener('turbo:before-render', (event) => {
    apply(event.detail.newBody);
});

// Also apply once for the very first real page load (no turbo:before-render fires for that).
apply(document);
