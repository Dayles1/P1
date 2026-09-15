import { getEcho } from './echo';

/**
 * Tracks who's currently on the site-wide `online` presence channel.
 * Joining/leaving the channel *is* the online signal (native to Reverb's
 * presence channels) — there's no separate heartbeat to send or poll.
 * Consumers (chat, profile, etc. — from Phase 5 onward) read
 * `isOnline(userId)` or subscribe via `onPresenceChange`.
 */
const onlineIds = new Set();
const listeners = new Set();
let joined = false;

function notify() {
    listeners.forEach((listener) => listener(new Set(onlineIds)));
}

export function initPresence() {
    if (joined) {
        return;
    }

    const echo = getEcho();

    if (!echo) {
        return;
    }

    joined = true;

    echo.join('online')
        .here((users) => {
            onlineIds.clear();
            users.forEach((user) => onlineIds.add(user.id));
            notify();
        })
        .joining((user) => {
            onlineIds.add(user.id);
            notify();
        })
        .leaving((user) => {
            onlineIds.delete(user.id);
            notify();
        });
}

export function isOnline(userId) {
    return onlineIds.has(Number(userId));
}

export function onPresenceChange(listener) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}
