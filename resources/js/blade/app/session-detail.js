import { initSessionDetailView } from '../shared/session-detail-view';

const sessionId = window.location.pathname.match(/\/sessions\/(\d+)/)?.[1];

if (sessionId) {
    initSessionDetailView({
        sessionId,
        sessionEndpoint: `/sessions/${sessionId}`,
        logsEndpoint: `/sessions/${sessionId}/request-logs`,
        logDetailEndpoint: (logId) =>
            `/sessions/${sessionId}/request-logs/${logId}`,
        revokeEndpoint: `/sessions/${sessionId}`,
        showOwner: false,
    });
}
