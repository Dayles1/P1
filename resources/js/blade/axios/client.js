import axios from 'axios';

const api = axios.create({
    baseURL: '/api',

    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },

    withCredentials: true,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token');

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (window.__i18n?.locale) {
            config.headers['X-Locale'] = window.__i18n.locale;
        }

        config.__startedAt = performance.now();

        return config;
    },
    (error) => Promise.reject(error),
);

/**
 * Developer Mode (Settings -> Developer) listens for this — kept as a
 * plain DOM CustomEvent rather than a JS import so the axios client never
 * has to know the dev panel exists. Only every real request/response is
 * reported; nothing here is fabricated.
 */
function reportDevRequest(config, response, error) {
    if (!document.documentElement.hasAttribute('data-developer-mode')) {
        return;
    }

    const duration = config.__startedAt
        ? Math.round(performance.now() - config.__startedAt)
        : null;

    document.dispatchEvent(
        new CustomEvent('dev-request', {
            detail: {
                method: (config.method || 'get').toUpperCase(),
                url: (config.baseURL || '') + (config.url || ''),
                status: response?.status ?? error?.response?.status ?? null,
                duration,
                ok: !error,
            },
        }),
    );
}

api.interceptors.response.use(
    (response) => {
        reportDevRequest(response.config, response, null);

        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Only force a redirect when the rejected request actually
            // carried a bearer token — i.e. we thought we were logged in
            // and the session died mid-use (token revoked/expired
            // elsewhere). A 401 with no token attached is a normal
            // response from a public endpoint (e.g. a wrong-password
            // login attempt) and must not redirect anything; that case is
            // already handled by the caller's own error handling.
            const hadToken = Boolean(error.config?.headers?.Authorization);

            localStorage.removeItem('auth_token');

            if (hadToken && !window.location.pathname.startsWith('/login')) {
                const redirect = encodeURIComponent(
                    window.location.pathname + window.location.search,
                );

                window.location.href = `/login?redirect=${redirect}`;
            }
        }

        reportDevRequest(error.config || {}, null, error);

        return Promise.reject(error);
    },
);

export default api;
