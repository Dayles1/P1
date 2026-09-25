import { api } from '../axios';
import {
    bootstrapAppState,
    getState,
    logout as appStateLogout,
    setPresence,
    setTheme,
    subscribe,
} from './app-state';
import { hasRole, initials } from './auth-state';
import { initCommandPalette, startCreate } from './command-palette';
import { initDatePickers } from './date-picker';
import { initDevPanel } from './dev-panel';
import { closeAllDropdowns, initDropdowns } from './dropdown';
import { initDropzones } from './dropzone';
import { initFormControls } from './form-controls';
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
| Account menu: theme switch
|--------------------------------------------------------------------------
|
| The Light / Dark / Auto segmented control. The menu stays open while
| switching, so the pressed state is re-synced from AppState on every
| change (including ones made elsewhere: settings page, Ctrl+Shift+L).
|
*/

function syncThemeSwitch() {
    const { choice } = getState().theme;

    document.querySelectorAll('[data-theme-set]').forEach((el) => {
        el.setAttribute('aria-pressed', String(el.dataset.themeSet === choice));
    });
}

function initThemeSwitch() {
    if (!document.querySelector('[data-theme-set]')) {
        return;
    }

    syncThemeSwitch();
    subscribe('theme', syncThemeSwitch);

    document.addEventListener('click', (event) => {
        const option = event.target.closest('[data-theme-set]');

        if (option) {
            setTheme(option.dataset.themeSet);
        }
    });
}

/*
|--------------------------------------------------------------------------
| Header "Create" menu
|--------------------------------------------------------------------------
*/

function initCreateMenu() {
    document.addEventListener('click', (event) => {
        const action = event.target.closest('[data-create]');

        if (action) {
            closeAllDropdowns();
            startCreate(action.dataset.create);
        }
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

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

function paintUserHeader(user) {
    const name = user.name;
    const avatarUrl = user.avatar?.url || null;

    document.querySelectorAll('[data-user-name]').forEach((el) => {
        el.textContent = name;
    });

    document.querySelectorAll('[data-user-email]').forEach((el) => {
        el.textContent = user.email || '';
    });

    // The account menu names an admin's role; everyone else gets no chip.
    const adminRole = (user.roles || []).find((role) =>
        ADMIN_ROLES.includes(role.code),
    );

    document.querySelectorAll('[data-user-role]').forEach((el) => {
        el.textContent = adminRole?.name || '';
        el.hidden = !adminRole;
    });

    document.querySelectorAll('[data-user-avatar]').forEach((el) => {
        el.innerHTML = avatarUrl
            ? `<img class="avatar__image" src="${avatarUrl}" alt="">`
            : `<span class="avatar__initials" aria-hidden="true">${initials(name)}</span>`;
    });
}

/**
 * Shows/hides every `[data-requires-role]` element for the given user —
 * shared by the one-time initial pass and the per-navigation re-apply
 * below, since page content (unlike the permanent header/sidebar) gets
 * fresh `[data-requires-role]` elements on every Turbo visit.
 */
function applyRoleVisibility(user) {
    document.querySelectorAll('[data-requires-role]').forEach((el) => {
        const roles = el.dataset.requiresRole.split(',');

        el.toggleAttribute('hidden', !hasRole(user, ...roles));
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
    paintUserHeader(user);

    subscribe('user', (current) => {
        if (current) {
            paintUserHeader(current);
        }
    });

    applyRoleVisibility(user);

    // `<main>` (and everything in it) is replaced by fresh server HTML on
    // every Turbo navigation, but this function itself only ever runs
    // once per session (see the doc comment above) — so a `[data-requires-
    // role]` element inside page content, like Settings' Application nav
    // group, would stay stuck on whatever `hidden` state its very first
    // appearance in the DOM happened to get, never revisited on a later
    // soft-navigation to that page. Elements in the permanent header/
    // sidebar don't have this problem (they're never recreated), but
    // anything page-specific needs re-applying on every visit.
    document.addEventListener('turbo:load', () => {
        applyRoleVisibility(getState().user);
    });

    initThemeSwitch();
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
    initCommandPalette();
    initCreateMenu();
    initFormControls();
    initDatePickers();
    initDropzones();

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
