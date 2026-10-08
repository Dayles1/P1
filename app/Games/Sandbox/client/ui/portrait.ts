/**
 * A little 3D portrait of the hero: the figure, dressed and built the way
 * it is in the world, standing on a disc of grass and turning slowly. It
 * has its own small renderer and only draws while it is on the page (the
 * hero card, the character tab).
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

        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.element.append(this.renderer.domElement);

        const sun = new THREE.DirectionalLight(0xfff6ea, 2.2);
        sun.position.set(2, 4, 3);
        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(0.9, 32),
            new THREE.MeshStandardMaterial({ color: 0x9fb087, roughness: 1 }),
        );
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(
            new THREE.HemisphereLight(0xf1f4f6, 0x8f8a80, 1.8),
            sun,
            ground,
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
