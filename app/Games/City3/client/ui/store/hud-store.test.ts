import { describe, expect, it } from 'vitest';
import { loadContent } from '../../content';
import { Game } from '../../engine/sim/game';
import { HudStore } from './hud-store';
import type { SampleExtras } from './hud-store';

const { content } = loadContent();

const extras = (now = 1_000_000): SampleExtras => ({
    speed: 1,
    tester: false,
    infinite: false,
    fps: 60,
    now,
    advisor: null,
    counts: { upgrade: 0, goals: null },
});

describe('the HUD snapshot (ui-spec §10)', () => {
    it('notifies no one when a sample changes nothing', () => {
        const game = Game.create(content, 7);
        const hud = new HudStore();
        let calls = 0;

        hud.sample(game, extras());
        hud.subscribe(() => calls++);
        hud.sample(game, extras());

        expect(calls).toBe(0);
    });

    it('gives a money change to money selectors only', () => {
        const game = Game.create(content, 7);
        const hud = new HudStore();

        hud.sample(game, extras());

        const before = hud.getState();

        game.state.resources[content.currency] += 5000;
        hud.sample(game, extras());

        const after = hud.getState();

        expect(after.money).not.toBe(before.money);
        expect(after.money.exact).toBe(before.money.exact + 5000);
        expect(after.citizens).toBe(before.citizens);
        expect(after.calendar).toBe(before.calendar);
        expect(after.gate).toBe(before.gate);
        expect(after.alerts).toBe(before.alerts);
        expect(after.counts).toBe(before.counts);
    });

    it('pre-formats the readouts', () => {
        const game = Game.create(content, 7);
        const hud = new HudStore();

        game.state.resources[content.currency] = 8420;
        hud.sample(game, extras());

        const snapshot = hud.getState();

        expect(snapshot.money.text).toBe('8,42K');
        expect(snapshot.money.face).toBe(game.epoch.id);
        expect(snapshot.calendar.era).toBe(game.epoch.name);
        expect(snapshot.gate.next).toBe(game.nextEpoch?.name);
        expect(snapshot.gate.total).toBe(game.gateLines().length);
    });

    it('ticks the whole second for sheets without touching the groups', () => {
        const game = Game.create(content, 7);
        const hud = new HudStore();

        hud.sample(game, extras(1_000_000));

        const before = hud.getState();

        hud.sample(game, extras(1_001_200));

        expect(hud.getState().second).toBe(before.second + 1);
        expect(hud.getState().money).toBe(before.money);
    });
});
