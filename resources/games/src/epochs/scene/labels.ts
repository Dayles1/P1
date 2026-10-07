/**
 * An HTML layer over the canvas for crisp text: warning badges above
 * buildings, construction progress bars, floating texts and the white
 * flash of a new era. Elements are pooled by key and positioned with
 * transforms every frame.
 */

import type * as THREE from 'three';

interface Floating {
    element: HTMLDivElement;
    position: THREE.Vector3;
    life: number;
    max: number;
}

class KeyedPool {
    private elements = new Map<string, HTMLDivElement>();
    private used = new Set<string>();

    constructor(
        private root: HTMLElement,
        private make: () => HTMLDivElement,
    ) {}

    begin(): void {
        this.used.clear();
    }

    get(key: string): HTMLDivElement {
        let element = this.elements.get(key);

        if (!element) {
            element = this.make();
            this.root.appendChild(element);
            this.elements.set(key, element);
        }

        this.used.add(key);

        return element;
    }

    end(): void {
        for (const [key, element] of this.elements) {
            if (!this.used.has(key)) {
                element.remove();
                this.elements.delete(key);
            }
        }
    }

    clear(): void {
        this.begin();
        this.end();
    }
}

function place(element: HTMLElement, x: number, y: number): void {
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
}

export class Labels {
    readonly root: HTMLDivElement;

    private badges: KeyedPool;
    private bars: KeyedPool;
    private floating: Floating[] = [];
    private flashElement: HTMLDivElement;
    private flashLife = 0;

    constructor(private canvas: HTMLCanvasElement) {
        const root = document.createElement('div');

        root.className = 'scene-labels';
        Object.assign(root.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: '0px',
            height: '0px',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: '1',
        });
        this.root = root;

        this.mount();

        this.badges = new KeyedPool(root, () => {
            const element = document.createElement('div');

            element.className = 'scene-badge';
            Object.assign(element.style, {
                position: 'absolute',
                left: '0px',
                top: '0px',
                padding: '1px 4px',
                borderRadius: '9px',
                background: 'rgba(20, 20, 28, 0.72)',
                color: '#fff',
                font: '600 12px/16px system-ui, sans-serif',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
            });

            return element;
        });
        this.bars = new KeyedPool(root, () => {
            const element = document.createElement('div');
            const fill = document.createElement('div');

            element.className = 'scene-progress';
            Object.assign(element.style, {
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: '38px',
                height: '6px',
                borderRadius: '3px',
                background: 'rgba(20, 20, 28, 0.6)',
                border: '1px solid rgba(255,255,255,0.7)',
                overflow: 'hidden',
            });
            Object.assign(fill.style, {
                height: '100%',
                width: '0%',
                background: 'linear-gradient(90deg, #ffcf4d, #7ddc5a)',
            });
            element.appendChild(fill);

            return element;
        });

        this.flashElement = document.createElement('div');
        this.flashElement.className = 'scene-flash';
        Object.assign(this.flashElement.style, {
            position: 'absolute',
            inset: '0px',
            background: '#fff',
            opacity: '0',
        });
        root.appendChild(this.flashElement);
        this.resize();
    }

    /** Matches the layer to the canvas' box inside its parent. */
    resize(): void {
        this.mount();
        Object.assign(this.root.style, {
            left: `${this.canvas.offsetLeft}px`,
            top: `${this.canvas.offsetTop}px`,
            width: `${this.canvas.clientWidth}px`,
            height: `${this.canvas.clientHeight}px`,
        });
    }

    /** Puts the layer next to the canvas once the canvas is in the page. */
    private mount(): void {
        const parent = this.canvas.parentElement;

        if (!parent || this.root.parentElement === parent) {
            return;
        }

        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }

        parent.appendChild(this.root);
    }

    beginFrame(): void {
        this.badges.begin();
        this.bars.begin();
    }

    badge(key: string, text: string, x: number, y: number): void {
        const element = this.badges.get(key);

        if (element.textContent !== text) {
            element.textContent = text;
        }

        place(element, x, y);
    }

    progress(key: string, share: number, x: number, y: number): void {
        const element = this.bars.get(key);
        const fill = element.firstElementChild as HTMLDivElement;
        const width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`;

        if (fill.style.width !== width) {
            fill.style.width = width;
        }

        place(element, x, y);
    }

    endFrame(): void {
        this.badges.end();
        this.bars.end();
    }

    /** A text rising from a world point. */
    float(
        text: string,
        position: THREE.Vector3,
        tone = '#ffffff',
        seconds = 2.2,
    ): void {
        const element = document.createElement('div');

        element.className = 'scene-float';
        element.textContent = text;
        Object.assign(element.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            color: tone,
            font: '700 14px/18px system-ui, sans-serif',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.4)',
        });
        this.root.appendChild(element);
        this.floating.push({
            element,
            position: position.clone(),
            life: 0,
            max: seconds,
        });

        if (this.floating.length > 24) {
            this.floating.shift()!.element.remove();
        }
    }

    flash(): void {
        this.flashLife = 1;
    }

    /** Moves floating texts; `project` maps a world point to canvas pixels. */
    update(
        dt: number,
        project: (position: THREE.Vector3) => {
            x: number;
            y: number;
            visible: boolean;
        },
    ): void {
        this.floating = this.floating.filter((item) => {
            item.life += dt;

            if (item.life >= item.max) {
                item.element.remove();

                return false;
            }

            const t = item.life / item.max;
            const screen = project(item.position);

            item.element.style.display = screen.visible ? '' : 'none';
            item.element.style.opacity = String(Math.min(1, (1 - t) * 2.5));
            place(item.element, screen.x, screen.y - t * 50);

            return true;
        });

        if (this.flashLife > 0) {
            this.flashLife = Math.max(0, this.flashLife - dt * 1.6);
        }

        this.flashElement.style.opacity = String(this.flashLife * 0.85);
    }

    clear(): void {
        this.badges.clear();
        this.bars.clear();

        for (const item of this.floating) {
            item.element.remove();
        }

        this.floating = [];
    }

    dispose(): void {
        this.clear();
        this.root.remove();
    }
}
