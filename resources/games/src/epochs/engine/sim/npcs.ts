/**
 * Residents and traffic. Residents are real people of the city: each has a
 * name, an age, a home and maybe a job, follows the daily schedule from
 * npcs.json (sleep → work → leisure → home), walks there along A* paths and
 * thinks about what bothers them. Traffic only drives around the roads for
 * life and is never saved.
 */

import type { NpcTypeDef } from '../content/types';
import { hash2 } from '../core/random';
import { findPath } from '../world/pathfinding';
import type { Step } from '../world/pathfinding';
import type { Game } from './game';
import type { BuildingState, NpcState } from './state';

export interface Vehicle {
    type: NpcTypeDef;
    x: number;
    y: number;
    nx: number;
    ny: number;
    px: number;
    py: number;
    p: number;
    color: string;
    lane: number;
}

/** A path is only kept in memory; after a reload NPCs re-plan. */
interface Walk {
    path: Step[];
    step: number;
}

const PATHS_PER_TICK = 6;

export class NpcSystem {
    residents: NpcState[];
    vehicles: Vehicle[] = [];

    private walks = new Map<number, Walk>();
    private idleUntil = new Map<number, number>();
    private changed = true;

    constructor(
        private game: Game,
        residents: NpcState[],
    ) {
        this.residents = residents.filter((npc) =>
            game.buildings.has(npc.homeUid),
        );
    }

    /** True once since the last save if residents moved in, out or changed jobs. */
    takeChanged(): boolean {
        const changed = this.changed;

        this.changed = false;

        return changed;
    }

    typeOf(npc: NpcState): NpcTypeDef {
        return (
            this.game.content.npcTypes.find((type) => type.id === npc.type) ??
            this.game.content.npcTypes[0]
        );
    }

    get(uid: number): NpcState | undefined {
        return this.residents.find((npc) => npc.uid === uid);
    }

    isVisible(npc: NpcState): boolean {
        return npc.activity === 'walking' || npc.activity === 'leisure';
    }

    /** Once per game second: population changes, jobs and where everyone is headed. */
    think(quiet: boolean): void {
        const game = this.game;
        const rules = game.content.world.npc;
        const target = Math.min(
            rules.maxNpcs,
            Math.floor(game.state.population / rules.residentsPerNpc),
        );

        if (this.residents.length < target) {
            this.spawn(Math.min(3, target - this.residents.length));
        } else if (this.residents.length > target + 1) {
            const leaving = this.residents.pop()!;

            this.walks.delete(leaving.uid);
            this.changed = true;
        }

        this.assignJobs();

        if (quiet) {
            for (const npc of this.residents) {
                this.teleportHome(npc);
            }

            return;
        }

        const schedule = game.content.bundle.npcs.schedule;
        let planned = 0;

        for (const npc of this.residents) {
            const t =
                (game.clock.timeOfDay(game.state.time) - npc.offset + 1) % 1;
            const wanted: NpcState['goal'] =
                t < schedule.wake || t >= schedule.home
                    ? 'home'
                    : t < schedule.leisure
                      ? npc.workUid
                          ? 'work'
                          : 'leisure'
                      : 'leisure';

            if (
                wanted === npc.goal &&
                (npc.activity !== 'leisure' ||
                    (this.idleUntil.get(npc.uid) ?? 0) > game.state.time)
            ) {
                continue;
            }

            if (planned >= PATHS_PER_TICK) {
                continue;
            }

            planned++;

            if (
                wanted === 'leisure' &&
                npc.goal === 'leisure' &&
                npc.activity === 'leisure'
            ) {
                this.stroll(npc);
            } else {
                this.headTo(npc, wanted);
            }
        }
    }

    /** Every frame: walking along paths, traffic driving. `dt` is game seconds. */
    move(dt: number): void {
        for (const npc of this.residents) {
            const walk = this.walks.get(npc.uid);

            if (!walk) {
                continue;
            }

            const type = this.typeOf(npc);
            const roadBoost = this.game.isRoad(
                this.game.map.index(Math.floor(npc.x), Math.floor(npc.y)),
            )
                ? 1.3
                : 1;
            let budget = type.speed * roadBoost * dt;

            while (budget > 0 && walk.step < walk.path.length) {
                const [tx, ty] = walk.path[walk.step];
                const gx = tx + 0.5;
                const gy = ty + 0.5;
                const dx = gx - npc.x;
                const dy = gy - npc.y;
                const distance = Math.hypot(dx, dy);

                if (distance <= budget) {
                    npc.x = gx;
                    npc.y = gy;
                    budget -= distance;
                    walk.step++;
                } else {
                    npc.x += (dx / distance) * budget;
                    npc.y += (dy / distance) * budget;
                    budget = 0;
                }
            }

            if (walk.step >= walk.path.length) {
                this.walks.delete(npc.uid);
                this.arrive(npc);
            }
        }

        this.driveTraffic(dt);
    }

    thought(npc: NpcState): string {
        const game = this.game;
        const thoughts = game.content.bundle.npcs.thoughts;
        const home = game.status.get(npc.homeUid);
        const homeBuilding = game.buildings.get(npc.homeUid);

        if (game.stats.starving) {
            return thoughts.starving;
        }

        if (
            home?.noPower ||
            (homeBuilding &&
                game.effects(homeBuilding).powerUse &&
                game.stats.powerSupply < game.stats.powerDemand)
        ) {
            return thoughts.no_power;
        }

        if ((home?.pollution ?? 0) > 10) {
            return thoughts.polluted;
        }

        if (game.season.temperature < 0 && npc.activity !== 'home') {
            return thoughts.cold;
        }

        if (
            !npc.workUid &&
            game.stats.employment >= 1 &&
            game.stats.jobs < game.stats.workers
        ) {
            return thoughts.unemployed;
        }

        if ((home?.happiness ?? 50) < 40) {
            return thoughts.unhappy;
        }

        if (npc.activity === 'home') {
            return thoughts.sleeping;
        }

        if (npc.activity === 'working') {
            return thoughts.working;
        }

        if (npc.activity === 'walking') {
            return thoughts.commuting;
        }

        if ((home?.happiness ?? 50) >= 65) {
            return thoughts.happy;
        }

        return thoughts.leisure;
    }

    mood(npc: NpcState): number {
        return Math.round(
            this.game.status.get(npc.homeUid)?.happiness ??
                this.game.stats.happiness,
        );
    }

    onBuildingRemoved(uid: number): void {
        const before = this.residents.length;

        this.residents = this.residents.filter((npc) => npc.homeUid !== uid);

        for (const npc of this.residents) {
            if (npc.workUid === uid) {
                npc.workUid = null;
                this.changed = true;
            }
        }

        this.changed ||= before !== this.residents.length;
    }

    onEpochChanged(): void {
        const types = this.game.content.npcTypesFor(
            this.game.state.epoch,
            'resident',
        );

        if (types.length) {
            for (const npc of this.residents) {
                npc.type =
                    types[Math.floor(hash2(npc.uid, 3) * types.length)].id;
            }
        }

        this.vehicles = [];
        this.changed = true;
    }

    // ———————————————————————————————————————— Internals

    private homes(): { building: BuildingState; free: number }[] {
        const game = this.game;
        const perNpc = game.content.world.npc.residentsPerNpc;
        const living = new Map<number, number>();

        for (const npc of this.residents) {
            living.set(npc.homeUid, (living.get(npc.homeUid) ?? 0) + 1);
        }

        const result: { building: BuildingState; free: number }[] = [];

        for (const building of game.buildings.values()) {
            const status = game.status.get(building.uid);
            const housing = game.effects(building).housing;

            if (housing && status?.complete && status.connected) {
                result.push({
                    building,
                    free:
                        Math.floor(housing / perNpc) -
                        (living.get(building.uid) ?? 0),
                });
            }
        }

        return result.filter((home) => home.free > 0);
    }

    private spawn(count: number): void {
        const game = this.game;
        const types = game.content.npcTypesFor(game.state.epoch, 'resident');
        const [minAge, maxAge] = game.content.bundle.npcs.age;
        const jitter = game.content.bundle.npcs.schedule.jitter;

        for (let i = 0; i < count; i++) {
            const homes = this.homes();

            if (!homes.length || !types.length) {
                return;
            }

            const home =
                homes[Math.floor(game.random() * homes.length)].building;
            const def = game.def(home);
            const uid = game.state.nextUid++;

            this.residents.push({
                uid,
                type: types[Math.floor(game.random() * types.length)].id,
                name: game.randomName(),
                age: Math.floor(minAge + game.random() * (maxAge - minAge)),
                homeUid: home.uid,
                workUid: null,
                x: home.x + def.size.w / 2,
                y: home.y + def.size.h / 2,
                activity: 'home',
                goal: 'home',
                offset: (game.random() - 0.5) * 2 * jitter,
            });
            this.changed = true;
        }
    }

    private assignJobs(): void {
        const game = this.game;
        const perNpc = game.content.world.npc.residentsPerNpc;
        const taken = new Map<number, number>();

        for (const npc of this.residents) {
            if (npc.workUid && !game.buildings.has(npc.workUid)) {
                npc.workUid = null;
                this.changed = true;
            }

            if (npc.workUid) {
                taken.set(npc.workUid, (taken.get(npc.workUid) ?? 0) + 1);
            }
        }

        const unemployed = this.residents.filter((npc) => !npc.workUid);

        if (!unemployed.length) {
            return;
        }

        for (const building of game.buildings.values()) {
            const status = game.status.get(building.uid);
            const jobs = game.effects(building).jobs;

            if (!jobs || !status?.complete || !status.connected) {
                continue;
            }

            let free =
                Math.max(1, Math.round(jobs / perNpc)) -
                (taken.get(building.uid) ?? 0);

            while (free-- > 0 && unemployed.length) {
                unemployed.pop()!.workUid = building.uid;
                this.changed = true;
            }
        }
    }

    /** The tile a walker heads for: a road next to the building, else the building itself. */
    private entrance(building: BuildingState): Step {
        const game = this.game;
        const { w, h } = game.def(building).size;

        for (const [x, y] of game.around(building.x, building.y, w, h, 1)) {
            if (game.connectedRoads.has(game.map.index(x, y))) {
                return [x, y];
            }
        }

        return [building.x, building.y];
    }

    private footprint(building: BuildingState): Set<number> {
        const game = this.game;
        const { w, h } = game.def(building).size;
        const tiles = new Set<number>();

        for (let y = building.y; y < building.y + h; y++) {
            for (let x = building.x; x < building.x + w; x++) {
                tiles.add(game.map.index(x, y));
            }
        }

        return tiles;
    }

    private leisureSpot(): BuildingState | null {
        const game = this.game;
        const spots = [...game.buildings.values()].filter(
            (b) =>
                game.effects(b).aura &&
                game.status.get(b.uid)?.complete &&
                !game.def(b).role,
        );

        return spots.length
            ? spots[Math.floor(game.random() * spots.length)]
            : (game.center ?? null);
    }

    private headTo(npc: NpcState, goal: NpcState['goal']): void {
        const game = this.game;
        const target =
            goal === 'home'
                ? game.buildings.get(npc.homeUid)
                : goal === 'work' && npc.workUid
                  ? game.buildings.get(npc.workUid)
                  : this.leisureSpot();

        npc.goal = goal;

        if (!target) {
            return;
        }

        const from: Step = [Math.floor(npc.x), Math.floor(npc.y)];
        const to: Step =
            goal === 'leisure' ? this.entrance(target) : [target.x, target.y];
        const allowed = new Set([
            ...this.footprint(target),
            ...this.footprint(game.buildings.get(npc.homeUid) ?? target),
        ]);
        const path = findPath(game.map, from, to, {
            isRoad: (i) => game.isRoad(i),
            allowed,
        });

        if (!path) {
            // Unreachable on foot: appear there (as if by cart).
            npc.x = to[0] + 0.5;
            npc.y = to[1] + 0.5;
            this.arrive(npc);

            return;
        }

        npc.activity = 'walking';
        this.walks.set(npc.uid, { path, step: 1 });
    }

    private stroll(npc: NpcState): void {
        const game = this.game;
        const x = Math.floor(npc.x) + Math.floor(game.random() * 7) - 3;
        const y = Math.floor(npc.y) + Math.floor(game.random() * 7) - 3;

        if (!game.map.inBounds(x, y)) {
            return;
        }

        const path = findPath(
            game.map,
            [Math.floor(npc.x), Math.floor(npc.y)],
            [x, y],
            { isRoad: (i) => game.isRoad(i), maxNodes: 300 },
        );

        if (path) {
            npc.activity = 'walking';
            this.walks.set(npc.uid, { path, step: 1 });
        } else {
            this.idleUntil.set(npc.uid, game.state.time + 5);
        }
    }

    private arrive(npc: NpcState): void {
        npc.activity =
            npc.goal === 'home'
                ? 'home'
                : npc.goal === 'work'
                  ? 'working'
                  : 'leisure';
        this.idleUntil.set(
            npc.uid,
            this.game.state.time + 4 + this.game.random() * 10,
        );
    }

    private teleportHome(npc: NpcState): void {
        const home = this.game.buildings.get(npc.homeUid);

        if (home) {
            npc.x = home.x + 0.5;
            npc.y = home.y + 0.5;
        }

        npc.activity = 'home';
        npc.goal = 'home';
        this.walks.delete(npc.uid);
    }

    private driveTraffic(dt: number): void {
        const game = this.game;
        const rules = game.content.world.npc;
        const types = game.content.npcTypesFor(game.state.epoch, 'traffic');
        const roads = [...game.connectedRoads];
        const wanted = types.length
            ? Math.min(
                  rules.maxTraffic,
                  Math.floor(roads.length / rules.trafficPerRoads),
              )
            : 0;
        const isRoad = (x: number, y: number) =>
            game.map.inBounds(x, y) &&
            game.connectedRoads.has(game.map.index(x, y));

        if (
            this.vehicles.length < wanted &&
            roads.length &&
            Math.random() < 0.05
        ) {
            const index = roads[Math.floor(Math.random() * roads.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            const x = index % game.map.width;
            const y = Math.floor(index / game.map.width);

            this.vehicles.push({
                type,
                x,
                y,
                nx: x,
                ny: y,
                px: 0,
                py: 0,
                p: 1,
                color: type.body[Math.floor(Math.random() * type.body.length)],
                lane: 1,
            });
        }

        if (this.vehicles.length > wanted) {
            this.vehicles.pop();
        }

        this.vehicles = this.vehicles.filter((v) => {
            v.p += v.type.speed * dt;

            if (v.p < 1) {
                return true;
            }

            const fromX = v.x;
            const fromY = v.y;

            v.x = v.nx;
            v.y = v.ny;

            if (!isRoad(v.x, v.y)) {
                return false;
            }

            const options = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ].filter(
                ([dx, dy]) =>
                    isRoad(v.x + dx, v.y + dy) &&
                    !(v.x + dx === fromX && v.y + dy === fromY),
            );
            const next = options.length
                ? options[Math.floor(Math.random() * options.length)]
                : [fromX - v.x, fromY - v.y];

            if (!isRoad(v.x + next[0], v.y + next[1])) {
                return false;
            }

            v.nx = v.x + next[0];
            v.ny = v.y + next[1];
            v.p = 0;
            v.px = next[1] !== 0 ? 0.14 * Math.sign(next[1]) : 0;
            v.py = next[0] !== 0 ? -0.14 * Math.sign(next[0]) : 0;

            return true;
        });
    }
}
