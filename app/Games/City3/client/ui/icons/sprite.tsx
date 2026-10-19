/**
 * The one inline icon sprite (ui-spec §3.7): a 24-px grid, 2-px round
 * strokes in currentColor, and the seven duotone currency faces with
 * their own fills. Rendered once by the HUD; components point at it with
 * <Icon/> and <CurrencyFace/>.
 */

const ICONS: Record<string, string> = {
    build: '<path d="M4 20l9.1-9.1"/><path d="M12.4 4.6l7.1 7-2.9 2.9-7.1-7.1z"/>',
    upgrade: '<path d="M6 12.5l6-6 6 6"/><path d="M6 18.5l6-6 6 6"/>',
    goals: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.5 6.5l1.5 1.5 2.5-3"/><path d="M3.5 12l1.5 1.5 2.5-3"/><path d="M4 17.5h2.5"/>',
    city: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6.5M17 16v-8"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    layers: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
    compass:
        '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2l-1.6 4-4 1.6 1.6-4z"/>',
    target: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
    bulldoze:
        '<path d="M3 20h18"/><path d="M5 20V9.5L10 6l5 3.5V20"/><path d="M10.5 11l-1.8 2.6 2.4 1.6-1.4 2.8"/><path d="M17.5 13l2.5-2.5M18 17l3-1"/>',
    move: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
    undo: '<path d="M9 14l-5-5 5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c.5-3.4 2.9-5.4 6-5.4s5.5 2 6 5.4"/><path d="M16 4.9a3.2 3.2 0 0 1 0 6.2"/><path d="M17.6 14.4c1.9.7 3 2.4 3.4 5.1"/>',
    face: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10v.6M15 10v.6"/><path d="M8.5 14.2c.9 1.3 2.1 1.9 3.5 1.9s2.6-.6 3.5-1.9"/>',
    'face-meh':
        '<circle cx="12" cy="12" r="8.5"/><path d="M9 10v.6M15 10v.6"/><path d="M8.8 15h6.4"/>',
    'face-sad':
        '<circle cx="12" cy="12" r="8.5"/><path d="M9 10v.6M15 10v.6"/><path d="M8.5 16.2c.9-1.3 2.1-1.9 3.5-1.9s2.6.6 3.5 1.9"/>',
    bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    'chev-l': '<path d="M15 6l-6 6 6 6"/>',
    'chev-d': '<path d="M6 9l6 6 6-6"/>',
    back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    wheat: '<path d="M12 21V7.5"/><path d="M12 11.5c-2.6 0-4.2-1.5-4.2-4.1 2.6 0 4.2 1.5 4.2 4.1zM12 11.5c2.6 0 4.2-1.5 4.2-4.1-2.6 0-4.2 1.5-4.2 4.1zM12 16.5c-2.6 0-4.2-1.5-4.2-4.1 2.6 0 4.2 1.5 4.2 4.1zM12 16.5c2.6 0 4.2-1.5 4.2-4.1-2.6 0-4.2 1.5-4.2 4.1zM12 6.6c-1.3-1-1.3-2.9 0-3.9 1.3 1 1.3 2.9 0 3.9z"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    drop: '<path d="M12 3.5c3.4 4 5.8 7.1 5.8 10.1a5.8 5.8 0 0 1-11.6 0c0-3 2.4-6.1 5.8-10.1z"/>',
    car: '<path d="M4 17v-4.6L6.6 7h10.8l2.6 5.4V17z"/><path d="M4 12.4h16"/><circle cx="7.6" cy="17" r="1.8"/><circle cx="16.4" cy="17" r="1.8"/>',
    'coin-off': '<circle cx="12" cy="12" r="8.5"/><path d="M5.5 18.5l13-13"/>',
    briefcase:
        '<rect x="3" y="7.5" width="18" height="12.5" rx="2"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3 13h18"/>',
    hardhat:
        '<path d="M3.5 17.5h17"/><path d="M5.5 17.5v-3a6.5 6.5 0 0 1 13 0v3"/><path d="M10 8.2V12M14 8.2V12"/>',
    cloud: '<path d="M7 18.5h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.3 9.8 4.4 4.4 0 0 0 7 18.5z"/>',
    sliders:
        '<path d="M4 7h9M18 7h2M4 17h3M11 17h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.8" cy="17" r="2.3"/>',
    sound: '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9.5a3.6 3.6 0 0 1 0 5M19 7a7 7 0 0 1 0 10"/>',
    'sound-off':
        '<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5s-1.2 6-3.6 8.5c-2.4-2.5-3.6-5.3-3.6-8.5s1.2-6 3.6-8.5z"/>',
    flask: '<path d="M9 3.5h6"/><path d="M10 3.5V9l-5.2 9.6A1.6 1.6 0 0 0 6.2 21h11.6a1.6 1.6 0 0 0 1.4-2.4L14 9V3.5"/><path d="M7.4 15.5h9.2"/>',
    book: '<path d="M5 19.5V5.5A2 2 0 0 1 7 3.5h12v14H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h4"/><path d="M15 17.5v4.5l-1.5-1.1-1.5 1.1v-4.5"/><path d="M9 8h6"/>',
    hall: '<path d="M3 9.5L12 4l9 5.5z"/><path d="M5 9.5v8M9.7 9.5v8M14.3 9.5v8M19 9.5v8"/><path d="M3.5 20.5h17M4 17.5h16"/>',
    mat: '<rect x="3" y="13" width="8" height="7" rx="1"/><rect x="13" y="13" width="8" height="7" rx="1"/><rect x="8" y="4.5" width="8" height="7" rx="1"/>',
    crate: '<path d="M4 8l8-4 8 4v8.5l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8.5"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    anchor: '<circle cx="12" cy="5.5" r="2"/><path d="M12 7.5V21M8.5 11h7"/><path d="M4.5 13.5a7.5 7.5 0 0 0 15 0"/>',
    fish: '<path d="M3 12c2.6-3.4 5.6-5 9-5 3.4 0 6.2 1.8 8 5-1.8 3.2-4.6 5-8 5-3.4 0-6.4-1.6-9-5z"/><path d="M3 12l-1-3M3 12l-1 3"/><path d="M15.5 10.5v.5"/>',
    pick: '<path d="M4.5 8.5C8.8 4.6 15.2 4.6 19.5 8.5"/><path d="M12 6v15"/>',
    house: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    factory: '<path d="M3 20.5V10l5 3v-3l5 3v-3l5 3V4.5h3v16z"/>',
    stall: '<path d="M4 10l1.5-5h13L20 10"/><path d="M4 10a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11.5V20h13v-8.5M10 20v-4.5h4V20"/>',
    service:
        '<rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
    tree: '<path d="M12 21v-6"/><path d="M12 15c-4 0-6-2.2-6-5.2C6 6.6 8.7 4 12 4s6 2.6 6 5.8c0 3-2 5.2-6 5.2z"/>',
    train: '<rect x="6" y="3" width="12" height="13.5" rx="3"/><path d="M6 10h12"/><path d="M9 13.4v.1M15 13.4v.1"/><path d="M9 19.5l-2 2M15 19.5l2 2"/>',
    road: '<path d="M8 3.5L5 20.5M16 3.5l3 17"/><path d="M12 4.5v2.5M12 10.5v3M12 17.5v3"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.4v.1"/>',
    chest: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13.5h18"/><path d="M5 9a7 4.5 0 0 1 14 0"/><path d="M11 13.5v3h2v-3"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20.5h7M10 17h4"/>',
    flag: '<path d="M6 21V3.5"/><path d="M6 4h12l-3.5 4.2L18 12.5H6"/>',
    'flag-down': '<path d="M12 4v14"/><path d="M6 12l6 6 6-6"/>',
    water: '<path d="M12 3.5c3.4 4 5.8 7.1 5.8 10.1a5.8 5.8 0 0 1-11.6 0c0-3 2.4-6.1 5.8-10.1z"/><path d="M9.2 14.2a2.8 2.8 0 0 0 2.8 2.8"/>',
    health: '<path d="M12 20s-7.5-4.4-7.5-10A4.4 4.4 0 0 1 12 7.2 4.4 4.4 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/><path d="M12 10.5v5M9.5 13h5"/>',
    masks: '<path d="M4 5.5c2.7 1.2 5.3 1.2 8 0v5.5a4 4 0 0 1-8 0z"/><path d="M14 9.5c2-.5 4-.9 6-1.9v5.4a4 4 0 0 1-6 3.5"/><path d="M6.5 9h.1M9.5 9h.1M6.8 12.2c.8.6 1.6.6 2.4 0"/>',
    edu: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5V16c1.6 1.4 3.4 2 5.5 2s3.9-.6 5.5-2v-4.5"/><path d="M21.5 9.5v5"/>',
    data: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.1M8 17h.1"/>',
    portal: '<path d="M3 20.5h18"/><path d="M6 20.5V12a6 6 0 0 1 12 0v8.5"/><path d="M9.5 20.5V13a2.5 2.5 0 0 1 5 0v7.5"/>',
    lighthouse:
        '<path d="M9 21l1.5-12h3L15 21"/><path d="M8.5 9h7M10 6h4l-.5 3h-3z"/><path d="M12 3v3M4 6.5l3 .8M20 6.5l-3 .8"/><path d="M6 21h12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    oil: '<path d="M7 21V8l5-4 5 4v13"/><path d="M7 12h10M9.5 21v-5h5v5"/><path d="M12 4V2"/>',
    district:
        '<path d="M4 20V9l8-5 8 5v11z"/><path d="M9 20v-6h6v6"/><path d="M12 4v-1.5"/>',
    pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/>',
};

/** Currency faces (gdd §3.1): drawn, duotone, explicit fills. */
const FACES: Record<string, string> = {
    e0: '<path d="M12 2.3c5.1.2 9.6 4.3 9.7 9.6.1 5.4-4.3 9.9-9.8 9.8C6.6 21.6 2.3 17.3 2.3 12 2.2 6.6 6.8 2.1 12 2.3z" fill="#D7DCE6" stroke="#5F6886" stroke-width="1.2"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#9AA3BC" stroke-width=".9"/><path d="M8.2 9.4c.6-1.4 2-2.2 3.8-2.2s3.2.8 3.8 2.2l.2 4.4c0 2-1.8 3.4-4 3.4s-4-1.4-4-3.4z" fill="#B7BECF" stroke="#4E5672" stroke-width=".9"/><circle cx="10.3" cy="10.6" r="1.35" fill="#fff" stroke="#3E4560" stroke-width=".8"/><circle cx="13.7" cy="10.6" r="1.35" fill="#fff" stroke="#3E4560" stroke-width=".8"/><path d="M12 11.6l-.6 1 .6.7.6-.7z" fill="#3E4560"/>',
    e1000: '<path d="M8.6 6.6c-2.9 2-4.6 5-4.6 8 0 3.6 2.8 5.8 7.4 5.8s7.2-2.2 7.2-5.6c0-3-1.7-6.1-4.6-8.2z" fill="#B97D45" stroke="#4E2D12" stroke-width="1.1"/><path d="M8.4 6.6c1.2-.5 2.3-.7 3.6-.7s2.3.2 3.5.7" fill="none" stroke="#4E2D12" stroke-width="1.1"/><path d="M9.3 3.4l1.5 2.4h2.6l1.4-2.4z" fill="#D49A5E" stroke="#4E2D12" stroke-width="1.1" stroke-linejoin="round"/><path d="M7.3 12.6c1.3.6 2.8.9 4.4.9" fill="none" stroke="#7A4A22" stroke-width=".9" stroke-linecap="round"/><circle cx="17.4" cy="17.8" r="3.6" fill="#DFE3EB" stroke="#4E5672" stroke-width="1"/><circle cx="17.4" cy="17.8" r="1.7" fill="none" stroke="#8C95AE" stroke-width=".8"/>',
    e1500: '<circle cx="12" cy="12" r="9.8" fill="#F1C24E" stroke="#8A5B0A" stroke-width="1.1"/><circle cx="12" cy="12" r="8.4" fill="none" stroke="#B9831A" stroke-width="1.1" stroke-dasharray="1 1.1"/><path d="M12 6.3c-1.3 1.4-1.6 3-.9 4.6.3.7.5 1.3.4 2.1h1c-.1-.8.1-1.4.4-2.1.7-1.6.4-3.2-.9-4.6zM8 9.8c-.7 1.6.2 3.3 2.3 3.3-.4-1.3-1-2.4-2.3-3.3zM16 9.8c.7 1.6-.2 3.3-2.3 3.3.4-1.3 1-2.4 2.3-3.3zM9.2 13.6h5.6v1.1H9.2zM11.4 14.7h1.2v2.6h-1.2z" fill="#8A5B0A"/>',
    e1800: '<rect x="1.8" y="5.5" width="20.4" height="13" rx="1.6" fill="#D5E6C8" stroke="#3F5E3A" stroke-width="1.1"/><rect x="3.6" y="7.2" width="16.8" height="9.6" rx=".8" fill="none" stroke="#6E9165" stroke-width=".8"/><path d="M4 12c1.2-1.6 2.4-1.6 3.6 0s2.4 1.6 3.6 0 2.4-1.6 3.6 0 2.4 1.6 3.6 0" fill="none" stroke="#8DB083" stroke-width=".8"/><path d="M9.3 14.6h6.3v-2.2h-1.4v-1.5h-1.2v1.5h-2.4l-1.3 1.2z" fill="#3F5E3A"/>',
    e1900: '<rect x="2.5" y="7" width="16" height="10" rx="1.4" fill="#6FA66C" stroke="#2F5A30" stroke-width="1.1" transform="rotate(-8 10.5 12)"/><rect x="4" y="8.5" width="16" height="10" rx="1.4" fill="#9CCB93" stroke="#2F5A30" stroke-width="1.1"/><circle cx="12" cy="13.5" r="2.4" fill="none" stroke="#2F5A30" stroke-width="1"/><circle cx="18" cy="17.2" r="3.6" fill="#E9C25A" stroke="#7D5810" stroke-width="1.1"/>',
    e2000: '<rect x="2" y="5" width="20" height="14" rx="2.4" fill="#5B8DEF" stroke="#1F3F8F" stroke-width="1.1"/><rect x="4.6" y="9" width="4.4" height="3.4" rx=".7" fill="#F1CF6B" stroke="#8C6A12" stroke-width=".7"/><path d="M14.2 9.3a3.6 3.6 0 0 1 0 4.4M16.4 8a5.6 5.6 0 0 1 0 7" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/><path d="M4.6 15.6h6" stroke="#CFE0FF" stroke-width="1.1" stroke-linecap="round"/>',
    e2100: '<path d="M12 1.8l8.8 5.1v10.2L12 22.2l-8.8-5.1V6.9z" fill="#3B2C7A" stroke="#C3A6FF" stroke-width="1.1"/><path d="M12 5.4l5.7 3.3v6.6L12 18.6l-5.7-3.3V8.7z" fill="#8F6BFF"/><path d="M12 8.6l2.9 1.7v3.4L12 15.4l-2.9-1.7v-3.4z" fill="#E4D8FF"/>',
};

export type IconName = keyof typeof ICONS;

const SPRITE = [
    ...Object.entries(ICONS).map(
        ([id, body]) =>
            `<symbol id="c3-i-${id}" viewBox="0 0 24 24">${body}</symbol>`,
    ),
    ...Object.entries(FACES).map(
        ([id, body]) =>
            `<symbol id="c3-cur-${id}" viewBox="0 0 24 24">${body}</symbol>`,
    ),
].join('');

export function hasIcon(name: string): boolean {
    return name in ICONS;
}

/** The sprite, once per page (hidden). */
export function IconSprite() {
    return (
        <svg
            width="0"
            height="0"
            className="c3-sprite"
            aria-hidden="true"
            focusable="false"
            dangerouslySetInnerHTML={{ __html: `<defs>${SPRITE}</defs>` }}
        />
    );
}
