/**
 * How much the graphics card is asked to do. Four settings:
 *
 * - low: below-native resolution, no shadows;
 * - medium: native resolution (no more than one pixel per CSS pixel),
 *   plain shadows;
 * - high: up to twice the resolution on sharp screens, soft and finer
 *   shadows, edge smoothing;
 * - auto (the default): plain shadows and a resolution that follows the
 *   frame rate — down when the game stutters, back up when it runs
 *   smoothly; on a very weak card the shadows go too.
 *
 * Edge smoothing can only be chosen when the drawing surface is made, so
 * switching to or from "high" takes effect after a reload.
 *
 * It also finds out which graphics card the browser draws with: a
 * software renderer means hardware acceleration is off in the browser,
 * which is the usual reason for a slow game on a computer.
 */

import * as THREE from 'three';
import { TOUCH } from './input';
import type { Quality } from './settings';

const AUTO_MIN = 0.5;
const AUTO_WINDOW = 2;

export function createRenderer(quality: Quality): THREE.WebGLRenderer {
    return new THREE.WebGLRenderer({
        antialias: quality === 'high',
        powerPreference: 'high-performance',
    });
}

export class Graphics {
    readonly gpu: string;
    readonly software: boolean;
    readonly smoothing: boolean;
    quality: Quality = 'auto';
    /** Frames per second over the last second or so. */
    fps = 60;

    private ratio = 1;
    private shadows = true;
    private window = { frames: 0, time: 0 };
    private smoothWindows = 0;

    constructor(
        private renderer: THREE.WebGLRenderer,
        private scene: THREE.Scene,
        private sun: THREE.DirectionalLight,
    ) {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        this.gpu = String(
            (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) ||
                gl.getParameter(gl.RENDERER) ||
                '',
        );
        this.software = /swiftshader|llvmpipe|software|basic render/i.test(
            this.gpu,
        );
        this.smoothing = gl.getContextAttributes()?.antialias ?? false;
    }

    /** The most pixels worth drawing per CSS pixel in this mode. */
    private get ceiling(): number {
        const device = window.devicePixelRatio || 1;

        switch (this.quality) {
            case 'low':
                return Math.min(device, 1) * 0.7;
            case 'medium':
                return Math.min(device, 1);
            case 'high':
                return Math.min(device, 2);
            case 'auto':
                return Math.min(device, TOUCH ? 1.5 : 1.25);
        }
    }

    apply(quality: Quality): void {
        this.quality = quality;
        this.ratio =
            quality === 'auto'
                ? Math.min(window.devicePixelRatio || 1, 1)
                : this.ceiling;
        this.renderer.setPixelRatio(this.ratio);
        this.setShadows(quality !== 'low', quality === 'high');
        this.smoothWindows = 0;
    }

    /** Counts frames; in auto mode, every couple of seconds adjusts. */
    update(dt: number): void {
        if (document.hidden || dt >= 0.1) {
            return;
        }

        this.window.frames++;
        this.window.time += dt;

        if (this.window.time < AUTO_WINDOW) {
            return;
        }

        this.fps = this.window.frames / this.window.time;
        this.window.frames = 0;
        this.window.time = 0;

        if (this.quality !== 'auto') {
            return;
        }

        if (this.fps < 40 && this.ratio > AUTO_MIN) {
            this.setRatio(this.ratio - 0.15);
            this.smoothWindows = 0;
        } else if (this.fps < 28 && this.shadows) {
            this.setShadows(false, false);
        } else if (this.fps >= 55) {
            this.smoothWindows++;

            if (this.smoothWindows >= 3) {
                this.smoothWindows = 0;

                if (!this.shadows && this.ratio >= 0.8) {
                    this.setShadows(true, false);
                } else if (this.ratio < this.ceiling) {
                    this.setRatio(this.ratio + 0.1);
                }
            }
        } else {
            this.smoothWindows = 0;
        }
    }

    /** "1280×720 · 0.8×" — what is being drawn right now. */
    get summary(): string {
        const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());

        return `${size.x}×${size.y} · ${this.ratio.toFixed(2)}× · ${this.shadows ? 'shadows' : 'no shadows'}`;
    }

    private setRatio(ratio: number): void {
        this.ratio = Math.max(AUTO_MIN, Math.min(this.ceiling, ratio));
        this.renderer.setPixelRatio(this.ratio);
    }

    private setShadows(on: boolean, soft: boolean): void {
        const map = this.renderer.shadowMap;
        const type = soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
        const size = soft ? 2048 : TOUCH ? 1024 : 1536;
        const changed =
            map.enabled !== on ||
            map.type !== type ||
            this.sun.shadow.mapSize.x !== size;

        this.shadows = on;
        map.enabled = on;
        map.type = type;
        this.sun.castShadow = on;

        if (this.sun.shadow.mapSize.x !== size) {
            this.sun.shadow.mapSize.setScalar(size);
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }

        // Materials are compiled for one shadow setting; make them redo it.
        if (changed) {
            this.scene.traverse((node) => {
                const material = (node as THREE.Mesh).material;

                for (const each of Array.isArray(material)
                    ? material
                    : material
                      ? [material]
                      : []) {
                    each.needsUpdate = true;
                }
            });
        }
    }
}
