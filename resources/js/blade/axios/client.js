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

        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('auth_token');
        }

        return Promise.reject(error);
    }
);

export default api;