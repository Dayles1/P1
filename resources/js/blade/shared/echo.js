import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getToken } from './auth-state';

window.Pusher = Pusher;

let echoInstance = null;

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
