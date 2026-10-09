/**
 * GU World — entry point of the browser client: checks the player is
 * signed in and loads where they left off. A new game starts on the first
 * morning; a saved one goes on from its saved time.
 *
 * The engine (the world loop, chunks, entities, NPCs) is being built in
 * stages; until it is, this page only shows the state it would start
 * from, and says so.
 */

import { goToLogin, hasToken, loadSave } from './api';
import type { SavedGame } from './api';
import { WorldClock } from './engine/clock';
import { t } from './i18n';
import './styles.css';

const root = document.getElementById('gu-world-root')!;

function show(lines: string[]): void {
    const card = document.createElement('main');
    card.className = 'gw-card';

    const title = document.createElement('h1');
    title.textContent = t.title;
    card.append(title);

    for (const line of lines) {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        card.append(paragraph);
    }

    const back = document.createElement('a');
    back.className = 'gw-back';
    back.href = root.dataset.backUrl || '/';
    back.textContent = t.back;
    card.append(back);

    root.replaceChildren(card);
}

function describe(saved: SavedGame | null): string[] {
    if (!saved) {
        const clock = WorldClock.newGame();

        return [
            `${t.new_game}: ${t.day} ${clock.day}, ${clock.label} (${t.phases[clock.phase]})`,
            t.stage,
        ];
    }

    const { clock, repaired } = WorldClock.fromSaved(saved.world_minutes);

    return [
        `${t.saved_game}: ${saved.location} · ${t.day} ${clock.day}, ${clock.label} (${t.phases[clock.phase]})`,
        ...(repaired ? [t.repaired_time] : []),
        t.stage,
    ];
}

if (!hasToken()) {
    goToLogin();
} else {
    show([t.loading]);
    loadSave()
        .then((saved) => show(describe(saved)))
        .catch(() => show([t.load_failed, t.stage]));
}
