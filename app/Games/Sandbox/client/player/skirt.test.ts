import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Skirt } from './skirt';

/** Panels round the hips in the test model, as in the Sci-Fi Girl's. */
const PANELS = 12;
const STEP = 1 / 60;

/**
 * A pair of legs under an A-line skirt: the Sci-Fi Girl's bones (pelvis,
 * legs, a skirt of panels each with a lower half), and a cone of cloth
 * round the legs skinned to the panels.
 */
function skirtedLegs(withSkirt = true) {
    const model = new THREE.Group();
    const bones = new Map<string, THREE.Bone>();
    const bone = (
        name: string,
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
    ) => {
        const made = new THREE.Bone();

        made.name = name;
        made.position.set(x, y, z);
        parent.add(made);
        bones.set(name, made);

        return made;
    };
    const root = bone('root', model, 0, 0, 0);
    const pelvis = bone('pelvis', root, 0, 0.873, -0.035);

    for (const [s, side] of [
        ['l', 1],
        ['r', -1],
    ] as const) {
        const thigh = bone(`thigh_${s}`, pelvis, side * 0.084, 0.012, 0.007);
        const calf = bone(`calf_${s}`, thigh, 0, -0.38, 0);

        bone(`foot_${s}`, calf, 0, -0.43, 0);
    }

    if (withSkirt) {
        for (let k = 0; k < PANELS; k++) {
            const angle = (k / PANELS) * Math.PI * 2;
            const upper = bone(
                `skirt_${k}`,
                pelvis,
                0.084 * Math.sin(angle),
                0.012,
                0.007,
            );

            bone(
                `skirt_${k}_lower`,
                upper,
                0.05 * Math.sin(angle),
                -0.38,
                0.05 * Math.cos(angle),
            );
        }
    }

    model.updateMatrixWorld(true);

    const ordered = [...bones.values()];
    const positions: number[] = [];
    const indices: number[] = [];
    const weights: number[] = [];

    // Rings of cloth from the hips (radius 0.15) flaring to the hem (0.24).
    for (let ring = 0; ring <= 10; ring++) {
        const y = 0.93 - ring * 0.055;
        const radius = 0.15 + ring * 0.009;

        for (let n = 0; n < 48; n++) {
            const angle = (n / 48) * Math.PI * 2;
            const panel = Math.round((angle / (Math.PI * 2)) * PANELS) % PANELS;
            const name = withSkirt
                ? `skirt_${panel}${y < 0.5 ? '_lower' : ''}`
                : 'pelvis';

            positions.push(
                radius * Math.sin(angle),
                y,
                radius * Math.cos(angle) - 0.02,
            );
            indices.push(ordered.indexOf(bones.get(name)!), 0, 0, 0);
            weights.push(1, 0, 0, 0);
        }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
        'skinIndex',
        new THREE.Uint16BufferAttribute(indices, 4),
    );
    geometry.setAttribute(
        'skinWeight',
        new THREE.Float32BufferAttribute(weights, 4),
    );

    const cloth = new THREE.SkinnedMesh(
        geometry,
        new THREE.MeshBasicMaterial(),
    );

    model.add(cloth);
    model.updateMatrixWorld(true);
    cloth.bind(new THREE.Skeleton(ordered));

    return { model, bones, skirt: Skirt.find(bones, model) };
}

/** How far a bone is turned from its rest (radians). */
function turn(bone: THREE.Bone): number {
    return 2 * Math.acos(Math.min(1, Math.abs(bone.quaternion.w)));
}

/** Runs the skirt for a while. */
function settle(skirt: Skirt, seconds: number): void {
    for (let t = 0; t < seconds; t += STEP) {
        skirt.update(STEP);
    }
}

describe('Skirt', () => {
    it('is only made for a model with skirt bones', () => {
        expect(skirtedLegs(false).skirt).toBeNull();
        expect(skirtedLegs().skirt).toBeInstanceOf(Skirt);
    });

    it('hangs straight down while the legs stand straight', () => {
        const { bones, skirt } = skirtedLegs();

        settle(skirt!, 1);

        for (let k = 0; k < PANELS; k++) {
            expect(turn(bones.get(`skirt_${k}`)!)).toBeLessThan(0.05);
        }
    });

    it('swings the front out of the way of a leg striding forward, not the back', () => {
        const { model, bones, skirt } = skirtedLegs();

        // The left thigh forward (turning about X toward +Z), the knee bent back.
        bones.get('thigh_l')!.rotation.x = -1.1;
        bones.get('calf_l')!.rotation.x = 0.6;
        model.updateMatrixWorld(true);
        skirt!.update(STEP);

        expect(turn(bones.get('skirt_0')!)).toBeGreaterThan(0.6);
        expect(turn(bones.get(`skirt_${PANELS / 2}`)!)).toBeLessThan(0.05);
    });

    it('keeps the cloth outside a leg raised high', () => {
        const { model, bones, skirt } = skirtedLegs();
        const cloth = model.children.find(
            (child): child is THREE.SkinnedMesh =>
                child instanceof THREE.SkinnedMesh,
        )!;

        bones.get('thigh_l')!.rotation.x = -1.3;
        bones.get('calf_l')!.rotation.x = 1.2;
        model.updateMatrixWorld(true);
        skirt!.update(STEP);
        model.updateMatrixWorld(true);

        const at = (name: string) =>
            bones.get(name)!.getWorldPosition(new THREE.Vector3());
        const hip = at('thigh_l');
        const knee = at('calf_l');
        const ankle = at('foot_l');
        const thigh = new THREE.Line3(hip, knee);
        const shin = new THREE.Line3(knee, ankle);
        const point = new THREE.Vector3();
        const nearest = new THREE.Vector3();
        let closest = Infinity;

        // Where the cloth is now, against the leg's middle line.
        for (
            let i = 0;
            i < cloth.geometry.getAttribute('position').count;
            i++
        ) {
            point.fromBufferAttribute(
                cloth.geometry.getAttribute('position'),
                i,
            );
            cloth.applyBoneTransform(i, point);

            // Skip the cloth at the hip itself, which the leg turns under.
            if (point.distanceTo(hip) < 0.12) {
                continue;
            }

            closest = Math.min(
                closest,
                point.distanceTo(
                    thigh.closestPointToPoint(point, true, nearest),
                ),
                point.distanceTo(
                    shin.closestPointToPoint(point, true, nearest),
                ),
            );
        }

        // Further from the leg's middle than the leg is thick.
        expect(closest).toBeGreaterThan(0.05);
    });

    it('hangs toward the ground when the body lies face down', () => {
        const { model, bones, skirt } = skirtedLegs();

        bones.get('pelvis')!.rotation.x = Math.PI / 2;
        model.updateMatrixWorld(true);
        settle(skirt!, 1);

        expect(turn(bones.get('skirt_0')!)).toBeGreaterThan(1.1);
        expect(turn(bones.get(`skirt_${PANELS / 2}`)!)).toBeLessThan(0.3);
    });

    it('settles back down gently once the leg goes back', () => {
        const { model, bones, skirt } = skirtedLegs();
        const front = bones.get('skirt_0')!;

        bones.get('thigh_l')!.rotation.x = -1.1;
        model.updateMatrixWorld(true);
        skirt!.update(STEP);

        const pushed = turn(front);

        bones.get('thigh_l')!.rotation.x = 0;
        model.updateMatrixWorld(true);
        skirt!.update(STEP);

        // Not snapped back in one frame…
        expect(turn(front)).toBeGreaterThan(pushed * 0.7);

        // …but down again within a second.
        settle(skirt!, 1);
        expect(turn(front)).toBeLessThan(0.05);
    });
});
