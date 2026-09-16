import { initSessionDetailView } from '../shared/session-detail-view';

const sessionId = window.location.pathname.match(
    /\/admin\/sessions\/(\d+)/,
)?.[1];

if (sessionId) {
    initSessionDetailView({
        sessionId,
        sessionEndpoint: `/admin/sessions/${sessionId}`,
        logsEndpoint: `/admin/sessions/${sessionId}/request-logs`,
        logDetailEndpoint: (logId) => `/admin/request-logs/${logId}`,
        revokeEndpoint: `/admin/sessions/${sessionId}`,
        showOwner: true,
    });
}
