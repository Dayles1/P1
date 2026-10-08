/**
 * Everything a player can carry. Ids, stack sizes and durability match
 * the server's App\Games\Sandbox\Item; names live in i18n.ts. Food,
 * bandages and potions give health (or mana) back, armour is worn on the
 * head, body or feet and wears out like tools do, placeable things are
 * built into the world, and notes and relics are studied for knowledge.
 *
 * Icons are small inline SVGs (emoji for logs and rocks are missing on
 * Windows 10).
 */

export type ItemId =
    | 'wood'
    | 'stone'
    | 'stick'
    | 'pebble'
    | 'berries'
    | 'mushroom'
    | 'fiber'
    | 'flint'
    | 'iron_ore'
    | 'iron'
    | 'stone_axe'
    | 'stone_pickaxe'
    | 'wood_sword'
    | 'stone_sword'
    | 'iron_axe'
    | 'iron_pickaxe'
    | 'iron_sword'
    | 'shovel'
    | 'dagger'
    | 'war_hammer'
    | 'staff'
    | 'torch'
    | 'campfire'
    | 'raw_meat'
    | 'cooked_meat'
    | 'hide'
    | 'bandage'
    | 'healing_potion'
    | 'mana_potion'
    | 'old_notes'
    | 'relic_shard'
    | 'leather_helmet'
    | 'leather_jacket'
    | 'leather_boots'
    | 'iron_helmet'
    | 'iron_chestplate'
    | 'iron_boots'
    | 'chest'
    | 'workbench'
    | 'wood_wall'
    | 'wood_door'
    | 'wood_roof'
    | 'stone_wall'
    | 'sleeping_bag'
    | 'wind_feather'
    | 'sun_stone'
    | 'frost_crystal'
    | 'forest_heart'
    | 'golden_clover'
    | 'strength_rune'
    | 'agility_rune'
    | 'spirit_rune'
    | 'vital_shard'
    | 'mana_pearl'
    | 'swift_charm'
    | 'storm_eye'
    | 'deep_pearl'
    | 'blood_ruby'
    | 'phoenix_feather'
    | 'essence';

export type ToolKind = 'axe' | 'pickaxe' | 'sword' | 'shovel';

/** Where a piece of armour is worn. */
export type ArmorSlot = 'head' | 'body' | 'feet';

export const ARMOR_SLOTS: ArmorSlot[] = ['head', 'body', 'feet'];

export type ArtifactId =
    | 'wind_feather'
    | 'sun_stone'
    | 'frost_crystal'
    | 'forest_heart'
    | 'golden_clover'
    | 'strength_rune'
    | 'agility_rune'
    | 'spirit_rune'
    | 'vital_shard'
    | 'mana_pearl'
    | 'swift_charm'
    | 'storm_eye'
    | 'deep_pearl'
    | 'blood_ruby'
    | 'phoenix_feather';

export interface ItemDefinition {
    maxStack: number;
    icon: string;
    /** Uses before it breaks (tools and weapons). */
    durability?: number;
    tool?: { kind: ToolKind; power: number };
    /** Can be put down in the world. */
    placeable?: boolean;
    artifact?: boolean;
    /** Eaten or put on: the health it gives back. */
    heals?: number;
    /** Drunk: the mana it gives back. */
    mana?: number;
    /** Studied (read, examined): the knowledge it gives. */
    knowledge?: number;
    /**
     * How a weapon differs from a plain one: blows `speed` times as quick,
     * `crit` more chance of a critical hit, spells `spell` times as strong.
     */
    weapon?: { speed?: number; crit?: number; spell?: number };
    /** Worn: where, and how many armour points it adds. */
    armor?: { slot: ArmorSlot; points: number };
}

const svg = (body: string) =>
    `<svg viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;

const HANDLE =
    '<path d="M9 27 21 9" stroke="#9c7e5f" stroke-width="3" stroke-linecap="round"/>';
const STONE_HEAD = '#a7a6a2';
const IRON_HEAD = '#c9d0d6';

function axe(head: string): string {
    return svg(
        `${HANDLE}<path d="M17 5c4 0 8 3 8 8l-6-1-3-3z" fill="${head}" stroke="#6f6d69" stroke-width="1"/>`,
    );
}

function pickaxe(head: string): string {
    return svg(
        `${HANDLE}<path d="M8 10c6-6 14-6 18 0-5-2-9-2-13 2z" fill="${head}" stroke="#6f6d69" stroke-width="1"/>`,
    );
}

function sword(blade: string): string {
    return svg(
        `<path d="M24 4 27 5 26 8 13 21 10 18z" fill="${blade}" stroke="#6f6d69" stroke-width="1"/><path d="M8 17l7 7" stroke="#6f5a45" stroke-width="2.5" stroke-linecap="round"/><path d="M6 26l4-4" stroke="#9c7e5f" stroke-width="3" stroke-linecap="round"/>`,
    );
}

const LEATHER = ['#a77a50', '#7e5a37'] as const;
const IRON_PLATE = ['#c9d0d6', '#8f979f'] as const;

function helmet([fill, dark]: readonly [string, string], iron: boolean) {
    return svg(
        `<path d="M6 20c0-7.5 4.5-13 10-13s10 5.5 10 13z" fill="${fill}"/><rect x="4" y="18.5" width="24" height="4.5" rx="2.2" fill="${dark}"/>` +
            (iron
                ? `<path d="M14.6 21h2.8v6.5h-2.8z" fill="${dark}"/><path d="M16 8v10" stroke="#e6eaee" stroke-width="1.6"/>`
                : `<path d="M10 12c3-2 9-2 12 0" stroke="${dark}" stroke-width="1.4" fill="none"/>`),
    );
}

function torso([fill, dark]: readonly [string, string], iron: boolean) {
    return svg(
        `<path d="M10 5 4 10.5l3.2 5.2 2.8-2V27h12V13.7l2.8 2 3.2-5.2L22 5c-1 2.2-3.2 3.4-6 3.4S11 7.2 10 5z" fill="${fill}"/>` +
            (iron
                ? `<path d="M10 14h12M10 19h12M16 9v18" stroke="${dark}" stroke-width="1.3"/>`
                : `<path d="M10 22h12" stroke="${dark}" stroke-width="2"/><path d="M16 9v13" stroke="${dark}" stroke-width="1" stroke-dasharray="2 2"/>`),
    );
}

function boots([fill, dark]: readonly [string, string]) {
    return svg(
        `<path d="M7 5h8v14l9.5 3.2c1.6.5 2.5 1.6 2.5 3V27H7z" fill="${fill}"/><path d="M7 24.5h20V28H7z" fill="${dark}"/><path d="M7 10h8" stroke="${dark}" stroke-width="1.5"/>`,
    );
}

function rune(glyph: string, color: string): string {
    return svg(
        `<path d="M9 4h14l3 6-3 18H9L6 10z" fill="#8f8b83"/><path d="M9 4h14l3 6H6z" fill="#aaa69e"/><path d="${glyph}" stroke="${color}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="17" r="11" fill="none" stroke="${color}" stroke-opacity=".35" stroke-width="1.5"/>`,
    );
}

function pearl(fill: string, shine: string): string {
    return svg(
        `<circle cx="16" cy="17" r="9" fill="${fill}"/><circle cx="12.5" cy="13.5" r="3" fill="${shine}" fill-opacity=".8"/><path d="M5 26c3-2 19-2 22 0" stroke="#b9a37a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="17" r="13" fill="none" stroke="${fill}" stroke-opacity=".35" stroke-width="1.5"/>`,
    );
}

function shovel(): string {
    return svg(
        `<path d="M8 27 20 10" stroke="#9c7e5f" stroke-width="3" stroke-linecap="round"/><path d="M6 25.5 9.5 29" stroke="#6f5a45" stroke-width="3" stroke-linecap="round"/><path d="M18 12.5c-1-3.5 1-7 4.5-8.5L28 9.5c-1.5 3.5-5 5.5-8.5 4.5z" fill="${STONE_HEAD}" stroke="#6f6d69" stroke-width="1"/>`,
    );
}

function potion(fill: string, shine: string): string {
    return svg(
        `<path d="M13 4h6v3h-6z" fill="#b48a60"/><path d="M13.5 7h5v4.5c4 1.6 6.5 5 6.5 9 0 5-4 7.5-9 7.5s-9-2.5-9-7.5c0-4 2.5-7.4 6.5-9z" fill="#e8eef0" fill-opacity=".55" stroke="#9aa6ac" stroke-width="1"/><path d="M8.3 19.5h15.4c.3 4.6-3.2 6.6-7.7 6.6s-8-2-7.7-6.6z" fill="${fill}"/><circle cx="12.5" cy="17" r="1.4" fill="${shine}"/>`,
    );
}

function meat(fill: string, marbling: string, cooked: boolean): string {
    return svg(
        `<path d="M9.5 21.5 5 26" stroke="#efe6d8" stroke-width="3.2" stroke-linecap="round"/><circle cx="4.6" cy="26.4" r="2.2" fill="#efe6d8"/><path d="M8 20c-3-5.5.5-12.5 8-13.3 6.4-.7 11 3.6 10 9.4-.9 5.3-6.4 8.4-11.6 7.4z" fill="${fill}"/>` +
            (cooked
                ? `<path d="M12 12l9 8M15 9.5l8 7.5M10 16l6 5.5" stroke="${marbling}" stroke-width="1.5" stroke-linecap="round"/>`
                : `<path d="M13 12c3 1 6 0 8.5 3M12 17c2 1 4 1 6 3" stroke="${marbling}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`),
    );
}

function gem(fill: string, shine: string): string {
    return svg(
        `<path d="M16 3 26 13 16 29 6 13z" fill="${fill}"/><path d="M16 3 21 13H11z" fill="${shine}"/><circle cx="16" cy="16" r="13" fill="none" stroke="${fill}" stroke-opacity=".35" stroke-width="1.5"/>`,
    );
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
    wood: {
        maxStack: 100,
        icon: svg(
            '<rect x="4" y="11" width="22" height="11" rx="5.5" fill="#a88b6c"/><ellipse cx="25" cy="16.5" rx="4" ry="5.5" fill="#d9c3a2"/><ellipse cx="25" cy="16.5" rx="1.8" ry="2.6" fill="none" stroke="#a88b6c" stroke-width="1"/><path d="M8 14h9M10 19h8" stroke="#8a6f53" stroke-width="1.2" stroke-linecap="round"/>',
        ),
    },
    stone: {
        maxStack: 100,
        icon: svg(
            '<path d="M5 22 9 11l8-4 8 5 3 10-6 4H11z" fill="#a7a6a2"/><path d="M9 11l8-4 8 5-7 3z" fill="#c4c3bf"/><path d="M18 15 25 12l3 10-6 4z" fill="#8e8d89"/>',
        ),
    },
    stick: {
        maxStack: 50,
        icon: svg(
            '<path d="M6 26 26 6" stroke="#9c7e5f" stroke-width="3" stroke-linecap="round"/><path d="M15 17l-4-6M19 13l5 1" stroke="#9c7e5f" stroke-width="2" stroke-linecap="round"/>',
        ),
    },
    pebble: {
        maxStack: 50,
        icon: svg(
            '<ellipse cx="12" cy="19" rx="7" ry="5" fill="#b6b3ad"/><ellipse cx="21" cy="14" rx="5" ry="4" fill="#9d9a94"/><ellipse cx="22" cy="23" rx="4" ry="3" fill="#c8c5bf"/>',
        ),
    },
    berries: {
        maxStack: 30,
        heals: 4,
        icon: svg(
            '<path d="M16 5c-1 3-1 5 0 8" stroke="#7d8f6a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M16 7c3-2 7-2 9 0-3 2-6 2-9 0z" fill="#93a67e"/><circle cx="11" cy="18" r="5" fill="#b4545a"/><circle cx="20" cy="20" r="5" fill="#9e4148"/><circle cx="15" cy="25" r="4.5" fill="#c06a70"/>',
        ),
    },
    mushroom: {
        maxStack: 30,
        heals: 3,
        icon: svg(
            '<path d="M13 16h6l1 11h-8z" fill="#e7e0d3"/><path d="M4 17c0-7 6-11 12-11s12 4 12 11z" fill="#b98a68"/><circle cx="11" cy="12" r="1.6" fill="#ead9c4"/><circle cx="19" cy="10" r="1.3" fill="#ead9c4"/><circle cx="22" cy="14" r="1.1" fill="#ead9c4"/>',
        ),
    },
    fiber: {
        maxStack: 50,
        icon: svg(
            '<path d="M8 27c2-8 2-14 0-21M14 27c1-9 3-15 7-20M20 27c0-7 2-11 6-14M11 27c0-6-2-10-5-13" stroke="#92a37c" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
        ),
    },
    flint: {
        maxStack: 30,
        icon: svg(
            '<path d="M7 20 12 8l10-2 4 9-6 11-9-1z" fill="#5f6266"/><path d="M12 8l10-2-3 8z" fill="#7d8186"/><path d="M14 16l5 2" stroke="#9aa0a6" stroke-width="1"/>',
        ),
    },
    iron_ore: {
        maxStack: 50,
        icon: svg(
            '<path d="M5 22 9 11l8-4 8 5 3 10-6 4H11z" fill="#8f8a84"/><circle cx="12" cy="15" r="2.2" fill="#b0714e"/><circle cx="19" cy="19" r="2.6" fill="#a8613f"/><circle cx="20" cy="12" r="1.6" fill="#c18663"/>',
        ),
    },
    iron: {
        maxStack: 50,
        icon: svg(
            '<path d="M4 20 10 12h18l-6 8z" fill="#d6dbe0"/><path d="M4 20h18v5H4z" fill="#aeb5bc"/><path d="M22 20l6-8v5l-6 8z" fill="#8f979f"/>',
        ),
    },
    stone_axe: {
        maxStack: 1,
        durability: 60,
        tool: { kind: 'axe', power: 2 },
        icon: axe(STONE_HEAD),
    },
    stone_pickaxe: {
        maxStack: 1,
        durability: 60,
        tool: { kind: 'pickaxe', power: 2 },
        icon: pickaxe(STONE_HEAD),
    },
    wood_sword: {
        maxStack: 1,
        durability: 40,
        tool: { kind: 'sword', power: 2 },
        icon: sword('#c7ab86'),
    },
    stone_sword: {
        maxStack: 1,
        durability: 80,
        tool: { kind: 'sword', power: 3 },
        icon: sword(STONE_HEAD),
    },
    iron_axe: {
        maxStack: 1,
        durability: 200,
        tool: { kind: 'axe', power: 3 },
        icon: axe(IRON_HEAD),
    },
    iron_pickaxe: {
        maxStack: 1,
        durability: 200,
        tool: { kind: 'pickaxe', power: 3 },
        icon: pickaxe(IRON_HEAD),
    },
    iron_sword: {
        maxStack: 1,
        durability: 250,
        tool: { kind: 'sword', power: 5 },
        icon: sword(IRON_HEAD),
    },
    shovel: {
        maxStack: 1,
        durability: 80,
        tool: { kind: 'shovel', power: 2 },
        icon: shovel(),
    },
    dagger: {
        maxStack: 1,
        durability: 150,
        tool: { kind: 'sword', power: 2 },
        weapon: { speed: 1.4, crit: 0.12 },
        icon: svg(
            `<path d="M22 5 25 6 24 9 15.5 17.5 13.5 15.5z" fill="${IRON_HEAD}" stroke="#6f6d69" stroke-width="1"/><path d="M11 15l5 5" stroke="#6f5a45" stroke-width="2.5" stroke-linecap="round"/><path d="M8 24l4.5-4.5" stroke="#3f3a44" stroke-width="3.4" stroke-linecap="round"/>`,
        ),
    },
    war_hammer: {
        maxStack: 1,
        durability: 260,
        tool: { kind: 'sword', power: 6 },
        weapon: { speed: 0.75 },
        icon: svg(
            `<path d="M8 27 19 12" stroke="#9c7e5f" stroke-width="3" stroke-linecap="round"/><path d="M14 9.5 21 3l8 8-6.5 7z" fill="${IRON_HEAD}" stroke="#6f6d69" stroke-width="1"/><path d="M17.5 6.2l8.3 8.3" stroke="#8f979f" stroke-width="1.6"/>`,
        ),
    },
    staff: {
        maxStack: 1,
        durability: 200,
        weapon: { spell: 1.4 },
        icon: svg(
            '<path d="M8 28 22 10" stroke="#7e5a37" stroke-width="2.8" stroke-linecap="round"/><path d="M20 12c-2-3-1-7 3-8 2 1 3 2 4 4-1 3-4 5-7 4z" fill="none" stroke="#7e5a37" stroke-width="2"/><circle cx="23.5" cy="8" r="2.6" fill="#9fd7f2"/><circle cx="23.5" cy="8" r="5" fill="#9fd7f2" fill-opacity=".25"/>',
        ),
    },
    torch: {
        maxStack: 10,
        icon: svg(
            '<path d="M13 28 17 13" stroke="#9c7e5f" stroke-width="3.2" stroke-linecap="round"/><path d="M18 3c4 4 4 8 0 11-3-1-5-4-3-8 1 2 2 2 3 0z" fill="#e9a85a"/><path d="M17 8c2 2 2 4 0 6-2-1-2-3 0-6z" fill="#f6dc97"/>',
        ),
    },
    campfire: {
        maxStack: 5,
        placeable: true,
        icon: svg(
            '<path d="M5 25 27 20M5 20l22 5" stroke="#9c7e5f" stroke-width="3.2" stroke-linecap="round"/><path d="M16 5c5 5 6 10 2 15h-4c-4-4-2-9 1-11 0 3 1 4 2 4 1-3 0-5-1-8z" fill="#e9a85a"/>',
        ),
    },
    raw_meat: {
        maxStack: 20,
        heals: 6,
        icon: meat('#c9636a', '#eaa4a7', false),
    },
    cooked_meat: {
        maxStack: 20,
        heals: 30,
        icon: meat('#a0623f', '#6f3f24', true),
    },
    hide: {
        maxStack: 30,
        icon: svg(
            '<path d="M7 6c3 2 6 2 9 0 3 2 6 2 9 0-1 4 0 7 2 9-2 3-2 7 0 11-3-1-6-1-9 1-3-2-6-2-9-1 2-4 2-8 0-11 2-2 3-5-2-9z" fill="#b38b62"/><ellipse cx="16" cy="16.5" rx="5.5" ry="6.5" fill="#9c7650" opacity=".55"/>',
        ),
    },
    bandage: {
        maxStack: 10,
        heals: 25,
        icon: svg(
            '<rect x="5" y="9" width="22" height="14" rx="3.5" fill="#efe9de"/><path d="M21 9v14" stroke="#d8d0c2" stroke-width="1.4"/><path d="M14 12.5v7M10.5 16h7" stroke="#c4565b" stroke-width="2.6" stroke-linecap="round"/>',
        ),
    },
    healing_potion: {
        maxStack: 10,
        heals: 60,
        icon: potion('#c4565b', '#f3b1b4'),
    },
    mana_potion: {
        maxStack: 10,
        mana: 60,
        icon: potion('#4f7fd0', '#b8d0f7'),
    },
    old_notes: {
        maxStack: 20,
        knowledge: 10,
        icon: svg(
            '<path d="M7 6h15l3 3v17H7z" fill="#efe3c4"/><path d="M22 6v3h3" fill="#d8c79d"/><path d="M10.5 12h11M10.5 16h11M10.5 20h7" stroke="#9c8a66" stroke-width="1.4" stroke-linecap="round"/><path d="M5 9c0-2 1-3 2-3v20c-1 0-2-1-2-3z" fill="#c9b78f"/>',
        ),
    },
    relic_shard: {
        maxStack: 20,
        knowledge: 25,
        icon: svg(
            '<path d="M9 5 22 7 27 17 18 27 6 21z" fill="#a49b8a"/><path d="M9 5 22 7 16 15z" fill="#bfb6a3"/><path d="M12 12c2 1 3 3 3 5M19 11l2 6M11 19l5 1" stroke="#d9b45a" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
        ),
    },
    leather_helmet: {
        maxStack: 1,
        durability: 80,
        armor: { slot: 'head', points: 4 },
        icon: helmet(LEATHER, false),
    },
    leather_jacket: {
        maxStack: 1,
        durability: 120,
        armor: { slot: 'body', points: 8 },
        icon: torso(LEATHER, false),
    },
    leather_boots: {
        maxStack: 1,
        durability: 80,
        armor: { slot: 'feet', points: 3 },
        icon: boots(LEATHER),
    },
    iron_helmet: {
        maxStack: 1,
        durability: 220,
        armor: { slot: 'head', points: 8 },
        icon: helmet(IRON_PLATE, true),
    },
    iron_chestplate: {
        maxStack: 1,
        durability: 320,
        armor: { slot: 'body', points: 16 },
        icon: torso(IRON_PLATE, true),
    },
    iron_boots: {
        maxStack: 1,
        durability: 220,
        armor: { slot: 'feet', points: 6 },
        icon: boots(IRON_PLATE),
    },
    chest: {
        maxStack: 5,
        placeable: true,
        icon: svg(
            '<path d="M4 13c0-3.3 2.2-6 5-6h14c2.8 0 5 2.7 5 6z" fill="#b88a5c"/><rect x="4" y="12" width="24" height="15" rx="2" fill="#a57a4f"/><path d="M4 16.5h24" stroke="#7e5a37" stroke-width="2"/><path d="M9 12v15M23 12v15" stroke="#8d6741" stroke-width="1.5"/><rect x="14" y="14.5" width="4" height="5" rx="1" fill="#d8c27a"/>',
        ),
    },
    workbench: {
        maxStack: 2,
        placeable: true,
        icon: svg(
            '<path d="M6.5 14v13M25.5 14v13" stroke="#8c6a48" stroke-width="3" stroke-linecap="round"/><path d="M6.5 22h19" stroke="#8c6a48" stroke-width="2"/><rect x="3" y="10" width="26" height="5" rx="1.2" fill="#b48a60"/><path d="M15 4.5l7 3.5" stroke="#6f6d69" stroke-width="3.2" stroke-linecap="round"/><path d="M18.5 6.2 16 10" stroke="#9c7e5f" stroke-width="1.8"/>',
        ),
    },
    wood_wall: {
        maxStack: 20,
        placeable: true,
        icon: svg(
            '<rect x="5" y="5" width="22" height="22" rx="1.5" fill="#b48a60"/><path d="M5 12.3h22M5 19.6h22" stroke="#8c6a48" stroke-width="1.5"/><path d="M12 5v7.3M20 12.3v7.3M10 19.6V27" stroke="#8c6a48" stroke-width="1.2"/>',
        ),
    },
    wood_door: {
        maxStack: 5,
        placeable: true,
        icon: svg(
            '<rect x="8" y="3" width="16" height="26" rx="1.5" fill="#a57a4f"/><path d="M8 11h16M8 21h16" stroke="#7e5a37" stroke-width="1.5"/><path d="M13.3 3v26M18.6 3v26" stroke="#946c45" stroke-width=".8"/><circle cx="20.5" cy="16" r="1.6" fill="#d8c27a"/>',
        ),
    },
    wood_roof: {
        maxStack: 20,
        placeable: true,
        icon: svg(
            '<path d="M3 17 16 6l13 11z" fill="#a57a4f"/><path d="M3 17 16 6l13 11h-4L16 9.5 7 17z" fill="#8c6a48"/><path d="M8 13h16M5.5 15.5h21" stroke="#7e5a37" stroke-width="1"/><path d="M7 17v9h18v-9" fill="none" stroke="#b48a60" stroke-width="2" stroke-dasharray="2 2"/>',
        ),
    },
    stone_wall: {
        maxStack: 20,
        placeable: true,
        icon: svg(
            '<rect x="4" y="5" width="24" height="22" rx="1.5" fill="#a7a6a2"/><path d="M4 12.3h24M4 19.6h24M11 5v7.3M20 5v7.3M15 12.3v7.3M24 12.3v7.3M9 19.6V27M19 19.6V27" stroke="#7d7c78" stroke-width="1.3"/>',
        ),
    },
    sleeping_bag: {
        maxStack: 2,
        placeable: true,
        icon: svg(
            '<rect x="4" y="9" width="24" height="14" rx="7" fill="#7f9a72"/><rect x="4" y="9" width="9" height="14" rx="4.5" fill="#efe6d8"/><path d="M16 12v8M21 12v8" stroke="#6b8560" stroke-width="1.2"/>',
        ),
    },
    wind_feather: {
        maxStack: 1,
        artifact: true,
        icon: svg(
            '<path d="M24 4C12 6 7 15 8 26l3-3c1-6 5-11 13-19z" fill="#cfe3ea"/><path d="M8 26 22 7" stroke="#8fb3c1" stroke-width="1.4"/><circle cx="16" cy="16" r="13" fill="none" stroke="#8fb3c1" stroke-opacity=".4" stroke-width="1.5"/>',
        ),
    },
    sun_stone: { maxStack: 1, artifact: true, icon: gem('#e8b45a', '#f8dfa0') },
    frost_crystal: {
        maxStack: 1,
        artifact: true,
        icon: gem('#8cc2db', '#d7eef7'),
    },
    forest_heart: {
        maxStack: 1,
        artifact: true,
        icon: gem('#79a36c', '#bfdcae'),
    },
    golden_clover: {
        maxStack: 1,
        artifact: true,
        icon: svg(
            '<circle cx="12" cy="11" r="5" fill="#d9b44a"/><circle cx="20" cy="11" r="5" fill="#e3c25e"/><circle cx="12" cy="19" r="5" fill="#e3c25e"/><circle cx="20" cy="19" r="5" fill="#d9b44a"/><path d="M16 15c1 6 3 9 6 12" stroke="#a88a35" stroke-width="2" fill="none"/>',
        ),
    },
    strength_rune: {
        maxStack: 10,
        artifact: true,
        icon: rune('M12 11l4 4 4-4M16 15v8', '#e0675f'),
    },
    agility_rune: {
        maxStack: 10,
        artifact: true,
        icon: rune('M11 22l5-11 5 11M13 18h6', '#6fbf6a'),
    },
    spirit_rune: {
        maxStack: 10,
        artifact: true,
        icon: rune(
            'M16 10v13M11 13c3 3 7 3 10 0M11 19c3-3 7-3 10 0',
            '#6f9fe8',
        ),
    },
    vital_shard: {
        maxStack: 10,
        artifact: true,
        icon: gem('#d9534f', '#f2a5a2'),
    },
    mana_pearl: {
        maxStack: 10,
        artifact: true,
        icon: pearl('#5f8fe0', '#d6e4fb'),
    },
    swift_charm: {
        maxStack: 10,
        artifact: true,
        icon: svg(
            '<path d="M16 3v6" stroke="#b9a37a" stroke-width="1.6"/><circle cx="16" cy="18" r="8" fill="#d8eef2" stroke="#7fb8c6" stroke-width="2"/><path d="M11 21c4-1 7-4 9-9-1 5-1 8 1 10" stroke="#4f97a8" stroke-width="2" fill="none" stroke-linecap="round"/>',
        ),
    },
    storm_eye: {
        maxStack: 1,
        artifact: true,
        icon: svg(
            '<ellipse cx="16" cy="16" rx="12" ry="8" fill="#3d4a73"/><circle cx="16" cy="16" r="5.5" fill="#9fd7f2"/><path d="M17 11l-3 5h4l-3 5" stroke="#fff27a" stroke-width="1.8" fill="none" stroke-linejoin="round"/><circle cx="16" cy="16" r="14" fill="none" stroke="#9fd7f2" stroke-opacity=".4" stroke-width="1.5"/>',
        ),
    },
    deep_pearl: {
        maxStack: 1,
        artifact: true,
        icon: pearl('#2f7f8f', '#bdf0f2'),
    },
    blood_ruby: {
        maxStack: 1,
        artifact: true,
        icon: gem('#8f1f2f', '#e0505f'),
    },
    phoenix_feather: {
        maxStack: 1,
        artifact: true,
        icon: svg(
            '<path d="M24 4C12 6 7 15 8 26l3-3c1-6 5-11 13-19z" fill="#f08a3c"/><path d="M21 8c-6 3-9 8-9 14" stroke="#ffd36b" stroke-width="2" fill="none"/><path d="M8 26 22 7" stroke="#b5441f" stroke-width="1.2"/><circle cx="16" cy="16" r="13" fill="none" stroke="#f08a3c" stroke-opacity=".4" stroke-width="1.5"/>',
        ),
    },
    essence: {
        maxStack: 50,
        icon: svg(
            '<path d="M12 4h8v4c4 2 6 6 6 10a10 10 0 0 1-20 0c0-4 2-8 6-10z" fill="#e8e2f5" fill-opacity=".6" stroke="#9a8fc0" stroke-width="1"/><path d="M8 19c3-3 6 2 9-1s5 1 7 0c0 5-3.5 8-8 8s-8-3-8-7z" fill="#a587e0"/><circle cx="13" cy="15" r="1.3" fill="#fff"/><circle cx="19" cy="21" r="1" fill="#fff"/>',
        ),
    },
};

export function isItem(value: unknown): value is ItemId {
    return typeof value === 'string' && value in ITEMS;
}

/** Items that are studied for knowledge (notes, relics). */
export function studied(item: ItemId): boolean {
    return Boolean(ITEMS[item].knowledge);
}

/**
 * How hard a blow lands on a creature: swords are made for it, other
 * tools do a little better than bare hands.
 */
export function strikeDamage(item: ItemId | null): number {
    const tool = item ? ITEMS[item].tool : undefined;

    if (!tool) {
        return 2;
    }

    return tool.kind === 'sword' ? 3 + tool.power * 2 : 2 + tool.power;
}
