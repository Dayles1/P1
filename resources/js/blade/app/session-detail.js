import { bootOnPage } from '../shared/page-boot';
import { initSessionDetailView } from '../shared/session-detail-view';

let currentCleanup = null;

/**
 * This used to call `initSessionDetailView(...)` once at module top
 * level. Under Turbo Drive this module is only ever evaluated once per
 * session, so `sessionId` (parsed from the current URL) and the whole
 * view would only ever be wired up for the very first `/sessions/{id}`
 * page visited. Wrapping it in `boot()` and re-running via `bootOnPage`
 * on every `turbo:load` re-parses the id and re-initializes the view
 * for whichever session is currently being viewed.
 */
function boot() {
    const sessionId = window.location.pathname.match(/\/sessions\/(\d+)/)?.[1];

    if (!sessionId) {
        return;
    }

    currentCleanup = initSessionDetailView({
        sessionId,
        sessionEndpoint: `/sessions/${sessionId}`,
        logsEndpoint: `/sessions/${sessionId}/request-logs`,
        logDetailEndpoint: (logId) =>
            `/sessions/${sessionId}/request-logs/${logId}`,
        revokeEndpoint: `/sessions/${sessionId}`,
        showOwner: false,
    });
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-session-summary]', boot, teardown);
