/**
 * Open/close behaviour for every `<x-blade.u-i.dropdown>` on the page.
 *
 * Lives here rather than inside `site-chrome.js` because the auth layout
 * (login, register, password reset…) renders the same component for its
 * language picker but never boots the authenticated chrome — so the menu
 * there had no toggle at all and simply sat open.
 *
 * One delegated listener on `document` covers every dropdown, including
 * any markup Turbo swaps in later.
 */

function closeDropdown(dropdown) {
    const trigger = dropdown.querySelector('[data-dropdown-trigger]');
    const menu = dropdown.querySelector('[data-dropdown-menu]');

    menu?.setAttribute('hidden', '');
    trigger?.setAttribute('aria-expanded', 'false');
}

export function closeAllDropdowns(except = null) {
    document.querySelectorAll('[data-dropdown]').forEach((dropdown) => {
        if (dropdown !== except) {
            closeDropdown(dropdown);
        }
    });
}

let initialized = false;

export function initDropdowns() {
    // The listeners are delegated and registered on `document`, which
    // survives Turbo navigations — binding them a second time would just
    // toggle each menu twice per click (open, then straight back shut).
    if (initialized) {
        return;
    }

    initialized = true;

    document.addEventListener('click', (event) => {
        if (event.target.closest('[data-theme-option], [data-locale-option]')) {
            closeAllDropdowns();

            return;
        }

        const trigger = event.target.closest('[data-dropdown-trigger]');

        if (trigger) {
            const dropdown = trigger.closest('[data-dropdown]');
            const menu = dropdown?.querySelector('[data-dropdown-menu]');

            if (!dropdown || !menu) {
                return;
            }

            const isOpen = !menu.hasAttribute('hidden');

            closeAllDropdowns(dropdown);

            if (isOpen) {
                closeDropdown(dropdown);
            } else {
                menu.removeAttribute('hidden');
                trigger.setAttribute('aria-expanded', 'true');
            }

            return;
        }

        if (!event.target.closest('[data-dropdown]')) {
            closeAllDropdowns();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllDropdowns();
        }
    });
}
