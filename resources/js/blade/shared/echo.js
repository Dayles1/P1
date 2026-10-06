import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { api } from '../axios';
import { getToken } from './auth-state';

window.Pusher = Pusher;

let echoInstance = null;

/*
 * Every API request names this tab's socket (X-Socket-ID), so what the
 * server broadcasts with `toOthers()` reaches every other tab and person
 * but not the tab that caused it — which already has the result.
 */
api.interceptors.request.use((config) => {
    const socketId = echoInstance?.socketId();

    if (socketId) {
        config.headers['X-Socket-ID'] = socketId;
    }

    return config;
});

/**
 * Runs `callback` each time the socket connects again after losing its
 * connection (not on the first connect) — anything broadcast while it was
 * away was missed, so the page should fetch what changed. Returns a
 * function that stops listening.
 */
export function onReconnect(callback) {
    const connection = getEcho()?.connector?.pusher?.connection;

    if (!connection) {
        return () => {};
    }

    let lost = false;

    const handler = ({ previous, current }) => {
        if (previous === 'connected' && current !== 'connected') {
            lost = true;
        } else if (current === 'connected' && lost) {
            lost = false;
            callback();
        }
    };

    connection.bind('state_change', handler);

    return () => connection.unbind('state_change', handler);
}

/**
 * One Echo/Reverb connection per page, authenticated the same way every
 * other API request is (a Sanctum bearer token via the Authorization
 * header) — this app has no server session, so the default cookie-based
 * broadcasting auth wouldn't work; /broadcasting/auth is deliberately
 * registered under the `auth.api` guard (see bootstrap/app.php) to match.
 */
export function getEcho() {
    if (echoInstance) {
        return echoInstance;
    }

    const token = getToken();

    if (!token) {
        return null;
    }

    echoInstance = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
        wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: '/broadcasting/auth',
        auth: {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
            },
        },
    });

    return echoInstance;
}

export function disconnectEcho() {
    echoInstance?.disconnect();
    echoInstance = null;
}
