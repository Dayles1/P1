/**
 * One running game: the scene, the hero and the loop that ties input,
 * physics, gathering, digging, building, fighting, skills, crafting,
 * research, levelling up, animation, camera, sky, sound and saving
 * together.
 *
 * The game is in one of four modes: playing (pointer locked, or the touch
 * controls showing), paused (the start card — or, before there is a hero,
 * the card to make one), in the menu (pointer free — the world goes on
 * meanwhile) or dead (the death card, until the player wakes up again at
 * their sleeping bag or the camp).
 */

import * as THREE from 'three';
import { playtimeBeat, resetPlayer, savePlayer } from './api';
import type { PlayerState, SavedPlayer } from './api';
import { essenceOf } from './artifacts';
import type { Fusion } from './artifacts';
import { Sound } from './audio';
import type { Surface } from './audio';
import { ThirdPersonCamera } from './camera';
import { createRenderer, Graphics } from './graphics';
import { artifactRules, Hero, RULES } from './hero';
import type { Attribute, Gender, HeroClass, XpReward } from './hero';
import { t } from './i18n';
import type { DeathCause, Tab } from './i18n';
import { Input, TOUCH } from './input';
import type { Action } from './input';
import { condition, HOTBAR, Inventory } from './inventory';
import type { Stack } from './inventory';
import { ITEMS, strikeDamage } from './items';
import type { ArmorSlot, ArtifactId, ItemId } from './items';
import { Character, RADIUS, STANCE_SPEED } from './physics/character';
import { ColliderGrid } from './physics/colliders';
import { Mannequin } from './player/mannequin';
import type { Activity as Pose } from './player/mannequin';
import { MAX_HEALTH, Vitals } from './player/vitals';
import { recipeFor } from './recipes';
import type { Recipe, Station } from './recipes';
import { Research } from './research';
import { loadSettings, saveSettings } from './settings';
import type { Settings } from './settings';
import { readStats } from './stats';
import type { Stats } from './stats';
import { CreateHero } from './ui/create';
import { Hud } from './ui/hud';
import type { PromptLine } from './ui/hud';
import type { IconName } from './ui/icons';
import { Menu } from './ui/menu';
import { TouchControls } from './ui/touch';
import type { TouchContext } from './ui/touch';
import { biomeWeights, dominantBiome } from './world/biomes';
import type { Biome } from './world/biomes';
import { Bolts } from './world/bolts';
import { Clouds } from './world/clouds';
import { Digs } from './world/digs';
import type { Dig } from './world/digs';
import { Chips } from './world/effects';
import { Mobs } from './world/mobs';
import type { Mob } from './world/mobs';
import { placementSpot, Resources } from './world/resources';
import type { HitTarget, Tool, UseTarget, Yield } from './world/resources';
import { Sky } from './world/sky';
import { Structures } from './world/structures';
import type { Structure, StructureType } from './world/structures';
import { heightAt, Terrain, WATER_LEVEL } from './world/terrain';
import { Water } from './world/water';

const AUTOSAVE_SECONDS = 10;
/** How often the games hub hears that the player is playing (for rating). */
const PLAYTIME_BEAT_MS = 60_000;
const REGROW_SECONDS = 20;

const HIT_SECONDS = 0.55;
const SWORD_SECONDS = 0.42;
/** Point of a swing at which the blow lands. */
const HIT_LANDS = 0.5;
const PICKUP_SECONDS = 0.6;
const PICKUP_TAKES = 0.45;
/** Landing faster than this (m/s, a fall of about 3.5 m) hurts. */
const SAFE_LANDING = 13;
const DROWN_DAMAGE = 10;
/** How close a fire or workbench has to be to make things at it. */
const CRAFT_REACH = 3.5;
/** Out of stamina, blows come this much slower. */
const TIRED_SWING = 1.5;
/** Share of a thing's materials that come back when it is taken apart. */
const SALVAGE = 0.5;
/** Knowledge for taking apart a thing whose recipe is already known. */
const SALVAGE_KNOWLEDGE = 3;
/** What can be taken apart: made things, not food or smelted iron. */
const SALVAGEABLE = ['tools', 'weapons', 'armor', 'building'];

const UNDERWATER = new THREE.Color(0x2f5566);

type Mode = 'play' | 'paused' | 'menu' | 'dead';

/** What a blow can land on. */
type Strike = HitTarget | Mob | Structure | Dig;
/** What E can do something with. */
type Use = UseTarget | Structure;

interface Activity {
    kind: 'hit' | 'pickup';
    time: number;
    duration: number;
    done: boolean;
    target: Strike | Use | null;
}

interface LightSource {
    position: THREE.Vector3;
    color: number;
    strength: number;
}

export interface GameOptions {
    root: HTMLElement;
    backUrl: string;
    saved: SavedPlayer | null;
}

export class Game {
    private renderer: THREE.WebGLRenderer;
    private graphics: Graphics;
    private settings: Settings = loadSettings();
    private scene = new THREE.Scene();
    private sun: THREE.DirectionalLight;
    private sky: Sky;
    private clouds = new Clouds();
    private water = new Water();
    private lights: THREE.PointLight[] = [];
    private terrain: Terrain;
    /** The view distance last handed to the land, the things on it and the fog. */
    private viewDistance = 0;
    private view: ThirdPersonCamera;
    private input: Input;
    private touch: TouchControls | null = null;
    private sound = new Sound();
    private character: Character;
    private mannequin = new Mannequin();
    private vitals = new Vitals();
    private chips = new Chips();
    private resources: Resources;
    private structures: Structures;
    private digs: Digs;
    private bolts: Bolts;
    private mobs: Mobs;
    private inventory = new Inventory();
    private stats: Stats;
    /** Null until the player has made one (a new player, or one from before heroes). */
    private hero: Hero | null = null;
    private research = new Research();
    private create: CreateHero | null = null;
    private skillCooldown = 0;
    /** Seconds left of the tank's guard. */
    private guardTime = 0;
    /** Seconds the assassin's next blow stays critical after a dash. */
    private poisedTime = 0;
    /** Seconds until the phoenix feather's second wind works again. */
    private secondWindCooldown = 0;
    private hud: Hud;
    private menu: Menu;
    private clock = new THREE.Clock();

    private mode: Mode = 'paused';
    private started = false;
    private activity: Activity | null = null;
    private targets: { hit: Strike | null; use: Use | null } = {
        hit: null,
        use: null,
    };
    private jumpQueued = false;
    /** Height still to ease the figure up after stepping onto something. */
    private stepLift = 0;
    private lastNote = new Map<string, number>();
    private wasSwimming = false;
    private gatherBonus = 1;
    private biome: Biome = 'meadow';
    private nearWater = 0;
    private sinceSurvey = 1;
    private night = 0;
    private drowning = 0;

    private dirty = false;
    /** Starting over: nothing may be saved any more (it would come back). */
    private wiping = false;
    private sinceSave = 0;
    private sinceRegrow = 0;
    private lastSaved = { x: NaN, z: NaN, yaw: NaN };
    private tip = new THREE.Vector3();

    constructor(private options: GameOptions) {
        const quality = this.settings.quality;
        this.renderer = createRenderer(quality);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.domElement.className = 'sb-canvas';
        options.root.append(this.renderer.domElement);

        this.scene.fog = new THREE.Fog(0xcfd8de, 70, 320);
        const ambient = new THREE.HemisphereLight(0xf1f4f6, 0x8f8a80, 1.6);
        this.scene.add(ambient);

        this.sun = new THREE.DirectionalLight(0xfff6ea, 2.4);
        this.sun.shadow.camera.left = -30;
        this.sun.shadow.camera.right = 30;
        this.sun.shadow.camera.top = 30;
        this.sun.shadow.camera.bottom = -30;
        this.sun.shadow.camera.far = 200;
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.03;
        this.scene.add(this.sun, this.sun.target);
        this.sky = new Sky(this.scene, this.sun, ambient);
        this.graphics = new Graphics(this.renderer, this.scene, this.sun);
        this.graphics.apply(quality);

        this.setLamps(this.graphics.lamps);
        this.terrain = new Terrain(this.graphics.groundDetail);

        const colliders = new ColliderGrid();
        this.resources = new Resources(colliders, this.chips);
        this.digs = new Digs(colliders, this.chips);
        this.structures = new Structures(colliders);
        this.mobs = new Mobs(colliders, this.chips, () => this.resources.fires);
        this.bolts = new Bolts(this.chips);
        this.scene.add(
            this.terrain.group,
            this.water.mesh,
            this.resources.group,
            this.digs.group,
            this.structures.group,
            this.mobs.group,
            this.bolts.group,
            this.clouds.group,
            this.chips.mesh,
            this.mannequin.root,
        );

        this.character = new Character(colliders);
        this.stats = readStats(options.saved?.stats);
        this.view = new ThirdPersonCamera(
            window.innerWidth / window.innerHeight,
        );
        this.view.sensitivity = this.settings.sensitivity;
        this.sound.setVolume(this.settings.volume);
        this.input = new Input(this.renderer.domElement);
        this.hud = new Hud(options.root, options.backUrl, TOUCH, {
            start: () => this.resume(),
            select: (slot) => this.inventory.select(slot),
            open: (tab) => this.openMenu(tab),
            pause: () => this.pause(),
            respawn: () => this.respawn(),
            skill: () => this.act('skill'),
        });

        if (TOUCH) {
            this.touch = new TouchControls(options.root, this.input, (action) =>
                this.act(action),
            );
        }

        this.menu = new Menu(options.root, {
            inventory: this.inventory,
            settings: this.settings,
            graphics: this.graphics,
            research: this.research,
            touch: TOUCH,
            hero: () => this.hero,
            vitals: () => this.vitals,
            armor: () => this.armor,
            health: () => this.vitals.health,
            stats: () => this.stats,
            stations: () => this.stations(),
            muted: () => this.sound.muted,
            craft: (recipe) => this.craft(recipe),
            drop: (index, count) => this.dropFromSlot(index, count),
            consume: (index) => this.consume(index),
            equip: (index) => this.equip(index),
            unequip: (slot, index) => this.unequip(slot, index),
            chestChanged: () => {
                this.dirty = true;
            },
            spendPoint: (attribute) => this.spendPoint(attribute),
            learn: (recipe) => this.learn(recipe),
            study: (index) => this.study(index),
            salvage: (index) => this.salvage(index),
            salvageable: (item) => this.salvageable(item),
            absorb: (index) => this.absorb(index),
            recycle: (index) => this.recycle(index),
            fuse: (fusion) => this.fuse(fusion),
            changeSettings: (change) => this.changeSettings(change),
            startOver: () => void this.startOver(),
            toggleMute: () => this.toggleMute(),
            close: () => this.closeMenu(),
        });

        this.inventory.onChange = () => {
            this.dirty = true;
            this.applyInventory();
        };
        this.resources.onTreeFalls = () => this.sound.treeCreak();
        this.resources.onTreeLands = () => this.sound.treeCrash();
        this.mannequin.onStep = (loudness) =>
            this.sound.footstep(this.surface(), loudness);
        this.mannequin.onStroke = () => this.sound.stroke();
        this.mobs.onStrike = (mob, damage) => this.struck(mob, damage);
        this.mobs.onDeath = ({ mob, loot }) => {
            this.sound.fall();

            for (const { item, count } of loot) {
                this.resources.drop(
                    item,
                    count,
                    mob.position
                        .clone()
                        .add(
                            new THREE.Vector3(
                                (Math.random() - 0.5) * 0.8,
                                0,
                                (Math.random() - 0.5) * 0.8,
                            ),
                        ),
                );
            }
        };
        this.mobs.onCall = (mob) =>
            this.sound.call(
                mob.type,
                mob.position.distanceTo(this.character.position),
            );
        this.bolts.onHit = (mob, damage) => this.hitMob(mob, damage, false);

        this.spawn(options.saved);
        this.applyView();
        this.terrain.update(this.character.position, Infinity);

        this.input.onAction = (action) => this.act(action);
        this.input.onLockChange = (locked) => {
            if (locked) {
                this.mode = 'play';
                this.started = true;
                this.beat();
                this.menu.hide();
                this.hud.showPaused(false);
                this.touch?.show(true);
            } else if (this.mode === 'play') {
                this.pause();
            }
        };
        this.renderer.domElement.addEventListener('click', () => {
            if (this.mode === 'paused') {
                this.resume();
            }
        });

        window.addEventListener('resize', this.resize);
        window.addEventListener('pagehide', () => void this.save(true));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                void this.save(true);
            }
        });
    }

    start(): void {
        this.renderer.setAnimationLoop(this.frame);
        window.setInterval(() => this.beat(), PLAYTIME_BEAT_MS);

        if (!this.hero) {
            this.showCreate();
        }
    }

    /** The card to make a hero: class, then gender, with a turning preview. */
    private showCreate(): void {
        this.hud.showPaused(false);
        this.create = new CreateHero(
            this.options.root,
            Boolean(this.options.saved),
            (heroClass, gender) => this.makeHero(heroClass, gender),
        );
    }

    private makeHero(heroClass: HeroClass, gender: Gender): void {
        this.hero = new Hero(heroClass, gender);
        this.applyHero();
        this.vitals.refill();
        this.create?.dispose();
        this.create = null;
        this.dirty = true;
        this.sound.artifact();
        void this.save();
        this.resume();
    }

    /**
     * What the hero is shows everywhere: health, mana and stamina, how the
     * figure looks, how tough the creatures are, the level on the HUD.
     */
    private applyHero(): void {
        const hero = this.hero;

        if (!hero) {
            return;
        }

        this.vitals.apply(hero.derived);
        this.applyInventory();
        this.mannequin.setLook({
            heroClass: hero.heroClass,
            gender: hero.gender,
            attributes: hero.attributes,
        });
        const growth = hero.level - 1;
        this.mobs.strength = [
            1 + growth * RULES.mob_scaling.health,
            1 + growth * RULES.mob_scaling.damage,
        ];
        this.hud.setHero(hero);
        this.menu.render();
    }

    /** Experience for something done; levels up as far as it goes. */
    private gainXp(reward: XpReward, times = 1): void {
        const hero = this.hero;

        if (!hero) {
            return;
        }

        const reached = hero.gain(RULES.xp_rewards[reward] * times);
        this.dirty = true;

        if (reached.length === 0) {
            this.hud.setHero(hero);

            return;
        }

        this.applyHero();
        this.vitals.refill();
        this.sound.artifact();
        this.hud.levelUp(hero.level, hero.freePoints);
    }

    private spendPoint(attribute: Attribute): void {
        if (this.hero?.spend(attribute)) {
            this.sound.click();
            this.dirty = true;
            this.applyHero();
        }
    }

    /** Armour points of what is worn plus the hero's own defence. */
    private get armor(): number {
        return this.inventory.armor + (this.hero?.derived.defense ?? 0);
    }

    /** A playtime heartbeat — only while actually playing, in a visible tab. */
    private beat(): void {
        if (
            document.visibilityState === 'visible' &&
            (this.mode === 'play' || this.mode === 'menu')
        ) {
            playtimeBeat();
        }
    }

    private spawn(saved: SavedPlayer | null): void {
        this.hero = Hero.read(saved?.hero);

        if (this.hero) {
            this.applyHero();
            this.vitals.refill();
        }

        if (saved) {
            this.character.placeAt(saved.x, saved.y, saved.z);
            this.character.facing = saved.yaw;
            this.view.yaw = saved.yaw + Math.PI;
            this.lastSaved = { x: saved.x, z: saved.z, yaw: saved.yaw };
            this.inventory.load(saved.inventory, saved.equipment);
            this.resources.load(saved.harvested, saved.placed, Date.now());
            this.digs.load(saved.harvested, Date.now());
            this.structures.load(saved.placed);
            this.research.load(saved.research, this.owned());
            this.vitals.revive(
                saved.health && saved.health > 0 ? saved.health : MAX_HEALTH,
            );

            if (saved.mana !== null && this.hero) {
                this.vitals.mana = Math.min(this.vitals.maxMana, saved.mana);
            }
        } else {
            this.character.placeAt(0, heightAt(0, 0), 0);
            this.character.facing = Math.PI;
        }

        this.dirty = false;
        this.applyInventory();
        this.view.update(0, this.character.position, 1.55, false, true);
    }

    /** Everything the player has: carried, worn and kept in chests. */
    private owned(): ItemId[] {
        const stacks: (Stack | null)[] = [
            ...this.inventory.slots,
            ...Object.values(this.inventory.worn),
            ...this.structures.list.flatMap(
                (structure) => structure.items ?? [],
            ),
        ];

        return stacks.flatMap((stack) => (stack ? [stack.item] : []));
    }

    /** What carrying things does: the item in hand, armour, artifact bonuses. */
    private applyInventory(): void {
        const inventory = this.inventory;
        const character = this.character;

        this.hud.setInventory(inventory);
        this.menu.render();
        this.mannequin.hold(inventory.held?.item ?? null);
        this.mannequin.wear({
            head: inventory.worn.head?.item ?? null,
            body: inventory.worn.body?.item ?? null,
            feet: inventory.worn.feet?.item ?? null,
        });

        // A carried rare artifact helps while carried; an absorbed one for
        // good (the better of the two counts).
        const hero = this.hero;
        const bonus = (key: Parameters<Hero['bonus']>[0]) =>
            1 + (hero?.bonus(key) ?? 0);

        character.jumpScale = Math.max(
            inventory.has('wind_feather') ? 1.3 : 1,
            bonus('jump'),
        );
        character.runScale = inventory.has('golden_clover') ? 1.15 : 1;
        character.swimScale = Math.max(
            inventory.has('frost_crystal') ? 1.35 : 1,
            bonus('swim'),
        );
        character.breathScale = hero?.has('water_breathing')
            ? Infinity
            : Math.max(inventory.has('frost_crystal') ? 2 : 1, bonus('breath'));
        character.extraJumps = hero?.has('double_jump') ? 1 : 0;
        this.gatherBonus = Math.max(
            inventory.has('forest_heart') ? 1.5 : 1,
            bonus('gather'),
        );
    }

    /** Takes in an artifact from a slot for good: its attributes, bonuses or skill. */
    private absorb(index: number): void {
        const hero = this.hero;
        const stack = this.inventory.slots[index];

        if (!hero || !stack || !artifactRules(stack.item)) {
            return;
        }

        if (!hero.absorb(stack.item)) {
            this.note(t.absorb_full);

            return;
        }

        const position = this.character.position;
        this.inventory.take(index, 1);
        this.sound.artifact();
        this.chips.burst(
            position.clone().setY(position.y + 1.2),
            0xf3d27a,
            24,
            0.05,
        );
        this.hud.toast(`${t.absorbed}: ${t.items[stack.item][0]}`, stack.item);
        this.applyHero();
        this.gainXp('absorb');
        this.dirty = true;
    }

    /** Turns an artifact from a slot into essence. */
    private recycle(index: number): void {
        const stack = this.inventory.slots[index];

        if (!stack || !artifactRules(stack.item)) {
            return;
        }

        const essence = essenceOf(stack.item as ArtifactId);
        this.inventory.take(index, 1);
        const added = this.inventory.add('essence', essence);

        if (added < essence) {
            this.dropNear('essence', essence - added);
        }

        this.sound.craft();
        this.hud.toast(`+${essence} ${t.items.essence[0]}`, 'essence');
        this.dirty = true;
        this.menu.render();
    }

    /** Fuses a legendary artifact from others and essence. */
    private fuse(fusion: Fusion): void {
        const inventory = this.inventory;

        if (
            fusion.needs.some(
                ([item, count]) => inventory.total(item) < count,
            ) ||
            inventory.room(fusion.result, 1) === 0
        ) {
            return;
        }

        for (const [item, count] of fusion.needs) {
            inventory.spend(item, count);
        }

        inventory.add(fusion.result, 1);
        this.sound.artifact();
        this.hud.toast(
            `${t.fused}: ${t.items[fusion.result][0]}`,
            fusion.result,
        );
        this.gainXp('fuse');
        this.dirty = true;
        this.menu.render();
    }

    private resume(): void {
        if (this.vitals.dead) {
            return;
        }

        if (!this.hero) {
            if (!this.create) {
                this.showCreate();
            }

            return;
        }

        this.sound.start();

        if (TOUCH && !document.fullscreenElement) {
            const orientation = screen.orientation as ScreenOrientation & {
                lock?: (orientation: string) => Promise<void>;
            };
            document.documentElement
                .requestFullscreen?.()
                .then(() => orientation.lock?.('landscape'))
                .catch(() => {});
        }

        void this.input.lock().then((locked) => {
            if (!locked) {
                this.hud.showPaused(true, this.started);
            }
        });
    }

    private pause(): void {
        if (this.mode === 'dead') {
            return;
        }

        this.closeChest();
        this.menu.hide();
        this.mode = 'paused';
        this.hud.showPaused(true, this.started);
        this.touch?.show(false);
        this.input.unlock();
        void this.save();
    }

    private openMenu(tab: Tab, chest: Structure | null = null): void {
        if (this.mode === 'dead') {
            return;
        }

        this.mode = 'menu';
        this.menu.show(tab, chest);
        this.hud.showPaused(false);
        this.touch?.show(false);
        this.sound.click();
        this.input.unlock();
    }

    private closeMenu(): void {
        this.closeChest();
        this.menu.hide();
        this.mode = 'paused';
        this.sound.click();
        this.resume();
    }

    /** The menu key for a tab: opens it, switches to it, or closes the menu. */
    private toggleMenu(tab: Tab): void {
        if (this.mode === 'menu') {
            if (this.menu.tab === tab) {
                this.closeMenu();
            } else {
                this.menu.switchTo(tab);
            }
        } else if (this.mode === 'play') {
            this.openMenu(tab);
        }
    }

    private closeChest(): void {
        if (this.menu.chest) {
            this.menu.chest.open = false;
            this.sound.chest();
            this.dirty = true;
        }
    }

    /** One-off keys and buttons. */
    private act(action: Action): void {
        const character = this.character;

        switch (action) {
            case 'debug':
                this.hud.toggleDebug();

                return;
            case 'skip_time':
                this.sky.skip(1 / 24);

                return;
            case 'mute':
                this.toggleMute();

                return;
            case 'inventory':
                this.toggleMenu('bag');

                return;
            case 'crafting':
                this.toggleMenu('craft');

                return;
            case 'character':
                this.toggleMenu('hero');

                return;
            case 'artifacts':
                this.toggleMenu('artifacts');

                return;
            case 'escape':
                if (this.mode === 'menu') {
                    this.pause();
                } else if (this.mode === 'play' && TOUCH) {
                    this.pause();
                }

                return;
        }

        if (this.mode !== 'play') {
            return;
        }

        if (action.startsWith('slot')) {
            this.inventory.select(Number(action.slice(4)) - 1);

            return;
        }

        // In water the jump and crouch keys are held to swim up and down.
        if (character.swimming) {
            return;
        }

        if (character.sitting) {
            character.standUp();

            return;
        }

        switch (action) {
            case 'jump':
                if (character.stance === 'crawl') {
                    this.changeStance('crouch');
                } else if (
                    !character.grounded ||
                    !character.tryClimb(...this.climbDirection())
                ) {
                    this.jumpQueued = true;
                }

                break;
            case 'crouch':
                this.changeStance(
                    character.stance === 'crouch' ? 'stand' : 'crouch',
                );
                break;
            case 'crawl':
                if (character.stance === 'crawl') {
                    if (!character.setStance('stand')) {
                        this.changeStance('crouch');
                    }
                } else {
                    this.changeStance('crawl');
                }

                break;
            case 'sit':
                if (!this.activity) {
                    character.sitDown(null);
                }

                break;
            case 'interact':
                this.interact();
                break;
            case 'use':
                this.useHeld();
                break;
            case 'skill':
                this.useSkill();
                break;
        }
    }

    private changeStance(stance: 'stand' | 'crouch' | 'crawl'): void {
        if (!this.character.setStance(stance)) {
            this.note(t.no_room);
        }
    }

    /** Where to climb: where the player is steering, else straight ahead. */
    private climbDirection(): [number, number] {
        const axes = this.view.groundAxes();
        const moveX =
            axes.forwardX * this.input.forward +
            axes.rightX * this.input.strafe;
        const moveZ =
            axes.forwardZ * this.input.forward +
            axes.rightZ * this.input.strafe;

        if (Math.hypot(moveX, moveZ) > 0.1) {
            return [moveX, moveZ];
        }

        return [
            Math.sin(this.character.facing),
            Math.cos(this.character.facing),
        ];
    }

    /** E: pick up what is near, sit on it, or use a building. */
    private interact(): void {
        const target = this.targets.use;

        if (!target || this.activity) {
            return;
        }

        if (target.kind === 'structure') {
            this.useStructure(target);

            return;
        }

        if (target.kind === 'seat') {
            this.character.sitDown(target.seat);

            return;
        }

        const item = target.kind === 'fire' ? 'campfire' : target.item;

        if (this.inventory.room(item, 1) === 0) {
            this.note(t.full);

            return;
        }

        this.activity = {
            kind: 'pickup',
            time: 0,
            duration: PICKUP_SECONDS,
            done: false,
            target,
        };
    }

    private useStructure(structure: Structure): void {
        switch (structure.type) {
            case 'chest':
                structure.open = true;
                this.sound.chest();
                this.openMenu('chest', structure);
                break;
            case 'wood_door':
                if (
                    structure.open &&
                    !this.structures.canClose(
                        structure,
                        this.character.position,
                    )
                ) {
                    this.note(t.no_room);

                    return;
                }

                this.structures.toggleDoor(structure);
                this.sound.door();
                this.dirty = true;
                break;
            case 'workbench':
                this.openMenu('craft');
                break;
            case 'sleeping_bag':
                this.structures.setSpawn(structure);
                this.sound.click();
                this.hud.toast(t.spawn_set, 'sleeping_bag');
                this.dirty = true;
                break;
        }
    }

    /** Right mouse / R: eat or drink what is held, study it, or build it. */
    private useHeld(): void {
        const held = this.inventory.held;

        if (!held || this.activity || !this.character.free) {
            return;
        }

        const definition = ITEMS[held.item];

        if (definition.heals || definition.mana) {
            this.consume(this.inventory.selected);

            return;
        }

        if (definition.knowledge) {
            this.study(this.inventory.selected);

            return;
        }

        if (!definition.placeable) {
            return;
        }

        const position = this.character.position;

        if (held.item === 'campfire') {
            const [x, z] = placementSpot(position, this.view.facing);

            if (!this.resources.placeFire(x, z)) {
                this.note(t.no_place);

                return;
            }
        } else {
            const type = held.item as StructureType;
            const spot = this.structures.spot(type, position, this.view.facing);

            if (!this.structures.fits(type, spot, position)) {
                this.note(this.structures.full ? t.too_many : t.no_place);

                return;
            }

            const built = this.structures.place(type, spot.x, spot.z, spot.yaw);

            if (type === 'sleeping_bag') {
                this.structures.setSpawn(built);
                this.hud.toast(t.spawn_set, 'sleeping_bag');
            }
        }

        this.inventory.take(this.inventory.selected, 1);
        this.sound.place();
        this.dirty = true;
    }

    /** Eats, drinks or puts on what is in a slot. */
    private consume(index: number): void {
        const stack = this.inventory.slots[index];
        const definition = stack ? ITEMS[stack.item] : undefined;

        if (!stack || !definition || this.vitals.dead) {
            return;
        }

        const item = stack.item;

        if (definition.mana) {
            if (this.vitals.mana >= this.vitals.maxMana - 0.5) {
                this.note(t.mana_full);

                return;
            }

            this.vitals.restoreMana(definition.mana);
            this.inventory.take(index, 1);
            this.sound.heal();
            this.hud.toast(`+${definition.mana} ${t.mana}`, item);
            this.menu.render();

            return;
        }

        const heals = definition.heals;

        if (!heals) {
            return;
        }

        if (this.vitals.health >= this.vitals.maxHealth - 0.5) {
            this.note(t.health_full);

            return;
        }

        this.vitals.heal(heals);
        this.inventory.take(index, 1);

        if (item === 'bandage' || item === 'healing_potion') {
            this.sound.heal();
        } else {
            this.sound.eat();
        }

        this.hud.toast(`+${heals} ${t.health}`, item);
        this.menu.render();
    }

    /** Studies notes or a relic shard from a slot: knowledge, more with spirit. */
    private study(index: number): void {
        const stack = this.inventory.slots[index];
        const knowledge = stack ? ITEMS[stack.item].knowledge : undefined;

        if (!stack || !knowledge) {
            return;
        }

        const gained = Math.round(
            knowledge * (this.hero?.derived.knowledge ?? 1),
        );
        this.research.add(gained);
        this.inventory.take(index, 1);
        this.sound.pickup();
        this.hud.toast(`+${gained} ${t.knowledge}`, stack.item);
        this.dirty = true;
        this.menu.render();
    }

    /** Learns a recipe for knowledge points. */
    private learn(recipe: Recipe): void {
        if (!this.research.study(recipe.result)) {
            this.note(t.not_enough_knowledge);

            return;
        }

        this.learnt(recipe.result);
    }

    /** A recipe just learnt (by study or by taking a thing apart). */
    private learnt(item: ItemId): void {
        this.stats.researched++;
        this.sound.artifact();
        this.hud.toast(`${t.learnt}: ${t.items[item][0]}`, item);
        this.gainXp('research');
        this.dirty = true;
        this.menu.render();
    }

    /** Whether an item can be taken apart: something made at a bench or by hand. */
    private salvageable(item: ItemId): boolean {
        const recipe = recipeFor(item);

        return Boolean(recipe && SALVAGEABLE.includes(recipe.group));
    }

    /**
     * Takes one of a slot's things apart: about half of what it was made
     * of comes back (less the more worn it is), and its recipe is learnt
     * when it was not known — else, for a thing that needs learning, a
     * little knowledge.
     */
    private salvage(index: number): void {
        const stack = this.inventory.slots[index];
        const recipe = stack ? recipeFor(stack.item) : undefined;

        if (!stack || !recipe || !this.salvageable(stack.item)) {
            return;
        }

        const share = (SALVAGE * condition(stack)) / recipe.count;
        this.inventory.take(index, 1);
        this.sound.hit('wood');
        this.hud.toast(
            `${t.disassembled}: ${t.items[stack.item][0]}`,
            stack.item,
        );

        for (const [item, count] of recipe.needs) {
            const back = Math.floor(count * share);

            if (back > 0) {
                const added = this.inventory.add(item, back);

                if (added < back) {
                    this.dropNear(item, back - added);
                }
            }
        }

        if (this.research.learn(stack.item)) {
            this.learnt(stack.item);
        } else if (recipe.research) {
            // Only things worth learning teach anything when known already.
            const gained = Math.round(
                SALVAGE_KNOWLEDGE * (this.hero?.derived.knowledge ?? 1),
            );
            this.research.add(gained);
            this.hud.toast(`+${gained} ${t.knowledge}`);
        }

        this.dirty = true;
        this.menu.render();
    }

    /** Puts things on the ground in front of the player. */
    private dropNear(item: ItemId, count: number): void {
        const { position, facing } = this.character;
        this.resources.drop(
            item,
            count,
            new THREE.Vector3(
                position.x + Math.sin(facing) * 0.9,
                position.y,
                position.z + Math.cos(facing) * 0.9,
            ),
        );
    }

    /** G: the class skill, if there is mana and it is not cooling down. */
    private useSkill(): void {
        const hero = this.hero;
        const character = this.character;

        if (
            !hero ||
            this.skillCooldown > 0 ||
            this.activity ||
            !character.free
        ) {
            return;
        }

        const skill = hero.skill;

        if (!this.vitals.spendMana(skill.cost)) {
            this.note(t.no_mana);

            return;
        }

        const position = character.position;
        const facing = this.view.facing;

        switch (skill.name) {
            case 'guard':
                this.guardTime = skill.seconds ?? 8;
                this.vitals.damageTaken = skill.damage_taken ?? 0.5;
                this.sound.equip(true);
                break;
            case 'whirlwind': {
                const blow = this.blow();
                this.chips.burst(
                    position.clone().setY(position.y + 1),
                    0xd8dde2,
                    18,
                    0.05,
                );

                for (const mob of this.mobs.around(
                    position,
                    skill.radius ?? 3,
                )) {
                    this.hitMob(
                        mob,
                        blow.damage * (skill.damage ?? 1.5),
                        blow.crit,
                    );
                }

                this.activity = {
                    kind: 'hit',
                    time: 0,
                    duration: SWORD_SECONDS,
                    done: true,
                    target: null,
                };
                this.sound.strike();
                break;
            }
            case 'dash':
                character.facing = facing;

                if (
                    !character.dash(
                        Math.sin(facing),
                        Math.cos(facing),
                        skill.speed ?? 16,
                        0.32,
                    )
                ) {
                    this.vitals.restoreMana(skill.cost);

                    return;
                }

                this.poisedTime = skill.seconds ?? 4;
                this.sound.jump();
                break;
            case 'bolt': {
                const staff = this.inventory.held?.item === 'staff';
                const power = staff ? (ITEMS.staff.weapon?.spell ?? 1) : 1;
                character.facing = facing;
                this.bolts.fire(
                    this.mannequin.handTip(this.tip).clone(),
                    facing,
                    this.mobs.aimed(position, facing, skill.range ?? 20),
                    hero.derived.spell * power,
                );
                this.activity = {
                    kind: 'hit',
                    time: 0,
                    duration: HIT_SECONDS,
                    done: true,
                    target: null,
                };

                if (staff && this.inventory.wearHeld()) {
                    this.sound.broke();
                    this.hud.toast(
                        `${t.items.staff[0]} ${t.broke}`,
                        undefined,
                        'bad',
                    );
                }

                this.sound.place();
                break;
            }
        }

        this.skillCooldown = skill.cooldown;
        this.hud.toast(t.skills[skill.name][0]);
    }

    /**
     * How hard the next blow lands: the weapon, times the hero's strength,
     * and whether it is a critical one (agility, a dagger, or a dash just
     * before).
     */
    private blow(): { damage: number; crit: boolean } {
        const held = this.inventory.held?.item ?? null;
        const hero = this.hero;
        const weapon = held ? ITEMS[held].weapon : undefined;
        let damage = strikeDamage(held) * (hero?.derived.damage ?? 1);

        if (this.poisedTime > 0 && hero?.skill.name === 'dash') {
            this.poisedTime = 0;

            return { damage: damage * (hero.skill.damage ?? 2), crit: true };
        }

        const chance = (hero?.derived.crit ?? 0) + (weapon?.crit ?? 0);
        const crit = Math.random() < chance;

        if (crit) {
            damage *= hero?.derived.critDamage ?? 1.5;
        }

        return { damage, crit };
    }

    /** Damage done to a creature by a blow, a whirlwind or a bolt. */
    private hitMob(mob: Mob, damage: number, crit: boolean): void {
        const killed = this.mobs.damage(
            mob,
            Math.round(damage * 10) / 10,
            this.character.position,
        );
        this.sound.strike();

        if (crit) {
            this.note(t.crit);
            this.chips.burst(
                mob.position.clone().setY(mob.position.y + 1),
                0xffd36b,
                10,
                0.05,
            );
        }

        // The blood ruby: a share of every blow comes back as health.
        if (this.hero?.has('vampirism')) {
            this.vitals.heal(damage * RULES.passives.vampirism);
        }

        if (killed) {
            this.stats[mob.type]++;
            this.gainXp(mob.type);
            this.dirty = true;
        }
    }

    private equip(index: number): void {
        const item = this.inventory.slots[index]?.item;

        if (item && this.inventory.equip(index)) {
            this.sound.equip(item.startsWith('iron_'));
        }
    }

    private unequip(slot: ArmorSlot, index: number | null): void {
        const item = this.inventory.worn[slot]?.item;

        if (!item) {
            return;
        }

        if (this.inventory.unequip(slot, index)) {
            this.sound.equip(item.startsWith('iron_'));
        } else {
            this.note(t.full);
        }
    }

    /** Which crafting places are within reach. */
    private stations(): Record<Station, boolean> {
        const position = this.character.position;

        return {
            fire: this.resources.fireNear(position, CRAFT_REACH) > 0,
            workbench: this.structures.near(position, 'workbench', CRAFT_REACH),
        };
    }

    private craft(recipe: Recipe): void {
        const inventory = this.inventory;

        if (!this.research.knows(recipe.result)) {
            this.note(t.locked);

            return;
        }

        if (
            (recipe.near && !this.stations()[recipe.near]) ||
            recipe.needs.some(
                ([item, count]) => inventory.total(item) < count,
            ) ||
            inventory.room(recipe.result, recipe.count) === 0
        ) {
            return;
        }

        for (const [item, count] of recipe.needs) {
            inventory.spend(item, count);
        }

        inventory.add(recipe.result, recipe.count);
        this.stats.crafted += recipe.count;
        this.gainXp('craft');
        this.sound.craft();
        this.hud.toast(
            `${t.crafted}: ${t.items[recipe.result][0]}`,
            recipe.result,
        );
    }

    private heldTool(): Tool | null {
        const held = this.inventory.held;

        return held ? (ITEMS[held.item].tool ?? null) : null;
    }

    /** Where a target stands, on the ground. */
    private whereIs(target: Strike): [number, number] {
        switch (target.kind) {
            case 'tree':
            case 'structure':
                return [target.x, target.z];
            case 'rock':
                return [target.center.x, target.center.z];
            case 'mob':
                return [target.position.x, target.position.z];
            case 'dig':
                return [target.x, target.z];
        }
    }

    private startHit(): void {
        const target = this.targets.hit;
        const tool = this.heldTool();

        if (target) {
            if (target.kind === 'tree' || target.kind === 'rock') {
                const item =
                    target.kind === 'rock'
                        ? target.ore
                            ? 'iron_ore'
                            : 'stone'
                        : target.species === 'cactus'
                          ? 'fiber'
                          : 'wood';

                if (this.inventory.room(item, 1) === 0) {
                    this.note(t.full);

                    return;
                }
            }

            const [x, z] = this.whereIs(target);
            this.character.facing = Math.atan2(
                x - this.character.position.x,
                z - this.character.position.z,
            );
        }

        const held = this.inventory.held;
        const tired = !this.vitals.tire(RULES.stamina_costs.blow);
        const pace =
            (this.hero?.derived.attackSpeed ?? 1) *
            ((held && ITEMS[held.item].weapon?.speed) || 1);

        this.activity = {
            kind: 'hit',
            time: 0,
            duration:
                ((tool?.kind === 'sword' ? SWORD_SECONDS : HIT_SECONDS) /
                    pace) *
                (tired ? TIRED_SWING : 1),
            done: false,
            target,
        };
    }

    /** Shows a note, at most once every 1.5 s per text. */
    private note(text: string): void {
        const now = performance.now();

        if (now - (this.lastNote.get(text) ?? 0) > 1500) {
            this.lastNote.set(text, now);
            this.hud.toast(text);
        }
    }

    private updateActivity(dt: number): void {
        const activity = this.activity;

        if (!activity) {
            return;
        }

        activity.time += dt;
        const progress = activity.time / activity.duration;

        if (
            !activity.done &&
            activity.kind === 'hit' &&
            progress >= HIT_LANDS
        ) {
            activity.done = true;
            this.landBlow(activity.target as Strike | null);
        }

        if (
            !activity.done &&
            activity.kind === 'pickup' &&
            progress >= PICKUP_TAKES
        ) {
            activity.done = true;
            this.pickUp(activity.target as UseTarget);
        }

        if (progress >= 1) {
            this.activity = null;
        }
    }

    private pickUp(target: UseTarget): void {
        if (
            target.kind === 'seat' ||
            ((target.kind === 'find' || target.kind === 'artifact') &&
                target.taken)
        ) {
            return;
        }

        const found = this.resources.take(target, Date.now());

        if (ITEMS[found.item].artifact) {
            this.sound.artifact();
            this.hud.toast(
                `${t.artifact_found}: ${t.items[found.item][0]}`,
                found.item,
            );
            this.inventory.add(found.item, found.count);
            this.stats.artifacts++;
            this.gainXp('artifact');
        } else {
            this.sound.pickup();
            this.collect([found]);
        }

        this.dirty = true;
    }

    private landBlow(target: Strike | null): void {
        const position = this.character.position;
        const tool = this.heldTool();

        if (!target) {
            this.sound.hit('air');

            return;
        }

        if (target.kind === 'mob') {
            if (!this.mobs.inReach(target, position)) {
                this.sound.hit('air');

                return;
            }

            const blow = this.blow();
            this.hitMob(target, blow.damage, blow.crit);
            this.wearTool(tool);

            return;
        }

        if (target.kind === 'dig') {
            this.digAt(target, tool);

            return;
        }

        if (target.kind === 'structure') {
            const needs = this.structures.breaksWith(target.type);

            if (tool?.kind !== needs) {
                this.sound.hit('air');
                this.note(t.needs[needs]);

                return;
            }

            const stone = target.type === 'stone_wall';
            this.sound.hit(stone ? 'stone' : 'wood');
            this.chips.burst(
                new THREE.Vector3(target.x, target.ground + 1, target.z),
                stone ? 0xa7a6a2 : 0xb48a60,
                8,
            );
            const back = this.structures.hit(target, tool.power);
            this.wearTool(tool);

            if (back) {
                this.sound.treeCrash();
                this.returnStacks(back, target);
                this.dirty = true;
            }

            return;
        }

        if (target.kind === 'tree' ? target.felled : target.gone) {
            this.sound.hit('air');

            return;
        }

        const result = this.resources.hit(
            target,
            position,
            Date.now(),
            tool,
            this.gatherBonus,
        );
        this.sound.hit(result.material);

        if (result.needs) {
            this.note(t.needs[result.needs]);

            return;
        }

        if (target.kind === 'tree' && target.felled) {
            this.stats.trees++;
            this.gainXp('tree');
        } else if (target.kind === 'rock' && target.gone) {
            this.stats.rocks++;
            this.gainXp('rock');
        }

        this.collect(result.yields);
        this.wearTool(tool);
        this.dirty = true;
    }

    /** A stroke at an excavation; the last one gives what was buried. */
    private digAt(dig: Dig, tool: Tool | null): void {
        const result = this.digs.hit(dig, tool, Date.now());
        this.sound.hit(result.needs ? 'air' : 'stone');

        if (result.needs) {
            this.note(t.needs.shovel);

            return;
        }

        this.collect(result.yields);
        this.wearTool(tool);
        this.dirty = true;

        if (!result.done) {
            return;
        }

        this.stats.digs++;
        this.gainXp('dig');
        const relic = this.digs.relic();

        if (relic) {
            this.sound.artifact();
            this.hud.toast(`+1 ${t.items[relic.item][0]}`, relic.item);

            if (this.inventory.put(relic) === 0) {
                this.dropNear(relic.item, 1);
            }
        }
    }

    /** One use of the held tool; says so when it breaks. */
    private wearTool(tool: Tool | null): void {
        if (!tool) {
            return;
        }

        const name = t.items[this.inventory.held!.item][0];

        if (this.inventory.wearHeld()) {
            this.sound.broke();
            this.hud.toast(`${name} ${t.broke}`, undefined, 'bad');
        }
    }

    /** A building taken apart: it (and what a chest held) back to the bag, the rest on the ground. */
    private returnStacks(
        stacks: { item: ItemId; count: number; wear?: number }[],
        at: Structure,
    ): void {
        for (const stack of stacks) {
            const moved = this.inventory.put(stack);

            if (moved > 0) {
                this.hud.toast(
                    `+${moved} ${t.items[stack.item][0]}`,
                    stack.item,
                );
            }

            if (moved < stack.count) {
                this.resources.drop(
                    stack.item,
                    stack.count - moved,
                    new THREE.Vector3(at.x, at.ground, at.z),
                );
            }
        }
    }

    private collect(found: Yield[]): void {
        for (const { item, count } of found) {
            const added = this.inventory.add(item, count);

            if (added > 0) {
                this.hud.toast(`+${added} ${t.items[item][0]}`, item);
            }

            if (added < count) {
                this.note(t.full);
            }
        }
    }

    private dropFromSlot(index: number, count: number): void {
        const stack = this.inventory.take(index, count);

        if (!stack) {
            return;
        }

        const { position, facing } = this.character;
        this.resources.drop(
            stack.item,
            stack.count,
            new THREE.Vector3(
                position.x + Math.sin(facing) * 0.9,
                position.y,
                position.z + Math.cos(facing) * 0.9,
            ),
        );
    }

    /** A creature's blow lands on the player. */
    private struck(mob: Mob, damage: number): void {
        if (this.mode === 'paused' || this.mode === 'dead') {
            return;
        }

        if (!this.hurt(damage, this.armor)) {
            return;
        }

        for (const item of this.inventory.wearArmor()) {
            this.hud.toast(`${t.items[item][0]} ${t.broke}`, item, 'bad');
        }

        // Knocked back a little.
        const character = this.character;
        const away = Math.atan2(
            character.position.x - mob.position.x,
            character.position.z - mob.position.z,
        );
        character.velocity.x += Math.sin(away) * 3;
        character.velocity.z += Math.cos(away) * 3;

        if (character.sitting) {
            character.standUp();
        }

        if (this.vitals.dead) {
            this.die(mob.type);
        }
    }

    /** Takes health; answers whether it hurt at all. */
    private hurt(amount: number, armor: number): boolean {
        if (this.vitals.hurt(amount, armor) <= 0) {
            return false;
        }

        this.hud.hurt();
        this.sound.hurt();
        this.view.shake(0.6);
        this.dirty = true;

        if (this.vitals.health < this.vitals.maxHealth * 0.3) {
            this.note(t.low_health);
        }

        return true;
    }

    private die(cause: DeathCause): void {
        // The phoenix feather: a lethal blow leaves some health instead,
        // now and then.
        if (this.hero?.has('second_wind') && this.secondWindCooldown <= 0) {
            const { health, cooldown } = RULES.passives.second_wind;
            this.vitals.health = this.vitals.maxHealth * health;
            this.secondWindCooldown = cooldown;
            this.sound.heal();
            this.hud.toast(t.second_wind, 'phoenix_feather');

            return;
        }

        this.mode = 'dead';
        this.activity = null;
        this.stats.deaths++;
        this.closeChest();
        this.menu.hide();
        this.touch?.show(false);
        this.input.unlock();
        this.sound.death();
        this.hud.showDeath(
            t.death_causes[cause],
            this.structures.spawnPoint() ? t.wake_bag : t.wake_camp,
        );
        this.dirty = true;
        void this.save();
    }

    /** Wakes up again at the sleeping bag, or at the camp. */
    private respawn(): void {
        const bag = this.structures.spawnPoint();
        const character = this.character;

        if (character.sitting) {
            character.standUp();
        }

        if (bag) {
            character.placeAt(bag.x + 1, bag.y + 0.5, bag.z);
        } else {
            character.placeAt(0, heightAt(0, 0), 0);
            character.facing = Math.PI;
        }

        this.vitals.revive();
        this.mobs.clear();
        this.drowning = 0;
        this.mode = 'paused';
        this.hud.showDeath(null);
        this.view.update(0, character.position, 1.55, false, true);
        // Far from where the player fell: build the land around them at once.
        this.terrain.update(character.position, Infinity);
        this.dirty = true;
        this.resume();
    }

    private changeSettings(change: Partial<Settings>): void {
        Object.assign(this.settings, change);
        saveSettings(this.settings);

        if (change.quality) {
            this.graphics.apply(change.quality);
            this.terrain.detail = this.graphics.groundDetail;
            this.setLamps(this.graphics.lamps);
            this.menu.qualityChanged(change.quality);
        }

        if (change.sensitivity !== undefined) {
            this.view.sensitivity = change.sensitivity;
        }

        if (change.volume !== undefined) {
            this.sound.setVolume(change.volume);
        }
    }

    private toggleMute(): void {
        this.hud.toast(this.sound.toggleMuted() ? t.sound_off : t.sound_on);
    }

    /** What the feet are on, for the sound of steps. */
    private surface(): Surface {
        const character = this.character;
        const { x, y, z } = character.position;

        if (character.waterDepth > 0.05) {
            return 'water';
        }

        if (!character.onTerrain) {
            return 'stone';
        }

        if (y > 42 || this.biome === 'snow') {
            return 'snow';
        }

        if (this.biome === 'desert' || heightAt(x, z) < WATER_LEVEL + 1) {
            return 'sand';
        }

        return this.biome === 'mountains' ? 'stone' : 'grass';
    }

    private frame = (): void => {
        const dt = Math.min(this.clock.getDelta(), 0.1);
        const now = Date.now();
        const character = this.character;
        const alive = !this.vitals.dead;
        const look = this.input.takeLook();
        this.view.look(look.x, look.y, look.wheel);

        const axes = this.view.groundAxes();
        const forward = this.input.forward;
        const strafe = this.input.strafe;
        let moveX = axes.forwardX * forward + axes.rightX * strafe;
        let moveZ = axes.forwardZ * forward + axes.rightZ * strafe;
        const length = Math.hypot(moveX, moveZ);

        if (length > 1) {
            moveX /= length;
            moveZ /= length;
        }

        // Walking off gets up from a seat.
        if (character.sitting && length > 0) {
            character.standUp();
        }

        if (
            this.mode === 'play' &&
            this.input.attack &&
            !this.activity &&
            character.free &&
            character.grounded &&
            character.stance !== 'crawl'
        ) {
            this.startHit();
        }

        const speedScale =
            (this.activity?.kind === 'pickup'
                ? 0
                : this.activity?.kind === 'hit'
                  ? 0.35
                  : 1) * (this.hero?.derived.speed ?? 1);
        const wasGrounded = character.grounded;
        character.update(dt, {
            moveX,
            moveZ,
            // Out of stamina: walking only.
            sprint: this.input.sprint && this.vitals.stamina > 0,
            jump: this.jumpQueued,
            speedScale,
            rise: this.input.rise,
            dive: this.input.dive,
        });

        if (alive) {
            this.mobs.pushOut(character.position, RADIUS);
        }

        if (
            this.jumpQueued &&
            (wasGrounded || character.extraJumps > 0) &&
            character.velocity.y > 4
        ) {
            this.sound.jump();
            this.vitals.tire(RULES.stamina_costs.jump);
        }

        this.jumpQueued = false;
        this.updateWater(dt);
        this.updateActivity(dt);

        this.targets =
            this.mode === 'play' && character.free && !this.activity
                ? this.findTargets()
                : { hit: null, use: null };

        this.survey(dt);
        this.animate(dt);
        this.resources.update(dt);
        this.digs.update(dt);
        this.structures.update(dt);
        this.bolts.update(dt);
        this.chips.update(dt);
        this.updateSkills(dt);

        const skyState = this.sky.update(now, character.position);
        this.night = skyState.night;
        this.water.update(dt, skyState.color);
        this.clouds.update(dt, character.position, skyState.color, this.night);

        const running =
            this.input.sprint &&
            character.stance === 'stand' &&
            character.horizontalSpeed > STANCE_SPEED.stand[0] + 0.5;
        const hunted =
            alive && (this.mode === 'play' || this.mode === 'menu')
                ? character.position
                : null;
        this.mobs.update(dt, hunted, running, this.night, this.view.camera);

        if (running && this.mode === 'play') {
            this.vitals.tire(RULES.stamina_costs.sprint * dt);
        }

        if (alive) {
            this.vitals.update(dt);
        }

        this.updateGhost();
        this.view.update(dt, character.position, this.eyeHeight(), running);
        this.applyView();
        this.terrain.update(character.position);
        this.resources.refresh(character.position, this.view.camera);
        this.structures.cull(character.position, this.viewDistance);
        this.updateLights(now);
        this.updateUnderwater(skyState.color);
        this.graphics.update(dt);

        this.renderer.render(this.scene, this.view.camera);

        this.hud.setPrompt(this.promptLines());
        this.hud.setAim(
            this.mode === 'play' && alive && !character.sitting,
            this.targets.hit?.kind === 'mob'
                ? 'enemy'
                : this.targets.hit || this.targets.use
                  ? 'thing'
                  : null,
        );
        this.touch?.setContext(this.touchContext());
        this.hud.setStance(
            character.swimming
                ? t.stances.swim
                : character.sitting
                  ? t.stances.sit
                  : character.stance === 'stand'
                    ? null
                    : t.stances[character.stance],
        );
        this.hud.setBreath(character.breath);
        this.hud.setVitals(this.vitals, this.armor);
        this.hud.setSkill(
            this.hero,
            this.skillCooldown,
            this.vitals.mana,
            this.guardTime > 0 || this.poisedTime > 0,
        );
        this.hud.setClock(skyState.time, t.biomes[this.biome]);
        this.hud.setFps(
            this.settings.showFps
                ? `${Math.round(this.graphics.fps)} FPS`
                : null,
        );

        this.sinceRegrow += dt;

        if (this.sinceRegrow >= REGROW_SECONDS) {
            this.sinceRegrow = 0;

            if (this.resources.regrow(now)) {
                this.dirty = true;
            }

            if (this.digs.regrow(now)) {
                this.dirty = true;
            }
        }

        this.sinceSave += dt;

        if (this.sinceSave >= AUTOSAVE_SECONDS) {
            this.sinceSave = 0;
            void this.save();
        }

        this.updateDebug();
    };

    /**
     * What the player could hit and use right now: a creature first, then
     * the nearest of a tree, rock or excavation and — with the tool that
     * takes it apart in hand — a building; a building to open or use, or
     * whatever lies about.
     */
    private findTargets(): { hit: Strike | null; use: Use | null } {
        const position = this.character.position;
        const facing = this.character.facing;
        const found = this.resources.targets(position, facing);
        const mob = this.mobs.target(position, facing);
        const dig = this.digs.target(position, facing);
        const structure = this.structures.target(position, facing);
        const structureDistance = structure
            ? this.structures.distance(structure, position)
            : Infinity;

        let hit: Strike | null = mob ?? found.hit;

        if (
            !mob &&
            dig &&
            (!found.hit ||
                this.digs.distance(dig, position) < this.hitDistance(found.hit))
        ) {
            hit = dig;
        }

        if (
            !mob &&
            structure &&
            this.heldTool()?.kind ===
                this.structures.breaksWith(structure.type) &&
            (!hit || structureDistance < this.hitDistance(hit))
        ) {
            hit = structure;
        }

        let use: Use | null = found.use;

        if (
            structure &&
            this.structures.usable(structure.type) &&
            (!use ||
                use.kind === 'seat' ||
                structureDistance < this.useDistance(use))
        ) {
            use = structure;
        }

        return { hit, use };
    }

    private hitDistance(target: HitTarget | Dig | Mob | Structure): number {
        const { x, z } = this.character.position;

        switch (target.kind) {
            case 'tree':
                return Math.hypot(target.x - x, target.z - z) - target.radius;
            case 'rock':
                return (
                    Math.hypot(target.center.x - x, target.center.z - z) -
                    target.collider.radius
                );
            case 'dig':
                return this.digs.distance(target, this.character.position);
            case 'structure':
                return this.structures.distance(
                    target,
                    this.character.position,
                );
            case 'mob':
                return Math.hypot(target.position.x - x, target.position.z - z);
        }
    }

    /** Timers of the class skill: cooldown, the guard, a dash's poise. */
    private updateSkills(dt: number): void {
        this.skillCooldown = Math.max(0, this.skillCooldown - dt);
        this.secondWindCooldown = Math.max(0, this.secondWindCooldown - dt);
        this.poisedTime = Math.max(0, this.poisedTime - dt);

        if (this.guardTime > 0) {
            this.guardTime -= dt;

            if (this.guardTime <= 0) {
                this.guardTime = 0;
                this.vitals.damageTaken = 1;
            }
        }
    }

    private useDistance(target: UseTarget): number {
        const { x, z } = this.character.position;

        switch (target.kind) {
            case 'drop':
                return Math.hypot(
                    target.mesh.position.x - x,
                    target.mesh.position.z - z,
                );
            case 'seat':
                return (
                    Math.hypot(target.seat.x - x, target.seat.z - z) -
                    target.seat.clearance
                );
            default:
                return Math.hypot(target.x - x, target.z - z);
        }
    }

    /** The see-through preview of what the held item would build. */
    private updateGhost(): void {
        const held = this.inventory.held;
        const character = this.character;

        if (
            this.mode !== 'play' ||
            !held ||
            !ITEMS[held.item].placeable ||
            !character.free ||
            this.activity
        ) {
            this.structures.showGhost(null, null, false);

            return;
        }

        const facing = this.view.facing;

        if (held.item === 'campfire') {
            const [x, z] = placementSpot(character.position, facing);
            this.structures.showGhost(
                'campfire',
                { x, z, yaw: 0 },
                this.resources.fireFits(x, z),
            );

            return;
        }

        const type = held.item as StructureType;
        const spot = this.structures.spot(type, character.position, facing);
        this.structures.showGhost(
            type,
            spot,
            this.structures.fits(type, spot, character.position),
        );
    }

    /** Splashes going in, a warning running out of air, drowning. */
    private updateWater(dt: number): void {
        const character = this.character;

        if (character.swimming && !this.wasSwimming) {
            const size = Math.min(1, character.landingSpeed / 10 + 0.3);
            this.sound.splash(size);
            this.chips.burst(
                new THREE.Vector3(
                    character.position.x,
                    WATER_LEVEL,
                    character.position.z,
                ),
                0xa9c4d0,
                Math.round(8 + size * 14),
                0.06,
            );
        }

        this.wasSwimming = character.swimming;

        if (character.breath < 0.3 && character.underwater) {
            this.note(t.out_of_breath);
        }

        if (
            character.underwater &&
            character.breath <= 0 &&
            (this.mode === 'play' || this.mode === 'menu')
        ) {
            this.drowning += dt;

            if (this.drowning >= 1) {
                this.drowning = 0;

                if (this.hurt(DROWN_DAMAGE, 0) && this.vitals.dead) {
                    this.die('drown');
                }
            }
        } else {
            this.drowning = 0;
        }
    }

    /**
     * Twice a second: which biome the player is in and how much water is
     * around (for the clock line and the ambience).
     */
    private survey(dt: number): void {
        const { x, y, z } = this.character.position;
        this.sinceSurvey += dt;

        if (this.sinceSurvey >= 0.5) {
            this.sinceSurvey = 0;
            this.biome = dominantBiome(biomeWeights(x, z));
            let wet = 0;

            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;

                if (
                    heightAt(
                        x + Math.cos(angle) * 12,
                        z + Math.sin(angle) * 12,
                    ) < WATER_LEVEL
                ) {
                    wet++;
                }
            }

            this.nearWater = Math.max(
                wet / 8,
                this.character.waterDepth > 0 ? 1 : 0,
            );
        }

        const weights = biomeWeights(x, z);
        this.sound.updateAmbience({
            night: this.night,
            forest: weights.forest,
            open: weights.meadow + weights.desert * 0.3,
            windy: Math.min(
                1,
                weights.mountains +
                    weights.snow * 0.6 +
                    Math.max(0, (y - 20) / 30),
            ),
            nearWater: this.nearWater,
            fire: this.resources.fireNear(this.character.position),
            underwater: this.view.camera.position.y < WATER_LEVEL,
        });
    }

    /**
     * Fires, a held torch and the sun stone light the night: the nearest
     * few get the scene's point lights.
     */
    private updateLights(now: number): void {
        const position = this.character.position;
        const night = this.night;
        const sources: LightSource[] = this.resources.fires.map((fire) => ({
            position: new THREE.Vector3(fire.x, fire.ground + 0.7, fire.z),
            color: 0xffa652,
            strength: 1,
        }));

        if (this.inventory.held?.item === 'torch') {
            sources.push({
                position: this.mannequin.handTip(this.tip).clone(),
                color: 0xffb766,
                strength: 0.8,
            });
        }

        if (
            (this.inventory.has('sun_stone') ||
                (this.hero?.bonus('light') ?? 0) > 0) &&
            night > 0.2
        ) {
            sources.push({
                position: position.clone().setY(position.y + 1.4),
                color: 0xffd99a,
                strength: 0.6,
            });
        }

        sources.sort(
            (a, b) =>
                a.position.distanceToSquared(position) -
                b.position.distanceToSquared(position),
        );

        this.lights.forEach((light, index) => {
            const source = sources[index];

            if (!source || source.position.distanceTo(position) > 60) {
                light.intensity = 0;

                return;
            }

            const flicker =
                0.9 +
                Math.sin(now / 70 + index * 7) * 0.06 +
                Math.sin(now / 23 + index) * 0.04;
            light.position.copy(source.position);
            light.color.setHex(source.color);
            light.intensity = (0.8 + 5 * night) * source.strength * flicker;
        });
    }

    /** Under water the view turns blue and short. */
    /**
     * Hands the graphics' view distance (which "auto" changes with the
     * frame rate) to the land, the things on it and the fog.
     */
    private applyView(): void {
        const distance = this.graphics.viewDistance;

        if (distance === this.viewDistance) {
            return;
        }

        this.viewDistance = distance;
        this.terrain.viewDistance = distance;
        this.resources.setViewDistance(distance);
    }

    /**
     * As many point lights as the quality allows. Each one costs every
     * pixel, so a weak card gets fewer; the nearest fires get them.
     */
    private setLamps(count: number): void {
        while (this.lights.length > count) {
            this.scene.remove(this.lights.pop()!);
        }

        while (this.lights.length < count) {
            const light = new THREE.PointLight(0xffa652, 0, 16, 1.1);
            this.lights.push(light);
            this.scene.add(light);
        }
    }

    private updateUnderwater(sky: THREE.Color): void {
        const fog = this.scene.fog as THREE.Fog;
        const under = this.view.camera.position.y < WATER_LEVEL + 0.02;

        if (under) {
            fog.color.copy(UNDERWATER).lerp(sky, 0.15);
            this.scene.background = fog.color;
            fog.near = 0.5;
            fog.far = 26;
        } else {
            // The land ends where the fog is thickest, so its edge never shows.
            fog.near = this.viewDistance * 0.3;
            fog.far = this.viewDistance;
        }

        this.sky.dome.visible = !under;
        this.options.root.classList.toggle('sb-underwater', under);
    }

    private animate(dt: number): void {
        const character = this.character;
        const [walkSpeed, runSpeed] = STANCE_SPEED[character.stance];

        this.stepLift += character.steppedUp;
        this.stepLift *= Math.exp(-14 * dt);

        const activity: Pose = this.activity
            ? {
                  kind: this.activity.kind,
                  progress: this.activity.time / this.activity.duration,
              }
            : null;

        if (character.landingSpeed > 5 && !character.swimming) {
            this.sound.land(character.landingSpeed);

            if (
                character.landingSpeed > SAFE_LANDING &&
                !this.vitals.dead &&
                this.hurt((character.landingSpeed - SAFE_LANDING) * 6, 0) &&
                this.vitals.dead
            ) {
                this.die('fall');
            }
        }

        this.mannequin.root.position.copy(character.position);
        this.mannequin.root.position.y -= this.stepLift;
        this.mannequin.root.rotation.y = character.facing;
        this.mannequin.update(
            dt,
            {
                speed: character.horizontalSpeed,
                walkSpeed,
                runSpeed,
                stance: character.stance,
                grounded: character.grounded,
                verticalSpeed: character.velocity.y,
                turnRate: character.turnRate,
                acceleration: character.acceleration,
                sitting: character.seat
                    ? 'seat'
                    : character.sittingOnGround
                      ? 'ground'
                      : null,
                swimming: character.swimming,
                seatHeight: character.seat
                    ? character.seat.top - character.seat.ground
                    : 0,
                climb: character.climbProgress,
                activity,
                lookYaw: Math.atan2(
                    Math.sin(this.view.facing - character.facing),
                    Math.cos(this.view.facing - character.facing),
                ),
                lookPitch: this.view.pitch - 0.3,
                ground: character.onTerrain ? heightAt : null,
            },
            character.landingSpeed,
        );
        character.landingSpeed = 0;
    }

    private eyeHeight(): number {
        const character = this.character;

        if (character.seat) {
            return character.seat.top - character.seat.ground + 0.75;
        }

        if (character.sittingOnGround) {
            return 0.75;
        }

        if (character.swimming) {
            return 1.5;
        }

        return { stand: 1.55, crouch: 1.05, crawl: 0.45 }[character.stance];
    }

    private promptLines(): PromptLine[] {
        if (this.mode !== 'play') {
            return [];
        }

        if (this.character.sitting) {
            return [{ key: 'use', text: t.stand_up }];
        }

        // In deep water: how to come up and go down.
        if (this.character.swimming) {
            return [
                { key: 'rise', text: t.swim_up },
                { key: 'dive', text: t.swim_down },
            ];
        }

        const lines: PromptLine[] = [];
        const { hit, use } = this.targets;

        if (hit?.kind === 'mob') {
            lines.push({
                key: 'attack',
                text: `${t.attack} · ${t.mobs[hit.type]} ${Math.ceil(hit.health)}/${hit.maxHealth}`,
            });
        } else if (hit?.kind === 'structure') {
            lines.push({
                key: 'attack',
                text: `${t.dismantle} · ${t.items[hit.type][0]} ${hit.health}/${hit.maxHealth}`,
            });
        } else if (hit?.kind === 'tree') {
            const name = { broad: t.tree, pine: t.pine, cactus: t.cactus }[
                hit.species
            ];
            const verb = hit.species === 'cactus' ? t.cut : t.chop;
            lines.push({
                key: 'attack',
                text: `${verb} · ${name} ${hit.hp}/${hit.maxHp}`,
            });
        } else if (hit?.kind === 'rock') {
            lines.push({
                key: 'attack',
                text: `${t.mine} · ${hit.ore ? t.ore : t.rock} ${hit.hp}/${hit.maxHp}`,
            });
        } else if (hit?.kind === 'dig') {
            lines.push({
                key: 'attack',
                text: `${t.dig} · ${t.dig_site} ${hit.hp}/${hit.maxHp}`,
            });
        }

        if (use?.kind === 'structure') {
            const name = t.items[use.type][0];
            const texts: Partial<Record<StructureType, string>> = {
                chest: `${t.open} · ${name}`,
                wood_door: `${use.open ? t.close : t.open} · ${name}`,
                workbench: `${t.craft_here} · ${name}`,
                sleeping_bag: use.spawn ? `${name} ✓` : t.sleep_here,
            };
            const text = texts[use.type];

            if (text) {
                lines.push({ key: 'use', text });
            }
        } else if (use?.kind === 'find' || use?.kind === 'artifact') {
            const count =
                use.kind === 'find' && use.count > 1 ? ` ×${use.count}` : '';
            lines.push({
                key: 'use',
                text: `${t.pick_up}: ${t.items[use.item][0]}${count}`,
            });
        } else if (use?.kind === 'drop') {
            lines.push({
                key: 'use',
                text: `${t.pick_up}: ${t.bundle} (${t.items[use.item][0]} ×${use.count})`,
            });
        } else if (use?.kind === 'fire') {
            lines.push({ key: 'use', text: t.take_fire });
        } else if (use?.kind === 'seat') {
            lines.push({ key: 'use', text: `${t.sit} · ${t[use.what]}` });
        }

        const held = this.inventory.held;

        if (held && this.character.free) {
            const definition = ITEMS[held.item];
            const name = t.items[held.item][0];

            if (definition.placeable) {
                lines.push({ key: 'place', text: `${t.place}: ${name}` });
            } else if (definition.knowledge) {
                lines.push({ key: 'place', text: `${t.study}: ${name}` });
            } else if (definition.heals || definition.mana) {
                lines.push({
                    key: 'place',
                    text: `${held.item === 'bandage' ? t.bandage_up : held.item.endsWith('_potion') ? t.drink : t.eat}: ${name}`,
                });
            }
        }

        return lines;
    }

    /** What the touch buttons show right now. */
    private touchContext(): TouchContext {
        const { use } = this.targets;
        const held = this.inventory.held;
        let icon: IconName | null = null;

        if (this.character.sitting) {
            icon = 'sit';
        } else if (use?.kind === 'structure') {
            const icons: Partial<Record<StructureType, IconName>> = {
                chest: 'chest',
                wood_door: 'door',
                workbench: 'craft',
                sleeping_bag: 'hand',
            };
            icon = icons[use.type] ?? null;
        } else if (use?.kind === 'seat') {
            icon = 'sit';
        } else if (use) {
            icon = 'hand';
        }

        const definition = held ? ITEMS[held.item] : null;

        return {
            use: icon,
            place: definition?.placeable
                ? 'build'
                : definition?.heals || definition?.mana
                  ? 'eat'
                  : definition?.knowledge
                    ? 'book'
                    : null,
            swimming: this.character.swimming,
        };
    }

    /** Saves the character, inventory and the world's changes — if anything changed. */
    /** Deletes the saved character, after asking, and loads the game afresh. */
    private async startOver(): Promise<void> {
        if (!window.confirm(t.start_over_confirm)) {
            return;
        }

        this.wiping = true;

        try {
            await resetPlayer();
            window.location.reload();
        } catch {
            this.wiping = false;
            this.hud.toast(t.start_over_failed, undefined, 'bad');
        }
    }

    private async save(keepalive = false): Promise<void> {
        if (this.wiping) {
            return;
        }

        const { position, facing } = this.character;
        const moved = Math.hypot(
            position.x - this.lastSaved.x,
            position.z - this.lastSaved.z,
        );

        if (
            !this.dirty &&
            moved < 0.5 &&
            Math.abs(facing - this.lastSaved.yaw) < 0.2
        ) {
            return;
        }

        const yaw = Math.atan2(Math.sin(facing), Math.cos(facing));
        this.lastSaved = { x: position.x, z: position.z, yaw: facing };
        this.dirty = false;
        this.hud.setStatus(t.saving);

        const player: Partial<PlayerState> = {
            x: position.x,
            y: position.y,
            z: position.z,
            yaw,
            health: Math.floor(this.vitals.health * 10) / 10,
            inventory: this.inventory.toJSON(),
            equipment: this.inventory.wornJSON(),
            harvested: [
                ...this.resources.harvestedList(),
                ...this.digs.harvestedList(),
            ],
            placed: [
                ...this.resources.placedList(),
                ...this.structures.placedList(),
            ],
            stats: { ...this.stats },
            research: this.research.toJSON(),
        };

        // Before there is a hero there is no mana either.
        if (this.hero) {
            player.hero = this.hero.toJSON();
            player.mana = Math.floor(this.vitals.mana * 10) / 10;
        }

        try {
            await savePlayer(player, keepalive);
            this.hud.setStatus(t.saved);
        } catch {
            this.lastSaved = { x: NaN, z: NaN, yaw: NaN };
            this.dirty = true;
            this.hud.setStatus(t.save_failed);
        }
    }

    private updateDebug(): void {
        if (!this.hud.debugShown) {
            return;
        }

        const {
            position,
            velocity,
            grounded,
            horizontalSpeed,
            stance,
            breath,
        } = this.character;
        this.hud.setDebug(
            [
                `FPS ${Math.round(this.graphics.fps)} · ${this.graphics.summary}`,
                `GPU ${this.graphics.gpu}`,
                `XYZ ${position.x.toFixed(1)} / ${position.y.toFixed(2)} / ${position.z.toFixed(1)}`,
                `Speed ${horizontalSpeed.toFixed(1)} m/s · Vy ${velocity.y.toFixed(1)}`,
                `Ground ${grounded ? 'yes' : 'no'} · ${stance} · breath ${breath.toFixed(2)}`,
                `Biome ${this.biome} · night ${this.night.toFixed(2)} · slot ${this.inventory.selected + 1}/${HOTBAR}`,
                `Hero ${this.hero ? `${this.hero.heroClass} ${this.hero.gender} L${this.hero.level} ${this.hero.xp}/${this.hero.toNext}xp` : '—'} · knowledge ${this.research.points}`,
                `Mobs ${this.mobs.list.length} · buildings ${this.structures.list.length} · draw calls ${this.renderer.info.render.calls}`,
            ].join('\n'),
        );
    }

    private resize = (): void => {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.view.resize(window.innerWidth / window.innerHeight);
    };
}
