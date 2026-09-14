import axios from 'axios';

/**
 * ==========================================================================
 * AUTH SPA
 * ==========================================================================
 *
 * Отвечает только за:
 * - SPA navigation
 * - history
 * - страницы
 * - page transitions
 * - forms
 * - API
 * - validation
 * - password visibility
 *
 * Theme находится в auth.js.
 */

/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const spa =
    document.getElementById('auth-spa');

const viewport =
    document.getElementById(
        'auth-spa-viewport'
    );

if (!spa || !viewport) {
    throw new Error(
        'Auth SPA root was not found.'
    );
}

/*
|--------------------------------------------------------------------------
| Pages
|--------------------------------------------------------------------------
*/

const pages = Array.from(
    spa.querySelectorAll(
        '[data-auth-page]'
    )
);

if (!pages.length) {
    throw new Error(
        'Auth SPA pages were not found.'
    );
}

/*
|--------------------------------------------------------------------------
| State
|--------------------------------------------------------------------------
*/

const state = {
    currentPage:
        spa.dataset.currentPage || 'login',

    resetToken:
        spa.dataset.resetToken || '',

    resetEmail:
        spa.dataset.resetEmail || '',

    isTransitioning:
        false,

    transitionTimer:
        null,
};

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

const AUTH_ROUTES = {
    login:
        '/login',

    register:
        '/register',

    'forgot-password':
        '/forgot-password',

    'reset-password':
        '/reset-password',

    'verify-email':
        '/verify-email',

    'confirm-password':
        '/confirm-password',
};

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API = {
    login:
        '/api/auth/login',

    register:
        '/api/auth/register',

    'forgot-password':
        '/api/auth/forgot-password',

    'reset-password':
        '/api/auth/reset-password',

    'verification-notification':
        '/api/auth/email/verification-notification',

    'confirm-password':
        '/api/auth/confirm-password',
};

/*
|--------------------------------------------------------------------------
| Page order
|--------------------------------------------------------------------------
*/

const PAGE_ORDER = [
    'login',
    'register',
    'forgot-password',
    'reset-password',
    'verify-email',
    'confirm-password',
];

/*
|--------------------------------------------------------------------------
| Page lookup
|--------------------------------------------------------------------------
*/

function getPageElement(page) {
    return pages.find(
        (element) =>
            element.dataset.authPage === page
    );
}

function isKnownPage(page) {
    return Boolean(
        getPageElement(page)
    );
}

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
| Direction
|--------------------------------------------------------------------------
|
| Направление теперь не используется для движения.
|
| Оно оставлено для CSS/data-state,
| чтобы при необходимости различать переходы.
|
|--------------------------------------------------------------------------
*/

function getDirection(
    from,
    to
) {
    const fromIndex =
        PAGE_ORDER.indexOf(from);

    const toIndex =
        PAGE_ORDER.indexOf(to);

    if (
        fromIndex === -1 ||
        toIndex === -1
    ) {
        return 'forward';
    }

    return toIndex >= fromIndex
        ? 'forward'
        : 'backward';
}

/*
|--------------------------------------------------------------------------
| URL → Page
|--------------------------------------------------------------------------
*/

function getPageFromLocation() {
    const path =
        window.location.pathname;

    if (path === '/register') {
        return 'register';
    }

    if (
        path === '/forgot-password'
    ) {
        return 'forgot-password';
    }

    if (
        path.startsWith(
            '/reset-password/'
        )
    ) {
        return 'reset-password';
    }

    if (
        path === '/verify-email'
    ) {
        return 'verify-email';
    }

    if (
        path === '/confirm-password'
    ) {
        return 'confirm-password';
    }

    return 'login';
}

/*
|--------------------------------------------------------------------------
| Page → URL
|--------------------------------------------------------------------------
*/

function getUrlForPage(
    page,
    options = {}
) {
    if (
        page === 'reset-password'
    ) {
        const token =
            options.token ||
            state.resetToken;

        if (token) {
            const url =
                new URL(
                    `/reset-password/${encodeURIComponent(token)}`,
                    window.location.origin
                );

            const email =
                options.email ||
                state.resetEmail;

            if (email) {
                url.searchParams.set(
                    'email',
                    email
                );
            }

            return (
                url.pathname +
                url.search
            );
        }

        return '/reset-password';
    }

    return (
        AUTH_ROUTES[page] ||
        '/login'
    );
}

/*
|--------------------------------------------------------------------------
| Clear transition classes
|--------------------------------------------------------------------------
*/

function clearTransitionClasses() {
    pages.forEach(
        (page) => {
            page.classList.remove(
                'is-entering',
                'is-leaving'
            );
        }
    );
}

/*
|--------------------------------------------------------------------------
| Activate page
|--------------------------------------------------------------------------
*/

function setActivePage(page) {
    pages.forEach(
        (pageElement) => {
            pageElement.classList.toggle(
                'is-active',
                pageElement.dataset.authPage === page
            );
        }
    );

    spa.dataset.currentPage =
        page;

    state.currentPage =
        page;
}

/*
|--------------------------------------------------------------------------
| Reset transition
|--------------------------------------------------------------------------
*/

function finishTransition() {
    if (
        state.transitionTimer
    ) {
        clearTimeout(
            state.transitionTimer
        );

        state.transitionTimer =
            null;
    }

    clearTransitionClasses();

    state.isTransitioning =
        false;
}

/*
|--------------------------------------------------------------------------
| Page transition
|--------------------------------------------------------------------------
|
| Здесь нет:
| - translateX
| - translateY
| - position:absolute
| - изменения width
| - изменения height
|
| Только opacity.
|
|--------------------------------------------------------------------------
*/

function animatePageChange(
    from,
    to,
    direction
) {
    const fromElement =
        getPageElement(from);

    const toElement =
        getPageElement(to);

    if (!toElement) {
        return;
    }

    /*
    |--------------------------------------------------------------------------
    | Same page
    |--------------------------------------------------------------------------
    */

    if (
        from === to ||
        !fromElement
    ) {
        setActivePage(to);

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | Stop previous transition
    |--------------------------------------------------------------------------
    */

    finishTransition();

    state.isTransitioning =
        true;

    /*
    |--------------------------------------------------------------------------
    | Direction state
    |--------------------------------------------------------------------------
    */

    viewport.dataset.direction =
        direction;

    /*
    |--------------------------------------------------------------------------
    | Prepare target
    |--------------------------------------------------------------------------
    */

    toElement.classList.remove(
        'is-entering',
        'is-leaving'
    );

    fromElement.classList.remove(
        'is-entering',
        'is-leaving'
    );

    /*
    |--------------------------------------------------------------------------
    | Force style calculation
    |--------------------------------------------------------------------------
    */

    void toElement.offsetWidth;

    /*
    |--------------------------------------------------------------------------
    | Reduced motion
    |--------------------------------------------------------------------------
    */

    if (prefersReducedMotion()) {
        setActivePage(to);

        finishTransition();

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | New page
    |--------------------------------------------------------------------------
    */

    toElement.classList.add(
        'is-entering'
    );

    /*
    |--------------------------------------------------------------------------
    | Old page
    |--------------------------------------------------------------------------
    */

    fromElement.classList.add(
        'is-leaving'
    );

    /*
    |--------------------------------------------------------------------------
    | Both are visible while fading
    |--------------------------------------------------------------------------
    */

    setActivePage(to);

    /*
    |--------------------------------------------------------------------------
    | Finish after CSS animation
    |--------------------------------------------------------------------------
    */

    state.transitionTimer =
        window.setTimeout(
            () => {
                finishTransition();
            },
            360
        );
}

/*
|--------------------------------------------------------------------------
| Navigate
|--------------------------------------------------------------------------
*/

function navigate(
    page,
    options = {}
) {
    if (!isKnownPage(page)) {
        return;
    }

    const current =
        state.currentPage;

    /*
    |--------------------------------------------------------------------------
    | Same page
    |--------------------------------------------------------------------------
    */

    if (
        current === page &&
        !options.force
    ) {
        return;
    }

    /*
    |--------------------------------------------------------------------------
    | Direction
    |--------------------------------------------------------------------------
    */

    const direction =
        options.direction ||
        getDirection(
            current,
            page
        );

    /*
    |--------------------------------------------------------------------------
    | Update reset state
    |--------------------------------------------------------------------------
    */

    if (options.token) {
        state.resetToken =
            options.token;
    }

    if (options.email) {
        state.resetEmail =
            options.email;
    }

    /*
    |--------------------------------------------------------------------------
    | Update URL
    |--------------------------------------------------------------------------
    */

    if (!options.fromPopState) {
        const url =
            getUrlForPage(
                page,
                options
            );

        history.pushState(
            {
                authPage:
                    page,

                token:
                    state.resetToken,

                email:
                    state.resetEmail,
            },
            '',
            url
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Animate
    |--------------------------------------------------------------------------
    */

    animatePageChange(
        current,
        page,
        direction
    );
}

/*
|--------------------------------------------------------------------------
| Navigation links
|--------------------------------------------------------------------------
*/

function setupNavigationLinks() {
    spa.addEventListener(
        'click',
        (event) => {
            const link =
                event.target.closest(
                    '[data-auth-link]'
                );

            if (!link) {
                return;
            }

            /*
            |--------------------------------------------------------------------------
            | Allow browser modified clicks
            |--------------------------------------------------------------------------
            */

            if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            event.preventDefault();

            const page =
                link.dataset.authLink;

            if (
                !page ||
                !isKnownPage(page)
            ) {
                return;
            }

            navigate(page);
        }
    );
}

/*
|--------------------------------------------------------------------------
| Browser back / forward
|--------------------------------------------------------------------------
*/

function setupHistory() {
    window.addEventListener(
        'popstate',
        (event) => {
            const page =
                event.state?.authPage ||
                getPageFromLocation();

            if (!isKnownPage(page)) {
                return;
            }

            if (
                event.state?.token
            ) {
                state.resetToken =
                    event.state.token;
            }

            if (
                event.state?.email
            ) {
                state.resetEmail =
                    event.state.email;
            }

            const direction =
                getDirection(
                    state.currentPage,
                    page
                );

            animatePageChange(
                state.currentPage,
                page,
                direction
            );
        }
    );
}

/*
|--------------------------------------------------------------------------
| API errors
|--------------------------------------------------------------------------
*/

function getApiErrors(error) {
    const response =
        error?.response;

    const data =
        response?.data;

    if (
        data?.errors &&
        typeof data.errors === 'object'
    ) {
        return data.errors;
    }

    if (data?.message) {
        return {
            general: [
                data.message,
            ],
        };
    }

    return {
        general: [
            'Something went wrong. Please try again.',
        ],
    };
}

/*
|--------------------------------------------------------------------------
| Clear errors
|--------------------------------------------------------------------------
*/

function clearFormErrors(form) {
    form.querySelectorAll(
        '.form-error'
    ).forEach(
        (element) => {
            element.textContent =
                '';

            element.removeAttribute(
                'data-visible'
            );
        }
    );

    form.querySelectorAll(
        '.form-input'
    ).forEach(
        (element) => {
            element.classList.remove(
                'is-invalid'
            );
        }
    );

    const general =
        form.querySelector(
            '[data-error-general]'
        );

    if (general) {
        general.textContent =
            '';

        general.removeAttribute(
            'data-visible'
        );
    }
}

/*
|--------------------------------------------------------------------------
| Show errors
|--------------------------------------------------------------------------
*/

function showFormErrors(
    form,
    errors
) {
    clearFormErrors(form);

    Object.entries(errors)
        .forEach(
            ([field, messages]) => {
                const message =
                    Array.isArray(messages)
                        ? messages[0]
                        : messages;

                /*
                |--------------------------------------------------------------------------
                | General error
                |--------------------------------------------------------------------------
                */

                if (
                    field === 'general'
                ) {
                    let general =
                        form.querySelector(
                            '[data-error-general]'
                        );

                    if (!general) {
                        general =
                            document.createElement(
                                'div'
                            );

                        general.className =
                            'auth-form-error';

                        general.dataset.errorGeneral =
                            'true';

                        form.prepend(
                            general
                        );
                    }

                    general.textContent =
                        message;

                    general.setAttribute(
                        'data-visible',
                        'true'
                    );

                    return;
                }

                /*
                |--------------------------------------------------------------------------
                | Input
                |--------------------------------------------------------------------------
                */

                const input =
                    form.querySelector(
                        `[name="${CSS.escape(field)}"]`
                    );

                const errorElement =
                    form.querySelector(
                        `[data-error-for="${CSS.escape(field)}"]`
                    );

                if (input) {
                    input.classList.add(
                        'is-invalid'
                    );
                }

                if (errorElement) {
                    errorElement.textContent =
                        message;

                    errorElement.setAttribute(
                        'data-visible',
                        'true'
                    );
                }
            }
        );
}

/*
|--------------------------------------------------------------------------
| Loading state
|--------------------------------------------------------------------------
*/

function setFormLoading(
    form,
    loading
) {
    form.querySelectorAll(
        'button[type="submit"]'
    ).forEach(
        (button) => {
            button.disabled =
                loading;

            button.classList.toggle(
                'is-loading',
                loading
            );

            button.setAttribute(
                'aria-busy',
                loading
                    ? 'true'
                    : 'false'
            );
        }
    );
}

/*
|--------------------------------------------------------------------------
| Serialize form
|--------------------------------------------------------------------------
*/

function serializeForm(form) {
    const formData =
        new FormData(form);

    const data = {};

    formData.forEach(
        (value, key) => {
            data[key] =
                value;
        }
    );

    return data;
}

/*
|--------------------------------------------------------------------------
| API request
|--------------------------------------------------------------------------
*/

function getAuthToken() {
    return localStorage.getItem('auth_token');
}

async function apiRequest(
    method,
    url,
    data = {}
) {
    const token =
        getAuthToken();

    return axios({
        method,
        url,
        data,

        headers: {
            Accept:
                'application/json',

            'Content-Type':
                'application/json',

            'X-Requested-With':
                'XMLHttpRequest',

            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
        },

        withCredentials:
            true,
    });
}

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

async function handleLogin(form) {
    clearFormErrors(form);

    setFormLoading(
        form,
        true
    );

    try {
        const data =
            serializeForm(form);

        data.timezone =
            Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone;

        const response =
            await apiRequest(
                'POST',
                API.login,
                data
            );

        const token =
            response.data?.data?.token ||
            response.data?.data?.access_token;

        if (token) {
            localStorage.setItem(
                'auth_token',
                token
            );
        }

        const params =
            new URLSearchParams(
                window.location.search
            );

        const redirect =
            params.get('redirect');

        window.location.href =
            (redirect && redirect.startsWith('/'))
                ? redirect
                : '/';
    } catch (error) {
        showFormErrors(
            form,
            getApiErrors(error)
        );
    } finally {
        setFormLoading(
            form,
            false
        );
    }
}

/*
|--------------------------------------------------------------------------
| REGISTER
|--------------------------------------------------------------------------
*/

async function handleRegister(form) {
    clearFormErrors(form);

    setFormLoading(
        form,
        true
    );

    try {
        const data =
            serializeForm(form);

        data.timezone =
            Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone;

        const response =
            await apiRequest(
                'POST',
                API.register,
                data
            );

        const verified =
            response.data?.data?.user?.email_verified;

        if (verified) {
            window.location.href =
                '/login?registered=1';

            return;
        }

        navigate(
            'verify-email'
        );
    } catch (error) {
        showFormErrors(
            form,
            getApiErrors(error)
        );
    } finally {
        setFormLoading(
            form,
            false
        );
    }
}

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/

async function handleForgotPassword(form) {
    clearFormErrors(form);

    setFormLoading(
        form,
        true
    );

    try {
        const data =
            serializeForm(form);

        await apiRequest(
            'POST',
            API['forgot-password'],
            data
        );

        form.reset();

        let success =
            form.querySelector(
                '.auth-form-success'
            );

        if (!success) {
            success =
                document.createElement(
                    'div'
                );

            success.className =
                'auth-form-success';

            form.prepend(
                success
            );
        }

        success.textContent =
            'If this email exists, a password reset link has been sent.';
    } catch (error) {
        showFormErrors(
            form,
            getApiErrors(error)
        );
    } finally {
        setFormLoading(
            form,
            false
        );
    }
}

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
*/

async function handleResetPassword(form) {
    clearFormErrors(form);

    setFormLoading(
        form,
        true
    );

    try {
        const data =
            serializeForm(form);

        data.token =
            state.resetToken;

        if (
            !data.email &&
            state.resetEmail
        ) {
            data.email =
                state.resetEmail;
        }

        await apiRequest(
            'POST',
            API['reset-password'],
            data
        );

        navigate(
            'login'
        );
    } catch (error) {
        showFormErrors(
            form,
            getApiErrors(error)
        );
    } finally {
        setFormLoading(
            form,
            false
        );
    }
}

/*
|--------------------------------------------------------------------------
| CONFIRM PASSWORD
|--------------------------------------------------------------------------
*/

async function handleConfirmPassword(form) {
    clearFormErrors(form);

    if (!getAuthToken()) {
        window.location.href =
            '/login';

        return;
    }

    setFormLoading(
        form,
        true
    );

    try {
        const data =
            serializeForm(form);

        await apiRequest(
            'POST',
            API['confirm-password'],
            data
        );

        const params =
            new URLSearchParams(
                window.location.search
            );

        window.location.href =
            params.get('redirect') ||
            '/profile';
    } catch (error) {
        showFormErrors(
            form,
            getApiErrors(error)
        );
    } finally {
        setFormLoading(
            form,
            false
        );
    }
}

/*
|--------------------------------------------------------------------------
| VERIFICATION EMAIL
|--------------------------------------------------------------------------
*/

async function handleVerificationNotification(
    form
) {
    clearFormErrors(form);

    setFormLoading(
        form,
        true
    );

    try {
        const data =
            serializeForm(form);

        await apiRequest(
            'POST',
            API['verification-notification'],
            data
        );

        let success =
            form.querySelector(
                '.auth-form-success'
            );

        if (!success) {
            success =
                document.createElement(
                    'div'
                );

            success.className =
                'auth-form-success';

            form.prepend(
                success
            );
        }

        success.textContent =
            'Verification email has been sent.';
    } catch (error) {
        showFormErrors(
            form,
            getApiErrors(error)
        );
    } finally {
        setFormLoading(
            form,
            false
        );
    }
}

/*
|--------------------------------------------------------------------------
| Form router
|--------------------------------------------------------------------------
*/

function setupForms() {
    spa.addEventListener(
        'submit',
        async (event) => {
            const form =
                event.target.closest(
                    '[data-auth-form]'
                );

            if (!form) {
                return;
            }

            event.preventDefault();

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            if (
                submitButton?.disabled
            ) {
                return;
            }

            const type =
                form.dataset.authForm;

            switch (type) {
                case 'login':
                    await handleLogin(
                        form
                    );
                    break;

                case 'register':
                    await handleRegister(
                        form
                    );
                    break;

                case 'forgot-password':
                    await handleForgotPassword(
                        form
                    );
                    break;

                case 'reset-password':
                    await handleResetPassword(
                        form
                    );
                    break;

                case 'verification-notification':
                    await handleVerificationNotification(
                        form
                    );
                    break;

                case 'confirm-password':
                    await handleConfirmPassword(
                        form
                    );
                    break;
            }
        }
    );
}

/*
|--------------------------------------------------------------------------
| Password visibility
|--------------------------------------------------------------------------
*/

function setupPasswordToggles() {
    spa.addEventListener(
        'click',
        (event) => {
            const button =
                event.target.closest(
                    '[data-password-toggle]'
                );

            if (!button) {
                return;
            }

            event.preventDefault();

            const inputId =
                button.dataset.passwordToggle;

            if (!inputId) {
                return;
            }

            const input =
                document.getElementById(
                    inputId
                );

            if (!input) {
                return;
            }

            const visible =
                input.type === 'text';

            input.type =
                visible
                    ? 'password'
                    : 'text';

            button.setAttribute(
                'aria-label',
                visible
                    ? 'Show password'
                    : 'Hide password'
            );

            button.setAttribute(
                'aria-pressed',
                visible
                    ? 'false'
                    : 'true'
            );
        }
    );
}

/*
|--------------------------------------------------------------------------
| Initial state
|--------------------------------------------------------------------------
*/

function initializePage() {
    const page =
        getPageFromLocation();

    /*
    |--------------------------------------------------------------------------
    | Reset token
    |--------------------------------------------------------------------------
    */

    const pathname =
        window.location.pathname;

    if (
        pathname.startsWith(
            '/reset-password/'
        )
    ) {
        const token =
            decodeURIComponent(
                pathname.split(
                    '/reset-password/'
                )[1] || ''
            );

        if (token) {
            state.resetToken =
                token;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Email query
    |--------------------------------------------------------------------------
    */

    const params =
        new URLSearchParams(
            window.location.search
        );

    const email =
        params.get('email');

    if (email) {
        state.resetEmail =
            email;
    }

    /*
    |--------------------------------------------------------------------------
    | Initial active page
    |--------------------------------------------------------------------------
    */

    clearTransitionClasses();

    setActivePage(page);

    /*
    |--------------------------------------------------------------------------
    | Replace browser state
    |--------------------------------------------------------------------------
    */

    history.replaceState(
        {
            authPage:
                page,

            token:
                state.resetToken,

            email:
                state.resetEmail,
        },
        '',
        window.location.href
    );
}

/*
|--------------------------------------------------------------------------
| Query-param status banners (verified / registered / reset)
|--------------------------------------------------------------------------
*/

function showStatusBanner(form, message, isError = false) {
    if (!form) {
        return;
    }

    const className =
        isError
            ? 'auth-form-error'
            : 'auth-form-success';

    let banner =
        form.querySelector(
            `.${className}`
        );

    if (!banner) {
        banner =
            document.createElement(
                'div'
            );

        banner.className =
            className;

        form.prepend(banner);
    }

    banner.textContent =
        message;
}

function showQueryStatusBanners() {
    const params =
        new URLSearchParams(
            window.location.search
        );

    const loginForm =
        getPageElement('login')?.querySelector(
            '[data-auth-form="login"]'
        );

    if (
        window.location.pathname === '/login'
    ) {
        if (params.get('registered')) {
            showStatusBanner(
                loginForm,
                'Account created. Please sign in.'
            );
        }

        if (params.get('reset')) {
            showStatusBanner(
                loginForm,
                'Your password has been reset. Please sign in.'
            );
        }

        const verified =
            params.get('verified');

        if (verified === '1') {
            showStatusBanner(
                loginForm,
                'Your email has been verified. Please sign in.'
            );
        } else if (verified === 'already') {
            showStatusBanner(
                loginForm,
                'Your email was already verified. Please sign in.'
            );
        } else if (verified === 'invalid') {
            showStatusBanner(
                loginForm,
                'This verification link is invalid or has expired.',
                true
            );
        }
    }
}

/*
|--------------------------------------------------------------------------
| Route guarding
|--------------------------------------------------------------------------
|
| Sanctum bearer tokens are the only real signal of auth
| state here (no server session is ever established for
| API logins), so guarding has to happen client-side.
|
*/

const GUEST_ONLY_PAGES = [
    'login',
    'register',
    'forgot-password',
    'reset-password',
];

const AUTH_ONLY_PAGES = [
    'confirm-password',
];

async function guardAuthPage() {
    const page =
        getPageFromLocation();

    const token =
        getAuthToken();

    if (
        AUTH_ONLY_PAGES.includes(page) &&
        !token
    ) {
        window.location.href =
            '/login';

        return;
    }

    if (
        !token ||
        !GUEST_ONLY_PAGES.includes(page)
    ) {
        return;
    }

    try {
        await apiRequest(
            'GET',
            '/api/auth/me'
        );

        const params =
            new URLSearchParams(
                window.location.search
            );

        const redirect =
            params.get('redirect');

        window.location.href =
            (redirect && redirect.startsWith('/'))
                ? redirect
                : '/profile';
    } catch {
        localStorage.removeItem(
            'auth_token'
        );
    }
}

/*
|--------------------------------------------------------------------------
| Initialization
|--------------------------------------------------------------------------
*/

function init() {
    initializePage();

    setupNavigationLinks();

    setupHistory();

    setupForms();

    setupPasswordToggles();

    showQueryStatusBanners();

    guardAuthPage();
}

init();