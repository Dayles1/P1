/**
 * The creatures' figures: low-poly animals (deer, boar, wolf) on four legs
 * and the night's dead on two, each facing +Z with the feet at the
 * origin. Every figure gets its own materials so a blow can flash it.
 *
 * `animate` moves the legs in step with the ground speed, bobs the body
 * and lunges forward for a bite or a swipe.
 */

import * as THREE from 'three';

export type MobType = 'deer' | 'boar' | 'wolf' | 'zombie';

export interface MobModel {
    root: THREE.Group;
    body: THREE.Group;
    head: THREE.Group;
    legs: THREE.Group[];
    arms: THREE.Group[];
    tail: THREE.Group | null;
    materials: THREE.MeshStandardMaterial[];
    /** Health bar over the head: the fill is scaled along X. */
    bar: THREE.Group;
    barFill: THREE.Mesh;
    /** Leg length, for the stride. */
    stride: number;
}

const BAR_BACK = new THREE.MeshBasicMaterial({
    color: 0x1d2126,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
});

function material(
    model: MobModel,
    color: number,
    extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
    const made = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        flatShading: true,
        ...extra,
    });
    model.materials.push(made);

    return made;
}

function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
): THREE.Mesh {
    const made = new THREE.Mesh(geometry, material);
    made.position.set(x, y, z);
    made.castShadow = true;

    return made;
}

function box(width: number, height: number, depth: number) {
    return new THREE.BoxGeometry(width, height, depth);
}

/** A leg hanging from its hip: upper and lower part and a hoof or paw. */
function leg(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    length: number,
    radius: number,
    color: THREE.Material,
    foot: THREE.Material,
): THREE.Group {
    const hip = new THREE.Group();
    hip.position.set(x, y, z);
    const upper = mesh(
        new THREE.CylinderGeometry(radius * 1.3, radius, length * 0.55, 6),
        color,
        0,
        -length * 0.27,
        0,
    );
    const lower = mesh(
        new THREE.CylinderGeometry(radius, radius * 0.8, length * 0.5, 6),
        color,
        0,
        -length * 0.75,
        0,
    );
    const end = mesh(
        box(radius * 2.2, length * 0.1, radius * 2.6),
        foot,
        0,
        -length * 0.97,
        radius * 0.3,
    );
    hip.add(upper, lower, end);
    parent.add(hip);

    return hip;
}

function healthBar(model: MobModel, height: number): void {
    model.bar.position.y = height + 0.35;
    model.bar.visible = false;
    model.bar.renderOrder = 3;

    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), BAR_BACK);
    const fillGeometry = new THREE.PlaneGeometry(0.76, 0.06);
    fillGeometry.translate(0.38, 0, 0.001);
    model.barFill.geometry = fillGeometry;
    model.barFill.material = new THREE.MeshBasicMaterial({
        color: 0xd9534f,
        depthWrite: false,
    });
    model.barFill.position.x = -0.38;
    model.bar.add(back, model.barFill);
    model.root.add(model.bar);
}

function blank(): MobModel {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    return {
        root,
        body,
        head: new THREE.Group(),
        legs: [],
        arms: [],
        tail: null,
        materials: [],
        bar: new THREE.Group(),
        barFill: new THREE.Mesh(),
        stride: 0.5,
    };
}

interface Quadruped {
    /** Body width, height, length. */
    size: [number, number, number];
    legLength: number;
    legRadius: number;
    fur: number;
    belly: number;
    feet: number;
    headSize: [number, number, number];
    /** Head joint, from the body's front-top. */
    neck: [number, number];
    snout: [number, number];
}

function quadruped(look: Quadruped): MobModel {
    const model = blank();
    const [width, height, length] = look.size;
    const fur = material(model, look.fur);
    const belly = material(model, look.belly);
    const feet = material(model, look.feet);
    const top = look.legLength + height / 2;

    model.body.position.y = top;
    const torso = mesh(box(width, height, length), fur);
    const under = mesh(
        box(width * 0.86, height * 0.3, length * 0.8),
        belly,
        0,
        -height * 0.4,
        0,
    );
    model.body.add(torso, under);

    model.head.position.set(0, look.neck[1], length / 2 + look.neck[0]);
    const [headWidth, headHeight, headLength] = look.headSize;
    model.head.add(
        mesh(box(headWidth, headHeight, headLength), fur),
        mesh(
            box(headWidth * 0.6, headHeight * 0.55, look.snout[0]),
            belly,
            0,
            -headHeight * 0.18,
            headLength / 2 + look.snout[0] / 2 - 0.01,
        ),
        mesh(
            box(headWidth * 0.3, headHeight * 0.22, 0.04),
            feet,
            0,
            -headHeight * 0.05 + look.snout[1],
            headLength / 2 + look.snout[0],
        ),
    );
    model.body.add(model.head);

    const legY = -height / 2 + 0.02;
    const legX = width / 2 - look.legRadius * 1.4;
    const legZ = length / 2 - look.legRadius * 2;

    for (const [x, z] of [
        [legX, legZ],
        [-legX, legZ],
        [legX, -legZ],
        [-legX, -legZ],
    ]) {
        model.legs.push(
            leg(
                model.body,
                x,
                legY,
                z,
                look.legLength + 0.02,
                look.legRadius,
                fur,
                feet,
            ),
        );
    }

    model.stride = look.legLength;
    healthBar(model, top + height / 2 + look.neck[1]);

    return model;
}

function deer(): MobModel {
    const model = quadruped({
        size: [0.42, 0.48, 1.05],
        legLength: 0.78,
        legRadius: 0.045,
        fur: 0xa8784e,
        belly: 0xe6d3b5,
        feet: 0x3b3029,
        headSize: [0.2, 0.22, 0.3],
        neck: [0.05, 0.5],
        snout: [0.14, 0],
    });
    const fur = model.materials[0];
    const antler = material(model, 0xd9c7a6);
    const neck = mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6),
        fur,
        0,
        0.24,
        0.48,
    );
    neck.rotation.x = 0.45;
    model.body.add(neck);

    for (const side of [1, -1]) {
        const beam = mesh(
            new THREE.CylinderGeometry(0.016, 0.022, 0.36, 5),
            antler,
            side * 0.1,
            0.24,
            -0.02,
        );
        beam.rotation.z = -side * 0.5;
        const tine = mesh(
            new THREE.CylinderGeometry(0.012, 0.016, 0.2, 5),
            antler,
            side * 0.16,
            0.3,
            0.06,
        );
        tine.rotation.set(0.6, 0, -side * 0.2);
        const ear = mesh(box(0.12, 0.05, 0.04), fur, side * 0.14, 0.1, -0.06);
        ear.rotation.z = side * 0.4;
        model.head.add(beam, tine, ear);
    }

    model.tail = new THREE.Group();
    model.tail.position.set(0, 0.16, -0.53);
    model.tail.add(
        mesh(box(0.1, 0.16, 0.06), model.materials[1], 0, -0.06, -0.02),
    );
    model.body.add(model.tail);

    return model;
}

function boar(): MobModel {
    const model = quadruped({
        size: [0.5, 0.52, 0.92],
        legLength: 0.36,
        legRadius: 0.06,
        fur: 0x5c4635,
        belly: 0x7a6250,
        feet: 0x2c241e,
        headSize: [0.34, 0.34, 0.34],
        neck: [0.12, 0.02],
        snout: [0.16, -0.04],
    });
    const fur = model.materials[0];
    const tusk = material(model, 0xf1ead9);
    model.head.rotation.x = 0.25;

    for (const side of [1, -1]) {
        const point = mesh(
            new THREE.ConeGeometry(0.025, 0.14, 5),
            tusk,
            side * 0.1,
            -0.1,
            0.3,
        );
        point.rotation.x = -0.6;
        const ear = mesh(box(0.08, 0.1, 0.03), fur, side * 0.13, 0.2, -0.08);
        ear.rotation.z = side * 0.5;
        model.head.add(point, ear);
    }

    // A bristly ridge along the back.
    model.body.add(mesh(box(0.1, 0.1, 0.8), fur, 0, 0.3, 0));
    model.tail = new THREE.Group();
    model.tail.position.set(0, 0.15, -0.47);
    model.tail.add(
        mesh(
            new THREE.CylinderGeometry(0.015, 0.02, 0.18, 4),
            fur,
            0,
            -0.08,
            0,
        ),
    );
    model.body.add(model.tail);

    return model;
}

function wolf(): MobModel {
    const model = quadruped({
        size: [0.3, 0.36, 0.9],
        legLength: 0.5,
        legRadius: 0.045,
        fur: 0x7d7f84,
        belly: 0xc9c9c6,
        feet: 0x4a4b4f,
        headSize: [0.24, 0.22, 0.26],
        neck: [0.1, 0.18],
        snout: [0.16, -0.02],
    });
    const fur = model.materials[0];
    const eye = material(model, 0xffd76a, {
        emissive: 0xffc23a,
        emissiveIntensity: 0.4,
    });

    for (const side of [1, -1]) {
        model.head.add(
            mesh(
                new THREE.ConeGeometry(0.05, 0.12, 4),
                fur,
                side * 0.08,
                0.15,
                -0.05,
            ),
            mesh(box(0.04, 0.03, 0.02), eye, side * 0.07, 0.04, 0.13),
        );
    }

    model.body.add(mesh(box(0.34, 0.3, 0.3), fur, 0, 0.04, 0.32));
    model.tail = new THREE.Group();
    model.tail.position.set(0, 0.1, -0.45);
    const brush = mesh(
        new THREE.CylinderGeometry(0.05, 0.07, 0.42, 6),
        fur,
        0,
        0,
        -0.18,
    );
    brush.rotation.x = Math.PI / 2 + 0.5;
    model.tail.add(brush);
    model.body.add(model.tail);

    return model;
}

/** The dead that walk at night: a stooped, ragged figure, arms out. */
function zombie(): MobModel {
    const model = blank();
    const skin = material(model, 0x8a9a7b);
    const shirt = material(model, 0x5a6170);
    const trousers = material(model, 0x3d3a44);
    const eye = material(model, 0xff6a4a, {
        emissive: 0xff4422,
        emissiveIntensity: 1.2,
    });

    model.body.position.y = 0.95;
    model.body.add(
        mesh(box(0.42, 0.62, 0.24), shirt, 0, 0.36, 0),
        mesh(box(0.38, 0.14, 0.22), trousers, 0, 0.02, 0),
    );

    model.head.position.set(0, 0.78, 0.04);
    model.head.add(
        mesh(box(0.26, 0.28, 0.26), skin, 0, 0.12, 0),
        mesh(box(0.05, 0.035, 0.02), eye, 0.065, 0.14, 0.135),
        mesh(box(0.05, 0.035, 0.02), eye, -0.065, 0.14, 0.135),
    );
    model.body.add(model.head);

    for (const side of [1, -1]) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.28, 0.6, 0);
        shoulder.add(
            mesh(box(0.13, 0.36, 0.13), shirt, 0, -0.15, 0),
            mesh(box(0.11, 0.32, 0.11), skin, 0, -0.46, 0),
        );
        model.body.add(shoulder);
        model.arms.push(shoulder);

        const hip = new THREE.Group();
        hip.position.set(side * 0.11, -0.04, 0);
        hip.add(
            mesh(box(0.15, 0.5, 0.15), trousers, 0, -0.24, 0),
            mesh(box(0.14, 0.42, 0.14), trousers, 0, -0.66, 0),
            mesh(box(0.15, 0.08, 0.24), skin, 0, -0.9, 0.04),
        );
        model.body.add(hip);
        model.legs.push(hip);
    }

    model.stride = 0.9;
    healthBar(model, 1.9);

    return model;
}

export function createMobModel(type: MobType): MobModel {
    switch (type) {
        case 'deer':
            return deer();
        case 'boar':
            return boar();
        case 'wolf':
            return wolf();
        case 'zombie':
            return zombie();
    }
}

export interface MobPose {
    /** Ground speed, m/s. */
    speed: number;
    /** Walk-cycle phase, 0…1, advanced by the caller. */
    phase: number;
    /** 0…1 through an attack (lunge), or null. */
    attack: number | null;
    /** 0…1 how far it has keeled over. */
    dying: number;
    time: number;
}

export function animateMob(
    model: MobModel,
    type: MobType,
    pose: MobPose,
): void {
    const moving = Math.min(1, pose.speed / 1.2);
    const swing = Math.sin(pose.phase * Math.PI * 2) * 0.6 * moving;
    const lunge = pose.attack === null ? 0 : Math.sin(Math.PI * pose.attack);

    if (type === 'zombie') {
        const [left, right] = model.legs;
        left.rotation.x = swing * 0.8;
        right.rotation.x = -swing * 0.8;
        model.arms.forEach((arm, index) => {
            arm.rotation.x =
                -1.35 -
                lunge * 0.5 +
                Math.sin(pose.time * 2 + index * 1.7) * 0.08;
            arm.rotation.z = (index ? -1 : 1) * 0.08;
        });
        model.body.rotation.x = 0.18 + lunge * 0.2;
        model.body.rotation.z = Math.sin(pose.time * 1.3) * 0.05;
        model.head.rotation.z = Math.sin(pose.time * 0.9) * 0.15;
    } else {
        const [frontLeft, frontRight, backLeft, backRight] = model.legs;
        frontLeft.rotation.x = swing;
        backRight.rotation.x = swing;
        frontRight.rotation.x = -swing;
        backLeft.rotation.x = -swing;
        model.body.rotation.x = -lunge * 0.15;
        model.body.position.z = lunge * 0.25;
        model.head.rotation.x =
            (type === 'boar' ? 0.25 : 0) +
            lunge * 0.35 +
            Math.sin(pose.time * 1.1) * 0.05 * (1 - moving);

        if (model.tail) {
            model.tail.rotation.y = Math.sin(pose.time * 6) * 0.25 * moving;
        }
    }

    const bob = Math.abs(Math.sin(pose.phase * Math.PI * 2)) * 0.03 * moving;
    model.root.rotation.z = pose.dying * (Math.PI / 2);
    model.root.position.y += bob - pose.dying * 0.15;
}

/** Tints the figure red for a moment after a blow (0 = normal). */
export function flashMob(model: MobModel, amount: number): void {
    for (const made of model.materials) {
        if (!made.userData.base) {
            made.userData.base = made.emissive.clone();
            made.userData.baseIntensity = made.emissiveIntensity;
        }

        if (amount > 0) {
            made.emissive.setRGB(0.9, 0.12, 0.08);
            made.emissiveIntensity = amount * 0.9;
        } else {
            made.emissive.copy(made.userData.base);
            made.emissiveIntensity = made.userData.baseIntensity;
        }
    }
}
