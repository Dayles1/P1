import axios from 'axios';


/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const root =
    document.documentElement;

const spa =
    document.getElementById(
        'auth-spa'
    );

const viewport =
    document.getElementById(
        'auth-spa-viewport'
    );

const themeToggle =
    document.getElementById(
        'theme-toggle'
    );


if (!spa || !viewport) {
    throw new Error(
        'Auth SPA root was not found.'
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

    previousPage:
        null,

    isNavigating:
        false,

    resetToken:
        spa.dataset.resetToken || '',

    resetEmail:
        spa.dataset.resetEmail || '',
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
};


/*
|--------------------------------------------------------------------------
| Page elements
|--------------------------------------------------------------------------
*/

const pages =
    Array.from(
        spa.querySelectorAll(
            '[data-auth-page]'
        )
    );


/*
|--------------------------------------------------------------------------
| Helpers
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
| URL → Page
|--------------------------------------------------------------------------
*/

function getPageFromLocation() {

    const path =
        window.location.pathname;


    if (path === '/register') {
        return 'register';
    }


    if (path === '/forgot-password') {
        return 'forgot-password';
    }


    if (
        path.startsWith(
            '/reset-password/'
        )
    ) {
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


            if (options.email) {

                url.searchParams.set(
                    'email',
                    options.email
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
| Navigation direction
|--------------------------------------------------------------------------
*/

function getDirection(
    from,
    to
) {

    const order = [
        'login',
        'register',
        'forgot-password',
        'reset-password',
        'verify-email',
        'confirm-password'
    ];


    const fromIndex =
        order.indexOf(from);

    const toIndex =
        order.indexOf(to);


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
| Show page
|--------------------------------------------------------------------------
*/

function applyPage(
    page,
    direction = 'forward'
) {

    pages.forEach(
        (pageElement) => {

            const isActive =
                pageElement.dataset.authPage === page;

            pageElement.classList.toggle(
                'is-active',
                isActive
            );
        }
    );


    viewport.dataset.direction =
        direction;


    spa.dataset.currentPage =
        page;

    state.currentPage =
        page;
}


/*
|--------------------------------------------------------------------------
| Navigate without request
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


    if (current === page) {
        return;
    }


    const direction =
        options.direction ||
        getDirection(
            current,
            page
        );


    state.previousPage =
        current;


    /*
     * URL changes WITHOUT HTTP request.
     */

    if (!options.fromPopState) {

        const url =
            getUrlForPage(
                page,
                options
            );


        history.pushState(
            {
                authPage: page,

                token:
                    options.token ||
                    state.resetToken,

                email:
                    options.email ||
                    state.resetEmail
            },

            '',
            url
        );
    }


    /*
     * Update state.
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
     * Animate.
     */

    animatePageChange(
        current,
        page,
        direction
    );
}


/*
|--------------------------------------------------------------------------
| Page animation
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


    if (
        !fromElement ||
        !toElement
    ) {
        applyPage(
            to,
            direction
        );

        return;
    }


    /*
     * Remove old transition classes.
     */

    fromElement.classList.remove(
        'page-leaving',
        'page-leaving-backward'
    );

    toElement.classList.remove(
        'page-entering',
        'page-entering-backward'
    );


    /*
     * Force browser reflow.
     */

    void viewport.offsetWidth;


    /*
     * Entering page.
     */

    if (direction === 'forward') {

        toElement.classList.add(
            'page-entering'
        );

    } else {

        toElement.classList.add(
            'page-entering-backward'
        );
    }


    /*
     * Activate target.
     */

    applyPage(
        to,
        direction
    );


    /*
     * Leaving current page.
     */

    if (direction === 'forward') {

        fromElement.classList.add(
            'page-leaving'
        );

    } else {

        fromElement.classList.add(
            'page-leaving-backward'
        );
    }


    /*
     * Remove animation helpers.
     */

    window.setTimeout(
        () => {

            fromElement.classList.remove(
                'page-leaving',
                'page-leaving-backward'
            );

            toElement.classList.remove(
                'page-entering',
                'page-entering-backward'
            );

        },
        420
    );
}


/*
|--------------------------------------------------------------------------
| Handle regular auth links
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


            event.preventDefault();


            const page =
                link.dataset.authLink;


            navigate(page);
        }
    );
}


/*
|--------------------------------------------------------------------------
| Browser back / forward
|--------------------------------------------------------------------------
*/

window.addEventListener(
    'popstate',
    (event) => {

        const page =
            event.state?.authPage ||
            getPageFromLocation();


        state.resetToken =
            event.state?.token ||
            state.resetToken;


        state.resetEmail =
            event.state?.email ||
            state.resetEmail;


        const direction =
            getDirection(
                state.currentPage,
                page
            );


        applyPage(
            page,
            direction
        );
    }
);


/*
|--------------------------------------------------------------------------
| API error messages
|--------------------------------------------------------------------------
*/

function getApiErrors(
    error
) {

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


    if (
        data?.message
    ) {
        return {
            general: [
                data.message
            ]
        };
    }


    return {
        general: [
            'Something went wrong. Please try again.'
        ]
    };
}


/*
|--------------------------------------------------------------------------
| Form errors
|--------------------------------------------------------------------------
*/

function clearFormErrors(
    form
) {

    form.querySelectorAll(
        '.form-error'
    ).forEach(
        (element) => {

            element.textContent =
                '';

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
    }
}


function showFormErrors(
    form,
    errors
) {

    clearFormErrors(
        form
    );


    Object.entries(errors)
        .forEach(
            ([field, messages]) => {

                const message =
                    Array.isArray(messages)
                        ? messages[0]
                        : messages;


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

                    return;
                }


                const input =
                    form.querySelector(
                        `[name="${field}"]`
                    );


                const errorElement =
                    form.querySelector(
                        `[data-error-for="${field}"]`
                    );


                if (input) {

                    input.classList.add(
                        'is-invalid'
                    );
                }


                if (errorElement) {

                    errorElement.textContent =
                        message;
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

    form
        .querySelectorAll(
            'button[type="submit"]'
        )
        .forEach(
            (button) => {

                button.disabled =
                    loading;

                button.classList.toggle(
                    'is-loading',
                    loading
                );
            }
        );
}


/*
|--------------------------------------------------------------------------
| Form data
|--------------------------------------------------------------------------
*/

function serializeForm(
    form
) {

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

async function apiRequest(
    method,
    url,
    data
) {

    return axios({
        method,
        url,
        data,

        headers: {
            'Accept':
                'application/json',

            'Content-Type':
                'application/json',

            'X-Requested-With':
                'XMLHttpRequest',
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

async function handleLogin(
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


        /*
         * Timezone.
         */

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


        /*
         * Backend response can have
         * token / access_token.
         */

        const token =
            response.data?.token ||
            response.data?.access_token;


        if (token) {

            localStorage.setItem(
                'auth_token',
                token
            );
        }


        /*
         * Successful login.
         */

        window.location.href =
            '/';

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

async function handleRegister(
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


        data.timezone =
            Intl.DateTimeFormat()
                .resolvedOptions()
                .timeZone;


        await apiRequest(
            'POST',
            API.register,
            data
        );


        /*
         * Registration successful.
         *
         * Verification page.
         */

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

async function handleForgotPassword(
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
            API['forgot-password'],
            data
        );


        /*
         * Don't expose whether email exists.
         */

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

async function handleResetPassword(
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


        data.token =
            state.resetToken;


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


            const type =
                form.dataset.authForm;


            switch (type) {

                case 'login':

                    await handleLogin(form);

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

                    await handleVerificationNotification(
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


            const input =
                document.getElementById(
                    button.dataset.passwordToggle
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
        }
    );
}


/*
|--------------------------------------------------------------------------
| Theme
|--------------------------------------------------------------------------
|
| Здесь оставляем твой переключатель темы.
|
|--------------------------------------------------------------------------
*/

function getWaveGeometry() {

    if (!themeToggle) {

        return {
            x:
                window.innerWidth / 2,

            y:
                window.innerHeight / 2,

            radius:
                Math.hypot(
                    window.innerWidth,
                    window.innerHeight
                )
        };
    }


    const rect =
        themeToggle.getBoundingClientRect();


    const x =
        rect.left +
        rect.width / 2;


    const y =
        rect.top +
        rect.height / 2;


    const radius =
        Math.ceil(
            Math.max(

                Math.hypot(
                    x,
                    y
                ),

                Math.hypot(
                    window.innerWidth - x,
                    y
                ),

                Math.hypot(
                    x,
                    window.innerHeight - y
                ),

                Math.hypot(
                    window.innerWidth - x,
                    window.innerHeight - y
                )
            )
        );


    return {
        x,
        y,
        radius
    };
}


let themeAnimation =
    null;


let themeTransition =
    null;


function prefersReducedMotion() {

    return window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;
}


function toggleTheme() {

    const current =
        root.dataset.theme === 'dark'
            ? 'dark'
            : 'light';


    const next =
        current === 'dark'
            ? 'light'
            : 'dark';


    if (
        !document.startViewTransition ||
        prefersReducedMotion()
    ) {

        root.dataset.theme =
            next;

        localStorage.setItem(
            'theme',
            next
        );

        return;
    }


    /*
     * IMPORTANT:
     * geometry BEFORE transition.
     */

    const geometry =
        getWaveGeometry();


    /*
     * If animation is already running,
     * reverse it instead of starting
     * another transition.
     */

    if (
        themeAnimation &&
        themeTransition
    ) {

        root.dataset.theme =
            next;

        localStorage.setItem(
            'theme',
            next
        );


        themeAnimation.reverse();

        return;
    }


    themeTransition =
        document.startViewTransition(
            () => {

                root.dataset.theme =
                    next;

                localStorage.setItem(
                    'theme',
                    next
                );
            }
        );


    themeTransition.ready
        .then(() => {

            themeAnimation =
                root.animate(

                    [
                        {
                            clipPath:
                                `circle(0px at ` +
                                `${geometry.x}px ` +
                                `${geometry.y}px)`
                        },

                        {
                            clipPath:
                                `circle(` +
                                `${geometry.radius}px at ` +
                                `${geometry.x}px ` +
                                `${geometry.y}px)`
                        }
                    ],

                    {
                        duration: 560,

                        easing:
                            'cubic-bezier(0.16, 1, 0.3, 1)',

                        fill: 'both',

                        pseudoElement:
                            '::view-transition-new(root)'
                    }
                );


            themeAnimation.onfinish =
                () => {

                    themeAnimation =
                        null;

                    themeTransition =
                        null;
                };


            themeAnimation.oncancel =
                () => {

                    themeAnimation =
                        null;

                    themeTransition =
                        null;
                };
        })
        .catch(() => {

            themeAnimation =
                null;

            themeTransition =
                null;
        });
}


themeToggle?.addEventListener(
    'click',
    toggleTheme
);


/*
|--------------------------------------------------------------------------
| Initialization
|--------------------------------------------------------------------------
*/

function init() {

    /*
     * URL is the source of truth
     * when page is loaded directly.
     */

    const page =
        getPageFromLocation();


    applyPage(
        page,
        'forward'
    );


    /*
     * SPA navigation.
     */

    setupNavigationLinks();


    /*
     * Forms.
     */

    setupForms();


    /*
     * Passwords.
     */

    setupPasswordToggles();
}


init();