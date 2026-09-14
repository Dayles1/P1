import { api } from '../axios';

/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const root = document.documentElement;

const themeToggle =
    document.getElementById('theme-toggle');

const navToggle =
    document.querySelector('[data-nav-toggle]');

const mobileNav =
    document.querySelector('[data-mobile-nav]');

/*
|--------------------------------------------------------------------------
| Reduced motion
|--------------------------------------------------------------------------
*/

function prefersReducedMotion() {
    return window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;
}

/*
|--------------------------------------------------------------------------
| Theme toggle
|--------------------------------------------------------------------------
*/

function toggleTheme() {
    const current =
        root.dataset.theme === 'dark' ? 'dark' : 'light';

    const next =
        current === 'dark' ? 'light' : 'dark';

    const apply = () => {
        root.dataset.theme = next;
        localStorage.setItem('theme', next);
    };

    if (!document.startViewTransition || prefersReducedMotion()) {
        apply();
        return;
    }

    document.startViewTransition(apply);
}

themeToggle?.addEventListener('click', toggleTheme);

/*
|--------------------------------------------------------------------------
| Mobile navigation
|--------------------------------------------------------------------------
*/

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
    document
        .querySelectorAll('[data-dropdown]')
        .forEach((dropdown) => {
            if (dropdown !== except) {
                closeDropdown(dropdown);
            }
        });
}

document.addEventListener('click', (event) => {
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

/*
|--------------------------------------------------------------------------
| Dismissible alerts
|--------------------------------------------------------------------------
*/

document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-alert-close]');

    close?.closest('.alert')?.remove();
});

/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

document.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-logout]');

    if (!trigger) {
        return;
    }

    trigger.disabled = true;

    try {
        await api.post('/auth/logout');
    } catch {
        // ignore, still redirect to clear client state
    } finally {
        localStorage.removeItem('auth_token');
        window.location.href = '/';
    }
});
