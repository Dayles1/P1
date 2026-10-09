/**
 * A little 3D portrait of the hero: the figure, dressed and built the way
 * it is in the world, standing on a dark plinth with its own shadow and
 * turning slowly. A warm key light from the front, a cool one behind to
 * draw the outline against the dark, and the picture drawn at twice the
 * pixels and scaled down, so the figure stays crisp. It has its own small
 * renderer and only draws while it is on the page (the hero card, the
 * character tab).
 */

import * as THREE from 'three';
import type { ArmorSlot, ItemId } from '../items';
import { Mannequin } from '../player/mannequin';
import type { Look, MotionState } from '../player/mannequin';
import { element } from './dom';

const IDLE: MotionState = {
    speed: 0,
    walkSpeed: 4.2,
    runSpeed: 7.5,
    stance: 'stand',
    grounded: true,
    verticalSpeed: 0,
    turnRate: 0,
    acceleration: 0,
    sitting: null,
    swimming: false,
    seatHeight: 0,
    climb: null,
    activity: null,
    lookYaw: 0,
    lookPitch: 0,
    ground: null,
};

/** Pixels drawn per screen pixel: at least two, for a crisp small picture. */
const SUPERSAMPLE = 2;
/** The plinth's radius (m) and its colours: the game's flint, a spark rim. */
const PLINTH = 0.9;
const PLINTH_COLOR = '#2b3138';
const RIM_COLOR = 'rgba(255, 122, 47, 0.75)';

/** A disc fading out to its edge, with a thin bright ring near it. */
function plinthTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;
    const middle = size / 2;
    const fill = context.createRadialGradient(
        middle,
        middle,
        0,
        middle,
        middle,
        middle,
    );

    fill.addColorStop(0, PLINTH_COLOR);
    fill.addColorStop(0.75, PLINTH_COLOR);
    fill.addColorStop(1, 'rgba(43, 49, 56, 0)');
    context.fillStyle = fill;
    context.fillRect(0, 0, size, size);
    context.strokeStyle = RIM_COLOR;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(middle, middle, middle * 0.82, 0, Math.PI * 2);
    context.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return texture;
}

export class Portrait {
    readonly element: HTMLElement;
    private renderer: THREE.WebGLRenderer | null = null;
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(30, 0.8, 0.1, 20);
    private figure = new Mannequin();
    private clock = new THREE.Clock();
    private frame = 0;
    private size = new THREE.Vector2();

    constructor(className: string) {
        this.element = element('div', className);

        try {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
            });
        } catch {
            return;
        }

        this.renderer.setPixelRatio(
            Math.max(SUPERSAMPLE, Math.min(3, window.devicePixelRatio)),
        );
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.element.append(this.renderer.domElement);

        const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
        key.position.set(1.6, 3.6, 2.6);
        key.castShadow = true;
        key.shadow.mapSize.setScalar(1024);
        key.shadow.camera.left = -1;
        key.shadow.camera.right = 1;
        key.shadow.camera.top = 2.2;
        key.shadow.camera.bottom = -0.4;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 8;
        key.shadow.bias = -0.0005;
        key.shadow.normalBias = 0.02;

        const rim = new THREE.DirectionalLight(0xa9c8ff, 1.8);
        rim.position.set(-2.2, 2.4, -2.8);

        const plinth = new THREE.Mesh(
            new THREE.CircleGeometry(PLINTH, 64),
            new THREE.MeshStandardMaterial({
                map: plinthTexture(),
                transparent: true,
                roughness: 0.9,
                depthWrite: false,
            }),
        );
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(PLINTH * 0.8, 48),
            new THREE.ShadowMaterial({ opacity: 0.45 }),
        );

        plinth.rotation.x = -Math.PI / 2;
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.001;
        shadow.receiveShadow = true;
        this.scene.add(
            new THREE.HemisphereLight(0xf1f4f6, 0x5a5650, 1.4),
            key,
            rim,
            plinth,
            shadow,
            this.figure.root,
        );
        this.camera.position.set(0, 1.15, 4.6);
        this.camera.lookAt(0, 0.95, 0);
        this.draw();
    }

    /** Shapes, dresses and arms the figure. */
    show(
        look: Look,
        held: ItemId | null,
        worn: Record<ArmorSlot, ItemId | null> = {
            head: null,
            body: null,
            feet: null,
        },
    ): void {
        this.figure.setLook(look);
        this.figure.hold(held);
        this.figure.wear(worn);
    }

    dispose(): void {
        cancelAnimationFrame(this.frame);
        this.renderer?.dispose();
        this.element.remove();
    }

    private draw = (): void => {
        this.frame = requestAnimationFrame(this.draw);
        const renderer = this.renderer!;
        const width = this.element.clientWidth;
        const height = this.element.clientHeight;

        // Off the page (another tab, the menu closed): nothing to draw.
        if (!this.element.isConnected || width === 0 || height === 0) {
            this.clock.getDelta();

            return;
        }

        renderer.getSize(this.size);

        if (this.size.x !== width || this.size.y !== height) {
            renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        const dt = Math.min(this.clock.getDelta(), 0.1);
        this.figure.root.rotation.y += dt * 0.6;
        this.figure.update(dt, IDLE, 0);
        renderer.render(this.scene, this.camera);
    };
}
