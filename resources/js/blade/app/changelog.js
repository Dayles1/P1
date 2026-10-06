import { escapeHtml } from '../shared/forms';
import { t, tChoice } from '../shared/i18n';
import { icon } from '../shared/icon';
import { bootOnPage } from '../shared/page-boot';
import { pageWindow } from '../shared/pagination';
import { showToast } from '../shared/toast';

/** Changes of a release shown before its "Show N more". */
const CAP = 5;

/** The choices of "Versions per page". */
const PER_PAGE_OPTIONS = [2, 3, 5, 10];

let currentCleanup = null;

/**
 * `text` as HTML with every occurrence of `query` (already lower-case)
 * wrapped in <mark>.
 */
function highlight(text, query) {
    if (!query) {
        return escapeHtml(text);
    }

    const lower = text.toLowerCase();
    let html = '';
    let from = 0;
    let at = lower.indexOf(query);

    while (at >= 0) {
        html += `${escapeHtml(text.slice(from, at))}<mark>${escapeHtml(text.slice(at, at + query.length))}</mark>`;
        from = at + query.length;
        at = lower.indexOf(query, from);
    }

    return html + escapeHtml(text.slice(from));
}

/**
 * The release markup is complete on the server (every release, every
 * change); this reads it back once and from then on only shows, hides
 * and highlights it. It is wrapped in `boot()` and re-run via
 * `bootOnPage` on every visit to the page.
 */
function boot() {
    const root = document.querySelector('[data-changelog]');
    const controller = new AbortController();
    const { signal } = controller;

    const search = root.querySelector('[data-changelog-search]');
    const versionSearch = root.querySelector('[data-changelog-version-search]');
    const jumpSelect = root.querySelector('[data-changelog-jump-select]');
    const chips = [...root.querySelectorAll('[data-changelog-type]')];
    const status = root.querySelector('[data-changelog-status]');
    const statusText = root.querySelector('[data-changelog-status-text]');
    const empty = root.querySelector('[data-changelog-empty]');
    const pager = root.querySelector('[data-changelog-pager]');
    const toggleAll = root.querySelector('[data-changelog-toggle-all]');
    const toggleAllText = root.querySelector(
        '[data-changelog-toggle-all-text]',
    );
    const indexGroups = [
        ...root.querySelectorAll('[data-changelog-index-group]'),
    ];
    const indexEmpty = root.querySelector('[data-changelog-index-empty]');

    const indexRows = new Map(
        [...root.querySelectorAll('[data-changelog-jump]')].map((row) => [
            row.dataset.changelogJump,
            row,
        ]),
    );

    const releases = [...root.querySelectorAll('[data-changelog-release]')].map(
        (el) => ({
            version: el.dataset.changelogRelease,
            el,
            more: el.querySelector('[data-changelog-more]'),
            items: [...el.querySelectorAll('[data-changelog-item]')].map(
                (li) => {
                    const textEl = li.querySelector('[data-changelog-text]');
                    const text = textEl.textContent.trim();

                    return {
                        li,
                        textEl,
                        text,
                        lower: text.toLowerCase(),
                        type: li.dataset.changelogItem,
                        highlighted: '',
                    };
                },
            ),
        }),
    );

    const view = {
        query: '',
        type: 'all',
        page: 1,
        per: window.matchMedia('(max-width: 639px)').matches ? 2 : 3,
        open: new Set(),
        focus: null,
        versionQuery: '',
    };

    function normalizedQuery() {
        return view.query.trim().toLowerCase();
    }

    function isFiltering() {
        return normalizedQuery() !== '' || view.type !== 'all';
    }

    /**
     * Releases with at least one change matching the search and the type,
     * each with just those changes.
     */
    function matchingReleases() {
        const query = normalizedQuery();

        return releases
            .map((release) => ({
                release,
                items: release.items.filter(
                    (item) =>
                        (view.type === 'all' || item.type === view.type) &&
                        (!query || item.lower.includes(query)),
                ),
            }))
            .filter((match) => match.items.length > 0);
    }

    function render() {
        const query = normalizedQuery();
        const filtering = isFiltering();
        const matches = matchingReleases();
        const pages = Math.max(1, Math.ceil(matches.length / view.per));

        view.page = Math.min(view.page, pages);

        const shown = matches.slice(
            (view.page - 1) * view.per,
            view.page * view.per,
        );
        const shownVersions = new Set(
            shown.map((match) => match.release.version),
        );
        const matchedVersions = new Set(
            matches.map((match) => match.release.version),
        );

        releases.forEach((release) => {
            release.el.hidden = !shownVersions.has(release.version);
            release.el.toggleAttribute(
                'data-focused',
                view.focus === release.version,
            );
        });

        shown.forEach(({ release, items }) => {
            const open = filtering || view.open.has(release.version);
            const visible = new Set(open ? items : items.slice(0, CAP));

            release.items.forEach((item) => {
                item.li.hidden = !visible.has(item);

                if (visible.has(item) && item.highlighted !== query) {
                    item.textEl.innerHTML = highlight(item.text, query);
                    item.highlighted = query;
                }
            });

            release.more.hidden = filtering || release.items.length <= CAP;
            release.more.textContent = open
                ? t('changelog.show_less')
                : t('changelog.show_more', {
                      count: release.items.length - CAP,
                  });
            release.more.setAttribute('aria-expanded', String(open));
        });

        renderChips(query);
        renderIndex(shownVersions, matchedVersions);
        renderPager(matches.length, pages);

        const matchedChanges = matches.reduce(
            (sum, match) => sum + match.items.length,
            0,
        );

        status.hidden = !filtering;
        statusText.textContent = t('changelog.found', {
            changes: tChoice('changelog.changes', matchedChanges),
            versions: tChoice('changelog.found_versions', matches.length),
        });
        empty.hidden = matches.length > 0;

        const anyOpen = view.open.size > 0;

        toggleAllText.textContent = anyOpen
            ? t('changelog.collapse_all')
            : t('changelog.expand_all');
        jumpSelect.value = view.focus ?? '';
    }

    /**
     * Counts on the type chips follow the search, so each says how many
     * changes picking it would show.
     */
    function renderChips(query) {
        const totals = { all: 0, new: 0, improved: 0, fixed: 0 };

        releases.forEach((release) =>
            release.items.forEach((item) => {
                if (!query || item.lower.includes(query)) {
                    totals.all += 1;
                    totals[item.type] += 1;
                }
            }),
        );

        chips.forEach((chip) => {
            const type = chip.dataset.changelogType;

            chip.setAttribute('aria-pressed', String(view.type === type));
            chip.querySelector('.chip__count').textContent = totals[type];
        });
    }

    function renderIndex(shownVersions, matchedVersions) {
        const prefix = view.versionQuery.trim().replace(/^v/i, '');
        let visibleRows = 0;

        indexRows.forEach((row, version) => {
            const state = [
                matchedVersions.has(version) ? '' : 'unmatched',
                view.focus === version ? 'focused' : '',
            ];

            row.hidden = prefix !== '' && !version.startsWith(prefix);
            row.dataset.state = state.filter(Boolean).join(' ');
            row.setAttribute(
                'aria-current',
                String(shownVersions.has(version)),
            );

            if (!row.hidden) {
                visibleRows += 1;
            }
        });

        indexGroups.forEach((group) => {
            group.hidden = ![
                ...group.querySelectorAll('[data-changelog-jump]'),
            ].some((row) => !row.hidden);
        });

        indexEmpty.hidden = visibleRows > 0;
    }

    function renderPager(total, pages) {
        pager.hidden = total === 0;
        pager.toggleAttribute('data-single', pages <= 1);

        if (total === 0) {
            return;
        }

        const current = view.page;
        const from = (current - 1) * view.per + 1;
        const to = Math.min(current * view.per, total);

        const numbers = pageWindow(current, pages)
            .map((page) =>
                page === '…'
                    ? '<span class="pagination__btn pagination__ellipsis changelog-pager__num" aria-hidden="true">…</span>'
                    : `<button type="button" class="pagination__btn changelog-pager__num ${page === current ? 'pagination__btn--active' : ''}" data-page="${page}" ${page === current ? 'aria-current="page"' : ''}>${page}</button>`,
            )
            .join('');

        const perOptions = PER_PAGE_OPTIONS.map(
            (option) =>
                `<option value="${option}" ${option === view.per ? 'selected' : ''}>${option}</option>`,
        ).join('');

        pager.innerHTML = `
            <span class="changelog-pager__range">${t('changelog.range', { from, to, total })}</span>
            <div class="pagination__controls">
                <button type="button" class="pagination__btn changelog-pager__step" data-page="${current - 1}" aria-label="${escapeHtml(t('components.previous'))}" ${current <= 1 ? 'disabled' : ''}>
                    ${icon('left', { size: 16 })}<span class="changelog-pager__step-label">${t('changelog.newer')}</span>
                </button>
                <span class="changelog-pager__page">
                    <strong>${t('changelog.page', { page: current, pages })}</strong>
                    <span>${t('changelog.range', { from, to, total })}</span>
                </span>
                ${numbers}
                <button type="button" class="pagination__btn changelog-pager__step" data-page="${current + 1}" aria-label="${escapeHtml(t('components.next'))}" ${current >= pages ? 'disabled' : ''}>
                    <span class="changelog-pager__step-label">${t('changelog.older')}</span>${icon('chev', { size: 16 })}
                </button>
            </div>
            <label class="changelog-pager__per">
                ${t('changelog.per_page')}
                <select class="field-select field-select--sm" data-changelog-per>${perOptions}</select>
            </label>
        `;
    }

    /**
     * Brings the top of the releases back into view after a page change
     * that happened below it.
     */
    function scrollToReleases() {
        const main = root.querySelector('.changelog__main');

        if (main.getBoundingClientRect().top < 0) {
            main.scrollIntoView({ block: 'start' });
        }
    }

    function anchorOf(version) {
        return `v${version.replaceAll('.', '-')}`;
    }

    /**
     * Opens the page a release is on and scrolls to it. A release the
     * search or the type hides clears them first.
     */
    function jumpTo(version, { smooth = true } = {}) {
        const release = releases.find((item) => item.version === version);

        if (!release) {
            return;
        }

        let position = matchingReleases().findIndex(
            (match) => match.release.version === version,
        );

        if (position < 0) {
            view.query = '';
            view.type = 'all';
            search.value = '';
            position = releases.indexOf(release);
        }

        view.page = Math.floor(position / view.per) + 1;
        view.focus = version;
        render();

        history.replaceState(history.state, '', `#${anchorOf(version)}`);
        release.el.scrollIntoView({
            behavior: smooth ? 'smooth' : 'auto',
            block: 'start',
        });
    }

    function resetFilters() {
        view.query = '';
        view.type = 'all';
        view.page = 1;
        view.focus = null;
        search.value = '';
        render();
    }

    async function copyLink(version) {
        const url = `${location.origin}${location.pathname}#${anchorOf(version)}`;

        try {
            await navigator.clipboard.writeText(url);
            showToast(t('changelog.link_copied', { version }));
        } catch {
            showToast(t('changelog.copy_failed'), 'error');
        }
    }

    search.addEventListener(
        'input',
        () => {
            view.query = search.value;
            view.page = 1;
            view.focus = null;
            render();
        },
        { signal },
    );

    versionSearch.addEventListener(
        'input',
        () => {
            view.versionQuery = versionSearch.value;
            render();
        },
        { signal },
    );

    jumpSelect.addEventListener(
        'change',
        () => {
            if (jumpSelect.value) {
                jumpTo(jumpSelect.value);
            }
        },
        { signal },
    );

    toggleAll.hidden = !releases.some((release) => release.items.length > CAP);
    toggleAll.addEventListener(
        'click',
        () => {
            view.open =
                view.open.size > 0
                    ? new Set()
                    : new Set(releases.map((release) => release.version));
            render();
        },
        { signal },
    );

    root.addEventListener(
        'click',
        (event) => {
            const chip = event.target.closest('[data-changelog-type]');
            const row = event.target.closest('[data-changelog-jump]');
            const pageButton = event.target.closest('[data-page]');
            const release = event.target.closest('[data-changelog-release]')
                ?.dataset.changelogRelease;

            if (chip) {
                view.type = chip.dataset.changelogType;
                view.page = 1;
                view.focus = null;
                render();
            } else if (row) {
                event.preventDefault();
                jumpTo(row.dataset.changelogJump);
            } else if (event.target.closest('[data-changelog-reset]')) {
                resetFilters();
            } else if (pageButton && !pageButton.disabled) {
                view.page = Number(pageButton.dataset.page);
                view.focus = null;
                render();
                scrollToReleases();
            } else if (
                release &&
                event.target.closest('[data-changelog-more]')
            ) {
                if (view.open.has(release)) {
                    view.open.delete(release);
                } else {
                    view.open.add(release);
                }

                render();
            } else if (
                release &&
                event.target.closest('[data-changelog-copy]')
            ) {
                copyLink(release);
            }
        },
        { signal },
    );

    pager.addEventListener(
        'change',
        (event) => {
            if (event.target.matches('[data-changelog-per]')) {
                view.per = Number(event.target.value);
                view.page = 1;
                render();
            }
        },
        { signal },
    );

    const linked = releases.find(
        (release) => `#${anchorOf(release.version)}` === location.hash,
    );

    if (linked) {
        jumpTo(linked.version, { smooth: false });
    } else {
        render();
    }

    currentCleanup = () => controller.abort();
}

function teardown() {
    currentCleanup?.();
    currentCleanup = null;
}

bootOnPage('[data-changelog]', boot, teardown);
