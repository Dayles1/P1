/**
 * A realistic body for the player: a skinned, textured human — Quaternius'
 * Universal Base Characters (CC0), a man or a woman in plain underwear,
 * with hair — worn over the Mannequin's joints. Armour put on is cut from
 * the body's own skin, lifted off it a little and coloured (see dress), so
 * it fits and bends with the body.
 *
 * The Mannequin keeps doing all the moving — walk cycle, leg IK, crawl,
 * swim, blows — on its own (now invisible) joints; every frame each bone
 * copies the turn of the joint that drives it. Rotations are compared in
 * the figure's own space, so the bones' local axes don't matter: at load
 * the model is brought into the Mannequin's rest pose (arms and legs
 * hanging straight down), and from then on a bone's orientation is its
 * joint's orientation times that rest one.
 *
 * Some bones take only a share of their joint's turn, which the real
 * body spreads out: the bend of the back over three vertebrae, a turn of
 * the head partly in the neck, a raised arm partly in the collarbone.
 * The fingers curl by themselves: loosely at rest, into a fist round
 * whatever the hand holds.
 */

import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import femaleUrl from '../assets/human-female.glb?url';
import maleUrl from '../assets/human-male.glb?url';
import type { Gender } from '../hero';
import type { ArmorSlot } from '../items';

/** The Mannequin's joints a body follows. */
export interface Rig {
    hips: THREE.Object3D;
    spine: THREE.Object3D;
    neck: THREE.Object3D;
    head: THREE.Object3D;
    shoulderL: THREE.Object3D;
    shoulderR: THREE.Object3D;
    elbowL: THREE.Object3D;
    elbowR: THREE.Object3D;
    hipL: THREE.Object3D;
    hipR: THREE.Object3D;
    kneeL: THREE.Object3D;
    kneeR: THREE.Object3D;
    ankleL: THREE.Object3D;
    ankleR: THREE.Object3D;
}

/**
 * Bone → the joint that turns it; `share` < 1 takes only that part of the
 * joint's own turn (relative to the joint's parent).
 */
const DRIVERS: Record<string, { joint: keyof Rig; share?: number }> = {
    pelvis: { joint: 'hips' },
    spine_01: { joint: 'spine', share: 0.35 },
    spine_02: { joint: 'spine', share: 0.7 },
    spine_03: { joint: 'spine' },
    neck_01: { joint: 'head', share: 0.45 },
    Head: { joint: 'head' },
    clavicle_l: { joint: 'shoulderL', share: 0.2 },
    upperarm_l: { joint: 'shoulderL' },
    lowerarm_l: { joint: 'elbowL' },
    hand_l: { joint: 'elbowL' },
    clavicle_r: { joint: 'shoulderR', share: 0.2 },
    upperarm_r: { joint: 'shoulderR' },
    lowerarm_r: { joint: 'elbowR' },
    hand_r: { joint: 'elbowR' },
    thigh_l: { joint: 'hipL' },
    calf_l: { joint: 'kneeL' },
    foot_l: { joint: 'ankleL' },
    thigh_r: { joint: 'hipR' },
    calf_r: { joint: 'kneeR' },
    foot_r: { joint: 'ankleR' },
};

/** Arms hang this far out from straight down (radians) at rest. */
const ARM_OUT = 0.1;
/** Finger curl per joint (radians): relaxed, and round a held item. */
const CURL_REST = 0.3;
const CURL_GRIP = 1.2;
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
/** How much of the curl each knuckle takes, from the palm out. */
const KNUCKLES = [0.8, 1, 0.75];

const HAIR: Record<Gender, number> = { male: 0x3b2a1f, female: 0x4b2e1c };

/** Where on the body armour goes, as fractions of the body's height. */
const COVER = {
    /** Boots: up the shins. */
    bootTop: 0.2,
    /** Jacket and breastplate: from the waist up to the collarbones. */
    waist: 0.56,
    plateWaist: 0.6,
    collar: 0.83,
    /** Half the width of the trunk (beyond it are the arms, out in the T-pose). */
    trunk: 0.11,
};

/** How wide (m) an armour edge fades over before it is cut. */
const EDGE = 0.03;

const clamp = THREE.MathUtils.clamp;

const cutOuts = new WeakMap<THREE.Material, THREE.Material>();

/** The material, cut where the vertex alpha (how covered) is under ½. */
function cutOut(material: THREE.Material): THREE.Material {
    let cut = cutOuts.get(material);

    if (!cut) {
        cut = material.clone();
        cut.vertexColors = true;
        cut.alphaTest = 0.5;
        cut.side = THREE.DoubleSide;
        cutOuts.set(material, cut);
    }

    return cut;
}

const URLS: Record<Gender, string> = { male: maleUrl, female: femaleUrl };
const loading = new Map<Gender, Promise<GLTF>>();

/** Loads (once) the body for a gender. */
export function loadHuman(gender: Gender): Promise<GLTF> {
    let promise = loading.get(gender);

    if (!promise) {
        promise = new GLTFLoader().loadAsync(URLS[gender]);
        promise.catch(() => loading.delete(gender));
        loading.set(gender, promise);
    }

    return promise;
}

interface Driven {
    bone: THREE.Bone;
    joint: THREE.Object3D;
    share: number;
    /** Orientation at rest, in figure space. */
    rest: THREE.Quaternion;
    parent: THREE.Bone | null;
}

interface Finger {
    bone: THREE.Bone;
    rest: THREE.Quaternion;
    /** The curl axis in the bone's own space, and its share of the curl. */
    axis: THREE.Vector3;
    amount: number;
    side: 'left' | 'right';
}

export class Human {
    /** Holds the model: scaled to the Mannequin and turned to face +Z. */
    readonly holder = new THREE.Group();

    private bones = new Map<string, THREE.Bone>();
    private driven: Driven[] = [];
    private fingers: Finger[] = [];
    /** The pelvis' parent in figure space (it never moves). */
    private pelvisParent = new THREE.Quaternion();
    private pelvisRest = new THREE.Vector3();
    private target = new Map<THREE.Bone, THREE.Quaternion>();
    private rootInverse = new THREE.Quaternion();
    private q = new THREE.Quaternion();
    private share = new THREE.Quaternion();
    private v = new THREE.Vector3();
    private curl = { left: CURL_REST, right: CURL_REST };
    /** The skin armour is cut from, and the hair a helmet hides. */
    private body: THREE.SkinnedMesh | null = null;
    private hair: THREE.Mesh[] = [];

    /**
     * @param hipJoint height of the Mannequin's hip joints at rest
     * @param hipsDriverRest the Mannequin's hips joint at rest, in figure space
     */
    constructor(
        gltf: GLTF,
        gender: Gender,
        private root: THREE.Object3D,
        private rig: Rig,
        hipJoint: number,
        private hipsDriverRest: THREE.Vector3,
    ) {
        const model = clone(gltf.scene);

        model.traverse((object) => {
            if (object instanceof THREE.Bone) {
                this.bones.set(object.name, object);
            }

            if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                // Skinned meshes move away from their bounds.
                object.frustumCulled = false;

                const material = object.material as THREE.MeshStandardMaterial;

                // The hair texture is grey, to be tinted.
                if (material.name.startsWith('MI_Hair')) {
                    material.color.setHex(HAIR[gender]);
                }

                if (object.name.startsWith('Hair')) {
                    this.hair.push(object);
                }

                if (
                    object instanceof THREE.SkinnedMesh &&
                    material.name.startsWith('MI_Superhero')
                ) {
                    this.body = object;
                }
            }
        });

        this.holder.add(model);
        root.add(this.holder);
        this.fit(hipJoint);
        this.calibrate();

        model.traverse((object) => {
            const drive =
                object instanceof THREE.Bone ? DRIVERS[object.name] : null;

            if (!drive) {
                return;
            }

            const bone = object as THREE.Bone;
            const parent =
                bone.parent instanceof THREE.Bone && DRIVERS[bone.parent.name]
                    ? bone.parent
                    : null;

            this.driven.push({
                bone,
                joint: rig[drive.joint],
                share: drive.share ?? 1,
                rest: this.inFigure(bone, new THREE.Quaternion()),
                parent,
            });
            this.target.set(bone, new THREE.Quaternion());
        });

        const pelvis = this.bone('pelvis');

        this.inFigure(pelvis.parent!, this.pelvisParent);
        this.positionInFigure(pelvis, this.pelvisRest);
        this.findFingers();
    }

    /** How tightly each hand closes: 0 relaxed, 1 a fist round a handle. */
    setGrip(left: number, right: number): void {
        this.curl.left = THREE.MathUtils.lerp(CURL_REST, CURL_GRIP, left);
        this.curl.right = THREE.MathUtils.lerp(CURL_REST, CURL_GRIP, right);
    }

    /** Copies the joints' turns onto the bones. Call after the joints move. */
    update(): void {
        this.root.updateWorldMatrix(true, false);
        this.root.getWorldQuaternion(this.rootInverse).invert();

        for (const { bone, joint, share, rest, parent } of this.driven) {
            const target = this.target.get(bone)!;

            if (share < 1) {
                // The joint's parent turned, plus a share of the joint's own turn.
                joint.parent!.getWorldQuaternion(target);
                target
                    .premultiply(this.rootInverse)
                    .multiply(
                        this.share.identity().slerp(joint.quaternion, share),
                    );
            } else {
                joint.getWorldQuaternion(target).premultiply(this.rootInverse);
            }

            target.multiply(rest);

            const parentTarget = parent
                ? this.target.get(parent)!
                : this.pelvisParent;

            bone.quaternion.copy(parentTarget).invert().multiply(target);
        }

        for (const { bone, rest, axis, amount, side } of this.fingers) {
            bone.quaternion
                .copy(rest)
                .multiply(
                    this.q.setFromAxisAngle(axis, this.curl[side] * amount),
                );
        }

        // The hips also carry the body's shift (crouching, sitting, lying).
        const pelvis = this.bone('pelvis');
        const shift = this.positionInFigure(this.rig.hips, this.v)
            .sub(this.hipsDriverRest)
            .add(this.pelvisRest);

        pelvis.position.copy(
            pelvis.parent!.worldToLocal(this.root.localToWorld(shift)),
        );
        this.holder.updateMatrixWorld(true);
    }

    /**
     * Armour for a slot, cut from the body's skin: a cap above the brows, a
     * jacket over the trunk and upper arms (a breastplate over the trunk
     * only), boots up the shins. Taking it off is removing it.
     */
    dress(
        slot: ArmorSlot,
        item: string,
        material: THREE.Material,
    ): THREE.Object3D[] {
        const body = this.body;

        if (!body) {
            return [];
        }

        const geometry = body.geometry;
        const position = geometry.getAttribute('position');
        const normal = geometry.getAttribute('normal');
        const joints = geometry.getAttribute('skinIndex');
        const weights = geometry.getAttribute('skinWeight');
        const bones = body.skeleton.bones;

        geometry.computeBoundingBox();

        const height = geometry.boundingBox!.max.y;
        const brows = this.browHeight(height);
        const plate = item === 'iron_chestplate';
        const share = (vertex: number, test: (name: string) => boolean) => {
            let sum = 0;

            for (let k = 0; k < 4; k++) {
                if (test(bones[joints.getComponent(vertex, k)]?.name ?? '')) {
                    sum += weights.getComponent(vertex, k);
                }
            }

            return sum;
        };
        // How much a point is covered, 0…1, changing smoothly so the edge
        // (where it crosses ½) runs straight through the triangles.
        const inside = (distance: number) => clamp(0.5 + distance / EDGE, 0, 1);
        const coverage = (vertex: number): number => {
            const x = position.getX(vertex);
            const y = position.getY(vertex);
            const z = position.getZ(vertex);

            if (slot === 'head') {
                return Math.min(
                    share(vertex, (name) => name === 'Head'),
                    Math.max(
                        inside(y - brows - 0.008),
                        Math.min(inside(-0.03 - z), inside(y - brows + 0.07)),
                    ),
                );
            }

            if (slot === 'feet') {
                return inside(COVER.bootTop * height - y);
            }

            const hand = share(
                vertex,
                (name) =>
                    name.startsWith('lowerarm') ||
                    name.startsWith('hand') ||
                    /^(index|middle|ring|pinky|thumb)/.test(name),
            );
            const neck = share(
                vertex,
                (name) => name === 'Head' || name === 'neck_01',
            );
            const upperArm = share(
                vertex,
                (name) =>
                    name.startsWith('upperarm') || name.startsWith('clavicle'),
            );
            const trunk = Math.min(
                inside(COVER.trunk * height - Math.abs(x)),
                inside(y - (plate ? COVER.plateWaist : COVER.waist) * height),
                inside(COVER.collar * height - y),
            );

            return Math.min(
                1 - hand,
                1 - neck,
                plate ? trunk : Math.max(trunk, upperArm),
            );
        };
        const lift = { head: 0.018, body: plate ? 0.026 : 0.02, feet: 0.012 }[
            slot
        ];
        const cover = new Float32Array(position.count);

        for (let i = 0; i < position.count; i++) {
            cover[i] = coverage(i);
        }

        const source = geometry.index!;
        const indices: number[] = [];

        for (let i = 0; i < source.count; i += 3) {
            const a = source.getX(i);
            const b = source.getX(i + 1);
            const c = source.getX(i + 2);

            if (Math.max(cover[a], cover[b], cover[c]) > 0.5) {
                indices.push(a, b, c);
            }
        }

        const lifted = new Float32Array(position.count * 3);
        const alpha = new Float32Array(position.count * 4).fill(1);

        for (let i = 0; i < position.count; i++) {
            lifted[i * 3] = position.getX(i) + normal.getX(i) * lift;
            lifted[i * 3 + 1] = position.getY(i) + normal.getY(i) * lift;
            lifted[i * 3 + 2] = position.getZ(i) + normal.getZ(i) * lift;
            alpha[i * 4 + 3] = cover[i];
        }

        const shell = new THREE.BufferGeometry();

        shell.setAttribute('position', new THREE.BufferAttribute(lifted, 3));
        shell.setAttribute('normal', normal);
        shell.setAttribute('color', new THREE.BufferAttribute(alpha, 4));
        shell.setAttribute('skinIndex', joints);
        shell.setAttribute('skinWeight', weights);
        shell.setIndex(indices);

        const piece = new THREE.SkinnedMesh(shell, cutOut(material));

        piece.castShadow = true;
        piece.receiveShadow = true;
        piece.frustumCulled = false;
        piece.bind(body.skeleton, body.bindMatrix);
        body.parent!.add(piece);

        return [piece];
    }

    /** A helmet covers the hair. */
    coverHair(covered: boolean): void {
        for (const hair of this.hair) {
            hair.visible = !covered;
        }
    }

    /** Where the right hand grips, in world space. */
    grip(out: THREE.Vector3): THREE.Vector3 {
        const wrist = this.bone('hand_r').getWorldPosition(out);
        const finger = this.bones.get('middle_01_r');

        return finger
            ? wrist.lerp(finger.getWorldPosition(this.v), 0.8)
            : wrist;
    }

    dispose(): void {
        this.holder.removeFromParent();
    }

    /** Top of the eyebrows, in the body's own space. */
    private browHeight(height: number): number {
        let top = 0.94 * height;

        this.holder.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name === 'Eyebrows') {
                object.geometry.computeBoundingBox();
                top = object.geometry.boundingBox!.max.y;
            }
        });

        return top;
    }

    private bone(name: string): THREE.Bone {
        const bone = this.bones.get(name);

        if (!bone) {
            throw new Error(`The body has no ${name} bone`);
        }

        return bone;
    }

    private inFigure(
        object: THREE.Object3D,
        out: THREE.Quaternion,
    ): THREE.Quaternion {
        this.root.getWorldQuaternion(this.q).invert();

        return object.getWorldQuaternion(out).premultiply(this.q);
    }

    private positionInFigure(
        object: THREE.Object3D,
        out: THREE.Vector3,
    ): THREE.Vector3 {
        return this.root.worldToLocal(object.getWorldPosition(out));
    }

    /** Scales the model so its hip joints are the Mannequin's, feet on the ground, facing +Z. */
    private fit(hipJoint: number): void {
        const at = (name: string) =>
            this.positionInFigure(this.bone(name), new THREE.Vector3());

        this.root.updateMatrixWorld(true);

        if (at('upperarm_l').x < at('upperarm_r').x) {
            this.holder.rotation.y = Math.PI;
            this.root.updateMatrixWorld(true);
        }

        const sole = () => Math.min(at('ball_leaf_l').y, at('ball_leaf_r').y);
        const hips = (at('thigh_l').y + at('thigh_r').y) / 2;
        const scale = hipJoint / Math.max(0.1, hips - sole());

        this.holder.scale.setScalar(scale);
        this.root.updateMatrixWorld(true);

        const centre = at('pelvis');

        this.holder.position.set(-centre.x, -sole(), -centre.z);
        this.root.updateMatrixWorld(true);
    }

    /** Hangs the arms and legs straight down: the Mannequin's rest pose. */
    private calibrate(): void {
        const down = (side: number) =>
            new THREE.Vector3(side * Math.sin(ARM_OUT), -Math.cos(ARM_OUT), 0);
        const straight = new THREE.Vector3(0, -1, 0);
        const aims: [string, string, THREE.Vector3][] = [
            ['upperarm_l', 'lowerarm_l', down(1)],
            ['lowerarm_l', 'hand_l', down(1)],
            ['hand_l', 'middle_01_l', down(1)],
            ['upperarm_r', 'lowerarm_r', down(-1)],
            ['lowerarm_r', 'hand_r', down(-1)],
            ['hand_r', 'middle_01_r', down(-1)],
            ['thigh_l', 'calf_l', straight],
            ['calf_l', 'foot_l', straight],
            ['thigh_r', 'calf_r', straight],
            ['calf_r', 'foot_r', straight],
        ];
        const from = new THREE.Vector3();
        const to = new THREE.Vector3();
        const turn = new THREE.Quaternion();
        const current = new THREE.Quaternion();
        const parent = new THREE.Quaternion();

        for (const [name, childName, direction] of aims) {
            const bone = this.bones.get(name);
            const child = this.bones.get(childName);

            if (!bone || !child) {
                continue;
            }

            this.root.updateMatrixWorld(true);
            this.positionInFigure(bone, from);
            this.positionInFigure(child, to);
            turn.setFromUnitVectors(to.sub(from).normalize(), direction);
            this.inFigure(bone, current).premultiply(turn);
            this.inFigure(bone.parent!, parent);
            bone.quaternion.copy(parent.invert().multiply(current));
        }

        this.root.updateMatrixWorld(true);
    }

    /**
     * Works out, per hand, which way the fingers curl: toward the palm,
     * the side the thumb is on.
     */
    private findFingers(): void {
        for (const [side, s] of [
            ['left', 'l'],
            ['right', 'r'],
        ] as const) {
            const at = (name: string) =>
                this.positionInFigure(this.bone(name), new THREE.Vector3());
            const wrist = at(`hand_${s}`);
            const along = at(`middle_01_${s}`).sub(wrist).normalize();
            const across = at(`pinky_01_${s}`).sub(at(`index_01_${s}`));
            const palm = new THREE.Vector3()
                .crossVectors(along, across)
                .normalize();

            if (palm.dot(at(`thumb_03_${s}`).sub(wrist)) < 0) {
                palm.negate();
            }

            const axis = new THREE.Vector3()
                .crossVectors(along, palm)
                .normalize();
            const add = (name: string, amount: number) => {
                const bone = this.bones.get(name);

                if (!bone) {
                    return;
                }

                const world = this.inFigure(bone, new THREE.Quaternion());

                this.fingers.push({
                    bone,
                    rest: bone.quaternion.clone(),
                    axis: axis.clone().applyQuaternion(world.invert()),
                    amount,
                    side,
                });
            };

            for (const finger of FINGERS) {
                KNUCKLES.forEach((amount, k) =>
                    add(`${finger}_0${k + 1}_${s}`, amount),
                );
            }

            add(`thumb_02_${s}`, 0.35);
            add(`thumb_03_${s}`, 0.45);
        }
    }
}
