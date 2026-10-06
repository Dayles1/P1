import { api } from '../axios';
import { bootstrapAppState } from '../shared/app-state';
import { getEcho } from '../shared/echo';
import { escapeHtml } from '../shared/forms';
import { getLocale, t } from '../shared/i18n';
import {
    interpolate,
    markNotificationReadAndOpen,
    normalizeNotification,
    notificationFeedHtml,
    pluralKey,
} from '../shared/notification-renderers';
import { bootOnPage } from '../shared/page-boot';
import { renderPagination } from '../shared/pagination';
import { emptyState, errorState, skeletonList } from '../shared/skeleton';
import { apiErrorMessage, showToast, toastSuccess } from '../shared/toast';

const PER_PAGE = 15;

let currentCleanup = null;

/** "4 unread" with the locale's plural form, or "All caught up" at zero. */
function unreadSummary(count) {
    if (count === 0) {
        return t('notifications.all_read');
    }

    return t(pluralKey('notifications.unread_summary', count), {
        count: new Intl.NumberFormat(getLocale()).format(count),
    });
}

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Everything below used to run once at module top level. Under Turbo
 * Drive, `<main>` (and everything in it) is replaced by fresh server
 * HTML on every navigation, but this module is only ever evaluated once
 * per session — so all of this is wrapped in `boot()` and re-run via
 * `bootOnPage` on every `turbo:load` that lands on /notifications, re-
 * querying the (new) DOM each time instead of operating on detached
 * nodes from a previous visit. The AbortController removes this visit's
 * DOM listeners on `teardown()`, and the same teardown unbinds this
 * visit's Echo listeners — only this page's callbacks, never the whole
 * private channel, which the header bell keeps listening on.
 */
function boot() {
    const controller = new AbortController();
    const { signal } = controller;

    const pageRoot = document.querySelector('.notif-page');
    const list = document.querySelector('[data-notif-center-list]');
    const paginationEl = document.querySelector('[data-notif-pagination]');
    const filterButtons = [...document.querySelectorAll('[data-notif-filter]')];
    const markAllBtn = document.querySelector('[data-notif-mark-all-page]');
    const summaryEl = document.querySelector('[data-notif-unread-summary]');

    // Taken from the chips, not assumed: a page Turbo restores from its
    // cache (Back/Forward) comes back with the chip the user left pressed.
    let currentFilter =
        filterButtons.find(
            (button) => button.getAttribute('aria-pressed') === 'true',
        )?.dataset.notifFilter ?? '';
    let currentPage = 1;
    let items = [];
    let unreadCount = null;
    let latestLoad = 0;
    let active = true;
    let channel = null;
    let markingAll = false;

    /**
     * aria-disabled, not `disabled`: a disabled button drops keyboard
     * focus to <body> — right after "Read all" is pressed, for one.
     */
    function setMarkAllEnabled(enabled) {
        markAllBtn?.setAttribute('aria-disabled', String(!enabled));
    }

    function setUnreadCount(count) {
        unreadCount = Math.max(0, Number(count) || 0);

        if (summaryEl) {
            summaryEl.textContent = unreadSummary(unreadCount);
        }

        if (!markingAll) {
            setMarkAllEnabled(unreadCount > 0);
        }
    }

    async function refreshUnreadCount() {
        try {
            const { data } = await api.get('/notifications/unread-count');

            if (active) {
                setUnreadCount(data.data.count);
            }
        } catch {
            // The summary just stays blank; the list itself still works.
        }
    }

    function emptyHtml() {
        if (currentFilter === 'unread') {
            return emptyState(t('notifications.empty_unread'), {
                hint: t('notifications.empty_unread_hint'),
                icon: 'checks',
                plain: true,
            });
        }

        if (currentFilter) {
            return emptyState(t('notifications.empty_filtered'), {
                hint: t('notifications.empty_filtered_hint'),
                icon: 'filter',
                plain: true,
                actionHtml: `<button type="button" class="btn btn--outline btn--sm" data-notif-show-all>${t('notifications.view_all')}</button>`,
            });
        }

        return emptyState(t('notifications.empty'), {
            hint: t('notifications.empty_hint'),
            icon: 'bell',
            plain: true,
        });
    }

    function render() {
        list.innerHTML = items.length
            ? notificationFeedHtml(items)
            : emptyHtml();
    }

    /**
     * renderPagination(), with its "Showing 1–15 of 37" line written again
     * through interpolate(): shared/i18n.js's t() still fills `:to` inside
     * `:total` ("of 15tal"). Same text once t() fills in one pass.
     */
    function renderFeedPagination(pagination) {
        renderPagination(paginationEl, pagination, goToPage);

        const info = paginationEl?.querySelector('.pagination__info');
        const { from, to, total } = pagination || {};

        if (info && from && to) {
            info.textContent = interpolate('components.showing', {
                from,
                to,
                total,
            });
        }
    }

    async function load(page = 1) {
        const request = ++latestLoad;
        currentPage = page;
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = skeletonList(5);

        const params = { page, per_page: PER_PAGE };

        if (currentFilter === 'unread') {
            params.unread = true;
        } else if (currentFilter) {
            params.type = currentFilter;
        }

        try {
            // The user (their timezone and clock) is needed to group by
            // day; it is already loaded after the first page of a session.
            const [{ data }] = await Promise.all([
                api.get('/notifications', { params }),
                bootstrapAppState(),
            ]);

            if (!active || request !== latestLoad) {
                return;
            }

            items = data.data || [];
            render();
            renderFeedPagination(data.pagination);
        } catch (error) {
            if (!active || request !== latestLoad) {
                return;
            }

            items = [];
            list.innerHTML = errorState(t('notifications.load_error'), {
                hint: escapeHtml(
                    apiErrorMessage(error, t('common.error_generic')),
                ),
            });
            renderFeedPagination(null);
        } finally {
            if (request === latestLoad) {
                list.removeAttribute('aria-busy');
            }
        }
    }

    /**
     * A page number was clicked. Its button is re-rendered away, so focus
     * moves to the list the new page lands in (instead of <body>), and
     * the page scrolls back up to the top of the feed.
     */
    async function goToPage(page) {
        pageRoot?.scrollIntoView({
            block: 'start',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });

        await load(page);

        if (active) {
            list.focus({ preventScroll: true });
        }
    }

    /** Flips rows to read in place; returns how many were still unread. */
    function markReadLocally(ids) {
        let changed = 0;

        ids.forEach((id) => {
            const notification = items.find((n) => String(n.id) === String(id));

            if (notification && !notification.read_at) {
                notification.read_at = new Date().toISOString();
            }

            const row = list.querySelector(
                `[data-notif-id="${CSS.escape(String(id))}"]`,
            );

            if (row?.classList.contains('notif-item--unread')) {
                row.classList.remove('notif-item--unread');
                row.querySelector('.notif-item__dot')?.remove();
                changed += 1;
            }
        });

        return changed;
    }

    function selectFilter(value) {
        currentFilter = value;

        filterButtons.forEach((button) => {
            button.setAttribute(
                'aria-pressed',
                String(button.dataset.notifFilter === value),
            );
        });

        load(1);
    }

    list.addEventListener(
        'click',
        (event) => {
            if (event.target.closest('[data-retry]')) {
                load(currentPage);

                return;
            }

            if (event.target.closest('[data-notif-show-all]')) {
                // The button goes away with the empty state it sits in.
                selectFilter('');
                filterButtons[0]?.focus();

                return;
            }

            const item = event.target.closest('[data-notif-id]');

            if (!item) {
                return;
            }

            const changed = markReadLocally([item.dataset.notifId]);

            if (changed && unreadCount !== null) {
                setUnreadCount(unreadCount - changed);
            }

            markNotificationReadAndOpen(api, {
                id: item.dataset.notifId,
                action_url: item.dataset.notifUrl,
                data: {
                    conversation_id: item.dataset.notifConversationId || null,
                    message_id: item.dataset.notifMessageId || null,
                },
            });
        },
        { signal },
    );

    filterButtons.forEach((button) => {
        button.addEventListener(
            'click',
            () => {
                if (button.dataset.notifFilter !== currentFilter) {
                    selectFilter(button.dataset.notifFilter);
                }
            },
            { signal },
        );
    });

    markAllBtn?.addEventListener(
        'click',
        async () => {
            if (
                markingAll ||
                markAllBtn.getAttribute('aria-disabled') === 'true'
            ) {
                return;
            }

            markingAll = true;
            setMarkAllEnabled(false);

            try {
                await api.post('/notifications/read-all');
                markingAll = false;
                setUnreadCount(0);
                toastSuccess(t('notifications.marked_all'));
                load(currentFilter === 'unread' ? 1 : currentPage);
            } catch (error) {
                markingAll = false;
                setMarkAllEnabled(unreadCount !== 0);
                showToast(
                    apiErrorMessage(error, t('common.error_generic')),
                    'error',
                );
            }
        },
        { signal },
    );

    load();
    refreshUnreadCount();

    /*
    |--------------------------------------------------------------------------
    | Live updates — a new notification lands on top instantly if it matches
    | whatever's currently being viewed (page 1, and the active filter, if
    | any). Anything else (a later page, or a filtered-out type) just isn't
    | shown yet, exactly like a fresh page load wouldn't show it either.
    |--------------------------------------------------------------------------
    */

    function matchesCurrentFilter(notification) {
        if (!currentFilter) {
            return true;
        }

        if (currentFilter === 'unread') {
            return !notification.read_at;
        }

        // A chip may stand for several types ("message,reply").
        return currentFilter.split(',').includes(notification.type);
    }

    function onNotification(payload) {
        const notification = normalizeNotification(payload);

        if (unreadCount !== null) {
            setUnreadCount(unreadCount + 1);
        }

        if (currentPage !== 1 || !matchesCurrentFilter(notification)) {
            return;
        }

        items = [notification, ...items];
        render();
    }

    // Reflects reads that happened elsewhere — another tab, the header
    // bell, or reading the underlying message in Chat — without a refresh.
    function onRead(payload) {
        markReadLocally(payload.ids || []);

        if (payload.unread_count !== undefined) {
            setUnreadCount(payload.unread_count);
        }
    }

    (async () => {
        const user = await bootstrapAppState();

        if (!user || !active) {
            return;
        }

        channel = getEcho()?.private(`App.Models.User.${user.id}`) ?? null;
        channel?.notification(onNotification);
        channel?.listen('.notifications.read', onRead);
    })();

    currentCleanup = () => {
        active = false;
        controller.abort();
        channel?.stopListeningForNotification(onNotification);
        channel?.stopListening('.notifications.read', onRead);
    };
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-notif-center-list]', boot, teardown);
