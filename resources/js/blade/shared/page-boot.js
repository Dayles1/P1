/**
 * Turbo Drive keeps the JS realm alive across navigations, which means a
 * page bundle's top-level boot code (an IIFE that runs once when the
 * module is first evaluated) will NOT run again the second time the user
 * revisits that page within the same session — the browser's ES-module
 * cache simply won't re-execute an already-loaded module.
 *
 * This wraps a page's boot logic so it (re)runs on every `turbo:load`
 * (fired on the very first real page load AND on every subsequent Turbo
 * visit that lands on this page), instead of only once. `rootSelector`
 * is whatever unique marker element already identifies that page's
 * content, so `boot()` is skipped entirely on pages where it doesn't
 * apply. `teardown`, if given, runs on `turbo:before-cache` — right
 * before Turbo snapshots the current page to leave it — so anything
 * with a lifetime tied to being on-screen (socket subscriptions, timers)
 * gets cleaned up instead of leaking onto whatever page comes next.
 */
export function bootOnPage(rootSelector, boot, teardown) {
    function tryBoot() {
        if (document.querySelector(rootSelector)) {
            boot();
        }
    }

    document.addEventListener('turbo:load', tryBoot);

    if (teardown) {
        document.addEventListener('turbo:before-cache', () => {
            if (document.querySelector(rootSelector)) {
                teardown();
            }
        });
    }

    tryBoot();
}
