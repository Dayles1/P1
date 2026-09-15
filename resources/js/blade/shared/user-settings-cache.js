/**
 * `GET /profile/settings` is now read by more than one independent script
 * on the same page (the notification bell needs the `browser` preference,
 * settings.js needs everything) — cache it per page load the same way
 * `auth-state.js` caches `fetchCurrentUser()`, for the same reason.
 */
let settingsPromise = null;

export function getUserSettings(api) {
    settingsPromise ??= api.get('/profile/settings').then(({ data }) => data.data);

    return settingsPromise;
}

/** settings.js calls this after a successful save so later reads see fresh data. */
export function invalidateUserSettings() {
    settingsPromise = null;
}
