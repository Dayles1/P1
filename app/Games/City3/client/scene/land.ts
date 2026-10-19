/**
 * The land's marks in 3D (gdd §5.2, §5.3): at each edge of the player's
 * land a plaque on a post offering the next strip («+ Полоса · 4,4K ·
 * бухта», green when the treasury holds its price), and — built once, the
 * map being fixed — ore and coal outcrops on the mountain foot behind
 * their spots, tunnel portals cut into the slope, and a dark sheen on the
 * water off the oil spots. Locked strips show theirs from day one.
 */

import * as THREE from 'three';
import type { DepositKind } from '../engine/content/types';
import type { Game, LandOffer } from '../engine/sim/game';
import type { Side } from '../engine/world/land';
import { mountainHeight } from './backdrop';
import { color, hash3 } from './colors';
import { WATER_Y } from './terrain';
import type { Terrain } from './terrain';

const SIDES: Side[] = ['west', 'east'];
/** The plaque's canvas, and its size in tiles. */
const CANVAS_W = 512;
const CANVAS_H = 176;
const PLAQUE_W = 6;
const PLAQUE_H = (PLAQUE_W * CANVAS_H) / CANVAS_W;
/** How high the plaque's middle floats over the ground. */
const PLAQUE_LIFT = 2.3;

const OUTCROPS: Record<
    Exclude<DepositKind, 'oil'>,
    { colors: string[]; metalness: number; roughness: number }
> = {
    ore: {
        colors: ['#7f4429', '#9b5a32', '#c8913f'],
        metalness: 0.35,
        roughness: 0.6,
    },
    coal: {
        colors: ['#1d1b1a', '#2c2927', '#3a3633'],
        metalness: 0.2,
        roughness: 0.35,
    },
};

/**
 * A money amount the way the game writes it (gdd §3.2): three significant
 * digits, K/M/B, a decimal comma — 4,4K, 105K, 1,2M.
 */
function money(value: number): string {
    const suffixes = ['', 'K', 'M', 'B'];
    let amount = Math.max(0, value);
    let tier = 0;

    while (
        Number(amount.toPrecision(3)) >= 1000 &&
        tier < suffixes.length - 1
    ) {
        amount /= 1000;
        tier++;
    }

    return `${String(Number(amount.toPrecision(3))).replace('.', ',')}${suffixes[tier]}`;
}

interface Plaque {
    side: Side;
    group: THREE.Group;
    sprite: THREE.Sprite;
    post: THREE.Mesh;
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    key: string;
    /** The plaque's middle, before the bobbing. */
    x: number;
    y: number;
    z: number;
}

export class LandMarks {
    readonly group = new THREE.Group();

    private plaques: Plaque[];
    private postMaterial = new THREE.MeshStandardMaterial({
        color: color('#6b4a2c'),
        roughness: 0.85,
    });
    private postGeometry = new THREE.CylinderGeometry(0.07, 0.09, 1, 8);
    private disposables: { dispose(): void }[] = [];

    constructor(
        private game: Game,
        private terrain: Terrain,
    ) {
        this.plaques = SIDES.map((side) => this.makePlaque(side));
        this.buildOutcrops();
        this.buildPortals();
        this.buildOilSheens();
    }

    /** Per frame: the plaques follow the offers and bob gently. */
    update(time: number): void {
        for (const plaque of this.plaques) {
            const offer = this.game.landOffer(plaque.side);

            plaque.group.visible = offer !== null;

            if (!offer) {
                continue;
            }

            const key = `${offer.minX}:${offer.price}:${offer.affordable}:${offer.feature}`;

            if (key !== plaque.key) {
                plaque.key = key;
                this.place(plaque, offer);
                this.paint(plaque, offer);
            }

            plaque.sprite.position.y =
                plaque.y +
                Math.sin(time * 1.6 + (plaque.side === 'west' ? 0 : 1.7)) *
                    0.06;
        }
    }

    /** The side whose plaque is under a ray (set from the camera), if any. */
    pick(raycaster: THREE.Raycaster): Side | null {
        const sprites = this.plaques
            .filter((plaque) => plaque.group.visible)
            .map((plaque) => plaque.sprite);
        const hit = raycaster.intersectObjects(sprites, false)[0];

        return hit
            ? (this.plaques.find((plaque) => plaque.sprite === hit.object)
                  ?.side ?? null)
            : null;
    }

    /** Where a side's plaque stands (tile coordinates), if it is shown. */
    plaqueAt(side: Side): THREE.Vector3 | null {
        const plaque = this.plaques.find((p) => p.side === side);

        return plaque?.group.visible
            ? new THREE.Vector3(plaque.x, plaque.y, plaque.z)
            : null;
    }

    private makePlaque(side: Side): Plaque {
        const canvas = document.createElement('canvas');

        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;

        const texture = new THREE.CanvasTexture(canvas);

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;

        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                toneMapped: false,
            }),
        );

        sprite.scale.set(PLAQUE_W, PLAQUE_H, 1);
        sprite.renderOrder = 10;
        sprite.name = `strip-plaque-${side}`;

        const post = new THREE.Mesh(this.postGeometry, this.postMaterial);

        post.castShadow = true;

        const group = new THREE.Group();

        group.add(post, sprite);
        group.visible = false;
        this.group.add(group);

        return {
            side,
            group,
            sprite,
            post,
            canvas,
            texture,
            key: '',
            x: 0,
            y: 0,
            z: 0,
        };
    }

    /** Stands a plaque in the middle of its strip, level with the Town Hall. */
    private place(plaque: Plaque, offer: LandOffer): void {
        const center = this.game.center;
        const x = (offer.minX + offer.maxX + 1) / 2;
        const z = center ? center.y + 1 : this.game.layout.landRows / 2;
        const ground = this.terrain.heightAt(x, z);
        const bottom = ground + PLAQUE_LIFT - PLAQUE_H / 2;

        plaque.x = x;
        plaque.y = ground + PLAQUE_LIFT;
        plaque.z = z;
        plaque.sprite.position.set(x, plaque.y, z);
        plaque.post.scale.set(1, Math.max(0.1, bottom - ground), 1);
        plaque.post.position.set(x, (ground + bottom) / 2, z);
    }

    /** «+ Полоса» over «4,4K · бухта»: green when it can be paid, slate when not. */
    private paint(plaque: Plaque, offer: LandOffer): void {
        const ctx = plaque.canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        const pad = 10;
        const radius = 34;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.beginPath();
        ctx.roundRect(pad, pad, CANVAS_W - pad * 2, CANVAS_H - pad * 2, radius);
        ctx.fillStyle = offer.affordable
            ? 'rgba(38, 122, 66, 0.92)'
            : 'rgba(44, 50, 62, 0.88)';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = offer.affordable
            ? '#ffe08a'
            : 'rgba(255, 224, 138, 0.55)';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 58px system-ui, "Segoe UI", sans-serif';
        ctx.fillText('+ Полоса', CANVAS_W / 2, 64);

        const line = [money(offer.price), offer.feature]
            .filter(Boolean)
            .join(' · ');

        ctx.fillStyle = offer.affordable ? '#fff1b8' : '#d9dee8';
        ctx.font = `600 ${line.length > 24 ? 34 : 40}px system-ui, "Segoe UI", sans-serif`;
        ctx.fillText(line, CANVAS_W / 2, 126, CANVAS_W - pad * 4);
        plaque.texture.needsUpdate = true;
    }

    /** Ore and coal showing through the mountain foot behind their spots. */
    private buildOutcrops(): void {
        const spots = this.game.content.world.map.deposits;

        for (const kind of ['ore', 'coal'] as const) {
            const look = OUTCROPS[kind];
            const mine = spots.filter((spot) => spot.kind === kind);
            const perSpot = 6;
            const geometry = new THREE.IcosahedronGeometry(0.2, 0);
            const material = new THREE.MeshStandardMaterial({
                roughness: look.roughness,
                metalness: look.metalness,
                flatShading: true,
            });
            const mesh = new THREE.InstancedMesh(
                geometry,
                material,
                mine.length * perSpot,
            );
            const matrix = new THREE.Matrix4();
            const rotation = new THREE.Quaternion();
            const euler = new THREE.Euler();
            const position = new THREE.Vector3();
            const scale = new THREE.Vector3();
            let index = 0;

            for (const spot of mine) {
                for (let i = 0; i < perSpot; i++) {
                    const h = (salt: number) =>
                        hash3(spot.x * 7 + i, salt, kind === 'ore' ? 3 : 5);
                    const x = spot.x + 0.2 + h(1) * (spot.w - 0.4);
                    const d = 0.1 + h(2) * 0.9;
                    const size = (spot.rich ? 1.25 : 0.9) * (0.7 + h(3) * 0.7);

                    position.set(x, mountainHeight(x, d) + 0.04 * size, -d);
                    euler.set(h(4) * 3, h(5) * 3, h(6) * 3);
                    rotation.setFromEuler(euler);
                    scale.set(size, size * (0.6 + h(7) * 0.5), size);
                    matrix.compose(position, rotation, scale);
                    mesh.setMatrixAt(index, matrix);
                    mesh.setColorAt(
                        index,
                        color(
                            look.colors[Math.floor(h(8) * look.colors.length)],
                        ),
                    );
                    index++;
                }
            }

            mesh.instanceMatrix.needsUpdate = true;

            if (mesh.instanceColor) {
                mesh.instanceColor.needsUpdate = true;
            }

            mesh.castShadow = true;
            mesh.name = `outcrops-${kind}`;
            this.group.add(mesh);
            this.disposables.push(geometry, material);
        }
    }

    /** A stone gate and a dark mouth going into the slope at each portal (gdd §7.2). */
    private buildPortals(): void {
        const stone = new THREE.MeshStandardMaterial({
            color: color('#8c8378'),
            roughness: 0.9,
            flatShading: true,
        });
        const dark = new THREE.MeshBasicMaterial({ color: color('#0d0c0b') });
        const pillar = new THREE.BoxGeometry(0.2, 0.78, 0.36);
        const lintel = new THREE.BoxGeometry(1.0, 0.22, 0.4);
        const mouth = new THREE.BoxGeometry(0.6, 0.7, 2.4);

        for (const x of this.game.content.world.map.portals) {
            const gate = new THREE.Group();
            const left = new THREE.Mesh(pillar, stone);
            const right = new THREE.Mesh(pillar, stone);
            const top = new THREE.Mesh(lintel, stone);
            const hole = new THREE.Mesh(mouth, dark);

            left.position.set(-0.4, 0.39, 0);
            right.position.set(0.4, 0.39, 0);
            top.position.set(0, 0.86, 0);
            hole.position.set(0, 0.35, -1.25);

            for (const part of [left, right, top]) {
                part.castShadow = true;
            }

            gate.add(left, right, top, hole);
            gate.position.set(x + 0.5, 0, -0.2);
            gate.name = `portal-${x}`;
            this.group.add(gate);
        }

        this.disposables.push(stone, dark, pillar, lintel, mouth);
    }

    /** A dark, glossy sheen on the water just off each oil spot. */
    private buildOilSheens(): void {
        const material = new THREE.MeshStandardMaterial({
            color: color('#141218'),
            roughness: 0.12,
            metalness: 0.65,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
        });
        const geometry = new THREE.CircleGeometry(0.42, 20).rotateX(
            -Math.PI / 2,
        );
        const shore = this.game.layout.seaY;

        for (const spot of this.game.content.world.map.deposits) {
            if (spot.kind !== 'oil') {
                continue;
            }

            const sheen = new THREE.Mesh(geometry, material);
            const size = spot.rich ? 1.3 : 1;

            sheen.scale.set(size * 1.2, 1, size);
            sheen.position.set(spot.x + 0.5, WATER_Y + 0.006, shore + 0.35);
            sheen.renderOrder = 2;
            this.group.add(sheen);
        }

        this.disposables.push(material, geometry);
    }

    dispose(): void {
        for (const plaque of this.plaques) {
            plaque.texture.dispose();
            (plaque.sprite.material as THREE.Material).dispose();
        }

        this.postGeometry.dispose();
        this.postMaterial.dispose();

        for (const item of this.disposables) {
            item.dispose();
        }
    }
}
