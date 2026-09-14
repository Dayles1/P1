import { api } from '../axios';
import { showToast } from '../shared/toast';

const list = document.querySelector('[data-sessions-list]');
const revokeOthersBtn = document.querySelector('[data-revoke-others]');

function apiMessage(error, fallback) {
    return error?.response?.data?.message || fallback;
}

function renderEmpty(message) {
    list.innerHTML = `<div class="empty-state"><strong>${message}</strong></div>`;
}

function renderSessions(sessions) {
    if (!sessions.length) {
        renderEmpty('No sessions found.');

        return;
    }

    list.innerHTML = sessions
        .map((session) => {
            const statusPill =
                session.status === 'active'
                    ? '<span class="pill pill--success">Active</span>'
                    : '<span class="pill pill--muted">Expired</span>';

            const currentPill = session.is_current
                ? '<span class="pill pill--primary" style="margin-left:6px;">This device</span>'
                : '';

            const device = [session.browser, session.platform]
                .filter(Boolean)
                .join(' on ') || session.device_name || 'Unknown device';

            const revokeButton =
                session.status === 'active' && !session.is_current
                    ? `<button type="button" class="btn btn--outline btn--sm" data-revoke="${session.id}">Log out</button>`
                    : '';

            return `
                <div class="data-row ${session.is_current ? 'data-row--current' : ''}">
                    <div class="data-row__main">
                        <div class="data-row__title">${device} ${statusPill} ${currentPill}</div>
                        <div class="data-row__meta">${session.ip_address ?? ''} &middot; last active ${session.last_activity_at ?? '—'}</div>
                    </div>
                    <div class="data-row__actions">${revokeButton}</div>
                </div>
            `;
        })
        .join('');
}

async function loadSessions() {
    try {
        const { data } = await api.get('/sessions', { params: { status: 'all' } });

        renderSessions(data.data || []);
    } catch (error) {
        renderEmpty('Could not load sessions.');
        showToast(apiMessage(error, 'Could not load sessions.'), 'error');
    }
}

list?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-revoke]');

    if (!button) {
        return;
    }

    if (!window.confirm('Log out this session?')) {
        return;
    }

    button.disabled = true;

    try {
        await api.delete(`/sessions/${button.dataset.revoke}`);

        showToast('Session revoked.');

        loadSessions();
    } catch (error) {
        showToast(apiMessage(error, 'Could not revoke session.'), 'error');
        button.disabled = false;
    }
});

revokeOthersBtn?.addEventListener('click', async () => {
    if (!window.confirm('Log out all other sessions? This device stays signed in.')) {
        return;
    }

    revokeOthersBtn.disabled = true;

    try {
        const { data } = await api.delete('/sessions/others');

        showToast(`Logged out ${data.data?.revoked_sessions ?? 0} other session(s).`);

        loadSessions();
    } catch (error) {
        showToast(apiMessage(error, 'Could not revoke other sessions.'), 'error');
    } finally {
        revokeOthersBtn.disabled = false;
    }
});

loadSessions();
