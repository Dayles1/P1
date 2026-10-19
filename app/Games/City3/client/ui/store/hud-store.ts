/**
 * The HUD's 4 Hz snapshot (ui-spec §10, §11.1): the frame loop calls
 * `sample(game, extras)`, which builds flat, pre-formatted groups from
 * the engine's cached aggregates. A group keeps its identity until one of
 * its fields changes, so a component that selects a group re-renders only
 * then; most samples change nothing and notify no one.
 */

import type { Game, GateLine } from '../../engine/sim/game';
import { formatExact, formatNumber, formatRate, mixColor } from '../format';
import { alertsOf } from '../game/advisor';
import type { AdvisorView, AlertView } from '../game/advisor';
import { leadText, raceShares } from '../race';
import { keep, keepList, Store } from './store';

export interface MoneyView {
    text: string;
    exact: number;
    net: string;
    netExact: number;
    sign: -1 | 0 | 1;
    /** Era id of the money's face (e1000). */
    face: string;
    faceShort: string;
    /** The face before the last change, for 20 years after it (gdd §2.4). */
    before: string | null;
    arrears: boolean;
}

export interface CitizensView {
    pop: string;
    popExact: number;
    target: string;
    targetExact: number;
    over: boolean;
    happiness: number;
}

export interface CalendarView {
    year: number;
    eraIndex: number;
    era: string;
    eraId: string;
    /** The accent, blended over the transition years. */
    accent: string;
    lead: number;
    falling: boolean;
    behind: boolean;
    raceNow: number;
    raceCity: number;
    tooltip: string;
}

export interface GateView {
    next: string | null;
    lines: readonly GateLine[];
    done: number;
    total: number;
    state: 'open' | 'ready' | 'building' | 'last';
    /** The Town Hall level being raised, while it builds. */
    hall: string;
    yearsLeft: number;
    buildShare: number;
}

export interface CountsView {
    /** Homes in the city whose next level is open (whole city, lead decision 6). */
    upgrade: number;
    /** The Задачи thumb's dot. */
    goals: 'reward' | 'story' | null;
}

export type SaveState = 'saved' | 'saving' | 'failed' | 'off';

export interface HudSnapshot {
    money: MoneyView;
    citizens: CitizensView;
    alerts: readonly AlertView[];
    calendar: CalendarView;
    gate: GateView;
    advisor: AdvisorView | null;
    counts: CountsView;
    speed: number;
    tester: boolean;
    infinite: boolean;
    save: SaveState;
    savedAt: number;
    fps: number;
    /** Whole real seconds: sheets with live numbers refresh on it (1 Hz). */
    second: number;
}

/** What the HUD needs besides the game itself. */
export interface SampleExtras {
    speed: number;
    tester: boolean;
    infinite: boolean;
    fps: number;
    now: number;
    advisor: AdvisorView | null;
    counts: CountsView;
}

function moneyView(game: Game): MoneyView {
    const money = game.money;
    const net = game.stats.rates[game.content.currency] ?? 0;
    const face = game.content.currencyFace(game.state.epoch);
    const epoch = game.epoch;
    const before =
        game.state.epoch > 0 && game.eraTransition() < 1
            ? game.content.epoch(game.state.epoch - 1).id
            : null;

    return {
        text: formatNumber(money),
        exact: Math.round(money),
        net: formatRate(net),
        netExact: Math.round(net),
        sign: net > 0.5 ? 1 : net < -0.5 ? -1 : 0,
        face: epoch.id,
        faceShort: face.short,
        before,
        arrears: game.stats.arrears || game.state.economy.arrears,
    };
}

function citizensView(game: Game): CitizensView {
    const pop = Math.floor(game.state.population);
    const target = Math.floor(game.stats.target);

    return {
        pop: formatNumber(pop),
        popExact: pop,
        target: formatNumber(target),
        targetExact: target,
        over: pop > target,
        happiness: Math.round(game.stats.happiness),
    };
}

function calendarView(game: Game): CalendarView {
    const lead = Math.round(game.lead().lead);
    const race = raceShares(game);
    const previous = game.content.epoch(Math.max(0, game.state.epoch - 1));

    return {
        year: game.year,
        eraIndex: game.state.epoch,
        era: game.epoch.name,
        eraId: game.epoch.id,
        accent: mixColor(
            previous.accent,
            game.epoch.accent,
            game.eraTransition(),
        ),
        lead,
        falling: game.leadFalling(),
        behind: lead < 0,
        raceNow: Math.round(race.now * 1000) / 1000,
        raceCity: Math.round(race.city * 1000) / 1000,
        tooltip: leadText(game),
    };
}

function gateView(game: Game, prev: GateView | null): GateView {
    const next = game.nextEpoch;
    const lines = game.gateLines();
    const center = game.center;
    const building = game.townHallBuilding();
    const done = lines.filter((line) => line.done).length;
    const upgrade = game.townHallUpgrade();
    const spy = game.clock.secondsPerYear;

    return {
        next: next?.name ?? null,
        lines: prev ? keepList(prev.lines, lines) : lines,
        done,
        total: lines.length,
        state: !next
            ? 'last'
            : building
              ? 'building'
              : done === lines.length
                ? 'ready'
                : 'open',
        hall: upgrade?.level.name ?? '',
        yearsLeft:
            building && center
                ? Math.max(
                      1,
                      Math.ceil((center.buildEnd - game.state.time) / spy),
                  )
                : 0,
        buildShare:
            building && center
                ? Math.round(
                      ((game.state.time - center.buildStart) /
                          Math.max(1, center.buildEnd - center.buildStart)) *
                          100,
                  ) / 100
                : 0,
    };
}

const EMPTY_COUNTS: CountsView = { upgrade: 0, goals: null };

export const EMPTY_SNAPSHOT: HudSnapshot = {
    money: {
        text: '0',
        exact: 0,
        net: '+0/год',
        netExact: 0,
        sign: 0,
        face: 'e0',
        faceShort: '',
        before: null,
        arrears: false,
    },
    citizens: {
        pop: '0',
        popExact: 0,
        target: '0',
        targetExact: 0,
        over: false,
        happiness: 50,
    },
    alerts: [],
    calendar: {
        year: 0,
        eraIndex: 0,
        era: '',
        eraId: 'e0',
        accent: '#c9d17a',
        lead: 0,
        falling: false,
        behind: false,
        raceNow: 0,
        raceCity: 0,
        tooltip: '',
    },
    gate: {
        next: null,
        lines: [],
        done: 0,
        total: 0,
        state: 'last',
        hall: '',
        yearsLeft: 0,
        buildShare: 0,
    },
    advisor: null,
    counts: EMPTY_COUNTS,
    speed: 1,
    tester: false,
    infinite: false,
    save: 'saved',
    savedAt: 0,
    fps: 60,
    second: 0,
};

/** Alerts are the same when their ids, tones and texts are (targets are rebuilt). */
function keepAlerts(
    prev: readonly AlertView[],
    next: readonly AlertView[],
): readonly AlertView[] {
    return prev.length === next.length &&
        prev.every(
            (alert, index) =>
                alert.id === next[index].id &&
                alert.tone === next[index].tone &&
                alert.text === next[index].text,
        )
        ? prev
        : next;
}

export class HudStore extends Store<HudSnapshot> {
    private sampled = false;

    constructor() {
        super(EMPTY_SNAPSHOT);
    }

    /** Builds the snapshot; only changed groups get new identities. */
    sample(game: Game, extras: SampleExtras): void {
        const prev = this.getState();
        const first = !this.sampled;

        this.sampled = true;

        const money = keep(prev.money, moneyView(game));
        const citizens = keep(prev.citizens, citizensView(game));
        const alerts = keepAlerts(prev.alerts, alertsOf(game));
        const calendar = keep(prev.calendar, calendarView(game));
        const gate = keep(prev.gate, gateView(game, first ? null : prev.gate));
        const advisor =
            extras.advisor &&
            prev.advisor &&
            prev.advisor.id === extras.advisor.id &&
            prev.advisor.text === extras.advisor.text
                ? prev.advisor
                : extras.advisor;

        this.set({
            money,
            citizens,
            alerts,
            calendar,
            gate,
            advisor,
            counts: keep(prev.counts, extras.counts),
            speed: extras.speed,
            tester: extras.tester,
            infinite: extras.infinite,
            fps: Math.round(extras.fps / 5) * 5,
            second: Math.floor(extras.now / 1000),
        });
    }

    setSave(save: SaveState, savedAt?: number): void {
        this.set(savedAt === undefined ? { save } : { save, savedAt });
    }
}

/** «8 420 (гроши)» for labels: exact, with the face's short name. */
export function moneyLabel(view: MoneyView): string {
    return `${formatExact(view.exact)} (${view.faceShort.toLowerCase()})`;
}
