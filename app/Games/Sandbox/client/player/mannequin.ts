/**
 * The player's figure: a rounded, simply dressed character — shirt,
 * trousers, boots, a bit of hair and two dark eyes — 1.8 m tall with the
 * feet at the group's origin, facing +Z. Worn armour is laid over the
 * clothes: a helmet on the head, a jacket or breastplate over the chest
 * and shoulders, boots up the shins.
 *
 * The hero shows (see setLook): strength makes the figure broader and
 * thicker in the arms and legs, agility leaner; a woman has narrower
 * shoulders and waist, fuller hips, a bust and a ponytail; and every
 * class dresses its own way — a tank in red with iron pauldrons, a
 * fighter in blue with leather bracers, an assassin in near-black with a
 * hood, a mage in an indigo robe.
 *
 * It has joints but no animation clips: every frame a target pose is
 * worked out from what the body does (walk, run, crouch, crawl, sit,
 * swim, jump, climb, hit, pick up) and the figure eases into it. While on its
 * feet the legs are placed by inverse kinematics: each foot follows a
 * step path that matches the ground speed (no sliding) and lands on the
 * real ground height under it, so the knees bend on slopes and steps.
 *
 * Once the realistic body (see Human) has loaded, it is what is seen: the
 * shapes here are hidden and only drive its bones; the held item moves
 * into its right hand, and armour is seated on the body.
 */

import * as THREE from 'three';
import type { Attributes, Gender, HeroClass } from '../hero';
import { ARMOR_SLOTS } from '../items';
import type { ArmorSlot, ItemId } from '../items';
import type { Stance } from '../physics/character';
import { createHeld } from './held';
import { Human, loadHuman } from './human';

const cloth = (color: number, roughness = 0.85) =>
    new THREE.MeshStandardMaterial({ color, roughness });

const SKIN = cloth(0xe2b896, 0.6);
const SHOES = cloth(0x3b3029);
const EYES = new THREE.MeshStandardMaterial({
    color: 0x1d2126,
    roughness: 0.3,
});
const LEATHER = cloth(0x8a5f3b, 0.75);
const LEATHER_DARK = cloth(0x5e3f26, 0.8);
const IRON = new THREE.MeshStandardMaterial({
    color: 0xbfc6cc,
    roughness: 0.35,
    metalness: 0.65,
});
const IRON_DARK = new THREE.MeshStandardMaterial({
    color: 0x7f878f,
    roughness: 0.45,
    metalness: 0.6,
});

/** Clothes per class: shirt, trousers, trim. */
const OUTFITS: Record<HeroClass, [number, number, number]> = {
    tank: [0x7d3b34, 0x4a4440, 0x8f979f],
    fighter: [0x5f8296, 0x4a4b55, 0x6f4a2c],
    assassin: [0x3c3a44, 0x2f2d35, 0x6b3550],
    mage: [0x4b4f8f, 0x3d3a5c, 0xd8c27a],
};

/** Who the figure is: the hero's class, gender and attributes. */
export interface Look {
    heroClass: HeroClass;
    gender: Gender;
    attributes: Attributes;
}

const HIPS = 0.98;
/** Hip joint below the hips' origin. */
const HIP_JOINT = 0.02;
const THIGH = 0.44;
const SHIN = 0.45;
/** Ankle above the sole. */
const ANKLE = 0.07;
const LEG_SPREAD = 0.094;

/** A rounded limb hanging down from its joint, `length` long in all. */
function limb(
    radius: number,
    length: number,
    material: THREE.Material,
): THREE.Mesh {
    const geometry = new THREE.CapsuleGeometry(
        radius,
        Math.max(0.001, length - radius * 2),
        6,
        14,
    );
    geometry.translate(0, -length / 2, 0);

    return part(geometry, material);
}

function part(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

/** The top of a sphere, for caps and helmets. */
function dome(open = 0.55): THREE.SphereGeometry {
    return new THREE.SphereGeometry(
        1,
        22,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI * open,
    );
}

function joint(parent: THREE.Object3D, x: number, y: number, z = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);

    return group;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = (t: number) => {
    const x = clamp(t, 0, 1);

    return x * x * (3 - 2 * x);
};

/**
 * Two-bone leg IK in the leg's forward/down plane: hip → ankle target
 * `forward` ahead and `down` below. Answers [thigh, knee, foot] rotations
 * (limbs swing forward on negative X; the foot stays level).
 */
function solveLeg(forward: number, down: number): [number, number, number] {
    const reach = clamp(Math.hypot(forward, down), 0.05, THIGH + SHIN - 0.001);
    const toTarget = Math.atan2(forward, down);
    const atHip = Math.acos(
        clamp(
            (THIGH ** 2 + reach ** 2 - SHIN ** 2) / (2 * THIGH * reach),
            -1,
            1,
        ),
    );
    const knee =
        Math.PI -
        Math.acos(
            clamp(
                (THIGH ** 2 + SHIN ** 2 - reach ** 2) / (2 * THIGH * SHIN),
                -1,
                1,
            ),
        );
    const thigh = toTarget + atHip;

    return [-thigh, knee, thigh - knee];
}

/** Joint angles and placements; see apply() for what each one moves. */
interface Pose {
    /** Body origin (at the hips) relative to standing height. */
    bodyY: number;
    bodyZ: number;
    /** Whole body tipped forward (π/2 lies face down). */
    pitch: number;
    /** Whole body leaning sideways (into a turn). */
    roll: number;
    hipsYaw: number;
    /** Hips tilting sideways (the swing leg's side drops). */
    hipsRoll: number;
    lean: number;
    side: number;
    twist: number;
    headX: number;
    headY: number;
    /** 1 = legs placed by IK from the foot targets, 0 = by the angles. */
    ik: number;
    footZL: number;
    footZR: number;
    liftL: number;
    liftR: number;
    thighL: number;
    thighR: number;
    kneeL: number;
    kneeR: number;
    footL: number;
    footR: number;
    spreadL: number;
    spreadR: number;
    /** Thighs turned outward about their length (knees to the sides). */
    turnOut: number;
    armL: number;
    armR: number;
    armOutL: number;
    armOutR: number;
    elbowL: number;
    elbowR: number;
}

const REST: Pose = {
    bodyY: 0,
    bodyZ: 0,
    pitch: 0,
    roll: 0,
    hipsYaw: 0,
    hipsRoll: 0,
    lean: 0,
    side: 0,
    twist: 0,
    headX: 0,
    headY: 0,
    ik: 1,
    footZL: 0,
    footZR: 0,
    liftL: 0,
    liftR: 0,
    thighL: 0,
    thighR: 0,
    kneeL: 0,
    kneeR: 0,
    footL: 0,
    footR: 0,
    spreadL: 0,
    spreadR: 0,
    turnOut: 0,
    armL: 0,
    armR: 0,
    armOutL: 0.08,
    armOutR: 0.08,
    elbowL: -0.12,
    elbowR: -0.12,
};

export type Activity = { kind: 'hit' | 'pickup'; progress: number } | null;

export interface MotionState {
    /** Ground speed, m/s, and the walk/run speeds of the stance. */
    speed: number;
    walkSpeed: number;
    runSpeed: number;
    stance: Stance;
    grounded: boolean;
    verticalSpeed: number;
    /** rad/s, positive turning toward +X. */
    turnRate: number;
    /** m/s². */
    acceleration: number;
    sitting: 'ground' | 'seat' | null;
    swimming: boolean;
    /** Seat surface above the feet, when on a seat. */
    seatHeight: number;
    /** 0…1 through a climb. */
    climb: number | null;
    activity: Activity;
    /** Where the camera looks, relative to the body (radians). */
    lookYaw: number;
    lookPitch: number;
    /** Ground height at a world point, to plant the feet on; null on objects. */
    ground: ((x: number, z: number) => number) | null;
}

export class Mannequin {
    readonly root = new THREE.Group();

    private shirt = cloth(0x5f8296);
    private trousers = cloth(0x4a4b55);
    private hairPaint = cloth(0x3a2a1e, 0.9);
    private trim = cloth(0x6f4a2c, 0.7);
    private build = { female: false, torso: 1, chestDepth: 1 };
    private pelvis: THREE.Mesh;
    private belt: THREE.Mesh;
    private waist: THREE.Mesh;
    private hair: THREE.Mesh;
    private limbs: { mesh: THREE.Mesh; kind: 'arm' | 'thigh' | 'shin' }[] = [];
    /** Parts that depend on the look (bust, robe, hood…), rebuilt with it. */
    private extras: THREE.Object3D[] = [];
    private body: THREE.Group;
    private hips: THREE.Group;
    private spine: THREE.Group;
    private head: THREE.Group;
    private neck: THREE.Group;
    private chest: THREE.Mesh;
    /** The realistic body, once loaded, and the gender it was asked for. */
    private human: Human | null = null;
    private humanGender: Gender | null = null;
    private grip = new THREE.Vector3();
    private shoulderL: THREE.Group;
    private shoulderR: THREE.Group;
    private elbowL: THREE.Group;
    private elbowR: THREE.Group;
    private hipL: THREE.Group;
    private hipR: THREE.Group;
    private kneeL: THREE.Group;
    private kneeR: THREE.Group;
    private ankleL: THREE.Group;
    private ankleR: THREE.Group;

    /** A foot came down (loudness 0…1) / a swim stroke began. */
    onStep: (loudness: number) => void = () => {};
    onStroke: () => void = () => {};

    private hand: THREE.Group;
    private heldItem: ItemId | null = null;
    private worn: Record<ArmorSlot, ItemId | null> = {
        head: null,
        body: null,
        feet: null,
    };
    private armor: Record<ArmorSlot, THREE.Object3D[]> = {
        head: [],
        body: [],
        feet: [],
    };
    private pose: Pose = { ...REST };
    private stepPhase = 0;
    private crawlPhase = 0;
    private swimPhase = 0;
    private time = 0;
    private squash = 0;
    private groundL = 0;
    private groundR = 0;

    constructor() {
        this.body = joint(this.root, 0, HIPS);
        this.hips = joint(this.body, 0, 0);
        this.head = new THREE.Group();

        this.pelvis = part(new THREE.SphereGeometry(1, 20, 14), this.trousers);
        this.pelvis.scale.set(0.17, 0.12, 0.12);
        this.pelvis.position.y = 0.02;
        this.hips.add(this.pelvis);

        this.belt = part(new THREE.CylinderGeometry(1, 1, 1, 20), SHOES);
        this.belt.scale.set(0.155, 0.03, 0.105);
        this.belt.position.y = 0.075;
        this.hips.add(this.belt);

        this.spine = joint(this.hips, 0, 0.06);

        this.waist = limb(0.12, 0.26, this.shirt);
        this.waist.position.y = 0.24;
        this.waist.scale.set(1.05, 1, 0.82);
        this.spine.add(this.waist);

        this.chest = part(new THREE.SphereGeometry(1, 24, 16), this.shirt);
        this.chest.scale.set(0.2, 0.2, 0.13);
        this.chest.position.y = 0.33;
        this.spine.add(this.chest);

        this.neck = joint(this.spine, 0, 0.5);
        const neckMesh = limb(0.048, 0.11, SKIN);
        neckMesh.position.y = 0.09;
        this.neck.add(neckMesh);

        this.head.position.y = 0.08;
        this.head.rotation.order = 'YXZ';
        this.neck.add(this.head);
        const skull = part(new THREE.SphereGeometry(1, 24, 18), SKIN);
        skull.scale.set(0.105, 0.128, 0.115);
        skull.position.set(0, 0.11, 0.01);
        this.hair = part(dome(0.5), this.hairPaint);
        this.hair.scale.set(0.11, 0.135, 0.12);
        this.hair.position.set(0, 0.125, -0.005);
        this.hair.rotation.x = -0.25;
        this.head.add(skull, this.hair);

        for (const side of [1, -1]) {
            const eye = part(new THREE.SphereGeometry(1, 10, 8), EYES);
            eye.scale.set(0.014, 0.019, 0.01);
            eye.position.set(side * 0.04, 0.125, 0.117);
            const ear = part(new THREE.SphereGeometry(1, 10, 8), SKIN);
            ear.scale.set(0.014, 0.028, 0.02);
            ear.position.set(side * 0.104, 0.11, 0.0);
            this.head.add(eye, ear);
        }

        [this.shoulderL, this.elbowL] = this.arm(1);
        [this.shoulderR, this.elbowR] = this.arm(-1);
        this.hand = joint(this.elbowR, 0, -0.29);
        [this.hipL, this.kneeL, this.ankleL] = this.leg(1);
        [this.hipR, this.kneeR, this.ankleR] = this.leg(-1);
    }

    /** Side: 1 is the figure's left (+X), -1 its right. */
    private arm(side: number): [THREE.Group, THREE.Group] {
        const shoulder = joint(this.spine, side * 0.215, 0.43);
        const ball = part(new THREE.SphereGeometry(0.062, 14, 10), this.shirt);
        const upper = limb(0.052, 0.29, this.shirt);
        shoulder.add(ball, upper);

        const elbow = joint(shoulder, 0, -0.28);
        const lower = limb(0.044, 0.26, SKIN);
        elbow.add(lower);
        this.limbs.push(
            { mesh: ball, kind: 'arm' },
            { mesh: upper, kind: 'arm' },
            { mesh: lower, kind: 'arm' },
        );

        const cuff = part(
            new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14),
            this.shirt,
        );
        cuff.position.y = -0.02;
        elbow.add(cuff);

        const hand = part(new THREE.SphereGeometry(1, 12, 10), SKIN);
        hand.scale.set(0.034, 0.068, 0.05);
        hand.position.y = -0.3;
        elbow.add(hand);

        return [shoulder, elbow];
    }

    private leg(side: number): [THREE.Group, THREE.Group, THREE.Group] {
        const hip = joint(this.hips, side * LEG_SPREAD, -HIP_JOINT);
        const thigh = limb(0.074, 0.46, this.trousers);
        hip.add(thigh);

        const knee = joint(hip, 0, -THIGH);
        const shin = limb(0.056, SHIN, this.trousers);
        knee.add(shin);
        this.limbs.push(
            { mesh: thigh, kind: 'thigh' },
            { mesh: shin, kind: 'shin' },
        );

        const ankle = joint(knee, 0, -SHIN);
        const foot = part(new THREE.CapsuleGeometry(0.042, 0.16, 4, 10), SHOES);
        foot.rotation.x = Math.PI / 2;
        foot.scale.set(1.15, 1, 0.8);
        foot.position.set(0, -0.035, 0.055);
        ankle.add(foot);

        return [hip, knee, ankle];
    }

    /**
     * Shapes and dresses the figure for the hero: build from strength and
     * agility, the gender's figure, the class's clothes.
     */
    setLook(look: Look): void {
        const { strength, agility } = look.attributes;
        const female = look.gender === 'female';
        const bulk = clamp((strength - 10) / 15, -0.4, 1.4);
        const lean = clamp((agility - 8) / 15, -0.3, 1.2);
        const torso = (1 + 0.22 * bulk - 0.08 * lean) * (female ? 0.9 : 1);
        const thickness = (1 + 0.28 * bulk - 0.1 * lean) * (female ? 0.9 : 1);
        const hips = female ? 1.2 : 1;
        const [shirt, trousers, trim] = OUTFITS[look.heroClass];

        this.shirt.color.setHex(shirt);
        this.trousers.color.setHex(trousers);
        this.trim.color.setHex(trim);
        this.hairPaint.color.setHex(female ? 0x4a2f1f : 0x3a2a1e);
        this.build = {
            female,
            torso,
            chestDepth: 1 + 0.18 * Math.max(0, bulk),
        };

        this.pelvis.scale.set(
            0.17 * hips * (1 + 0.08 * bulk),
            0.12,
            0.12 * (female ? 1.12 : 1),
        );
        this.belt.scale.set(
            0.155 * hips * (1 + 0.08 * bulk),
            0.03,
            0.105 * (female ? 1.1 : 1),
        );
        this.waist.scale.set(
            1.05 * torso * (female ? 0.86 : 1),
            1,
            0.82 * this.build.chestDepth,
        );
        this.chest.scale.x = 0.2 * torso;
        this.chest.scale.z = 0.13 * this.build.chestDepth;
        this.shoulderL.position.x = 0.215 * torso * (1 + 0.06 * bulk);
        this.shoulderR.position.x = -this.shoulderL.position.x;
        this.hair.scale.set(
            female ? 0.118 : 0.11,
            female ? 0.142 : 0.135,
            female ? 0.13 : 0.12,
        );

        for (const { mesh, kind } of this.limbs) {
            const scale = thickness * (kind === 'thigh' && female ? 1.12 : 1);
            mesh.scale.x = scale;
            mesh.scale.z = scale;
        }

        for (const extra of this.extras) {
            extra.removeFromParent();
        }

        this.extras = [];
        const add = (parent: THREE.Object3D, mesh: THREE.Mesh) => {
            parent.add(mesh);
            this.extras.push(mesh);

            return mesh;
        };

        if (female) {
            for (const side of [1, -1]) {
                const breast = add(
                    this.spine,
                    part(new THREE.SphereGeometry(1, 16, 12), this.shirt),
                );
                breast.scale.set(0.078, 0.07, 0.068);
                breast.position.set(
                    side * 0.074 * torso,
                    0.34,
                    0.09 * this.build.chestDepth,
                );

                const glute = add(
                    this.hips,
                    part(new THREE.SphereGeometry(1, 16, 12), this.trousers),
                );
                glute.scale.set(0.088, 0.09, 0.08);
                glute.position.set(side * 0.072 * hips, -0.02, -0.07);
            }

            const tail = add(this.head, limb(0.035, 0.26, this.hairPaint));
            tail.position.set(0, 0.16, -0.12);
            tail.rotation.x = 0.35;
        }

        switch (look.heroClass) {
            case 'tank':
                for (const shoulder of [this.shoulderL, this.shoulderR]) {
                    const pauldron = add(shoulder, part(dome(0.55), this.trim));
                    pauldron.scale.set(0.1, 0.075, 0.1);
                    pauldron.position.y = 0.01;
                }

                break;
            case 'fighter':
                for (const elbow of [this.elbowL, this.elbowR]) {
                    const bracer = add(
                        elbow,
                        part(
                            new THREE.CylinderGeometry(0.052, 0.048, 0.12, 14),
                            this.trim,
                        ),
                    );
                    bracer.position.y = -0.17;
                }

                break;
            case 'assassin': {
                const hood = add(this.head, part(dome(0.62), this.trim));
                hood.scale.set(0.135, 0.158, 0.145);
                hood.position.set(0, 0.105, -0.015);
                hood.rotation.x = -0.35;
                const scarf = add(
                    this.spine,
                    part(new THREE.TorusGeometry(0.07, 0.03, 8, 18), this.trim),
                );
                scarf.rotation.x = Math.PI / 2;
                scarf.position.y = 0.5;
                break;
            }
            case 'mage': {
                const robe = add(
                    this.hips,
                    part(
                        new THREE.CylinderGeometry(
                            0.16 * hips,
                            0.27,
                            0.52,
                            18,
                            1,
                            true,
                        ),
                        this.shirt,
                    ),
                );
                robe.position.y = -0.19;
                (robe.material as THREE.MeshStandardMaterial).side =
                    THREE.DoubleSide;
                const hem = add(
                    this.hips,
                    part(
                        new THREE.TorusGeometry(0.27, 0.014, 6, 24),
                        this.trim,
                    ),
                );
                hem.rotation.x = Math.PI / 2;
                hem.position.y = -0.45;
                break;
            }
        }

        // Armour is shaped to the body: put it on again.
        const worn = { ...this.worn };
        this.wear({ head: null, body: null, feet: null });
        this.wear(worn);
        this.useBody(look.gender);
    }

    /** Swaps in the realistic body for the gender once it has loaded. */
    private useBody(gender: Gender): void {
        if (gender === this.humanGender) {
            return;
        }

        this.humanGender = gender;
        loadHuman(gender)
            .then((gltf) => {
                if (gender !== this.humanGender) {
                    return;
                }

                this.human?.dispose();
                this.human = new Human(
                    gltf,
                    gender,
                    this.root,
                    {
                        hips: this.hips,
                        spine: this.spine,
                        neck: this.neck,
                        head: this.head,
                        shoulderL: this.shoulderL,
                        shoulderR: this.shoulderR,
                        elbowL: this.elbowL,
                        elbowR: this.elbowR,
                        hipL: this.hipL,
                        hipR: this.hipR,
                        kneeL: this.kneeL,
                        kneeR: this.kneeR,
                        ankleL: this.ankleL,
                        ankleR: this.ankleR,
                    },
                    HIPS - HIP_JOINT,
                    new THREE.Vector3(0, HIPS, 0),
                );

                // Put the armour on again, now cut to the body.
                const worn = { ...this.worn };
                this.wear({ head: null, body: null, feet: null });
                this.wear(worn);
                this.apply(null);
            })
            .catch((error: unknown) => {
                // Without the model the simple figure stays.
                console.warn('Sandbox: the player model did not load', error);
            });
    }

    /** Hides the simple figure under the realistic body (the held item stays). */
    private hideShapes(): void {
        const human = this.human;

        if (!human) {
            return;
        }

        const hide = (object: THREE.Object3D) => {
            if (object === human.holder || object === this.hand) {
                return;
            }

            if (object instanceof THREE.Mesh) {
                object.visible = false;
            }

            object.children.forEach(hide);
        };

        hide(this.root);
    }

    /** Dresses the figure in what is worn (null takes a piece off). */
    wear(worn: Record<ArmorSlot, ItemId | null>): void {
        for (const slot of ARMOR_SLOTS) {
            if (worn[slot] === this.worn[slot]) {
                continue;
            }

            for (const piece of this.armor[slot]) {
                piece.removeFromParent();
            }

            this.worn[slot] = worn[slot];
            this.armor[slot] = worn[slot]
                ? this.armorPieces(slot, worn[slot])
                : [];
        }

        this.human?.coverHair(this.worn.head !== null);
        this.hideShapes();
    }

    private armorPieces(slot: ArmorSlot, item: ItemId): THREE.Object3D[] {
        const iron = item.startsWith('iron_');
        const shell = iron ? IRON : LEATHER;
        const trim = iron ? IRON_DARK : LEATHER_DARK;
        const pieces: THREE.Object3D[] = [];

        // On the realistic body armour is cut to fit it.
        if (this.human) {
            return this.human.dress(
                slot,
                item,
                slot === 'body' || iron ? shell : trim,
            );
        }

        const put = (parent: THREE.Object3D, mesh: THREE.Mesh) => {
            parent.add(mesh);
            pieces.push(mesh);

            return mesh;
        };

        if (slot === 'head') {
            const cap = put(this.head, part(dome(0.56), shell));
            cap.scale.set(0.122, 0.148, 0.133);
            cap.position.set(0, 0.112, 0.008);
            const rim = put(
                this.head,
                part(new THREE.TorusGeometry(1, 0.08, 6, 22), trim),
            );
            rim.rotation.x = Math.PI / 2;
            rim.scale.set(0.122, 0.133, 0.18);
            rim.position.set(0, 0.105, 0.008);

            if (iron) {
                put(
                    this.head,
                    part(new THREE.BoxGeometry(0.018, 0.075, 0.02), trim),
                ).position.set(0, 0.085, 0.135);
                put(
                    this.head,
                    part(new THREE.BoxGeometry(0.02, 0.03, 0.24), trim),
                ).position.set(0, 0.255, 0.008);
            }
        } else if (slot === 'body') {
            const plate = put(
                this.spine,
                part(new THREE.SphereGeometry(1, 24, 16), shell),
            );
            const { torso, chestDepth, female } = this.build;
            plate.scale.set(
                0.212 * torso,
                0.212,
                (female ? 0.17 : 0.142) * chestDepth,
            );
            plate.position.y = 0.33;
            plate.position.z = female ? 0.02 : 0;
            const lower = put(this.spine, limb(0.129, 0.24, shell));
            lower.position.y = 0.25;
            lower.scale.set(
                1.06 * torso * (female ? 0.88 : 1),
                1,
                0.84 * chestDepth,
            );
            const belt = put(
                this.spine,
                part(new THREE.CylinderGeometry(1, 1, 1, 20), trim),
            );
            belt.scale.set(0.14, 0.035, 0.112);
            belt.position.y = 0.03;

            for (const shoulder of [this.shoulderL, this.shoulderR]) {
                const pad = put(shoulder, part(dome(0.5), iron ? shell : trim));
                pad.scale.set(0.078, 0.06, 0.078);
                pad.position.y = 0.005;
            }
        } else {
            for (const [knee, ankle] of [
                [this.kneeL, this.ankleL],
                [this.kneeR, this.ankleR],
            ]) {
                const shaft = put(knee, limb(0.064, 0.22, shell));
                shaft.position.y = -SHIN + 0.2;
                const cuff = put(
                    knee,
                    part(
                        new THREE.CylinderGeometry(0.07, 0.07, 0.035, 14),
                        trim,
                    ),
                );
                cuff.position.y = -SHIN + 0.2;
                const toe = put(
                    ankle,
                    part(new THREE.CapsuleGeometry(0.047, 0.17, 4, 10), shell),
                );
                toe.rotation.x = Math.PI / 2;
                toe.scale.set(1.15, 1, 0.82);
                toe.position.set(0, -0.032, 0.058);
            }
        }

        return pieces;
    }

    /** Puts an item in the right hand (or empties it). */
    hold(item: ItemId | null): void {
        if (item === this.heldItem) {
            return;
        }

        this.heldItem = item;
        this.hand.clear();
        const model = item ? createHeld(item) : null;

        if (model) {
            this.hand.add(model);
        }
    }

    /** Where the held item's tip is (a torch's flame), in world space. */
    handTip(out: THREE.Vector3): THREE.Vector3 {
        const flame = this.hand.getObjectByName('flame');

        return (flame ?? this.hand).getWorldPosition(out);
    }

    update(dt: number, motion: MotionState, landingSpeed: number): void {
        this.time += dt;

        if (landingSpeed > 2) {
            this.squash = Math.min(0.16, landingSpeed * 0.012);
        }

        this.squash *= Math.exp(-8 * dt);

        const target = this.targetPose(dt, motion);
        const rate =
            motion.sitting || motion.swimming || motion.stance === 'crawl'
                ? 7
                : 18;
        const ease = 1 - Math.exp(-rate * dt);
        const slowEase = 1 - Math.exp(-6 * dt);

        for (const key of Object.keys(target) as (keyof Pose)[]) {
            const amount = key === 'pitch' || key === 'bodyZ' ? slowEase : ease;
            this.pose[key] += (target[key] - this.pose[key]) * amount;
        }

        this.plantFeet(dt, motion);
        this.apply(motion.activity);
    }

    private targetPose(dt: number, motion: MotionState): Pose {
        const pose: Pose = { ...REST };

        if (motion.climb !== null) {
            this.climbPose(pose, motion.climb);
        } else if (motion.sitting) {
            this.sitPose(pose, motion);
        } else if (motion.swimming) {
            this.swimPose(pose, dt, motion);
        } else if (motion.stance === 'crawl') {
            this.crawlPose(pose, dt, motion);
        } else if (!motion.grounded) {
            this.airPose(pose, motion);
        } else {
            this.gaitPose(pose, dt, motion);
        }

        if (motion.activity?.kind === 'pickup') {
            const bend = Math.sin(
                Math.PI * clamp(motion.activity.progress, 0, 1),
            );
            pose.lean += 0.85 * bend;
            pose.bodyY -= 0.3 * bend;
            pose.armR = lerp(pose.armR, -1.15, bend);
            pose.elbowR = lerp(pose.elbowR, -0.15, bend);
            pose.headX += 0.35 * bend;
        }

        // The head looks where the camera does; lying down it mostly can't.
        const lookScale =
            (motion.stance === 'crawl' && !motion.sitting) || motion.swimming
                ? 0.3
                : 1;
        const lookYaw = clamp(motion.lookYaw, -1.25, 1.25) * lookScale;
        pose.headY += lookYaw * 0.75;
        pose.twist += lookYaw * 0.15;
        pose.headX += clamp(motion.lookPitch * 0.45, -0.35, 0.45) * lookScale;
        // Keep the eyes level whatever the back does.
        pose.headX -= pose.lean * 0.7;

        return pose;
    }

    private gaitPose(pose: Pose, dt: number, motion: MotionState): void {
        const crouch = motion.stance === 'crouch';
        const speed = motion.speed;
        const run =
            motion.runSpeed > motion.walkSpeed
                ? clamp(
                      (speed - motion.walkSpeed) /
                          (motion.runSpeed - motion.walkSpeed),
                      0,
                      1,
                  )
                : 0;
        const moving = smooth((speed - 0.05) / 0.5);

        const half = clamp(speed * 0.13, 0.06, crouch ? 0.32 : 0.62);
        const duty = lerp(0.52, 0.38, run);

        if (speed > 0.05) {
            const before = this.stepPhase;
            this.stepPhase =
                (this.stepPhase + ((speed * duty) / (2 * half)) * dt) % 1;

            // A foot lands at the start of each half of the cycle.
            if (
                this.stepPhase < before ||
                (before < 0.5 && this.stepPhase >= 0.5)
            ) {
                this.onStep(
                    smooth((speed - 0.2) / 1.5) *
                        (0.6 + 0.4 * run) *
                        (crouch ? 0.45 : 1),
                );
            }
        }

        const foot = (phase: number): [number, number] => {
            if (phase < duty) {
                return [half * (1 - (2 * phase) / duty), 0];
            }

            const swing = (phase - duty) / (1 - duty);

            return [
                -half + 2 * half * smooth(swing),
                Math.sin(Math.PI * swing) *
                    (0.09 + 0.14 * run) *
                    (crouch ? 0.7 : 1),
            ];
        };
        const [zL, liftL] = foot(this.stepPhase);
        const [zR, liftR] = foot((this.stepPhase + 0.5) % 1);

        pose.ik = 1;
        pose.footZL = zL * moving;
        pose.footZR = zR * moving;
        pose.liftL = liftL * moving;
        pose.liftR = liftR * moving;
        pose.spreadL = pose.spreadR = crouch ? 0.06 : 0;

        const bounce = 0.5 + 0.5 * Math.cos(this.stepPhase * Math.PI * 4);
        pose.bodyY =
            (crouch ? -0.36 : 0) -
            moving * (0.015 + 0.04 * run) * bounce -
            run * 0.05;
        pose.lean = (crouch ? 0.38 : 0) + moving * 0.03 + run * 0.16;
        pose.lean += clamp(motion.acceleration * 0.02, -0.12, 0.18) * moving;
        // Only a hint of leaning into a turn.
        pose.roll = clamp(-motion.turnRate * speed * 0.006, -0.07, 0.07);
        pose.side = pose.roll * 0.3;

        const swingL = zL / half;
        const swingR = zR / half;
        const armSwing = (0.35 + 0.5 * run) * moving * (crouch ? 0.5 : 1);
        pose.armL = -swingR * armSwing - (crouch ? 0.3 : 0);
        pose.armR = -swingL * armSwing - (crouch ? 0.3 : 0);
        pose.elbowL = pose.elbowR =
            -0.15 - moving * 0.2 - run * 1.0 - (crouch ? 0.5 : 0);
        pose.armOutL = pose.armOutR = 0.08 + run * 0.06;
        pose.twist = swingL * (0.08 + 0.06 * run) * moving;
        pose.hipsYaw = -swingL * 0.08 * moving;
        // The hip over the swinging leg drops a little each step.
        pose.hipsRoll =
            Math.sin(this.stepPhase * Math.PI * 2) *
            (0.045 - 0.02 * run) *
            moving *
            (crouch ? 0.5 : 1);

        // Breathing and a slow shift of weight while standing still.
        const idle = 1 - moving;
        const breath = Math.sin(this.time * 1.7);

        pose.hipsRoll += Math.sin(this.time * 0.45) * 0.03 * idle;
        pose.armL -= 0.05 * idle;
        pose.armR -= 0.05 * idle;
        pose.elbowL -= 0.1 * idle;
        pose.elbowR -= 0.1 * idle;
        pose.lean += breath * 0.012 * idle;
        pose.armOutL += breath * 0.015 * idle;
        pose.armOutR += breath * 0.015 * idle;
        pose.headX += Math.sin(this.time * 0.6) * 0.03 * idle;
        pose.bodyY -= this.squash;
    }

    private airPose(pose: Pose, motion: MotionState): void {
        const rising = clamp(motion.verticalSpeed / 8, -1, 1);
        const falling = clamp(-motion.verticalSpeed / 14, 0, 1);

        pose.ik = 0;
        pose.thighL = -0.8 + falling * 0.4;
        pose.thighR = -0.2;
        pose.kneeL = 1.2 - falling * 0.5;
        pose.kneeR = 0.6;
        pose.footL = -(pose.thighL + pose.kneeL) * 0.8;
        pose.footR = -(pose.thighR + pose.kneeR) * 0.8;
        pose.armOutL = pose.armOutR = 0.5 + rising * 0.2 + falling * 0.5;
        pose.armL = -0.4;
        pose.armR = 0.2;
        pose.elbowL = pose.elbowR = -0.6;
        pose.lean = 0.1;
        pose.roll = clamp(-motion.turnRate * motion.speed * 0.004, -0.05, 0.05);
        pose.headX = -rising * 0.12;
    }

    private sitPose(pose: Pose, motion: MotionState): void {
        const onSeat = motion.sitting === 'seat';
        const height = onSeat ? motion.seatHeight : 0;

        pose.ik = 1;
        pose.bodyY = height + 0.11 - HIPS;
        pose.footZL = pose.footZR = onSeat ? 0.42 : 0.72;
        pose.spreadL = pose.spreadR = 0.07;

        if (onSeat) {
            pose.lean = 0.1 + Math.sin(this.time * 1.4) * 0.01;
            pose.armL = pose.armR = -0.6;
            pose.elbowL = pose.elbowR = -0.7;
            pose.armOutL = pose.armOutR = 0.12;
        } else {
            pose.lean = -0.25 + Math.sin(this.time * 1.4) * 0.01;
            pose.armL = pose.armR = 0.6;
            pose.armOutL = pose.armOutR = 0.25;
            pose.elbowL = pose.elbowR = -0.05;
        }
    }

    private crawlPose(pose: Pose, dt: number, motion: MotionState): void {
        const moving = smooth((motion.speed - 0.05) / 0.4);
        const before = this.crawlPhase;
        this.crawlPhase = (this.crawlPhase + (motion.speed / 0.9) * dt) % 1;

        if (
            moving > 0.3 &&
            (this.crawlPhase < before ||
                (before < 0.5 && this.crawlPhase >= 0.5))
        ) {
            this.onStep(0.3);
        }

        const s = Math.sin(this.crawlPhase * Math.PI * 2) * moving;

        pose.ik = 0;
        pose.pitch = Math.PI / 2;
        pose.bodyY = 0.17 - HIPS;
        pose.bodyZ = -0.2;
        pose.thighL = -0.05 + 0.15 * s;
        pose.thighR = -0.05 - 0.15 * s;
        pose.spreadL = 0.22 + 0.25 * Math.max(0, s);
        pose.spreadR = 0.22 + 0.25 * Math.max(0, -s);
        // Knees bend out to the sides, not up into the air.
        pose.turnOut = 1.3;
        pose.kneeL = 0.35 + 0.8 * Math.max(0, s);
        pose.kneeR = 0.35 + 0.8 * Math.max(0, -s);
        pose.footL = pose.footR = 0.4;
        pose.armL = -2.5 + 0.35 * s;
        pose.armR = -2.5 - 0.35 * s;
        pose.armOutL = pose.armOutR = 0.35;
        pose.elbowL = -1.3 - 0.3 * s;
        pose.elbowR = -1.3 + 0.3 * s;
        pose.twist = 0.1 * s;
        pose.headX = -1.0;
    }

    /**
     * Swimming: lying along the water doing breaststroke when moving,
     * upright treading water with sculling arms when not.
     */
    private swimPose(pose: Pose, dt: number, motion: MotionState): void {
        const moving = smooth((motion.speed - 0.2) / 1.2);
        const before = this.swimPhase;
        this.swimPhase =
            (this.swimPhase + (0.45 + motion.speed * 0.35) * dt) % 1;

        if (moving > 0.3 && this.swimPhase < before) {
            this.onStroke();
        }

        const angle = this.swimPhase * Math.PI * 2;
        const s = Math.sin(angle);
        const tread = 1 - moving;
        const reach = 0.5 + 0.5 * s;
        const pull = Math.max(0, -s);

        pose.ik = 0;
        pose.pitch = lerp(0.12, 1.25, moving);
        pose.bodyY = 0.22 * moving;
        pose.headX = -0.95 * moving;

        // Breaststroke: reach forward, sweep out and back, tuck and kick.
        pose.armL = pose.armR = lerp(
            -0.5 + 0.25 * Math.sin(angle * 2),
            -2.7 + 1.2 * (1 - reach),
            moving,
        );
        pose.armOutL = pose.armOutR = lerp(0.95, 0.25 + 0.9 * pull, moving);
        pose.elbowL = pose.elbowR = lerp(
            -0.5,
            -0.2 - 1.1 * Math.max(0, Math.cos(angle)),
            moving,
        );
        pose.thighL =
            lerp(0.2 * Math.sin(angle * 2), -0.5 * pull, moving) + 0.15 * tread;
        pose.thighR =
            lerp(-0.2 * Math.sin(angle * 2), -0.5 * pull, moving) +
            0.15 * tread;
        pose.kneeL = pose.kneeR = lerp(0.35, 0.2 + 1.3 * pull, moving);
        pose.spreadL = pose.spreadR = lerp(0.12, 0.1 + 0.35 * pull, moving);
        pose.footL = pose.footR = 0.5 * moving;
    }

    private climbPose(pose: Pose, progress: number): void {
        const legs = Math.sin(Math.PI * clamp(progress / 0.8, 0, 1));

        pose.ik = 0;
        pose.bodyY = -0.05;

        if (progress < 0.65) {
            const pull = progress / 0.65;
            pose.armL = pose.armR = lerp(-2.9, -0.9, smooth(pull));
            pose.elbowL = pose.elbowR = -0.2 - 1.6 * Math.sin(Math.PI * pull);
        } else {
            const over = (progress - 0.65) / 0.35;
            pose.armL = pose.armR = lerp(-0.9, 0, smooth(over));
            pose.elbowL = pose.elbowR = lerp(-0.3, -0.15, over);
        }

        pose.armOutL = pose.armOutR = 0.2;
        pose.thighL = -1.3 * legs;
        pose.kneeL = 1.8 * legs;
        pose.thighR = -0.4 * legs;
        pose.kneeR = 0.8 * legs;
        pose.footL = -(pose.thighL + pose.kneeL) * 0.8;
        pose.footR = -(pose.thighR + pose.kneeR) * 0.8;
        pose.lean = 0.35 * Math.sin(Math.PI * progress);
        pose.headX = -0.4 * (1 - progress);
    }

    /** Eases each foot's ground height toward what is really under it. */
    private plantFeet(dt: number, motion: MotionState): void {
        let left = 0;
        let right = 0;

        if (
            motion.ground &&
            motion.grounded &&
            !motion.sitting &&
            !motion.swimming &&
            motion.climb === null
        ) {
            const { x, y, z } = this.root.position;
            const yaw = this.root.rotation.y;
            const cos = Math.cos(yaw);
            const sin = Math.sin(yaw);
            const at = (side: number, forward: number) =>
                clamp(
                    motion.ground!(
                        x + cos * side * LEG_SPREAD + sin * forward,
                        z - sin * side * LEG_SPREAD + cos * forward,
                    ) - y,
                    -0.3,
                    0.3,
                );
            left = at(1, this.pose.footZL);
            right = at(-1, this.pose.footZR);
        }

        const ease = 1 - Math.exp(-20 * dt);
        this.groundL += (left - this.groundL) * ease;
        this.groundR += (right - this.groundR) * ease;
    }

    private apply(activity: Activity): void {
        const pose = this.pose;
        // The body sinks to reach the lower foot.
        const bodyY =
            pose.bodyY + Math.min(0, this.groundL, this.groundR) * pose.ik;

        this.body.position.set(0, HIPS + bodyY, pose.bodyZ);
        this.body.rotation.set(pose.pitch, 0, pose.roll);
        this.hips.rotation.set(0, pose.hipsYaw, pose.hipsRoll);
        // The back straightens above the tilting hips.
        this.spine.rotation.set(
            pose.lean,
            pose.twist,
            pose.side - pose.hipsRoll * 0.8,
        );
        this.head.rotation.set(pose.headX, pose.headY, 0);
        this.chest.scale.y = 0.2 * (1 + Math.sin(this.time * 1.7) * 0.012);

        let { thighL, thighR, kneeL, kneeR, footL, footR } = pose;

        if (pose.ik > 0.001) {
            const hipHeight = HIPS + bodyY - HIP_JOINT;
            const left = solveLeg(
                pose.footZL,
                hipHeight - ANKLE - this.groundL - pose.liftL,
            );
            const right = solveLeg(
                pose.footZR,
                hipHeight - ANKLE - this.groundR - pose.liftR,
            );
            thighL = lerp(thighL, left[0], pose.ik);
            kneeL = lerp(kneeL, left[1], pose.ik);
            footL = lerp(footL, left[2], pose.ik);
            thighR = lerp(thighR, right[0], pose.ik);
            kneeR = lerp(kneeR, right[1], pose.ik);
            footR = lerp(footR, right[2], pose.ik);
        }

        this.hipL.rotation.set(thighL, pose.turnOut, pose.spreadL);
        this.hipR.rotation.set(thighR, -pose.turnOut, -pose.spreadR);
        this.kneeL.rotation.x = kneeL;
        this.kneeR.rotation.x = kneeR;
        this.ankleL.rotation.x = footL;
        this.ankleR.rotation.x = footR;

        let { armR, armOutR, elbowR, armL, elbowL } = pose;

        // A blow: wind up, strike, recover — too quick to ease, so it is
        // laid over the eased pose.
        if (activity?.kind === 'hit') {
            const t = activity.progress;
            const weight =
                t < 0.6 ? Math.min(1, t / 0.12) : 1 - smooth((t - 0.6) / 0.4);
            let swing: [number, number, number, number, number];

            if (t < 0.42) {
                const k = smooth(t / 0.42);
                swing = [
                    lerp(-0.6, -2.7, k),
                    0.4,
                    lerp(-0.6, -1.7, k),
                    -0.4 * k,
                    0,
                ];
            } else {
                const k = clamp((t - 0.42) / 0.18, 0, 1) ** 2;
                swing = [
                    lerp(-2.7, -0.4, k),
                    0.4 - 0.2 * k,
                    lerp(-1.7, -0.25, k),
                    lerp(-0.4, 0.4, k),
                    0.25 * k,
                ];
            }

            armR = lerp(armR, swing[0], weight);
            armOutR = lerp(armOutR, swing[1], weight);
            elbowR = lerp(elbowR, swing[2], weight);
            armL = lerp(armL, -0.5, weight);
            elbowL = lerp(elbowL, -1.4, weight);
            this.spine.rotation.set(
                pose.lean + swing[4] * weight,
                lerp(pose.twist, swing[3], weight),
                pose.side,
            );
        }

        this.shoulderL.rotation.set(armL, 0, pose.armOutL);
        this.shoulderR.rotation.set(armR, 0, -armOutR);
        this.elbowL.rotation.x = elbowL;
        this.elbowR.rotation.x = elbowR;

        if (this.human) {
            this.human.setGrip(0, this.heldItem ? 1 : 0);
            this.human.update();
            // The held item goes into the body's own hand.
            this.elbowR.updateWorldMatrix(true, false);
            this.hand.position.copy(
                this.elbowR.worldToLocal(this.human.grip(this.grip)),
            );
        }
    }
}
