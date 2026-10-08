/**
 * Keyboard, mouse and touch. Held keys (movement, sprint, attack, swim
 * up/down) are read each frame; one-off keys (jump, crouch, inventory…)
 * arrive as actions.
 *
 * With a mouse, the camera turns only while the pointer is locked to the
 * game (a click locks it, Esc frees it). On a touch screen there is no
 * pointer lock: the on-screen controls (ui/touch.ts) feed the same
 * movement, look and actions in through the `virtual…` methods, and
 * "locking" just means playing.
 */

export type Action =
    | 'jump'
    | 'crouch'
    | 'crawl'
    | 'sit'
    | 'interact'
    | 'use'
    | 'skill'
    | 'inventory'
    | 'crafting'
    | 'character'
    | 'artifacts'
    | 'escape'
    | 'mute'
    | 'debug'
    | 'skip_time'
    | 'slot1'
    | 'slot2'
    | 'slot3'
    | 'slot4'
    | 'slot5'
    | 'slot6';

const BINDINGS: Record<string, Action> = {
    Space: 'jump',
    KeyC: 'crouch',
    ControlLeft: 'crouch',
    KeyZ: 'crawl',
    KeyX: 'sit',
    KeyE: 'interact',
    KeyF: 'interact',
    KeyR: 'use',
    KeyG: 'skill',
    KeyI: 'inventory',
    Tab: 'inventory',
    KeyQ: 'crafting',
    KeyP: 'character',
    KeyO: 'artifacts',
    Escape: 'escape',
    KeyM: 'mute',
    F3: 'debug',
    F4: 'skip_time',
    Digit1: 'slot1',
    Digit2: 'slot2',
    Digit3: 'slot3',
    Digit4: 'slot4',
    Digit5: 'slot5',
    Digit6: 'slot6',
};

const FORWARD = ['KeyW', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const SPRINT = ['ShiftLeft', 'ShiftRight'];
const RISE = ['Space'];
const DIVE = ['KeyC', 'ControlLeft'];
/** Keys the browser must not act on while playing. */
const CAPTURED = [
    ...FORWARD,
    ...BACK,
    ...LEFT,
    ...RIGHT,
    'Space',
    'Tab',
    'F3',
    'F4',
];

export const TOUCH =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches ||
        'ontouchstart' in window);

export class Input {
    locked = false;
    readonly touch = TOUCH;
    onLockChange: (locked: boolean) => void = () => {};
    onAction: (action: Action) => void = () => {};

    private keys = new Set<string>();
    private attacking = false;
    private mouseX = 0;
    private mouseY = 0;
    private wheel = 0;
    private virtualMove = { x: 0, y: 0, sprint: false };
    private virtualHeld = { attack: false, rise: false, dive: false };

    constructor(private element: HTMLElement) {
        window.addEventListener('keydown', this.keyDown);
        window.addEventListener('keyup', this.keyUp);
        window.addEventListener('blur', this.release);
        document.addEventListener('mousemove', this.mouseMove);
        document.addEventListener('mousedown', this.mouseDown);
        document.addEventListener('mouseup', this.mouseUp);
        document.addEventListener('pointerlockchange', this.lockChange);
        element.addEventListener('wheel', this.mouseWheel, { passive: false });
        element.addEventListener('contextmenu', (event) =>
            event.preventDefault(),
        );
    }

    /** Starts playing: locks the pointer; false when the browser refuses. */
    async lock(): Promise<boolean> {
        if (this.touch) {
            this.locked = true;
            this.onLockChange(true);

            return true;
        }

        try {
            await this.element.requestPointerLock?.();

            return true;
        } catch {
            return false;
        }
    }

    unlock(): void {
        if (this.touch) {
            if (this.locked) {
                this.locked = false;
                this.release();
                this.onLockChange(false);
            }

            return;
        }

        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    /** -1…1 along each axis, relative to where the camera looks. */
    get forward(): number {
        return this.locked ? this.axis(FORWARD, BACK) || this.virtualMove.y : 0;
    }

    get strafe(): number {
        return this.locked ? this.axis(RIGHT, LEFT) || this.virtualMove.x : 0;
    }

    get sprint(): boolean {
        return this.held(SPRINT) || this.virtualMove.sprint;
    }

    /** The attack button is held. */
    get attack(): boolean {
        return this.locked && (this.attacking || this.virtualHeld.attack);
    }

    /** Swim up / dive keys are held. */
    get rise(): boolean {
        return this.locked && (this.held(RISE) || this.virtualHeld.rise);
    }

    get dive(): boolean {
        return this.locked && (this.held(DIVE) || this.virtualHeld.dive);
    }

    /** Mouse (or finger) movement and wheel since the last call. */
    takeLook(): { x: number; y: number; wheel: number } {
        const look = { x: this.mouseX, y: this.mouseY, wheel: this.wheel };
        this.mouseX = 0;
        this.mouseY = 0;
        this.wheel = 0;

        return look;
    }

    /** From the on-screen joystick: x right, y forward, -1…1. */
    setVirtualMove(x: number, y: number, sprint: boolean): void {
        this.virtualMove = { x, y, sprint };
    }

    setVirtualHeld(button: 'attack' | 'rise' | 'dive', held: boolean): void {
        this.virtualHeld[button] = held;
    }

    addLook(dx: number, dy: number): void {
        if (this.locked) {
            this.mouseX += dx;
            this.mouseY += dy;
        }
    }

    addZoom(steps: number): void {
        this.wheel += steps;
    }

    private held(codes: string[]): boolean {
        return codes.some((code) => this.keys.has(code));
    }

    private axis(positive: string[], negative: string[]): number {
        return (this.held(positive) ? 1 : 0) - (this.held(negative) ? 1 : 0);
    }

    private keyDown = (event: KeyboardEvent): void => {
        if (
            (this.locked || BINDINGS[event.code]) &&
            CAPTURED.includes(event.code)
        ) {
            event.preventDefault();
        }

        if (this.locked) {
            this.keys.add(event.code);
        }

        const action = BINDINGS[event.code];

        if (action && !event.repeat) {
            this.onAction(action);
        }
    };

    private keyUp = (event: KeyboardEvent): void => {
        this.keys.delete(event.code);
    };

    private mouseDown = (event: MouseEvent): void => {
        if (!this.locked || this.touch) {
            return;
        }

        if (event.button === 0) {
            this.attacking = true;
        } else if (event.button === 2) {
            this.onAction('use');
        }
    };

    private mouseUp = (event: MouseEvent): void => {
        if (event.button === 0) {
            this.attacking = false;
        }
    };

    private mouseMove = (event: MouseEvent): void => {
        if (this.locked && !this.touch) {
            this.mouseX += event.movementX;
            this.mouseY += event.movementY;
        }
    };

    private mouseWheel = (event: WheelEvent): void => {
        event.preventDefault();
        this.wheel += Math.sign(event.deltaY);
    };

    private release = (): void => {
        this.keys.clear();
        this.attacking = false;
        this.virtualMove = { x: 0, y: 0, sprint: false };
        this.virtualHeld = { attack: false, rise: false, dive: false };
    };

    private lockChange = (): void => {
        if (this.touch) {
            return;
        }

        this.locked = document.pointerLockElement === this.element;

        if (!this.locked) {
            this.release();
        }

        this.onLockChange(this.locked);
    };
}
