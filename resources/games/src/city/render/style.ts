/**
 * How each era looks: building materials, roofs, roads, ground and sky.
 * A city that enters a new era is redrawn with the new palette, so old
 * huts turn into the new architecture along with everything else.
 */

export interface EpochStyle {
    wall: string;
    walls?: string[];
    roof: string;
    trim: string;
    window: string;
    lit: string;
    road: string;
    roadEdge: string;
    roadMark: string | null;
    plaza: string;
    grass: string;
    grassAlt: string;
    sky: [string, string];
    crop: string;
    flag: string;
    flatRoofs: boolean;
}

export const STYLES: EpochStyle[] = [
    {
        wall: '#9a6b3f',
        roof: '#c9a24d',
        trim: '#5e3d22',
        window: '#3a2919',
        lit: '#f7c96a',
        road: '#b8925a',
        roadEdge: '#9a7646',
        roadMark: null,
        plaza: '#a98d63',
        grass: '#7cae4c',
        grassAlt: '#73a545',
        sky: ['#a8d8ea', '#e8f4ea'],
        crop: '#d8bf4f',
        flag: '#b33a2b',
        flatRoofs: false,
    },
    {
        wall: '#a87849',
        roof: '#b88b3a',
        trim: '#5e3d22',
        window: '#3a2919',
        lit: '#f7c96a',
        road: '#b3905e',
        roadEdge: '#957243',
        roadMark: null,
        plaza: '#ab9168',
        grass: '#79ab4a',
        grassAlt: '#70a243',
        sky: ['#a8d8ea', '#eaf3e4'],
        crop: '#dcc357',
        flag: '#b33a2b',
        flatRoofs: false,
    },
    {
        wall: '#aaa49b',
        roof: '#b5533a',
        trim: '#6f675d',
        window: '#2f2a26',
        lit: '#f4c56a',
        road: '#9d978c',
        roadEdge: '#7f7a70',
        roadMark: null,
        plaza: '#a9a397',
        grass: '#76a849',
        grassAlt: '#6e9f42',
        sky: ['#9fcfe6', '#e9f1ea'],
        crop: '#d7bd4c',
        flag: '#2f4f9c',
        flatRoofs: false,
    },
    {
        wall: '#cbc1ae',
        roof: '#4d5d7a',
        trim: '#8a7f6c',
        window: '#2b2c33',
        lit: '#f4c56a',
        road: '#a29d93',
        roadEdge: '#858076',
        roadMark: null,
        plaza: '#b8b1a3',
        grass: '#74a64b',
        grassAlt: '#6c9d44',
        sky: ['#9ccbe6', '#ecf0ea'],
        crop: '#d3b94a',
        flag: '#7a2e8e',
        flatRoofs: false,
    },
    {
        wall: '#e6d9bd',
        roof: '#8f3b2c',
        trim: '#9c8a68',
        window: '#334250',
        lit: '#f6d27a',
        road: '#a8a299',
        roadEdge: '#8b857b',
        roadMark: null,
        plaza: '#c7beac',
        grass: '#72a44c',
        grassAlt: '#6a9b45',
        sky: ['#97c8e6', '#eef0e8'],
        crop: '#d6be52',
        flag: '#1f6f5c',
        flatRoofs: false,
    },
    {
        wall: '#e8c9a0',
        walls: ['#e8c9a0', '#d9e3c8', '#f0d4c8', '#cfe0e8', '#efe3b8'],
        roof: '#5d6470',
        trim: '#a39074',
        window: '#2e4152',
        lit: '#f6d27a',
        road: '#9d9a94',
        roadEdge: '#7f7c76',
        roadMark: null,
        plaza: '#c9c3b6',
        grass: '#70a24d',
        grassAlt: '#689946',
        sky: ['#94c6e6', '#eef0ea'],
        crop: '#d3bd55',
        flag: '#1d4f91',
        flatRoofs: false,
    },
    {
        wall: '#9b4f3a',
        walls: ['#9b4f3a', '#a35c43', '#8c4533', '#b0674b'],
        roof: '#3f3f44',
        trim: '#6b3326',
        window: '#2a2a30',
        lit: '#f3c86b',
        road: '#6f6c69',
        roadEdge: '#57544f',
        roadMark: null,
        plaza: '#8d8882',
        grass: '#6c9a4c',
        grassAlt: '#649146',
        sky: ['#aab6ba', '#e3e2da'],
        crop: '#cdb758',
        flag: '#8f1d1d',
        flatRoofs: false,
    },
    {
        wall: '#d4d2cc',
        walls: ['#d4d2cc', '#e2d6c2', '#c9cfd6', '#ddd0c8'],
        roof: '#7d8188',
        trim: '#9a9893',
        window: '#3c5466',
        lit: '#ffe39a',
        road: '#4a4c50',
        roadEdge: '#3a3c40',
        roadMark: '#f2f2f2',
        plaza: '#a5a6a8',
        grass: '#6aa14f',
        grassAlt: '#629849',
        sky: ['#8fc3e8', '#eef2f2'],
        crop: '#c7c45a',
        flag: '#1f5fbf',
        flatRoofs: true,
    },
    {
        wall: '#8fc0de',
        walls: ['#8fc0de', '#a9d3e8', '#7fb0cf', '#b7d9e0'],
        roof: '#53606c',
        trim: '#d9e6ee',
        window: '#2a4a63',
        lit: '#c9f1ff',
        road: '#3b3e44',
        roadEdge: '#2e3035',
        roadMark: '#f5d14a',
        plaza: '#b4b9bf',
        grass: '#67a352',
        grassAlt: '#5f9a4c',
        sky: ['#7fbfe9', '#eaf5fb'],
        crop: '#b9d36a',
        flag: '#11a39a',
        flatRoofs: true,
    },
];
