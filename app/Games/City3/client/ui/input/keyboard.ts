/**
 * The shortcut map (ui-spec §7.3). Letters go by the physical key, so the
 * Russian layout works too (B = И, U = Г, …); the typed character is the
 * fallback where `code` is missing. Held keys (WASD / arrows pan, Q / E
 * rotate) are read by the frame loop, not here.
 */

export type KeyAction =
    | 'build'
    | 'upgrade'
    | 'goals'
    | 'city'
    | 'chronicle'
    | 'research'
    | 'layers'
    | 'bulldoze'
    | 'move'
    | 'rotate'
    | 'confirm'
    | 'escape'
    | 'pause'
    | 'speed1'
    | 'speed2'
    | 'speed5'
    | 'home'
    | 'zoomIn'
    | 'zoomOut';

const BY_CODE: Record<string, KeyAction> = {
    KeyB: 'build',
    KeyU: 'upgrade',
    KeyG: 'goals',
    KeyC: 'city',
    KeyH: 'chronicle',
    KeyT: 'research',
    KeyL: 'layers',
    KeyX: 'bulldoze',
    KeyM: 'move',
    KeyR: 'rotate',
    Enter: 'confirm',
    NumpadEnter: 'confirm',
    Escape: 'escape',
    Space: 'pause',
    Digit1: 'speed1',
    Digit2: 'speed2',
    Digit3: 'speed5',
    Numpad1: 'speed1',
    Numpad2: 'speed2',
    Numpad3: 'speed5',
    Home: 'home',
    Equal: 'zoomIn',
    NumpadAdd: 'zoomIn',
    Minus: 'zoomOut',
    NumpadSubtract: 'zoomOut',
};

/** The typed character, Latin and the Russian layout's letters on the same keys. */
const BY_KEY: Record<string, KeyAction> = {
    b: 'build',
    и: 'build',
    u: 'upgrade',
    г: 'upgrade',
    g: 'goals',
    п: 'goals',
    c: 'city',
    с: 'city',
    h: 'chronicle',
    р: 'chronicle',
    t: 'research',
    е: 'research',
    l: 'layers',
    д: 'layers',
    x: 'bulldoze',
    ч: 'bulldoze',
    m: 'move',
    ь: 'move',
    r: 'rotate',
    к: 'rotate',
    enter: 'confirm',
    escape: 'escape',
    ' ': 'pause',
    '1': 'speed1',
    '2': 'speed2',
    '3': 'speed5',
    home: 'home',
    '+': 'zoomIn',
    '=': 'zoomIn',
    '-': 'zoomOut',
};

export interface KeyLike {
    code?: string;
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
}

/** The action of a key press, or null (modified keys are the browser's). */
export function keyAction(event: KeyLike): KeyAction | null {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return null;
    }

    return (
        (event.code ? BY_CODE[event.code] : undefined) ??
        BY_KEY[event.key.toLowerCase()] ??
        null
    );
}

/** Held keys that move the camera, by physical key. */
export type PanKey =
    'left' | 'right' | 'up' | 'down' | 'rotL' | 'rotR' | 'tiltUp' | 'tiltDown';

const PAN: Record<string, PanKey> = {
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    KeyW: 'up',
    ArrowUp: 'up',
    KeyS: 'down',
    ArrowDown: 'down',
    KeyQ: 'rotL',
    KeyE: 'rotR',
    PageUp: 'tiltUp',
    PageDown: 'tiltDown',
};

export function panKey(code: string | undefined): PanKey | null {
    return code ? (PAN[code] ?? null) : null;
}
