import { api } from '../axios';
import {
    bootstrapAppState,
    logout as appStateLogout,
    setPresence,
    subscribe,
} from './app-state';
import { hasRole, initials } from './auth-state';
import { initDevPanel } from './dev-panel';
import { initLocalePicker } from './i18n';
import { initNotificationBell } from './notification-bell';
import { initPresence, onPresenceChange } from './presence';
import { initShortcuts } from './shortcuts';
import { initThemePicker } from './theme-picker';
import { getUserSettings } from './user-settings-cache';

/*
|--------------------------------------------------------------------------
| Mobile navigation
|--------------------------------------------------------------------------
*/

function initMobileNav() {
    const navToggle = document.querySelector('[data-nav-toggle]');
    const mobileNav = document.querySelector('[data-mobile-nav]');

    navToggle?.addEventListener('click', () => {
        if (!mobileNav) {
            return;
        }

        const isOpen = mobileNav.hasAttribute('data-open');

        if (isOpen) {
            mobileNav.removeAttribute('data-open');
            mobileNav.hidden = true;
        } else {
            mobileNav.setAttribute('data-open', '');
            mobileNav.hidden = false;
        }

        navToggle.setAttribute('aria-expanded', String(!isOpen));
    });
}

/*
|--------------------------------------------------------------------------
| Dropdowns
|--------------------------------------------------------------------------
*/

function closeDropdown(dropdown) {
    const trigger = dropdown.querySelector('[data-dropdown-trigger]');
    const menu = dropdown.querySelector('[data-dropdown-menu]');

    menu?.setAttribute('hidden', '');
    trigger?.setAttribute('aria-expanded', 'false');
}

function closeAllDropdowns(except = null) {
    document.querySelectorAll('[data-dropdown]').forEach((dropdown) => {
        if (dropdown !== except) {
            closeDropdown(dropdown);
        }
    });
}

function initDropdowns() {
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

/*
|--------------------------------------------------------------------------
| Static modals (<x-blade.u-i.modal>)
|--------------------------------------------------------------------------
*/

function initStaticModals() {
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-modal-trigger]');

        if (trigger) {
            document
                .getElementById(trigger.dataset.modalTrigger)
                ?.removeAttribute('hidden');

            return;
        }

        const closeBtn = event.target.closest('[data-modal-close]');
        const overlay = event.target.closest('[data-modal]');

        if (closeBtn) {
            closeBtn.closest('[data-modal]')?.setAttribute('hidden', '');
        } else if (overlay && event.target === overlay) {
            overlay.setAttribute('hidden', '');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document
                .querySelectorAll('[data-modal]:not([hidden])')
                .forEach((modal) => modal.setAttribute('hidden', ''));
        }
    });
}

/*
|--------------------------------------------------------------------------
| Dismissible alerts
|--------------------------------------------------------------------------
*/

function initAlerts() {
    document.addEventListener('click', (event) => {
        const close = event.target.closest('[data-alert-close]');

        close?.closest('.alert')?.remove();
    });
}

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

function initLogout() {
    document.addEventListener('click', async (event) => {
        const trigger = event.target.closest('[data-logout]');

        if (!trigger) {
            return;
        }

        trigger.disabled = true;

        await appStateLogout();

        window.location.href = '/login';
    });
}

/*
|--------------------------------------------------------------------------
| Header auth state
|--------------------------------------------------------------------------
|
| There is no server session for API logins (bearer tokens only), so
| the header's guest/user state is always resolved by asking the API
| — never assume login state from Blade.
|
*/

function paintUserHeader(name, avatarUrl) {
    document.querySelectorAll('[data-user-name]').forEach((el) => {
        el.textContent = name;
    });

    document.querySelectorAll('[data-user-avatar]').forEach((el) => {
        el.innerHTML = avatarUrl
            ? `<img class="avatar__image" src="${avatarUrl}" alt="">`
            : `<span class="avatar__initials" aria-hidden="true">${initials(name)}</span>`;
    });
}

/**
 * Called exactly once per session with the already-resolved user (never
 * a fake/placeholder one) — from authenticated.js after
 * bootstrapAppState() settles for the app shell, or resolved here for
 * public pages (see initSiteChrome below) where a guest is a valid,
 * real outcome rather than a loading state. The header nodes are
 * `data-turbo-permanent` on authenticated pages, so this paints the
 * real name/avatar once and then only ever repaints via the `user`
 * subscription below (e.g. after a profile edit patches AppState) —
 * never a refetch, never a placeholder shown first.
 */
function initHeaderAuthState(user) {
    const guestEls = document.querySelectorAll('[data-auth-guest]');
    const userEls = document.querySelectorAll('[data-auth-user]');

    if (!guestEls.length && !userEls.length) {
        return;
    }

    if (!user) {
        guestEls.forEach((el) => el.removeAttribute('hidden'));

        return;
    }

    userEls.forEach((el) => el.removeAttribute('hidden'));
    paintUserHeader(user.name, user.avatar?.url || null);

    subscribe('user', (current) => {
        if (current) {
            paintUserHeader(current.name, current.avatar?.url || null);
        }
    });

    document.querySelectorAll('[data-requires-role]').forEach((el) => {
        const roles = el.dataset.requiresRole.split(',');

        if (hasRole(user, ...roles)) {
            el.removeAttribute('hidden');
        }
    });

    initNotificationBell(api, user);
    initPresence();
    onPresenceChange((onlineIds) => setPresence(onlineIds));
    initDevPanel();

    getUserSettings(api)
        .then((settings) => {
            document.documentElement.toggleAttribute(
                'data-developer-mode',
                Boolean(settings?.meta?.developer_mode),
            );
        })
        .catch(() => {});
}

/*
|--------------------------------------------------------------------------
| Init
|--------------------------------------------------------------------------
*/

export function initSiteChrome(user) {
    initThemePicker();
    initLocalePicker(api);
    initMobileNav();
    initDropdowns();
    initStaticModals();
    initAlerts();
    initLogout();
    initShortcuts();

    // authenticated.js already resolved the user via bootstrapAppState()
    // and passes it in directly. Public pages (app.js) call this with no
    // argument at all — there's no route guard to wait on there, and a
    // resolved guest is a legitimate outcome, not a loading state.
    if (arguments.length > 0) {
        initHeaderAuthState(user);

        return;
    }

    bootstrapAppState().then((resolvedUser) =>
        initHeaderAuthState(resolvedUser),
    );
}
