/**
 * Creatures roaming around the player. They are not saved: a few at a
 * time live in a ring around the player and new ones come as old ones are
 * left behind.
 *
 * - deer graze and bolt when someone comes running or hits them;
 * - boars mind their own business until hit, then charge;
 * - wolves hunt whoever comes near, more of them at night, and run off
 *   when badly hurt;
 * - the dead rise at night, shamble after the player and burn away at
 *   dawn.
 *
 * Nothing hostile comes close to a burning fire, so a campfire is a safe
 * spot at night. Walls and closed doors stop everything.
 *
 * They grow with the player: every level above the first gives new ones
 * a little more health and harder bites (see `strength`).
 */

import * as THREE from 'three';
import type { ItemId } from '../items';
import type { ColliderGrid } from '../physics/colliders';
import { biomeAt } from './biomes';
import type { Biome } from './biomes';
import type { Chips } from './effects';
import { animateMob, createMobModel, flashMob } from './mob-models';
import type { MobModel, MobType } from './mob-models';
import { heightAt, normalAt, WATER_LEVEL } from './terrain';

export type { MobType } from './mob-models';

type Temper = 'timid' | 'proud' | 'hunter' | 'dead';

interface Kind {
    health: number;
    walk: number;
    run: number;
    radius: number;
    height: number;
    damage: number;
    temper: Temper;
    /** How far it notices the player. */
    sight: number;
    loot: [ItemId, number, number, number][];
}

const KINDS: Record<MobType, Kind> = {
    deer: {
        health: 14,
        walk: 1.2,
        run: 7.8,
        radius: 0.45,
        height: 1.4,
        damage: 0,
        temper: 'timid',
        sight: 11,
        loot: [
            ['raw_meat', 2, 3, 1],
            ['hide', 1, 2, 1],
        ],
    },
    boar: {
        health: 24,
        walk: 1.1,
        run: 5.6,
        radius: 0.5,
        height: 0.95,
        damage: 12,
        temper: 'proud',
        sight: 0,
        loot: [
            ['raw_meat', 2, 4, 1],
            ['hide', 1, 1, 1],
        ],
    },
    wolf: {
        health: 20,
        walk: 1.6,
        run: 6.3,
        radius: 0.4,
        height: 0.95,
        damage: 9,
        temper: 'hunter',
        sight: 15,
        loot: [
            ['hide', 1, 2, 1],
            ['raw_meat', 1, 1, 0.6],
        ],
    },
    zombie: {
        health: 30,
        walk: 0.9,
        run: 3.4,
        radius: 0.35,
        height: 1.85,
        damage: 11,
        temper: 'dead',
        sight: 24,
        loot: [
            ['iron', 1, 1, 0.35],
            ['flint', 1, 2, 0.5],
            ['bandage', 1, 1, 0.15],
            ['old_notes', 1, 1, 0.3],
        ],
    },
};

/** Which creatures turn up where: [type, weight] by day and by night. */
const SPAWNS: Record<Biome, [MobType, number, number][]> = {
    meadow: [
        ['deer', 5, 2],
        ['boar', 3, 2],
        ['wolf', 0.3, 1.5],
        ['zombie', 0, 6],
    ],
    forest: [
        ['deer', 3, 1],
        ['boar', 4, 2],
        ['wolf', 2, 4],
        ['zombie', 0, 6],
    ],
    desert: [
        ['boar', 0.5, 0.5],
        ['wolf', 0.5, 1],
        ['zombie', 0, 6],
    ],
    snow: [
        ['deer', 3, 1],
        ['wolf', 4, 5],
        ['zombie', 0, 5],
    ],
    mountains: [
        ['deer', 2, 1],
        ['wolf', 2, 3],
        ['zombie', 0, 4],
    ],
};

const SPAWN_EVERY = 1.5;
const SPAWN_NEAR = 30;
const SPAWN_FAR = 58;
const FORGET = 85;
/** No hostile creature appears this close to the spawn point. */
const SAFE_SPAWN = 28;
/** …or this close to a fire, nor walks into this ring around one. */
const FIRE_FEAR = 6;
const ATTACK_WINDUP = 0.45;
const ATTACK_EVERY = 1.3;
const DEAD_SECONDS = 2.4;
const UP = new THREE.Vector3(0, 1, 0);

type State = 'idle' | 'wander' | 'flee' | 'chase' | 'attack' | 'dead';

export interface Mob {
    kind: 'mob';
    type: MobType;
    id: number;
    position: THREE.Vector3;
    facing: number;
    health: number;
    maxHealth: number;
    radius: number;
    state: State;
    model: MobModel;
    goal: THREE.Vector3;
    timer: number;
    cooldown: number;
    angry: number;
    hurt: number;
    speed: number;
    phase: number;
    knock: THREE.Vector3;
    attack: number | null;
}

export interface FirePlace {
    x: number;
    z: number;
}

export interface MobDeath {
    mob: Mob;
    loot: { item: ItemId; count: number }[];
}

export class Mobs {
    readonly group = new THREE.Group();
    readonly list: Mob[] = [];
    /** A creature's blow landed on the player. */
    onStrike: (mob: Mob, damage: number) => void = () => {};
    onDeath: (death: MobDeath) => void = () => {};
    /** A creature made a sound worth hearing (a growl, a moan, a bleat). */
    onCall: (mob: Mob) => void = () => {};
    /**
     * How much tougher than at the start new creatures are: [health,
     * damage] multipliers, set from the player's level.
     */
    strength: [number, number] = [1, 1];

    private nextId = 1;
    private sinceSpawn = 0;
    private time = 0;
    private probe = new THREE.Vector3();
    private normal = new THREE.Vector3();
    private camera = new THREE.Quaternion();

    constructor(
        private colliders: ColliderGrid,
        private chips: Chips,
        private fires: () => FirePlace[],
    ) {}

    /**
     * One step of the world's creatures. `player` is null while nobody can
     * be hunted (dead or paused): then they just mill about.
     */
    update(
        dt: number,
        player: THREE.Vector3 | null,
        playerRunning: boolean,
        night: number,
        camera: THREE.Camera,
    ): void {
        this.time += dt;
        this.camera.copy(camera.quaternion);

        if (player) {
            this.sinceSpawn += dt;

            if (this.sinceSpawn >= SPAWN_EVERY) {
                this.sinceSpawn = 0;
                this.spawnAround(player, night);
            }
        }

        for (const mob of [...this.list]) {
            if (
                player &&
                mob.state !== 'dead' &&
                mob.position.distanceTo(player) > FORGET
            ) {
                this.remove(mob);
                continue;
            }

            this.think(mob, dt, player, playerRunning, night);
            this.move(mob, dt);
            this.draw(mob, dt);

            if (mob.state === 'dead' && mob.timer > DEAD_SECONDS) {
                this.remove(mob);
            }
        }

        this.separate();
    }

    /** The living creature right in front, within arm's (or sword's) reach. */
    target(position: THREE.Vector3, facing: number, reach = 1.6): Mob | null {
        const forwardX = Math.sin(facing);
        const forwardZ = Math.cos(facing);
        let best: Mob | null = null;
        let bestDistance = reach;

        for (const mob of this.list) {
            if (mob.state === 'dead') {
                continue;
            }

            const dx = mob.position.x - position.x;
            const dz = mob.position.z - position.z;
            const centre = Math.hypot(dx, dz);
            const distance = centre - mob.radius;

            if (
                distance < bestDistance &&
                Math.abs(mob.position.y - position.y) < 1.6 &&
                (centre < 0.6 || (dx * forwardX + dz * forwardZ) / centre > 0.2)
            ) {
                best = mob;
                bestDistance = distance;
            }
        }

        return best;
    }

    /**
     * The living creature most nearly in line with where the player looks,
     * up to `range` away — what a bolt flies at.
     */
    aimed(position: THREE.Vector3, facing: number, range: number): Mob | null {
        const forwardX = Math.sin(facing);
        const forwardZ = Math.cos(facing);
        let best: Mob | null = null;
        let bestScore = -Infinity;

        for (const mob of this.list) {
            if (mob.state === 'dead') {
                continue;
            }

            const dx = mob.position.x - position.x;
            const dz = mob.position.z - position.z;
            const distance = Math.hypot(dx, dz);

            if (distance > range || distance < 0.01) {
                continue;
            }

            const aim = (dx * forwardX + dz * forwardZ) / distance;

            // Within a cone of about 35°, nearer and straighter first.
            if (aim > 0.82) {
                const score = aim * 2 - distance / range;

                if (score > bestScore) {
                    best = mob;
                    bestScore = score;
                }
            }
        }

        return best;
    }

    /** Every living creature within `radius` of a point. */
    around(position: THREE.Vector3, radius: number): Mob[] {
        return this.list.filter(
            (mob) =>
                mob.state !== 'dead' &&
                Math.hypot(
                    mob.position.x - position.x,
                    mob.position.z - position.z,
                ) -
                    mob.radius <
                    radius,
        );
    }

    /** Whether a creature is still within reach for a blow that lands now. */
    inReach(mob: Mob, position: THREE.Vector3, reach = 2.1): boolean {
        return (
            mob.state !== 'dead' &&
            Math.hypot(
                mob.position.x - position.x,
                mob.position.z - position.z,
            ) -
                mob.radius <
                reach
        );
    }

    /** A blow from the player. Answers true when it killed. */
    damage(mob: Mob, amount: number, from: THREE.Vector3): boolean {
        if (mob.state === 'dead') {
            return false;
        }

        mob.health = Math.max(0, mob.health - amount);
        mob.hurt = 1;
        const away = this.probe
            .subVectors(mob.position, from)
            .setY(0)
            .normalize();
        mob.knock.copy(away).multiplyScalar(mob.type === 'boar' ? 3 : 5);
        this.chips.burst(
            this.probe
                .copy(mob.position)
                .setY(mob.position.y + KINDS[mob.type].height * 0.6),
            mob.type === 'zombie' ? 0x6d7a5f : 0x9e3b3b,
            6,
            0.05,
        );

        if (mob.health <= 0) {
            this.kill(mob);

            return true;
        }

        const kind = KINDS[mob.type];

        if (kind.temper === 'timid') {
            this.flee(mob, from, 7);
        } else if (
            kind.temper === 'hunter' &&
            mob.health < mob.maxHealth * 0.3
        ) {
            this.flee(mob, from, 6);
        } else {
            mob.angry = 25;
            mob.state = 'chase';
        }

        this.onCall(mob);

        return false;
    }

    /** Pushes the player's body out of any creature it walks into. */
    pushOut(position: THREE.Vector3, radius: number): void {
        for (const mob of this.list) {
            if (mob.state === 'dead') {
                continue;
            }

            const dx = position.x - mob.position.x;
            const dz = position.z - mob.position.z;
            const distance = Math.hypot(dx, dz);
            const reach = radius + mob.radius;

            if (
                distance < reach &&
                distance > 1e-4 &&
                Math.abs(position.y - mob.position.y) < 1.2
            ) {
                const push = (reach - distance) / distance;
                position.x += dx * push;
                position.z += dz * push;
            }
        }
    }

    /** Everything goes (on waking up again). */
    clear(): void {
        for (const mob of [...this.list]) {
            this.remove(mob);
        }
    }

    private spawnAround(player: THREE.Vector3, night: number): void {
        const cap = Math.round(6 + 4 * night);
        const living = this.list.filter((mob) => mob.state !== 'dead');

        if (living.length >= cap) {
            return;
        }

        const angle = Math.random() * Math.PI * 2;
        const distance = SPAWN_NEAR + Math.random() * (SPAWN_FAR - SPAWN_NEAR);
        const x = player.x + Math.cos(angle) * distance;
        const z = player.z + Math.sin(angle) * distance;

        if (!this.standable(x, z)) {
            return;
        }

        const type = this.pick(biomeAt(x, z), night);

        if (!type) {
            return;
        }

        const hostile = KINDS[type].temper !== 'timid';

        if (
            hostile &&
            (Math.hypot(x, z) < SAFE_SPAWN || this.nearFire(x, z, 16))
        ) {
            return;
        }

        const group =
            type === 'wolf'
                ? 2
                : type === 'deer'
                  ? 1 + Math.floor(Math.random() * 3)
                  : 1;

        for (let index = 0; index < group; index++) {
            const spotX = x + (Math.random() - 0.5) * 4;
            const spotZ = z + (Math.random() - 0.5) * 4;

            this.probe.set(spotX, heightAt(spotX, spotZ) + 0.1, spotZ);

            if (
                this.standable(spotX, spotZ) &&
                !this.colliders.blocked(
                    this.probe,
                    KINDS[type].radius,
                    KINDS[type].height,
                )
            ) {
                this.add(type, spotX, spotZ);
            }
        }
    }

    private pick(biome: Biome, night: number): MobType | null {
        const choices = SPAWNS[biome].map(
            ([type, day, dark]) =>
                [type, day + (dark - day) * night] as [MobType, number],
        );
        const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
        let roll = Math.random() * total;

        for (const [type, weight] of choices) {
            roll -= weight;

            if (roll < 0) {
                return type === 'zombie' && night < 0.6 ? null : type;
            }
        }

        return null;
    }

    private add(type: MobType, x: number, z: number): void {
        const kind = KINDS[type];
        const model = createMobModel(type);
        const mob: Mob = {
            kind: 'mob',
            type,
            id: this.nextId++,
            position: new THREE.Vector3(x, heightAt(x, z), z),
            facing: Math.random() * Math.PI * 2,
            health: Math.round(kind.health * this.strength[0]),
            maxHealth: Math.round(kind.health * this.strength[0]),
            radius: kind.radius,
            state: 'idle',
            model,
            goal: new THREE.Vector3(x, 0, z),
            timer: Math.random() * 3,
            cooldown: 0,
            angry: 0,
            hurt: 0,
            speed: 0,
            phase: Math.random(),
            knock: new THREE.Vector3(),
            attack: null,
        };

        this.list.push(mob);
        this.group.add(model.root);
    }

    private remove(mob: Mob): void {
        this.group.remove(mob.model.root);
        this.list.splice(this.list.indexOf(mob), 1);

        for (const used of mob.model.materials) {
            used.dispose();
        }
    }

    private kill(mob: Mob): void {
        mob.state = 'dead';
        mob.timer = 0;
        mob.attack = null;
        mob.model.bar.visible = false;

        const loot = KINDS[mob.type].loot
            .filter(([, , , chance]) => Math.random() < chance)
            .map(([item, min, max]) => ({
                item,
                count: min + Math.floor(Math.random() * (max - min + 1)),
            }));

        this.onDeath({ mob, loot });
    }

    private flee(mob: Mob, from: THREE.Vector3, seconds: number): void {
        mob.state = 'flee';
        mob.timer = seconds;
        const away = Math.atan2(
            mob.position.x - from.x,
            mob.position.z - from.z,
        );
        mob.goal.set(
            mob.position.x + Math.sin(away) * 40,
            0,
            mob.position.z + Math.cos(away) * 40,
        );
    }

    private think(
        mob: Mob,
        dt: number,
        player: THREE.Vector3 | null,
        playerRunning: boolean,
        night: number,
    ): void {
        const kind = KINDS[mob.type];

        if (mob.state === 'dead') {
            // Counts up: how long it has lain there.
            mob.timer += dt;

            return;
        }

        mob.timer -= dt;
        mob.cooldown = Math.max(0, mob.cooldown - dt);
        mob.angry = Math.max(0, mob.angry - dt);

        // The dead burn away by day.
        if (mob.type === 'zombie' && night < 0.25) {
            mob.health -= 8 * dt;

            if (Math.random() < dt * 8) {
                this.chips.burst(
                    this.probe.copy(mob.position).setY(mob.position.y + 1.6),
                    0x4a4542,
                    2,
                    0.08,
                );
            }

            if (mob.health <= 0) {
                this.kill(mob);

                return;
            }
        }

        const distance = player
            ? Math.hypot(player.x - mob.position.x, player.z - mob.position.z)
            : Infinity;
        const sight = kind.sight * (mob.type === 'wolf' ? 1 + night * 0.5 : 1);
        const playerSafe =
            player !== null && this.nearFire(player.x, player.z, FIRE_FEAR - 1);

        if (mob.attack !== null) {
            mob.attack += dt / ATTACK_WINDUP;

            if (mob.attack >= 1) {
                mob.attack = null;

                if (
                    player &&
                    distance - mob.radius < 1.25 &&
                    Math.abs(player.y - mob.position.y) < 1.5
                ) {
                    this.onStrike(mob, kind.damage * this.strength[1]);
                }
            }

            return;
        }

        if (mob.state === 'flee') {
            if (mob.timer <= 0) {
                mob.state = 'wander';
                mob.timer = 2;
            }

            return;
        }

        const hunting =
            player !== null &&
            !playerSafe &&
            ((kind.temper === 'hunter' && distance < sight) ||
                (kind.temper === 'dead' && distance < sight) ||
                (kind.temper === 'proud' && mob.angry > 0 && distance < 30));

        if (kind.temper === 'timid' && player) {
            if (distance < (playerRunning ? sight : 4)) {
                this.flee(mob, player, 5);

                return;
            }
        }

        if (hunting && player) {
            if (mob.state !== 'chase' && mob.state !== 'attack') {
                this.onCall(mob);
            }

            mob.state = 'chase';
            mob.goal.copy(player);

            if (distance - mob.radius < 1.1 && mob.cooldown <= 0) {
                mob.state = 'attack';
                mob.attack = 0;
                mob.cooldown = ATTACK_EVERY;
            }

            return;
        }

        if (mob.state === 'chase' || mob.state === 'attack') {
            mob.state = 'wander';
            mob.timer = 1;
        }

        if (mob.timer <= 0) {
            if (mob.state === 'wander' || Math.random() < 0.4) {
                mob.state = 'idle';
                mob.timer = 2 + Math.random() * 5;
            } else {
                const angle = Math.random() * Math.PI * 2;
                const reach = 4 + Math.random() * 10;
                mob.goal.set(
                    mob.position.x + Math.cos(angle) * reach,
                    0,
                    mob.position.z + Math.sin(angle) * reach,
                );
                mob.state = 'wander';
                mob.timer = 4 + Math.random() * 6;
            }

            if (Math.random() < 0.15) {
                this.onCall(mob);
            }
        }
    }

    private move(mob: Mob, dt: number): void {
        const kind = KINDS[mob.type];
        let wanted = 0;

        if (mob.state === 'wander') {
            wanted = kind.walk;
        } else if (mob.state === 'flee') {
            wanted = kind.run;
        } else if (mob.state === 'chase') {
            wanted = kind.run;
        }

        const dx = mob.goal.x - mob.position.x;
        const dz = mob.goal.z - mob.position.z;
        const toGoal = Math.hypot(dx, dz);

        if (mob.state === 'chase' && toGoal < mob.radius + 0.9) {
            wanted = 0;
        }

        if (mob.state === 'wander' && toGoal < 0.5) {
            mob.state = 'idle';
            mob.timer = 2 + Math.random() * 4;
            wanted = 0;
        }

        if (mob.attack !== null || mob.state === 'dead') {
            wanted = 0;
        }

        if (toGoal > 0.05 && mob.state !== 'idle' && mob.state !== 'dead') {
            const target = Math.atan2(dx, dz);
            let turn = target - mob.facing;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            mob.facing += turn * Math.min(1, dt * 6);
        }

        mob.speed += (wanted - mob.speed) * Math.min(1, dt * 5);

        let stepX = Math.sin(mob.facing) * mob.speed * dt + mob.knock.x * dt;
        let stepZ = Math.cos(mob.facing) * mob.speed * dt + mob.knock.z * dt;
        mob.knock.multiplyScalar(Math.exp(-8 * dt));

        if (Math.abs(stepX) + Math.abs(stepZ) > 1e-5) {
            if (
                !this.canStand(
                    mob,
                    mob.position.x + stepX,
                    mob.position.z + stepZ,
                )
            ) {
                // Feel around the obstacle: a little left, then right.
                let found = false;

                for (const angle of [0.7, -0.7, 1.4, -1.4]) {
                    const length = Math.hypot(stepX, stepZ);
                    const heading = Math.atan2(stepX, stepZ) + angle;
                    const tryX = Math.sin(heading) * length;
                    const tryZ = Math.cos(heading) * length;

                    if (
                        this.canStand(
                            mob,
                            mob.position.x + tryX,
                            mob.position.z + tryZ,
                        )
                    ) {
                        stepX = tryX;
                        stepZ = tryZ;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    stepX = 0;
                    stepZ = 0;
                    mob.knock.set(0, 0, 0);

                    if (mob.state === 'wander') {
                        mob.timer = 0;
                    }
                }
            }

            mob.position.x += stepX;
            mob.position.z += stepZ;
        }

        mob.position.y +=
            (heightAt(mob.position.x, mob.position.z) - mob.position.y) *
            Math.min(1, dt * 12);
        mob.phase =
            (mob.phase +
                (Math.abs(mob.speed) * dt) / (kind.walk < 1 ? 1.1 : 1.4)) %
            1;
    }

    /**
     * Dry, not too steep, nothing solid in the way, no fire too close for
     * the hostile. One that is already stuck (in a ring of fire, half in a
     * wall) may move anywhere, so it can get out.
     */
    private canStand(mob: Mob, x: number, z: number): boolean {
        if (!this.standable(x, z)) {
            return false;
        }

        const { position } = mob;

        if (
            KINDS[mob.type].temper !== 'timid' &&
            mob.state !== 'flee' &&
            this.nearFire(x, z, FIRE_FEAR) &&
            !this.nearFire(position.x, position.z, FIRE_FEAR)
        ) {
            return false;
        }

        const height = KINDS[mob.type].height;
        this.probe.set(position.x, position.y + 0.1, position.z);

        if (this.colliders.blocked(this.probe, mob.radius, height)) {
            return true;
        }

        this.probe.set(x, heightAt(x, z) + 0.1, z);

        return !this.colliders.blocked(this.probe, mob.radius, height);
    }

    private standable(x: number, z: number): boolean {
        return (
            heightAt(x, z) > WATER_LEVEL + 0.15 &&
            normalAt(x, z, this.normal).y > 0.7
        );
    }

    private nearFire(x: number, z: number, reach: number): boolean {
        return this.fires().some(
            (fire) => Math.hypot(fire.x - x, fire.z - z) < reach,
        );
    }

    /** Creatures do not walk through each other. */
    private separate(): void {
        for (let i = 0; i < this.list.length; i++) {
            for (let j = i + 1; j < this.list.length; j++) {
                const a = this.list[i];
                const b = this.list[j];

                if (a.state === 'dead' || b.state === 'dead') {
                    continue;
                }

                const dx = b.position.x - a.position.x;
                const dz = b.position.z - a.position.z;
                const distance = Math.hypot(dx, dz);
                const reach = a.radius + b.radius;

                if (distance < reach && distance > 1e-4) {
                    const push = ((reach - distance) / distance) * 0.5;
                    a.position.x -= dx * push;
                    a.position.z -= dz * push;
                    b.position.x += dx * push;
                    b.position.z += dz * push;
                }
            }
        }
    }

    private draw(mob: Mob, dt: number): void {
        const model = mob.model;
        model.root.position.copy(mob.position);
        model.root.rotation.y = mob.facing;
        mob.hurt = Math.max(0, mob.hurt - dt * 4);
        flashMob(model, mob.hurt);

        animateMob(model, mob.type, {
            speed: mob.speed,
            phase: mob.phase,
            attack: mob.attack,
            dying: mob.state === 'dead' ? Math.min(1, mob.timer / 0.6) : 0,
            time: this.time + mob.id,
        });

        if (mob.state === 'dead' && mob.timer > DEAD_SECONDS - 0.6) {
            model.root.scale.setScalar(
                Math.max(0.01, (DEAD_SECONDS - mob.timer) / 0.6),
            );
        }

        const showBar = mob.state !== 'dead' && mob.health < mob.maxHealth;
        model.bar.visible = showBar;

        if (showBar) {
            model.barFill.scale.x = Math.max(0.001, mob.health / mob.maxHealth);
            // Face the camera whatever way the creature turns.
            model.bar.quaternion
                .setFromAxisAngle(UP, -mob.facing)
                .multiply(this.camera);
        }
    }
}
