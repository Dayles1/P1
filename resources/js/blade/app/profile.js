import { api } from '../axios';
import { avatarHue, avatarMedia, initials } from '../shared/auth-state';
import { escapeHtml } from '../shared/forms';
import { formatNumber, getLocale, t } from '../shared/i18n';
import { bootOnPage } from '../shared/page-boot';
import { emptyState } from '../shared/skeleton';
import { apiErrorMessage, showToast } from '../shared/toast';

/** Admin roles are named next to the name; everyone else has no chip. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

/** Groups listed at most. */
const GROUPS_LIMIT = 6;

const LANGUAGES = { ru: 'Русский', uz: 'Oʻzbekcha', en: 'English' };

/**
 * The time now in `timeZone` ("16:40"), or null when the zone is unknown.
 */
function localTime(timeZone) {
    if (!timeZone) {
        return null;
    }

    try {
        return new Intl.DateTimeFormat(getLocale(), {
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
        }).format(new Date());
    } catch {
        return null;
    }
}

/**
 * The profile's own markup is the loading state; this fills it in from
 * three requests made side by side. Re-run on every visit via bootOnPage.
 */
function boot() {
    const root = document.querySelector('[data-profile-page]');
    const nameEl = root.querySelector('[data-profile-name]');
    const avatarEl = root.querySelector('[data-profile-avatar]');
    const roleEl = root.querySelector('[data-profile-role]');
    const metaEl = root.querySelector('[data-profile-meta]');
    const statsEl = root.querySelector('[data-profile-stats]');
    const groupsEl = root.querySelector('[data-profile-groups]');

    function stat(key, value) {
        const el = root.querySelector(`[data-profile-stat="${key}"]`);

        el.textContent = value === null ? '—' : formatNumber(value);
    }

    function fact(key, value) {
        root.querySelector(`[data-profile-fact="${key}"]`).textContent =
            value || '—';
    }

    function renderProfile(profile) {
        const name = profile.name || '';
        const role = (profile.roles || []).find((item) =>
            ADMIN_ROLES.includes(item.code),
        );
        const timezone = profile.settings?.timezone;
        const time = localTime(timezone?.name);

        nameEl.textContent = name;
        avatarEl.className = `avatar profile-head__avatar${profile.avatar?.url ? '' : ` avatar--hue-${avatarHue(name)}`}`;
        avatarEl.innerHTML = profile.avatar?.url
            ? avatarMedia(profile.avatar.url)
            : `<span class="avatar__initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`;

        roleEl.hidden = !role;
        roleEl.textContent = role?.name || '';

        metaEl.innerHTML = [
            profile.department?.name
                ? escapeHtml(profile.department.name)
                : null,
            `<span class="profile-head__online">${escapeHtml(t('profile_page.online'))}</span>`,
            time
                ? escapeHtml(
                      t('profile_page.local_time', {
                          time,
                          zone: timezone.label || timezone.name,
                      }),
                  )
                : null,
        ]
            .filter(Boolean)
            .join(' · ');

        fact('email', profile.email);
        fact('department', profile.department?.name);
        fact('language', LANGUAGES[profile.settings?.locale || getLocale()]);
        fact('timezone', timezone?.label || timezone?.name);
        fact('joined', String(profile.created_at || '').split(' ')[0]);
    }

    function renderGroups(conversations) {
        const groups = conversations
            .filter((conversation) => conversation.type !== 'private')
            .slice(0, GROUPS_LIMIT);

        if (!groups.length) {
            groupsEl.innerHTML = emptyState(t('profile_page.no_groups'), {
                icon: 'users',
                plain: true,
            });

            return;
        }

        groupsEl.innerHTML = `
            <ul class="profile-groups" role="list">
                ${groups
                    .map(
                        (group) => `
                    <li>
                        <a href="/chat/${escapeHtml(group.id)}" class="profile-group">
                            <span class="profile-group__mark profile-group__mark--${avatarHue(group.title || '')}" aria-hidden="true"></span>
                            <span class="profile-group__title truncate">${escapeHtml(group.title || '')}</span>
                            <span class="mono profile-group__time">${escapeHtml(
                                String(group.last_message_at || '')
                                    .split(' ')
                                    .slice(-1)[0],
                            )}</span>
                        </a>
                    </li>
                `,
                    )
                    .join('')}
            </ul>
        `;
    }

    async function load() {
        const [profile, summary, conversations] = await Promise.allSettled([
            api.get('/profile'),
            api.get('/dashboard'),
            api.get('/conversations', {
                params: { type: 'all', per_page: 50 },
            }),
        ]);

        if (profile.status === 'fulfilled') {
            renderProfile(profile.value.data.data);
        } else {
            nameEl.textContent = t('nav.profile');
            showToast(
                apiErrorMessage(profile.reason, t('common.error_generic')),
                'error',
            );
        }

        const list =
            conversations.status === 'fulfilled'
                ? conversations.value.data.data || []
                : null;

        stat('chats', list ? list.length : null);
        stat(
            'groups',
            list ? list.filter((item) => item.type !== 'private').length : null,
        );
        stat(
            'sessions',
            summary.status === 'fulfilled'
                ? summary.value.data.data.sessions.active
                : null,
        );
        statsEl.removeAttribute('aria-busy');

        if (list) {
            renderGroups(list);
        } else {
            groupsEl.innerHTML = emptyState(t('dashboard.load_failed'), {
                icon: 'alert',
                plain: true,
            });
        }
    }

    load();
}

bootOnPage('[data-profile-page]', boot);
