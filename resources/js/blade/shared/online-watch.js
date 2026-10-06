import { t } from './i18n';
import { onPresenceChange } from './presence';
import { showToast } from './toast';

/**
 * "Notify when online" from a public profile: the people to watch are
 * kept in localStorage (this browser only — nothing is sent anywhere),
 * and the site-wide presence channel says when one of them comes online,
 * which shows a toast. Started once per page load by authenticated.js,
 * so it works on every page, not only the profile.
 */
const STORAGE_KEY = 'online-watch';

function read() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

        return stored && typeof stored === 'object' ? stored : {};
    } catch {
        return {};
    }
}

function write(watched) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watched));
    } catch {
        // Storage full or blocked: the watch just lasts for this page.
    }
}

export function isWatchingOnline(userId) {
    return Object.hasOwn(read(), String(userId));
}

/** Starts or stops watching; returns whether the person is now watched. */
export function toggleOnlineWatch(userId, name) {
    const watched = read();
    const key = String(userId);

    if (Object.hasOwn(watched, key)) {
        delete watched[key];
        write(watched);

        return false;
    }

    watched[key] = { name: String(name || '') };
    write(watched);

    return true;
}

let started = false;

export function initOnlineWatch() {
    if (started) {
        return;
    }

    started = true;

    // Who was online the last time presence changed: a toast only for an
    // offline -> online change, never for the first snapshot.
    let previous = null;

    onPresenceChange((onlineIds) => {
        const watched = read();

        if (previous) {
            Object.entries(watched).forEach(([id, { name }]) => {
                if (onlineIds.has(Number(id)) && !previous.has(Number(id))) {
                    showToast(
                        t('user_profile.notify.came_online_body'),
                        'info',
                        {
                            title: t('user_profile.notify.came_online', {
                                name,
                            }),
                            action: {
                                label: t('user_profile.start_chat'),
                                onClick: () => {
                                    window.location.href = `/chat?user=${id}`;
                                },
                            },
                        },
                    );
                }
            });
        }

        previous = new Set(onlineIds);
    });
}
