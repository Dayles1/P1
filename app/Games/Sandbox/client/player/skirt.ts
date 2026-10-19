/**
 * A skirt the legs push aside: panels hung from the hips all round
 * (bones `skirt_0`… with a `_lower` half bending again at the knees),
 * each swung out just as far as it takes to stay outside the legs.
 *
 * At load every panel's cloth is measured: how far out it hangs (the
 * angle from straight down at its pivot) at each distance from the
 * pivot. Every frame points along each thigh and shin, with the leg's
 * thickness there, are checked against that: a point further out than
 * the cloth at its distance swings the panel out to clear it. The upper
 * half clears the leg down to about the knee, the lower half (hung from
 * where the upper one has swung to) what is below its pivot; under a
 * raised knee the cloth drapes back down part of the way. Leaning, lying
 * or swimming, the panels hang toward the ground. When the leg goes back,
 * the panel eases back down instead of snapping.
 *
 * Everything is worked out in the pelvis' own space: the skirt bones hang
 * from it, and at rest it lines up with the model's.
 */

import * as THREE from 'three';

/** Extra room (radians) a panel keeps from a leg pushing it. */
const MARGIN = 0.08;
/** The share of the upper half's swing the lower half keeps (the rest drapes down). */
const DRAPE = 0.45;
/** How fast a panel settles back once the leg lets go (per second). */
const SETTLE = 9;
/** How much of the way toward the ground a panel hangs when the body leans or lies (the cloth is a little stiff). */
const HANG = 0.85;
/** The share of a panel's swing its neighbours are carried along. */
const CARRY = 0.7;
/**
 * A leg pushes the panels this far round from its edge fully — every
 * panel whose cloth reaches over it (they are an eighth of a turn apart)
 * — and none past the second (radians).
 */
const PUSH_FULL = 0.45;
const PUSH_NONE = 1.2;
/** Cloth this far round from a panel's middle (radians) is measured as its own. */
const SECTOR = 0.4;
/** The measured profile's steps of distance from a pivot (m). */
const STEP = 0.025;
/** Leg points closer to a pivot than this (m) are left out (the hip joint itself). */
const NEAR = 0.07;
/** The leg's thickness (m) along the thigh (hip → knee) and the shin (knee → ankle). */
const THIGH: [number, number] = [0.095, 0.062];
const SHIN: [number, number] = [0.062, 0.045];
/** Points checked along each part of the leg. */
const SAMPLES = 6;
/** How far (m) a leg point may move from where it stands at rest before the rest error no longer counts. */
const REST_REACH = 0.15;

interface Half {
    bone: THREE.Bone;
    /** Its pivot at rest, in the pelvis' space. */
    pivot: THREE.Vector3;
    /** Per distance step: the least angle out its cloth hangs at. */
    profile: Map<number, number>;
    /**
     * Per leg point: what the measure makes of it at rest, standing
     * straight (where the cloth clearly clears it) — taken off later, so
     * the rough round-leg measure is only trusted for what changes.
     */
    rest: number[];
    angle: number;
}

interface Panel {
    upper: Half;
    lower: Half | null;
    /** Outward, level, in the pelvis' space; and the axis that swings it out. */
    out: THREE.Vector3;
    axis: THREE.Vector3;
    /** The upper half answers for the leg this far from its pivot (to about the knee). */
    upperReach: number;
}

interface Leg {
    thigh: THREE.Bone;
    calf: THREE.Bone;
    foot: THREE.Bone;
}

/** A point of a leg (pelvis space), where it is standing straight, and how thick the leg is there. */
interface LegPoint {
    at: THREE.Vector3;
    restAt: THREE.Vector3;
    radius: number;
}

const DOWN = new THREE.Vector3(0, -1, 0);

/** How far round (radians) an offset from a pivot is from a way out, and how far out it reaches. */
function bearing(
    offset: THREE.Vector3,
    out: THREE.Vector3,
): { apart: number; angle: number } {
    const across = Math.hypot(offset.x, offset.z);
    const facing =
        across > 1e-4 ? (offset.x * out.x + offset.z * out.z) / across : 1;

    return {
        apart: Math.acos(THREE.MathUtils.clamp(facing, -1, 1)),
        angle: Math.atan2(across, offset.dot(DOWN)),
    };
}

export class Skirt {
    private panels: Panel[] = [];
    private points: LegPoint[] = [];
    private gravity = new THREE.Vector3();
    private hip = new THREE.Vector3();
    private knee = new THREE.Vector3();
    private ankle = new THREE.Vector3();
    private pivot = new THREE.Vector3();
    private offset = new THREE.Vector3();
    private turn = new THREE.Quaternion();

    /** The skirt of a model, or null when it has none. */
    static find(
        bones: Map<string, THREE.Bone>,
        model: THREE.Object3D,
    ): Skirt | null {
        const pelvis = bones.get('pelvis');
        const leg = (s: string): Leg | null => {
            const thigh = bones.get(`thigh_${s}`);
            const calf = bones.get(`calf_${s}`);
            const foot = bones.get(`foot_${s}`);

            return thigh && calf && foot ? { thigh, calf, foot } : null;
        };
        const left = leg('l');
        const right = leg('r');

        if (!pelvis || !left || !right || !bones.has('skirt_0')) {
            return null;
        }

        return new Skirt(bones, model, pelvis, [left, right]);
    }

    private constructor(
        bones: Map<string, THREE.Bone>,
        model: THREE.Object3D,
        private pelvis: THREE.Bone,
        private legs: Leg[],
    ) {
        for (let k = 0; bones.has(`skirt_${k}`); k++) {
            const upperBone = bones.get(`skirt_${k}`)!;
            const lowerBone = bones.get(`skirt_${k}_lower`) ?? null;
            const half = (bone: THREE.Bone, pivot: THREE.Vector3): Half => ({
                bone,
                pivot,
                profile: new Map(),
                rest: [],
                angle: 0,
            });
            // A panel faces out the way its lower half hangs from the upper one.
            const out = (lowerBone ?? upperBone).position
                .clone()
                .setY(0)
                .normalize();

            this.panels.push({
                upper: half(upperBone, upperBone.position.clone()),
                lower: lowerBone
                    ? half(
                          lowerBone,
                          lowerBone.position.clone().add(upperBone.position),
                      )
                    : null,
                out,
                axis: new THREE.Vector3().crossVectors(DOWN, out).normalize(),
                upperReach: lowerBone
                    ? lowerBone.position.length() + 0.05
                    : Infinity,
            });
        }

        for (let i = 0; i < legs.length * SAMPLES * 2; i++) {
            this.points.push({
                at: new THREE.Vector3(),
                restAt: new THREE.Vector3(),
                radius: 0,
            });
        }

        this.measure(model);

        // The legs stand straight now: what each point seems to need is the
        // measure's own error.
        this.placePoints();

        for (const point of this.points) {
            point.restAt.copy(point.at);
        }

        for (const { upper, lower, out, upperReach } of this.panels) {
            this.points.forEach((_, i) => {
                upper.rest[i] = Math.max(
                    0,
                    this.need(i, upper, upper.pivot, out, upperReach, false),
                );

                if (lower) {
                    lower.rest[i] = Math.max(
                        0,
                        this.need(i, lower, lower.pivot, out, Infinity, true),
                    );
                }
            });
        }
    }

    /**
     * Swings the panels clear of the legs, `dt` seconds on. Call once the
     * leg bones are posed.
     */
    update(dt: number): void {
        const settle = 1 - Math.exp(-SETTLE * dt);

        // Which way is down in the world, in the pelvis' space: lying or
        // leaning, the cloth hangs that way.
        this.pelvis.getWorldQuaternion(this.turn).invert();
        this.gravity.copy(DOWN).applyQuaternion(this.turn);
        this.placePoints();

        // The upper halves first: hanging toward the ground (where that is
        // outward for the panel) or pushed out by a leg.
        const hang = this.panels.map(
            ({ out }) =>
                HANG *
                Math.max(
                    0,
                    Math.atan2(this.gravity.dot(out), this.gravity.dot(DOWN)),
                ),
        );
        const upperTargets = this.spread(
            this.panels.map((panel, k) =>
                Math.max(
                    hang[k],
                    this.clearance(
                        panel.upper,
                        panel.upper.pivot,
                        panel.out,
                        panel.upperReach,
                        false,
                    ),
                ),
            ),
        );

        this.panels.forEach(({ upper, axis }, k) => {
            this.ease(upper, upperTargets[k], settle);
            upper.bone.quaternion.setFromAxisAngle(axis, upper.angle);
        });

        // Then the lower halves, hung from where the upper ones swung to.
        const lowerTargets = this.spread(
            this.panels.map(({ upper, lower, out, axis }, k) => {
                if (!lower) {
                    return 0;
                }

                this.turn.setFromAxisAngle(axis, upper.angle);
                this.pivot
                    .copy(lower.bone.position)
                    .applyQuaternion(this.turn)
                    .add(upper.pivot);

                return Math.max(
                    upper.angle * DRAPE,
                    hang[k],
                    this.clearance(lower, this.pivot, out, Infinity, true),
                );
            }),
        );

        this.panels.forEach(({ upper, lower, axis }, k) => {
            if (lower) {
                this.ease(lower, lowerTargets[k], settle);
                lower.bone.quaternion.setFromAxisAngle(
                    axis,
                    lower.angle - upper.angle,
                );
            }
        });

        this.pelvis.updateMatrixWorld(true);
    }

    /**
     * Cloth is one piece: a panel swung out carries its neighbours some of
     * the way (round the ring), so the skirt flares as a bell and its
     * overlapping folds don't part.
     */
    private spread(angles: number[]): number[] {
        const count = angles.length;

        return angles.map((angle, k) =>
            Math.max(
                angle,
                CARRY *
                    Math.max(
                        angles[(k + 1) % count],
                        angles[(k + count - 1) % count],
                    ),
            ),
        );
    }

    /** Points along each thigh and shin where the leg bones are now, in the pelvis' space. */
    private placePoints(): void {
        let n = 0;

        for (const leg of this.legs) {
            this.local(leg.thigh, this.hip);
            this.local(leg.calf, this.knee);
            this.local(leg.foot, this.ankle);

            for (let s = 1; s <= SAMPLES; s++) {
                const t = s / SAMPLES;
                const thigh = this.points[n++];
                const shin = this.points[n++];

                thigh.at.lerpVectors(this.hip, this.knee, t);
                thigh.radius = THREE.MathUtils.lerp(THIGH[0], THIGH[1], t);
                shin.at.lerpVectors(this.knee, this.ankle, t);
                shin.radius = THREE.MathUtils.lerp(SHIN[0], SHIN[1], t);
            }
        }
    }

    /**
     * How far out (radians from rest) a half must swing to keep its cloth
     * outside the legs: the most any leg point needs, beyond what it
     * seemed to need standing straight.
     */
    private clearance(
        half: Half,
        pivot: THREE.Vector3,
        out: THREE.Vector3,
        reach: number,
        below: boolean,
    ): number {
        let need = 0;

        for (let i = 0; i < this.points.length; i++) {
            const { at, restAt } = this.points[i];
            // The rest error holds near the rest pose only.
            const still = 1 - Math.min(1, at.distanceTo(restAt) / REST_REACH);

            need = Math.max(
                need,
                this.need(i, half, pivot, out, reach, below) -
                    half.rest[i] * still,
            );
        }

        return need;
    }

    /**
     * How far out a half must swing to keep its cloth outside one leg
     * point: how far the point (and the leg's thickness round it) stands
     * out past the cloth at its distance from the pivot, for the panels
     * whose cloth reaches over it. -Infinity when it is out of the half's
     * reach (too near the pivot, too far, beyond the hem; above the pivot
     * when only points `below` count).
     */
    private need(
        index: number,
        half: Half,
        pivot: THREE.Vector3,
        out: THREE.Vector3,
        reach: number,
        below: boolean,
    ): number {
        const { at, radius } = this.points[index];
        const offset = this.offset.subVectors(at, pivot);
        const distance = offset.length();
        const rest = half.profile.get(Math.round(distance / STEP));

        if (
            distance < NEAR ||
            distance > reach ||
            rest === undefined ||
            (below && offset.dot(DOWN) < 0)
        ) {
            return -Infinity;
        }

        const { apart, angle } = bearing(offset, out);
        // The leg is round: as wide round as it is thick, seen from the pivot.
        const width = Math.asin(
            Math.min(
                1,
                radius / Math.max(radius, Math.hypot(offset.x, offset.z)),
            ),
        );
        const share =
            1 - THREE.MathUtils.smoothstep(apart - width, PUSH_FULL, PUSH_NONE);

        if (share <= 0) {
            return -Infinity;
        }

        const clear =
            angle + Math.asin(Math.min(1, radius / distance)) + MARGIN;

        return (clear - rest) * share;
    }

    /** Pushed out at once (or the leg would show through); back down gently. */
    private ease(half: Half, target: number, settle: number): void {
        half.angle =
            target > half.angle
                ? target
                : half.angle + (target - half.angle) * settle;
    }

    /**
     * Measures each half's cloth at rest: per distance from its pivot, the
     * least angle out the cloth round its middle hangs at.
     */
    private measure(model: THREE.Object3D): void {
        const point = new THREE.Vector3();
        const pelvisRest = new THREE.Matrix4();

        model.traverse((object) => {
            if (!(object instanceof THREE.SkinnedMesh)) {
                return;
            }

            const skeleton = object.skeleton;
            const pelvisIndex = skeleton.bones.indexOf(this.pelvis);
            const skirtBones = new Set<number>();

            skeleton.bones.forEach((bone, index) => {
                if (bone.name.startsWith('skirt_')) {
                    skirtBones.add(index);
                }
            });

            if (pelvisIndex < 0 || skirtBones.size === 0) {
                return;
            }

            // Into the pelvis' own space at rest.
            pelvisRest
                .copy(skeleton.boneInverses[pelvisIndex])
                .multiply(object.bindMatrix);

            const position = object.geometry.getAttribute('position');
            const joints = object.geometry.getAttribute('skinIndex');
            const weights = object.geometry.getAttribute('skinWeight');

            for (let i = 0; i < position.count; i++) {
                let onSkirt = 0;

                for (let k = 0; k < 4; k++) {
                    if (skirtBones.has(joints.getComponent(i, k))) {
                        onSkirt += weights.getComponent(i, k);
                    }
                }

                if (onSkirt < 0.3) {
                    continue;
                }

                point.fromBufferAttribute(position, i).applyMatrix4(pelvisRest);

                for (const { upper, lower, out } of this.panels) {
                    for (const half of lower ? [upper, lower] : [upper]) {
                        const offset = this.offset.subVectors(
                            point,
                            half.pivot,
                        );

                        if (half === lower && offset.dot(DOWN) < 0) {
                            continue;
                        }

                        const { apart, angle } = bearing(offset, out);

                        if (apart > SECTOR) {
                            continue;
                        }

                        const step = Math.round(offset.length() / STEP);
                        const known = half.profile.get(step);

                        half.profile.set(
                            step,
                            known === undefined
                                ? angle
                                : Math.min(known, angle),
                        );
                    }
                }
            }
        });
    }

    /** A bone's joint in the pelvis' space. */
    private local(bone: THREE.Bone, out: THREE.Vector3): THREE.Vector3 {
        return this.pelvis.worldToLocal(bone.getWorldPosition(out));
    }
}
