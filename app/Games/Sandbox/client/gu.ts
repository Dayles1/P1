/**
 * What artifacts look like: living Gu — insects and worms refined into
 * power, the way a Gu Master's are. Which creature an artifact is follows
 * from what it gives, so it needs nothing saved:
 *
 * - a skill artifact is the Gu of its skill (vampirism — a blood leech,
 *   swiftness — a dragonfly…);
 * - a stats artifact is a Gu of the attribute it gives most (strength —
 *   a beetle or a mantis, agility — a centipede or a spider, spirit — a
 *   moth or a silkworm; which of the two by its numbers), and a golden
 *   scarab when its points are spread evenly.
 *
 * The rank shows round it: ranks 1–3 bare, 4–5 a soft glow, the immortal
 * 6–9 a ring of their rank's colour and sparks, more of them the higher.
 */

import { ATTRIBUTES, pointsOf } from './hero';
import type { Artifact, Attribute, Passive } from './hero';

export type Species =
    | 'leech'
    | 'cicada'
    | 'locust'
    | 'diver'
    | 'dragonfly'
    | 'ironbeetle'
    | 'caterpillar'
    | 'ant'
    | 'firefly'
    | 'rhino'
    | 'mantis'
    | 'centipede'
    | 'spider'
    | 'moth'
    | 'silkworm'
    | 'scarab';

/** Colour of each rank (the glow, the cell, the badge): 1–5 mortal, 6–9 immortal. */
export const RANK_COLORS: Record<number, [string, string]> = {
    1: ['#9a9a92', '#d8d8d0'],
    2: ['#5f9e5a', '#bfe3b3'],
    3: ['#4f86c6', '#bcd6f2'],
    4: ['#8c5fc8', '#d6c2f2'],
    5: ['#d08a2e', '#f6d59e'],
    6: ['#d04a4a', '#f6b5a8'],
    7: ['#e0457f', '#f8bdd3'],
    8: ['#21b3c4', '#b5eef4'],
    9: ['#f0c53a', '#fff3b8'],
};

const OF_SKILL: Record<Passive, Species> = {
    vampirism: 'leech',
    second_wind: 'cicada',
    double_jump: 'locust',
    water_breathing: 'diver',
    swiftness: 'dragonfly',
    iron_skin: 'ironbeetle',
    regeneration: 'caterpillar',
    gatherer: 'ant',
    radiance: 'firefly',
};

const OF_ATTRIBUTE: Record<Attribute, [Species, Species]> = {
    strength: ['rhino', 'mantis'],
    agility: ['centipede', 'spider'],
    spirit: ['moth', 'silkworm'],
};

/** Below this share of its points in one attribute a stats Gu is a scarab. */
const EVEN = 0.45;

/** The creature an artifact is. */
export function speciesOf(artifact: Artifact): Species {
    if (artifact.type === 'skill' && artifact.skill) {
        return OF_SKILL[artifact.skill.name];
    }

    const total = pointsOf(artifact);
    const [main] = [...ATTRIBUTES].sort(
        (a, b) => (artifact.points[b] ?? 0) - (artifact.points[a] ?? 0),
    );
    const most = artifact.points[main] ?? 0;

    if (total === 0 || most / total < EVEN) {
        return 'scarab';
    }

    const pick =
        (artifact.points.strength ?? 0) * 7 +
        (artifact.points.agility ?? 0) * 3 +
        (artifact.points.spirit ?? 0);

    return OF_ATTRIBUTE[main][pick % 2];
}

/** A centipede: segments along a curve, a pair of legs on each. */
function centipede(): string {
    const points: [number, number][] = [];

    for (let i = 0; i <= 7; i++) {
        const t = i / 7;
        points.push([
            5 + 20 * t + Math.sin(t * Math.PI) * 2,
            26 - 18 * t - Math.sin(t * Math.PI) * 4,
        ]);
    }

    let legs = '';
    let body = '';

    points.forEach(([x, y], i) => {
        const [nx, ny] = points[Math.min(i + 1, points.length - 1)];
        const [px, py] = points[Math.max(i - 1, 0)];
        const dx = nx - px;
        const dy = ny - py;
        const length = Math.hypot(dx, dy) || 1;
        // Across the body.
        const ax = (-dy / length) * 4.2;
        const ay = (dx / length) * 4.2;

        if (i < points.length - 1) {
            legs += `<path d="M${(x - ax).toFixed(1)} ${(y - ay).toFixed(1)}L${(x + ax).toFixed(1)} ${(y + ay).toFixed(1)}" stroke="#7a2e14" stroke-width="1.1"/>`;
        }

        body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === points.length - 1 ? 2.9 : 2.5}" fill="${i % 2 ? '#c4502a' : '#a8401f'}"/>`;
    });

    const [hx, hy] = points[points.length - 1];

    return `${legs}${body}<path d="M${hx - 1} ${hy - 2}c-1-2-1-4 0-5M${hx + 1} ${hy - 2}c1-2 2-3 4-3" stroke="#7a2e14" stroke-width="1" fill="none"/><circle cx="${hx - 0.9}" cy="${hy - 0.6}" r=".7" fill="#f2d27a"/><circle cx="${hx + 0.9}" cy="${hy - 0.6}" r=".7" fill="#f2d27a"/>`;
}

/** Six legs of a beetle seen from above. */
const legs = (color: string) =>
    `<path d="M9 13 4 10M8.5 18H3M9 23l-4 3.5M23 13l5-3M23.5 18H29M23 23l4 3.5" stroke="${color}" stroke-width="1.8" stroke-linecap="square"/>`;

/** The creatures, drawn on a 32 grid. */
const DRAW: Record<Species, string> = {
    leech:
        '<path d="M5 24c2-6 7-6 9-2s6 4 8-2 2-9 5-10" fill="none" stroke="#8e2430" stroke-width="6.5" stroke-linecap="round"/>' +
        '<path d="M5 24c2-6 7-6 9-2s6 4 8-2 2-9 5-10" fill="none" stroke="#d9545d" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="1.4 3"/>' +
        '<circle cx="27.4" cy="9.6" r="3" fill="#5e1820"/><circle cx="27.4" cy="9.6" r="1.3" fill="#ff8a8f"/>',
    cicada:
        '<path d="M15 10 4 16c0 6 6 8 11 3z" fill="#bfe3d0" fill-opacity=".8"/>' +
        '<path d="M17 10l11 6c0 6-6 8-11 3z" fill="#bfe3d0" fill-opacity=".8"/>' +
        '<path d="M15 12 6 17M17 12l9 5M14 15l-6 5M18 15l6 5" stroke="#7fa98f" stroke-width=".8"/>' +
        '<ellipse cx="16" cy="18.5" rx="3.6" ry="8" fill="#5b7a2e"/>' +
        '<path d="M13 15h6M12.8 18h6.4M13.2 21h5.6M14 24h4" stroke="#3d5520" stroke-width="1"/>' +
        '<ellipse cx="16" cy="9.5" rx="5.2" ry="3.2" fill="#6f8f36"/>' +
        '<circle cx="11.6" cy="9" r="1.7" fill="#e8c44a"/><circle cx="20.4" cy="9" r="1.7" fill="#e8c44a"/>',
    locust:
        '<path d="M14 18 9 8l-3 17" fill="none" stroke="#6a8428" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<path d="M4 17.5c3-3 13-4.5 19-2.2 2 .8 3 2 2 3.6-5 1.6-15 2-21-1.4z" fill="#8aa83a"/>' +
        '<path d="M8 16.2c5-1.4 10-1.6 14-1" stroke="#d6e88a" stroke-width="1.3" fill="none"/>' +
        '<path d="M18 19.5l1 5M21.5 19.5l2.5 4" stroke="#6a8428" stroke-width="1.5"/>' +
        '<circle cx="24.5" cy="16" r="2.8" fill="#7a9632"/><circle cx="25.6" cy="15.2" r="1" fill="#1b1d20"/>' +
        '<path d="M26 13.5c2-3 3-6 4-8.5" stroke="#6a8428" stroke-width="1.1" fill="none"/>',
    diver:
        '<path d="M8 13 3 10M8 19l-5 2.5M24 13l5-3M24 19l5 2.5" stroke="#1f4f66" stroke-width="2.6" stroke-linecap="round"/>' +
        '<ellipse cx="16" cy="18" rx="8" ry="10" fill="#2f6f8f"/>' +
        '<ellipse cx="16" cy="7" rx="4.6" ry="3" fill="#25586f"/>' +
        '<path d="M16 9.5v18" stroke="#1f4f66" stroke-width="1.2"/>' +
        '<path d="M11 12.5c-1 4-1 9 1 13" stroke="#8fd3e8" stroke-width="1.6" fill="none" opacity=".85"/>' +
        '<circle cx="13.6" cy="6.3" r="1" fill="#cfeaf2"/><circle cx="18.4" cy="6.3" r="1" fill="#cfeaf2"/>',
    dragonfly:
        '<ellipse cx="9" cy="11" rx="7.2" ry="2.5" fill="#d6efff" fill-opacity=".8" transform="rotate(-10 9 11)"/>' +
        '<ellipse cx="23" cy="11" rx="7.2" ry="2.5" fill="#d6efff" fill-opacity=".8" transform="rotate(10 23 11)"/>' +
        '<ellipse cx="9.5" cy="15.2" rx="6.2" ry="2.2" fill="#d6efff" fill-opacity=".65" transform="rotate(12 9.5 15.2)"/>' +
        '<ellipse cx="22.5" cy="15.2" rx="6.2" ry="2.2" fill="#d6efff" fill-opacity=".65" transform="rotate(-12 22.5 15.2)"/>' +
        '<path d="M16 11v18" stroke="#2f8fc4" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M16 16v1M16 19v1M16 22v1M16 25v1" stroke="#9fdcff" stroke-width="2.6"/>' +
        '<ellipse cx="16" cy="11.5" rx="2.7" ry="3.1" fill="#2f8fc4"/>' +
        '<circle cx="14.1" cy="7.6" r="2.1" fill="#46b06a"/><circle cx="17.9" cy="7.6" r="2.1" fill="#46b06a"/>',
    ironbeetle:
        legs('#5c646b') +
        '<path d="M16 8c6 0 9 5 9 11s-4 9.5-9 9.5-9-3.5-9-9.5 3-11 9-11z" fill="#8a949c"/>' +
        '<path d="M16 9v19.5" stroke="#5c646b" stroke-width="1.4"/>' +
        '<path d="M8.5 16c4 1.2 11 1.2 15 0" stroke="#5c646b" stroke-width="1.1" fill="none"/>' +
        '<path d="M11 12c-1 3-1 7 0 10" stroke="#e1e6ea" stroke-width="1.7" fill="none"/>' +
        '<circle cx="12" cy="20" r="1" fill="#e1e6ea"/><circle cx="20" cy="20" r="1" fill="#e1e6ea"/><circle cx="12" cy="24.5" r="1" fill="#e1e6ea"/><circle cx="20" cy="24.5" r="1" fill="#e1e6ea"/>' +
        '<path d="M11.5 8.5c1-3.5 8-3.5 9 0z" fill="#6f7980"/>',
    caterpillar:
        '<path d="M6 26v2M10 23v2.5M14.5 21v2.5M19.2 21v2.5M23.5 18.5v2.5" stroke="#2c6e4a" stroke-width="1.4"/>' +
        '<circle cx="6" cy="23" r="3.4" fill="#3f9a6a"/><circle cx="10" cy="19.5" r="3.7" fill="#4fb07a"/><circle cx="14.5" cy="17.5" r="3.9" fill="#3f9a6a"/><circle cx="19.2" cy="17.5" r="3.9" fill="#4fb07a"/><circle cx="23.5" cy="15" r="3.7" fill="#3f9a6a"/>' +
        '<circle cx="10" cy="18.2" r="1.1" fill="#d7f5e2"/><circle cx="14.5" cy="16" r="1.1" fill="#d7f5e2"/><circle cx="19.2" cy="16" r="1.1" fill="#d7f5e2"/><circle cx="6" cy="21.8" r="1" fill="#d7f5e2"/>' +
        '<circle cx="26.6" cy="10.4" r="3.7" fill="#7fd6a0"/><circle cx="27.8" cy="9.4" r="1" fill="#14301f"/>' +
        '<path d="M25.5 7c-.5-2-1.5-3-3-3.5M28 7c.5-2 1.5-3 3-3" stroke="#2c6e4a" stroke-width="1" fill="none"/>',
    ant:
        '<path d="M16 15 8.5 10.5M16 16H7.5M16 17l-7 4.5M16 15l7.5-4.5M16 16h8.5M16 17l7 4.5" stroke="#6b3f1b" stroke-width="1.5"/>' +
        '<ellipse cx="16" cy="23.5" rx="4.7" ry="5.7" fill="#a8652a"/>' +
        '<ellipse cx="16" cy="16" rx="2.7" ry="3.3" fill="#8a5222"/>' +
        '<circle cx="16" cy="9.4" r="3.5" fill="#8a5222"/>' +
        '<path d="M14.5 7c-1-2-3-3-4.5-3M17.5 7c1-2 3-3 4.5-3" stroke="#6b3f1b" stroke-width="1.1" fill="none"/>' +
        '<path d="M13.8 21c0 3 1 5 2.2 5.2" stroke="#e8aa66" stroke-width="1.3" fill="none"/>',
    firefly:
        '<circle cx="16" cy="21.5" r="9" fill="#ffe36b" fill-opacity=".22"/>' +
        '<path d="M16 9c-4 1-8.5 5-8.5 9.5l8.5-2.5zM16 9c4 1 8.5 5 8.5 9.5L16 16z" fill="#cfd8c4" fill-opacity=".6"/>' +
        '<ellipse cx="16" cy="14" rx="3.3" ry="4.6" fill="#3a3a30"/>' +
        '<ellipse cx="16" cy="21.5" rx="3.8" ry="4.4" fill="#ffe36b"/>' +
        '<ellipse cx="15" cy="20.5" rx="1.2" ry="1.8" fill="#fffbe0"/>' +
        '<circle cx="16" cy="8.6" r="2.5" fill="#c4433a"/>' +
        '<path d="M15 7l-3-3.5M17 7l3-3.5" stroke="#3a3a30" stroke-width="1.1"/>',
    rhino:
        legs('#3a2418') +
        '<ellipse cx="16" cy="20" rx="8.2" ry="8.6" fill="#5a3b2a"/>' +
        '<path d="M16 12v16.5" stroke="#3a2418" stroke-width="1.3"/>' +
        '<path d="M11.5 15c-1 3-1 7 1 10" stroke="#a87a56" stroke-width="1.7" fill="none"/>' +
        '<path d="M11 12.5c1.5-2.5 8.5-2.5 10 0z" fill="#4a2e20"/>' +
        '<path d="M14.6 11.5c-1-4 0-7.5 1.4-9.5 1.4 2 2.4 5.5 1.4 9.5z" fill="#2e1c12"/>' +
        '<path d="M16 3.5v5" stroke="#8a5a3a" stroke-width=".9"/>',
    mantis:
        '<path d="M10 22c2-4 4-6 6.5-7" stroke="#cbe8a8" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/>' +
        '<path d="M7 27c2-5 4-9.5 8.5-12" stroke="#5f9a3a" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M12 20.5l-4 5.5M14.5 18.5l2 7" stroke="#4f8a30" stroke-width="1.3"/>' +
        '<path d="M15.5 15.5l3.2-6.5" stroke="#6fae44" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M17.5 12.5l6.5 1.8-2.2 4.4M18.5 14.5l5 4.2" stroke="#5f9a3a" stroke-width="1.9" fill="none" stroke-linejoin="miter"/>' +
        '<path d="M18 9l4.5-1.4 2.4 2.2-3.4 2.4z" fill="#8fd05f"/>' +
        '<circle cx="22.6" cy="8.8" r="1" fill="#1b1d20"/>' +
        '<path d="M22.5 7.8c1-2 2-3 4-4" stroke="#5f9a3a" stroke-width=".9" fill="none"/>',
    centipede: centipede(),
    spider:
        '<path d="M13 12 8 7 5.5 9.5M13 13.5 6.5 12 4 15M13 15 7 18l-2 4M13.5 16.5l-3.5 5-1 4M19 12l5-5 2.5 2.5M19 13.5l6.5-1.5 2.5 3M19 15l6 3 2 4M18.5 16.5l3.5 5 1 4" stroke="#2a2236" stroke-width="1.5" fill="none" stroke-linejoin="miter"/>' +
        '<circle cx="16" cy="20" r="5.8" fill="#3a2f4a"/>' +
        '<circle cx="16" cy="13" r="3.4" fill="#4a3d5c"/>' +
        '<path d="M16 17.2l1.7 2.7-1.7 2.7-1.7-2.7z" fill="#e05a6a"/>' +
        '<circle cx="14.8" cy="11.8" r=".8" fill="#e05a6a"/><circle cx="17.2" cy="11.8" r=".8" fill="#e05a6a"/>',
    moth:
        '<path d="M16 12C11 5.5 3.5 6 3.5 12c0 4.2 5.2 6.2 12.5 5z" fill="#b9a3e0"/>' +
        '<path d="M16 12c5-6.5 12.5-6 12.5 0 0 4.2-5.2 6.2-12.5 5z" fill="#b9a3e0"/>' +
        '<path d="M16 16.5c-4 1-8.5 4-7.5 8 2 2 6.5 0 7.5-4zM16 16.5c4 1 8.5 4 7.5 8-2 2-6.5 0-7.5-4z" fill="#9a84cc"/>' +
        '<circle cx="9" cy="11.5" r="2.2" fill="#4a3a7a"/><circle cx="23" cy="11.5" r="2.2" fill="#4a3a7a"/>' +
        '<circle cx="9" cy="11.5" r=".9" fill="#e8e0ff"/><circle cx="23" cy="11.5" r=".9" fill="#e8e0ff"/>' +
        '<ellipse cx="16" cy="16.5" rx="1.9" ry="6.2" fill="#ece2cf"/>' +
        '<path d="M15 10.5c-1-3-3-4.5-5.5-4.5M17 10.5c1-3 3-4.5 5.5-4.5" stroke="#ece2cf" stroke-width="1.1" fill="none"/>',
    silkworm:
        '<path d="M5.5 22.5c0-6 6-9 11.5-8s8.5 4 9.5 0" stroke="#e8dcc0" stroke-width="7.4" fill="none" stroke-linecap="round"/>' +
        '<path d="M5.5 22.5c0-6 6-9 11.5-8s8.5 4 9.5 0" stroke="#bfae84" stroke-width="7.4" fill="none" stroke-dasharray=".8 3.2"/>' +
        '<path d="M8 19c2-2.5 5-3.5 8-3.3" stroke="#fff8e6" stroke-width="1.4" fill="none"/>' +
        '<circle cx="26.8" cy="13.8" r="3.4" fill="#d6c79f"/><circle cx="28" cy="13" r=".9" fill="#3a3020"/>' +
        '<path d="M8 26.5v2M12 21.5v2.5M17 19v2.5" stroke="#bfae84" stroke-width="1.3"/>',
    scarab:
        legs('#7a5c14') +
        '<ellipse cx="16" cy="19.5" rx="7.8" ry="8.6" fill="#c99a2e"/>' +
        '<path d="M16 11.5v16.5" stroke="#8a6a1a" stroke-width="1.2"/>' +
        '<path d="M11 14.5c-1 3-1 7 1 10" stroke="#f6dc8a" stroke-width="1.7" fill="none"/>' +
        '<path d="M11.2 11.8c1-3.5 8.6-3.5 9.6 0z" fill="#a8801f"/>' +
        '<path d="M12.5 8.5 14 6.5l2 1.4 2-1.4 1.5 2" fill="none" stroke="#a8801f" stroke-width="1.4"/>' +
        '<circle cx="16" cy="19.5" r="2" fill="#4fb6a8"/>',
};

/** A four-pointed spark. */
function spark(x: number, y: number, size: number, color: string): string {
    const s = size;
    const k = s * 0.28;

    return `<path d="M${x} ${y - s}L${x + k} ${y - k}L${x + s} ${y}L${x + k} ${y + k}L${x} ${y + s}L${x - k} ${y + k}L${x - s} ${y}L${x - k} ${y - k}z" fill="${color}"/>`;
}

/** Sparks of the immortal ranks: one at rank 6, four at rank 9. */
const SPARKS: [number, number, number][] = [
    [5, 6, 2.6],
    [27, 26, 2.2],
    [27, 5, 1.8],
    [4.5, 26.5, 1.8],
];

/** The glow round a Gu by its rank (behind it), and its sparks (over it). */
function aura(rank: number): { behind: string; over: string } {
    const [color, light] = RANK_COLORS[rank] ?? RANK_COLORS[1];

    if (rank <= 3) {
        return { behind: '', over: '' };
    }

    if (rank <= 5) {
        return {
            behind: `<circle cx="16" cy="16" r="14.5" fill="${color}" fill-opacity="${rank === 4 ? 0.12 : 0.2}"/>`,
            over: '',
        };
    }

    return {
        behind:
            `<circle cx="16" cy="16" r="15.5" fill="${color}" fill-opacity=".14"/>` +
            `<circle cx="16" cy="16" r="11.5" fill="${light}" fill-opacity=".12"/>` +
            `<circle cx="16" cy="16" r="15" fill="none" stroke="${color}" stroke-opacity=".8" stroke-width="1.1"${rank === 9 ? '' : ' stroke-dasharray="2.4 2.6"'}/>`,
        over: SPARKS.slice(0, rank - 5)
            .map(([x, y, size]) => spark(x, y, size, light))
            .join(''),
    };
}

/** The picture of an artifact: its Gu, and its rank round it. */
export function guIcon(artifact: Artifact): string {
    const { behind, over } = aura(artifact.rank);

    return `<svg viewBox="0 0 32 32" aria-hidden="true">${behind}${DRAW[speciesOf(artifact)]}${over}</svg>`;
}
