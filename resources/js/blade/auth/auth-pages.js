import axios from 'axios';
import {
    focusCodeInput,
    getCodeValue,
    initCodeInput,
    resetCodeInput,
    startResendCountdown,
} from '../shared/code-input';
import { clearFieldErrors, showFieldErrors } from '../shared/forms';
import { t } from '../shared/i18n';
import { icon } from '../shared/icon';

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
 *
 * Theme, language and the form controls (password reveal, strength
 * meter) are wired in auth.js.
 */

/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const spa = document.getElementById('auth-spa');

const viewport = document.getElementById('auth-spa-viewport');

if (!spa || !viewport) {
    throw new Error('Auth SPA root was not found.');
}

/*
|--------------------------------------------------------------------------
| Pages
|--------------------------------------------------------------------------
*/

const pages = Array.from(spa.querySelectorAll('[data-auth-page]'));

if (!pages.length) {
    throw new Error('Auth SPA pages were not found.');
}

/*
|--------------------------------------------------------------------------
| State
|--------------------------------------------------------------------------
*/

const state = {
    currentPage: spa.dataset.currentPage || 'login',

    resetToken: spa.dataset.resetToken || '',

    resetEmail: spa.dataset.resetEmail || '',

    isTransitioning: false,

    transitionTimer: null,

    // The current pending code-login challenge (2FA-after-password on the
    // `login` page, or fully passwordless on `login-code`) — never the
    // code itself, just the opaque token identifying which pending
    // attempt a submitted code belongs to.
    loginChallengeToken: '',

    // Same idiom, for the `verify-email` code step — set after register
    // (or after resending the verification email) since that visitor has
    // no bearer token yet to identify themselves with instead.
    emailChallengeToken: '',
};

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

const AUTH_ROUTES = {
    login: '/login',

    'login-code': '/login/code',

    register: '/register',

    'forgot-password': '/forgot-password',

    'reset-password': '/reset-password',

    'verify-email': '/verify-email',

    'confirm-password': '/confirm-password',
};

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API = {
    login: '/api/auth/login',

    'login-verify': '/api/auth/login/verify',

    'login-code-request': '/api/auth/login/code',

    'login-code-verify': '/api/auth/login/code/verify',

    'login-code-resend': '/api/auth/login/code/resend',

    register: '/api/auth/register',

    'forgot-password': '/api/auth/forgot-password',

    'reset-password': '/api/auth/reset-password',

    'verification-notification': '/api/auth/email/verification-notification',

    'verify-email-code': '/api/auth/email/verify-code',

    'confirm-password': '/api/auth/confirm-password',
};

/*
|--------------------------------------------------------------------------
| Page order
|--------------------------------------------------------------------------
*/

const PAGE_ORDER = [
    'login',
    'login-code',
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
    return pages.find((element) => element.dataset.authPage === page);
}

function isKnownPage(page) {
    return Boolean(getPageElement(page));
}

/*
|--------------------------------------------------------------------------
| Reduced motion
|--------------------------------------------------------------------------
*/

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

function getDirection(from, to) {
    const fromIndex = PAGE_ORDER.indexOf(from);

    const toIndex = PAGE_ORDER.indexOf(to);

    if (fromIndex === -1 || toIndex === -1) {
        return 'forward';
    }

    return toIndex >= fromIndex ? 'forward' : 'backward';
}

/*
|--------------------------------------------------------------------------
| URL → Page
|--------------------------------------------------------------------------
*/

function getPageFromLocation() {
    const path = window.location.pathname;

    if (path === '/login/code') {
        return 'login-code';
    }

    if (path === '/register') {
        return 'register';
    }

    if (path === '/forgot-password') {
        return 'forgot-password';
    }

    if (path.startsWith('/reset-password/')) {
        return 'reset-password';
    }

    if (path === '/verify-email') {
        return 'verify-email';
    }

    if (path === '/confirm-password') {
        return 'confirm-password';
    }

    return 'login';
}

/*
|--------------------------------------------------------------------------
| Page → URL
|--------------------------------------------------------------------------
*/

function getUrlForPage(page, options = {}) {
    if (page === 'reset-password') {
        const token = options.token || state.resetToken;

        if (token) {
            const url = new URL(
                `/reset-password/${encodeURIComponent(token)}`,
                window.location.origin,
            );

            const email = options.email || state.resetEmail;

            if (email) {
                url.searchParams.set('email', email);
            }

            return url.pathname + url.search;
        }

        return '/reset-password';
    }

    return AUTH_ROUTES[page] || '/login';
}

/*
|--------------------------------------------------------------------------
| Clear transition classes
|--------------------------------------------------------------------------
*/

function clearTransitionClasses() {
    pages.forEach((page) => {
        page.classList.remove('is-entering', 'is-leaving');
    });
}

/*
|--------------------------------------------------------------------------
| Activate page
|--------------------------------------------------------------------------
| The current page (state, data attribute, tab title) changes at once;
| which section is on screen can lag behind it by one fade-out, see
| animatePageChange().
*/

function setCurrentPage(page) {
    spa.dataset.currentPage = page;

    state.currentPage = page;

    const title = getPageElement(page)?.dataset.authTitle;

    if (title) {
        document.title = title;
    }
}

function showPage(page) {
    pages.forEach((pageElement) => {
        pageElement.classList.toggle(
            'is-active',
            pageElement.dataset.authPage === page,
        );
    });
}

function setActivePage(page) {
    showPage(page);

    setCurrentPage(page);
}

/**
 * Moves focus to the heading of the screen that just came up, so the
 * next Tab starts inside it and a screen reader announces it (the link
 * that was clicked has just been hidden with the page it was on).
 */
function focusPageHeading(page) {
    const heading = Array.from(
        getPageElement(page)?.querySelectorAll('.auth-card__title') || [],
    ).find((title) => !title.closest('[hidden]'));

    if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    }
}

/*
|--------------------------------------------------------------------------
| Reset transition
|--------------------------------------------------------------------------
| Also completes a transition cut short by a new one: the page being
| left goes away and the current one is shown straight away.
*/

function finishTransition() {
    if (state.transitionTimer) {
        clearTimeout(state.transitionTimer);

        state.transitionTimer = null;
    }

    if (state.isTransitioning) {
        showPage(state.currentPage);
    }

    clearTransitionClasses();

    state.isTransitioning = false;
}

/*
|--------------------------------------------------------------------------
| Page transition
|--------------------------------------------------------------------------
| Opacity only, one page at a time: the old page fades out where it
| stands, then the new one replaces it and fades in. The two never
| overlap, and the column only changes height at the moment nothing is
| visible, so neither page jumps.
*/

const PAGE_FADE_OUT_MS = 140;

const PAGE_FADE_IN_MS = 220;

function animatePageChange(from, to, direction) {
    const fromElement = getPageElement(from);

    const toElement = getPageElement(to);

    if (!toElement) {
        return;
    }

    finishTransition();

    /*
    |--------------------------------------------------------------------------
    | Same page, or no motion wanted
    |--------------------------------------------------------------------------
    */

    if (from === to || !fromElement || prefersReducedMotion()) {
        setActivePage(to);

        if (from !== to) {
            focusPageHeading(to);
        }

        return;
    }

    state.isTransitioning = true;

    viewport.dataset.direction = direction;

    setCurrentPage(to);

    /*
    |--------------------------------------------------------------------------
    | Old page fades out in place
    |--------------------------------------------------------------------------
    */

    fromElement.classList.add('is-leaving');

    state.transitionTimer = window.setTimeout(() => {
        /*
        |----------------------------------------------------------------------
        | New page takes its place and fades in
        |----------------------------------------------------------------------
        */

        fromElement.classList.remove('is-leaving');

        toElement.classList.add('is-entering');

        showPage(to);

        focusPageHeading(to);

        state.transitionTimer = window.setTimeout(
            finishTransition,
            PAGE_FADE_IN_MS,
        );
    }, PAGE_FADE_OUT_MS);
}

/*
|--------------------------------------------------------------------------
| Navigate
|--------------------------------------------------------------------------
*/

function navigate(page, options = {}) {
    if (!isKnownPage(page)) {
        return;
    }

    const current = state.currentPage;

    /*
    |--------------------------------------------------------------------------
    | Same page
    |--------------------------------------------------------------------------
    */

    if (current === page && !options.force) {
        return;
    }

    /*
    |--------------------------------------------------------------------------
    | Direction
    |--------------------------------------------------------------------------
    */

    const direction = options.direction || getDirection(current, page);

    /*
    |--------------------------------------------------------------------------
    | Update reset state
    |--------------------------------------------------------------------------
    */

    if (options.token) {
        state.resetToken = options.token;
    }

    if (options.email) {
        state.resetEmail = options.email;
    }

    /*
    |--------------------------------------------------------------------------
    | Update URL
    |--------------------------------------------------------------------------
    */

    if (!options.fromPopState) {
        const url = getUrlForPage(page, options);

        history.pushState(
            {
                authPage: page,

                token: state.resetToken,

                email: state.resetEmail,
            },
            '',
            url,
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Animate
    |--------------------------------------------------------------------------
    */

    animatePageChange(current, page, direction);
}

/*
|--------------------------------------------------------------------------
| Navigation links
|--------------------------------------------------------------------------
*/

function setupNavigationLinks() {
    spa.addEventListener('click', (event) => {
        const link = event.target.closest('[data-auth-link]');

        if (!link) {
            return;
        }

        /*
            |--------------------------------------------------------------------------
            | Allow browser modified clicks
            |--------------------------------------------------------------------------
            */

        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        event.preventDefault();

        const page = link.dataset.authLink;

        if (!page || !isKnownPage(page)) {
            return;
        }

        navigate(page);
    });
}

/*
|--------------------------------------------------------------------------
| Browser back / forward
|--------------------------------------------------------------------------
*/

function setupHistory() {
    window.addEventListener('popstate', (event) => {
        const page = event.state?.authPage || getPageFromLocation();

        if (!isKnownPage(page)) {
            return;
        }

        if (event.state?.token) {
            state.resetToken = event.state.token;
        }

        if (event.state?.email) {
            state.resetEmail = event.state.email;
        }

        const direction = getDirection(state.currentPage, page);

        animatePageChange(state.currentPage, page, direction);
    });
}

/*
|--------------------------------------------------------------------------
| API errors
|--------------------------------------------------------------------------
*/

function getApiErrors(error) {
    const response = error?.response;

    const data = response?.data;

    if (data?.errors && typeof data.errors === 'object') {
        return data.errors;
    }

    if (data?.message) {
        return {
            general: [data.message],
        };
    }

    return {
        general: [t('common.error_generic')],
    };
}

/*
|--------------------------------------------------------------------------
| Clear errors
|--------------------------------------------------------------------------
*/

/**
 * Field messages, aria-invalid, and both banners where this form's
 * banners are shown (CSS hides an empty banner).
 */
function clearFormErrors(form) {
    clearFieldErrors(form);

    bannerHost(form)
        .querySelectorAll('[data-auth-banner] .alert__content')
        .forEach((slot) => {
            slot.replaceChildren();
            slot.removeAttribute('data-visible');
        });
}

/*
|--------------------------------------------------------------------------
| Form banners
|--------------------------------------------------------------------------
| One success and one error banner at the top of a form, drawn as the
| shared `.alert`. The error banner's text slot is the form's
| [data-field-error="general"]. A form that is not the first on its page
| can send its banners up to the first one with
| `data-auth-banners-in="<that form's data-auth-form>"`, so a message
| sits under the page heading rather than between buttons.
*/

function bannerHost(form) {
    const hostName = form.dataset.authBannersIn;

    return (
        (hostName &&
            spa.querySelector(`[data-auth-form="${CSS.escape(hostName)}"]`)) ||
        form
    );
}

function formBanner(form, type) {
    const isError = type === 'error';

    const host = bannerHost(form);

    let banner = host.querySelector(`[data-auth-banner="${type}"]`);

    if (!banner) {
        banner = document.createElement('div');
        banner.className = `alert alert--${isError ? 'error' : 'success'} auth-alert`;
        banner.dataset.authBanner = type;
        banner.setAttribute('role', isError ? 'alert' : 'status');
        banner.innerHTML = `
            <span class="alert__icon">${icon(isError ? 'alert' : 'check', { size: 20 })}</span>
            <div class="alert__content"${isError ? ' data-field-error="general"' : ''}></div>
        `;
        host.prepend(banner);
    }

    return banner.querySelector('.alert__content');
}

/*
|--------------------------------------------------------------------------
| Show errors
|--------------------------------------------------------------------------
| Field messages go through the shared showFieldErrors(); a `general`
| message (no single field to blame), or one about a field this form
| has no slot for, goes into the error banner instead of being lost.
*/

function showFormErrors(form, errors) {
    const { general, ...fields } = errors;

    showFieldErrors(form, fields);

    const unplaced = Object.entries(fields).find(
        ([field]) =>
            !form.querySelector(`[data-field-error="${CSS.escape(field)}"]`),
    );

    const message = general || unplaced?.[1];

    if (!message) {
        return;
    }

    const slot = formBanner(form, 'error');

    slot.textContent = Array.isArray(message) ? message[0] : message;
    slot.setAttribute('data-visible', 'true');
}

/**
 * The API reports a mismatched repeat under `password`; the designs put
 * it on the repeat field (the password itself may well be a good one),
 * so it is caught here before anything is sent.
 */
function showPasswordMismatch(form, data) {
    if ((data.password ?? '') === (data.password_confirmation ?? '')) {
        return false;
    }

    showFormErrors(form, {
        password_confirmation: [t('auth.passwords_mismatch')],
    });

    return true;
}

/*
|--------------------------------------------------------------------------
| Loading state
|--------------------------------------------------------------------------
*/

/**
 * A busy submit button keeps its label and gets a spinner in front of it
 * (`.btn[aria-busy]` also blocks further clicks); setupForms() ignores a
 * submit while it is busy, which covers Enter in a field too.
 */
function setFormLoading(form, loading) {
    form.querySelectorAll('button[type="submit"]').forEach((button) => {
        button.classList.toggle('is-loading', loading);

        button.setAttribute('aria-busy', loading ? 'true' : 'false');

        const spinner = button.querySelector(':scope > .spinner');

        if (loading && !spinner) {
            button.insertAdjacentHTML(
                'afterbegin',
                '<span class="spinner" aria-hidden="true"></span>',
            );
        } else if (!loading) {
            spinner?.remove();
        }
    });
}

function isFormBusy(form) {
    return Boolean(
        form.querySelector('button[type="submit"][aria-busy="true"]'),
    );
}

/*
|--------------------------------------------------------------------------
| Serialize form
|--------------------------------------------------------------------------
*/

function serializeForm(form) {
    const formData = new FormData(form);

    const data = {};

    formData.forEach((value, key) => {
        data[key] = value;
    });

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

async function apiRequest(method, url, data = {}) {
    const token = getAuthToken();

    return axios({
        method,
        url,
        data,

        headers: {
            Accept: 'application/json',

            'Content-Type': 'application/json',

            'X-Requested-With': 'XMLHttpRequest',

            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },

        withCredentials: true,
    });
}

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

function redirectAfterLogin() {
    const params = new URLSearchParams(window.location.search);

    // No explicit `?redirect=` (or it isn't a safe local path) means
    // there's no specifically required flow to send the user back to —
    // land on the dashboard, the app's actual home, not the public
    // marketing page or (see sanitizeRedirect) back on a guest page.
    window.location.href = sanitizeRedirect(
        params.get('redirect'),
        '/dashboard',
    );
}

function storeTokenAndRedirect(response) {
    const token =
        response.data?.data?.token || response.data?.data?.access_token;

    if (token) {
        localStorage.setItem('auth_token', token);
    }

    redirectAfterLogin();
}

/** Writes the address the visitor typed into a page's [data-auth-email] spots. */
function showEmailIn(page, email) {
    getPageElement(page)
        ?.querySelectorAll('[data-auth-email]')
        .forEach((element) => {
            element.textContent = email || '';
        });
}

/**
 * Shows one `[data-auth-step]` within a page and hides its siblings,
 * then puts focus in it: the first code box, or (going back) the
 * first field — the button that was pressed has just been hidden.
 */
function showStep(page, step) {
    getPageElement(page)
        ?.querySelectorAll('[data-auth-step]')
        .forEach((element) => {
            element.hidden = element.dataset.authStep !== step;
        });

    if (step !== 'password' && step !== 'request') {
        const container = getPageElement(page)?.querySelector(
            '[data-auth-step="verify"] [data-code-input]',
        );

        if (container) {
            clearFormErrors(container.closest('form'));
            resetCodeInput(container);
            focusCodeInput(container);
        }

        return;
    }

    getPageElement(page)
        ?.querySelector(`[data-auth-step="${step}"] input:not([type="hidden"])`)
        ?.focus();
}

async function handleLogin(form) {
    clearFormErrors(form);

    setFormLoading(form, true);

    try {
        const data = serializeForm(form);

        data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await apiRequest('POST', API.login, data);

        if (response.data?.data?.requires_verification) {
            state.loginChallengeToken = response.data.data.challenge_token;
            showEmailIn('login', data.email);
            showStep('login', 'verify');
            startCodeResendCountdown('login');

            return;
        }

        storeTokenAndRedirect(response);
    } catch (error) {
        showFormErrors(form, getApiErrors(error));
    } finally {
        setFormLoading(form, false);
    }
}

/*
|--------------------------------------------------------------------------
| CODE-BASED LOGIN (2FA-after-password + fully passwordless)
|--------------------------------------------------------------------------
*/

function codeVerifyErrorMessage(error) {
    const errorCode = error?.response?.data?.data?.error_code;
    const key =
        {
            invalid_code: 'auth.code_invalid',
            code_expired: 'auth.code_expired',
            too_many_attempts: 'auth.code_too_many_attempts',
        }[errorCode] || null;

    return key ? { code: [t(key)] } : getApiErrors(error);
}

async function handleLoginVerifyCode(form) {
    clearFormErrors(form);
    setFormLoading(form, true);

    try {
        const response = await apiRequest('POST', API['login-verify'], {
            challenge_token: state.loginChallengeToken,
            code: getCodeValue(form.querySelector('[data-code-input]')),
        });

        storeTokenAndRedirect(response);
    } catch (error) {
        showFormErrors(form, codeVerifyErrorMessage(error));
        resetCodeInput(form.querySelector('[data-code-input]'));
    } finally {
        setFormLoading(form, false);
    }
}

async function handleLoginCodeRequest(form) {
    clearFormErrors(form);
    setFormLoading(form, true);

    try {
        const data = serializeForm(form);
        const response = await apiRequest(
            'POST',
            API['login-code-request'],
            data,
        );

        state.loginChallengeToken = response.data?.data?.challenge_token || '';
        showEmailIn('login-code', data.email);
        showStep('login-code', 'verify');
        startCodeResendCountdown('login-code');
    } catch (error) {
        showFormErrors(form, getApiErrors(error));
    } finally {
        setFormLoading(form, false);
    }
}

async function handleLoginCodeVerify(form) {
    clearFormErrors(form);
    setFormLoading(form, true);

    try {
        const response = await apiRequest('POST', API['login-code-verify'], {
            challenge_token: state.loginChallengeToken,
            code: getCodeValue(form.querySelector('[data-code-input]')),
        });

        storeTokenAndRedirect(response);
    } catch (error) {
        showFormErrors(form, codeVerifyErrorMessage(error));
        resetCodeInput(form.querySelector('[data-code-input]'));
    } finally {
        setFormLoading(form, false);
    }
}

/** Purpose is inferred from which page's verify step is currently visible. */
function currentCodePurpose() {
    return state.currentPage === 'login-code'
        ? 'passwordless_login'
        : 'login_2fa';
}

async function resendCurrentLoginCode(button) {
    if (!state.loginChallengeToken || button.disabled) {
        return;
    }

    try {
        const { data } = await apiRequest('POST', API['login-code-resend'], {
            challenge_token: state.loginChallengeToken,
            purpose: currentCodePurpose(),
        });

        state.loginChallengeToken =
            data?.data?.challenge_token || state.loginChallengeToken;
        startResendCountdown(
            button,
            60,
            resendCountdownLabel,
            t('auth.resend_code'),
        );
    } catch {
        // Non-critical — the button just stays enabled and the user can retry.
    }
}

/** "Resend in 0:45" — the wait as m:ss. */
function resendCountdownLabel(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, '0');

    return t('auth.resend_in', { seconds: `${minutes}:${rest}` });
}

function startCodeResendCountdown(page) {
    const button = getPageElement(page)?.querySelector('[data-resend-code]');

    if (button) {
        startResendCountdown(
            button,
            60,
            resendCountdownLabel,
            t('auth.resend_code'),
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

    const data = serializeForm(form);

    if (showPasswordMismatch(form, data)) {
        return;
    }

    setFormLoading(form, true);

    try {
        data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const response = await apiRequest('POST', API.register, data);

        const verified = response.data?.data?.user?.email_verified;

        if (verified) {
            window.location.href = '/login?registered=1';

            return;
        }

        state.emailChallengeToken =
            response.data?.data?.email_challenge_token || '';

        setVerifyEmail(data.email);

        navigate('verify-email');
    } catch (error) {
        showFormErrors(form, getApiErrors(error));
    } finally {
        setFormLoading(form, false);
    }
}

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD
|--------------------------------------------------------------------------
*/

async function handleForgotPassword(form) {
    clearFormErrors(form);

    setFormLoading(form, true);

    try {
        const data = serializeForm(form);

        await apiRequest('POST', API['forgot-password'], data);

        form.reset();

        formBanner(form, 'success').textContent = t(
            'auth.forgot_password_sent',
        );
    } catch (error) {
        showFormErrors(form, getApiErrors(error));
    } finally {
        setFormLoading(form, false);
    }
}

/*
|--------------------------------------------------------------------------
| RESET PASSWORD
|--------------------------------------------------------------------------
*/

async function handleResetPassword(form) {
    clearFormErrors(form);

    const data = serializeForm(form);

    if (showPasswordMismatch(form, data)) {
        return;
    }

    setFormLoading(form, true);

    try {
        data.token = state.resetToken;

        if (!data.email && state.resetEmail) {
            data.email = state.resetEmail;
        }

        await apiRequest('POST', API['reset-password'], data);

        showStatusBanner(
            getPageElement('login')?.querySelector('[data-auth-form="login"]'),
            t('auth.status_reset'),
        );

        navigate('login');
    } catch (error) {
        showFormErrors(form, getApiErrors(error));
    } finally {
        setFormLoading(form, false);
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
        window.location.href = '/login';

        return;
    }

    setFormLoading(form, true);

    try {
        const data = serializeForm(form);

        await apiRequest('POST', API['confirm-password'], data);

        const params = new URLSearchParams(window.location.search);

        window.location.href = sanitizeRedirect(
            params.get('redirect'),
            '/profile',
        );
    } catch (error) {
        showFormErrors(form, getApiErrors(error));
    } finally {
        setFormLoading(form, false);
    }
}

/*
|--------------------------------------------------------------------------
| VERIFICATION EMAIL
|--------------------------------------------------------------------------
*/

async function handleVerificationNotification(form) {
    clearFormErrors(form);

    setFormLoading(form, true);

    try {
        const data = serializeForm(form);

        const response = await apiRequest(
            'POST',
            API['verification-notification'],
            data,
        );

        state.emailChallengeToken =
            response.data?.data?.email_challenge_token || '';

        setVerifyEmail(data.email);

        formBanner(form, 'success').textContent = t('auth.verification_sent');
    } catch (error) {
        const errors = getApiErrors(error);

        // The address field is hidden once known — bring it back when the
        // server has something to say about it.
        if (errors.email) {
            getPageElement('verify-email')
                ?.querySelector('[data-verify-email-field]')
                ?.removeAttribute('hidden');
        }

        showFormErrors(form, errors);
    } finally {
        setFormLoading(form, false);
    }
}

/**
 * Once the address is known (just registered, just resent, or the
 * signed-in account's), the page names it and stops asking for it; the
 * resend form still posts it from the now hidden field.
 */
function setVerifyEmail(email) {
    const page = getPageElement('verify-email');

    if (!page || !email) {
        return;
    }

    showEmailIn('verify-email', email);

    page.querySelectorAll('[data-verify-text]').forEach((element) => {
        element.hidden = element.dataset.verifyText !== 'email';
    });

    const input = page.querySelector('#verification-email');

    if (input) {
        input.value = email;
    }

    page.querySelector('[data-verify-email-field]')?.setAttribute('hidden', '');
}

/** A signed-in visitor on /verify-email: fill in their own address. */
async function prefillVerifyEmail() {
    if (getPageFromLocation() !== 'verify-email' || !getAuthToken()) {
        return;
    }

    try {
        const { data } = await apiRequest('GET', '/api/auth/me');

        setVerifyEmail(data?.data?.user?.email || '');
    } catch {
        // Not critical — the page just keeps asking for the address.
    }
}

/*
|--------------------------------------------------------------------------
| VERIFY EMAIL BY CODE (alternative to clicking the link)
|--------------------------------------------------------------------------
*/

async function handleVerifyEmailCode(form) {
    clearFormErrors(form);
    setFormLoading(form, true);

    try {
        await apiRequest('POST', API['verify-email-code'], {
            code: getCodeValue(form.querySelector('[data-code-input]')),
            challenge_token: state.emailChallengeToken,
        });

        // An already-authenticated visitor (verifying from inside the app,
        // e.g. after changing their email) has a session to go back to; a
        // freshly registered one has no token yet, so send them to sign in
        // — the login page already renders the `verified=1` banner for
        // this (same one the emailed link's flow uses).
        window.location.href = getAuthToken()
            ? '/dashboard'
            : '/login?verified=1';
    } catch (error) {
        showFormErrors(form, codeVerifyErrorMessage(error));
        resetCodeInput(form.querySelector('[data-code-input]'));
    } finally {
        setFormLoading(form, false);
    }
}

/*
|--------------------------------------------------------------------------
| Form router
|--------------------------------------------------------------------------
*/

function setupForms() {
    spa.addEventListener('submit', async (event) => {
        const form = event.target.closest('[data-auth-form]');

        if (!form) {
            return;
        }

        event.preventDefault();

        if (isFormBusy(form)) {
            return;
        }

        const type = form.dataset.authForm;

        switch (type) {
            case 'login':
                await handleLogin(form);
                break;

            case 'login-verify':
                await handleLoginVerifyCode(form);
                break;

            case 'login-code-request':
                await handleLoginCodeRequest(form);
                break;

            case 'login-code-verify':
                await handleLoginCodeVerify(form);
                break;

            case 'register':
                await handleRegister(form);
                break;

            case 'forgot-password':
                await handleForgotPassword(form);
                break;

            case 'reset-password':
                await handleResetPassword(form);
                break;

            case 'verification-notification':
                await handleVerificationNotification(form);
                break;

            case 'verify-email-code':
                await handleVerifyEmailCode(form);
                break;

            case 'confirm-password':
                await handleConfirmPassword(form);
                break;
        }
    });
}

/*
|--------------------------------------------------------------------------
| Code-entry steps: back links, resend, auto-submit on 6th digit
|--------------------------------------------------------------------------
*/

function setupCodeInputs() {
    spa.querySelectorAll('[data-code-input]').forEach((container) => {
        initCodeInput(container, () => {
            container.closest('form')?.requestSubmit();
        });
    });
}

function setupStepControls() {
    spa.addEventListener('click', (event) => {
        if (event.target.closest('[data-back-to-password]')) {
            showStep('login', 'password');
        }

        if (event.target.closest('[data-back-to-request]')) {
            showStep('login-code', 'request');
        }

        const resend = event.target.closest('[data-resend-code]');

        if (resend) {
            resendCurrentLoginCode(resend);
        }
    });
}

/*
|--------------------------------------------------------------------------
| Initial state
|--------------------------------------------------------------------------
*/

function initializePage() {
    const page = getPageFromLocation();

    /*
    |--------------------------------------------------------------------------
    | Reset token
    |--------------------------------------------------------------------------
    */

    const pathname = window.location.pathname;

    if (pathname.startsWith('/reset-password/')) {
        const token = decodeURIComponent(
            pathname.split('/reset-password/')[1] || '',
        );

        if (token) {
            state.resetToken = token;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Email query
    |--------------------------------------------------------------------------
    */

    const params = new URLSearchParams(window.location.search);

    const email = params.get('email');

    if (email) {
        state.resetEmail = email;
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
            authPage: page,

            token: state.resetToken,

            email: state.resetEmail,
        },
        '',
        window.location.href,
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

    formBanner(form, isError ? 'error' : 'success').textContent = message;
}

function showQueryStatusBanners() {
    const params = new URLSearchParams(window.location.search);

    const loginForm = getPageElement('login')?.querySelector(
        '[data-auth-form="login"]',
    );

    if (window.location.pathname === '/login') {
        if (params.get('registered')) {
            showStatusBanner(loginForm, t('auth.status_registered'));
        }

        if (params.get('reset')) {
            showStatusBanner(loginForm, t('auth.status_reset'));
        }

        const verified = params.get('verified');

        if (verified === '1') {
            showStatusBanner(loginForm, t('auth.status_verified'));
        } else if (verified === 'already') {
            showStatusBanner(loginForm, t('auth.status_verified_already'));
        } else if (verified === 'invalid') {
            showStatusBanner(
                loginForm,
                t('auth.status_verification_invalid'),
                true,
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

/**
 * A signed-in visitor is sent on from these. A reset link is not one
 * of them: a signed-in visitor can ask for one too (confirm-password
 * offers "Forgot password?"), and opening it must not bounce them to
 * the dashboard before they can set the new password.
 */
const GUEST_ONLY_PAGES = ['login', 'login-code', 'register', 'forgot-password'];

const AUTH_ONLY_PAGES = ['confirm-password'];

/** Pages that are never where a sign-in lands (see sanitizeRedirect). */
const NO_RETURN_PAGES = [...GUEST_ONLY_PAGES, 'reset-password'];

/**
 * Every no-return page's actual URL (not just its page key) — a
 * `?redirect=` value pointing back at one of these is never honored,
 * otherwise a stale or crafted `redirect=/login` sends someone right
 * back to the login screen immediately after successfully signing in.
 * Only a same-origin path is ever followed. A plain `startsWith('/')`
 * check is not enough: browsers read a backslash as a slash (so
 * "/" + "\" + "evil.com" is `//evil.com`) and drop tabs and newlines
 * inside a URL, which turns "/<tab>/evil.com" into the protocol-relative
 * `//evil.com`, and a `javascript:` value would run script. So the
 * value is parsed as a URL against this origin and dropped unless it
 * resolves back to the same origin.
 */
function sanitizeRedirect(path, fallback) {
    if (
        !path ||
        !path.startsWith('/') ||
        path.startsWith('//') ||
        path.includes('\\')
    ) {
        return fallback;
    }

    let url;

    try {
        url = new URL(path, window.location.origin);
    } catch {
        return fallback;
    }

    if (url.origin !== window.location.origin) {
        return fallback;
    }

    const guestUrls = NO_RETURN_PAGES.map((page) => getUrlForPage(page));

    if (guestUrls.includes(url.pathname)) {
        return fallback;
    }

    return url.pathname + url.search + url.hash;
}

async function guardAuthPage() {
    const page = getPageFromLocation();

    const token = getAuthToken();

    if (AUTH_ONLY_PAGES.includes(page) && !token) {
        window.location.href = '/login';

        return;
    }

    if (!token || !GUEST_ONLY_PAGES.includes(page)) {
        return;
    }

    try {
        await apiRequest('GET', '/api/auth/me');

        const params = new URLSearchParams(window.location.search);

        window.location.href = sanitizeRedirect(
            params.get('redirect'),
            '/dashboard',
        );
    } catch (error) {
        // Same rule as shared/auth-state.js: only a 401 means this token
        // is dead. A server error must not throw away a valid session.
        if (error?.response?.status === 401) {
            localStorage.removeItem('auth_token');
        }
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

    setupCodeInputs();

    setupStepControls();

    showQueryStatusBanners();

    guardAuthPage();

    prefillVerifyEmail();
}

init();
