import { api } from '../axios';
import { fetchCurrentUser } from '../shared/auth-state';
import { methodClass, statusClass } from '../shared/format';
import { escapeHtml } from '../shared/forms';
import { t } from '../shared/i18n';
import { showToast, apiErrorMessage } from '../shared/toast';

const welcomeEl = document.querySelector('[data-dashboard-welcome]');
const statGridEl = document.querySelector('[data-stat-grid]');
const completenessValueEl = document.querySelector('[data-completeness-value]');
const completenessBarEl = document.querySelector('[data-completeness-bar]');
const recentRequestsEl = document.querySelector('[data-recent-requests]');
const recentSessionsEl = document.querySelector('[data-recent-sessions]');
const instanceOverviewEl = document.querySelector('[data-instance-overview]');
const instanceStatsEl = document.querySelector('[data-instance-stats]');

function statCard(label, value, meta = '') {
    return `
        <div class="stat-card">
            <div class="stat-card__label">${label}</div>
            <div class="stat-card__value">${value}</div>
            ${meta ? `<div class="stat-card__meta">${meta}</div>` : ''}
        </div>
    `;
}

function renderStats(summary) {
    statGridEl.innerHTML = [
        statCard(t('dashboard.active_sessions'), summary.sessions.active, `${t('dashboard.total_sessions')}: ${summary.sessions.total}`),
        statCard(t('dashboard.requests_today'), summary.requests.today),
        statCard(t('dashboard.requests_week'), summary.requests.this_week),
        statCard(t('dashboard.errors_week'), summary.requests.errors_this_week),
        statCard(t('dashboard.unread_messages'), summary.unread_messages),
    ].join('');

    completenessValueEl.textContent = `${summary.account.profile_completeness}%`;
    completenessBarEl.style.width = `${summary.account.profile_completeness}%`;

    if (summary.instance) {
        instanceOverviewEl.hidden = false;
        instanceStatsEl.innerHTML = [
            statCard(t('dashboard.total_users'), summary.instance.total_users),
            statCard(t('dashboard.active_sessions'), summary.instance.active_sessions),
            statCard(t('dashboard.requests_today'), summary.instance.requests_today),
            statCard(t('common.status'), summary.instance.errors_today, t('dashboard.errors_week')),
        ].join('');
    }
}

function renderRecentRequests(logs) {
    if (!logs.length) {
        recentRequestsEl.innerHTML = `<div class="empty-state"><strong>${t('dashboard.no_recent_requests')}</strong></div>`;

        return;
    }

    recentRequestsEl.innerHTML = logs
        .map((log) => `
            <div class="timeline__item">
                <span class="timeline__dot ${log.status_code >= 400 ? 'timeline__dot--danger' : ''}"></span>
                <div class="timeline__content">
                    <div class="timeline__title">
                        <span class="${methodClass(log.method)}" style="margin-right:6px;">${log.method}</span>
                        ${escapeHtml(log.path)}
                        <span class="${statusClass(log.status_code)}" style="margin-left:6px;">${log.status_code ?? '—'}</span>
                    </div>
                    <div class="timeline__meta">${log.created_at ?? ''}</div>
                </div>
            </div>
        `)
        .join('');
}

function renderRecentSessions(sessions) {
    if (!sessions.length) {
        recentSessionsEl.innerHTML = `<div class="empty-state"><strong>${t('dashboard.no_recent_sessions')}</strong></div>`;

        return;
    }

    recentSessionsEl.innerHTML = sessions
        .map((session) => `
            <a href="/sessions/${session.id}" class="data-row" style="text-decoration:none; padding:10px 0;">
                <div class="data-row__main">
                    <div class="data-row__title" style="font-size:13px;">
                        ${[session.browser, session.platform].filter(Boolean).join(' · ') || t('common.unknown')}
                        ${session.is_current ? `<span class="pill pill--primary">${t('sessions.this_device')}</span>` : ''}
                    </div>
                    <div class="data-row__meta">${session.last_activity_at ?? ''}</div>
                </div>
            </a>
        `)
        .join('');
}

async function loadDashboard() {
    try {
        const { data } = await api.get('/dashboard');
        const summary = data.data;

        renderStats(summary);
        renderRecentRequests(summary.recent_requests || []);
        renderRecentSessions(summary.recent_sessions || []);
    } catch (error) {
        showToast(apiErrorMessage(error, t('common.error_generic')), 'error');
    }
}

(async () => {
    const user = await fetchCurrentUser();

    if (welcomeEl) {
        // Falls back to a generic subtitle (rather than leaving the skeleton
        // spinning forever) if the user fetch failed for any reason.
        welcomeEl.textContent = user
            ? t('dashboard.welcome', { name: user.name })
            : t('dashboard.subtitle');
    }

    loadDashboard();
})();
