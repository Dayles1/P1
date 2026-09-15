import { api } from '../axios';
import { fetchCurrentUser, hasRole, initials, logout } from './auth-state';
import { initLocalePicker } from './i18n';
import { initNotificationBell } from './notification-bell';
import { initPresence } from './presence';
import { initThemePicker } from './theme-picker';

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
            document.getElementById(trigger.dataset.modalTrigger)?.removeAttribute('hidden');

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
            document.querySelectorAll('[data-modal]:not([hidden])').forEach((modal) => modal.setAttribute('hidden', ''));
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

        await logout();

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

async function initHeaderAuthState() {
    const guestEls = document.querySelectorAll('[data-auth-guest]');
    const userEls = document.querySelectorAll('[data-auth-user]');

    if (!guestEls.length && !userEls.length) {
        return null;
    }

    const user = await fetchCurrentUser();

    if (!user) {
        guestEls.forEach((el) => el.removeAttribute('hidden'));

        return null;
    }

    userEls.forEach((el) => el.removeAttribute('hidden'));

    document.querySelectorAll('[data-user-name]').forEach((el) => {
        el.textContent = user.name;
    });

    document.querySelectorAll('[data-user-initials]').forEach((el) => {
        el.textContent = initials(user.name);
    });

    document.querySelectorAll('[data-requires-role]').forEach((el) => {
        const roles = el.dataset.requiresRole.split(',');

        if (hasRole(user, ...roles)) {
            el.removeAttribute('hidden');
        }
    });

    initNotificationBell(api);
    initPresence();

    return user;
}

/*
|--------------------------------------------------------------------------
| Init
|--------------------------------------------------------------------------
*/

export function initSiteChrome() {
    initThemePicker();
    initLocalePicker(api);
    initMobileNav();
    initDropdowns();
    initStaticModals();
    initAlerts();
    initLogout();

    return initHeaderAuthState();
}
