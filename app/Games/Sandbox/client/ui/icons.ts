/**
 * Line icons for buttons and labels, drawn in the text colour. Inline SVG
 * rather than emoji: several emoji are missing on Windows 10.
 */

const line = (body: string) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
    bag: line(
        '<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M9.5 12h5"/>',
    ),
    craft: line(
        '<path d="m14 6 4 4"/><path d="M15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L18 10l-4-4z"/><path d="M14 10 5 19l-1-1 9-9"/><path d="M4 18l2 2"/>',
    ),
    hero: line(
        '<circle cx="12" cy="7" r="3.5"/><path d="M5 20c.5-4 3.4-6.5 7-6.5s6.5 2.5 7 6.5"/>',
    ),
    settings: line(
        '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/><circle cx="12" cy="12" r="7"/>',
    ),
    pause: line('<path d="M9 5v14M15 5v14"/>'),
    play: line('<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>'),
    close: line('<path d="M6 6l12 12M18 6 6 18"/>'),
    exit: line(
        '<path d="M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>',
    ),
    sword: line(
        '<path d="M14.5 4H20v5.5L10 19.5 4.5 14z"/><path d="M7 11.5l5.5 5.5"/><path d="M4 20l3-3"/>',
    ),
    jump: line(
        '<path d="M12 19V6"/><path d="M6.5 11 12 5.5l5.5 5.5"/><path d="M6 20h12"/>',
    ),
    hand: line(
        '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M14 10V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L4 14a1.5 1.5 0 0 1 2.5-1.5L8 14"/>',
    ),
    build: line(
        '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M10 21v-6h4v6"/>',
    ),
    eat: line(
        '<path d="M12 7c-2.5-2-7-1.5-7 4 0 5 3.5 9 7 9s7-4 7-9c0-5.5-4.5-6-7-4z"/><path d="M12 7c0-2 1-3.5 3-4"/>',
    ),
    door: line(
        '<path d="M6 21V4h12v17"/><path d="M4 21h16"/><circle cx="14.5" cy="12.5" r=".9" fill="currentColor"/>',
    ),
    chest: line(
        '<path d="M4 10h16v9H4z"/><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4"/><path d="M11 12h2v2h-2z"/>',
    ),
    sit: line(
        '<circle cx="9" cy="5" r="2"/><path d="M9 8v6h6l2 5"/><path d="M9 11h5"/><path d="M5 19h8"/>',
    ),
    crouch: line(
        '<circle cx="12" cy="5" r="2"/><path d="M12 8l-2 5 4 2-1 5"/><path d="M10 13l-3 3"/><path d="M14 10l3 1"/>',
    ),
    crawl: line(
        '<circle cx="5" cy="12" r="2"/><path d="M7.5 13.5H15l4 3"/><path d="M10 13.5 8 18"/><path d="M15 13.5l-2 4.5"/>',
    ),
    more: line(
        '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
    ),
    sound: line(
        '<path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
    ),
    muted: line(
        '<path d="M5 9v6h4l5 4V5L9 9z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    ),
    heart: line(
        '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10C19.5 15.5 12 20 12 20z" fill="currentColor"/>',
    ),
    shield: line(
        '<path d="M12 3 5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z"/>',
    ),
    fire: line(
        '<path d="M12 21c-3.5 0-6-2.3-6-5.5C6 11 10 9.5 10 5c2.5 1.5 4 4 4 6 1-.8 1.5-2 1.5-3 2 1.5 2.5 4.5 2.5 7.5 0 3.2-2.5 5.5-6 5.5z"/>',
    ),
    workbench: line(
        '<path d="M3 9h18v3H3z"/><path d="M5 12v8M19 12v8"/><path d="M5 16h14"/><path d="M14 5l3 1.5"/>',
    ),
    check: line('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    sort: line(
        '<path d="M7 5v14M4 16l3 3 3-3"/><path d="M14 7h6M14 12h4.5M14 17h3"/>',
    ),
    drop: line(
        '<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 20h14"/>',
    ),
    take: line(
        '<path d="M12 20V9"/><path d="M7.5 13.5 12 9l4.5 4.5"/><path d="M5 4h14"/>',
    ),
    skull: line(
        '<path d="M12 3c-4.4 0-8 3.2-8 7.5 0 2.6 1.3 4.7 3.3 6V20h9.4v-3.5c2-1.3 3.3-3.4 3.3-6C20 6.2 16.4 3 12 3z"/><circle cx="9" cy="11" r="1.6" fill="currentColor"/><circle cx="15" cy="11" r="1.6" fill="currentColor"/>',
    ),
    star: line(
        '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    ),
} as const;

export type IconName = keyof typeof ICONS;
