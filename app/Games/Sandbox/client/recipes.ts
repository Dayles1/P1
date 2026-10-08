/**
 * What can be made from what, in groups for the crafting tab. A recipe
 * marked `near` needs a lit fire or a workbench within reach.
 */

import type { ItemId } from './items';

export type Station = 'fire' | 'workbench';

export type RecipeGroup =
    'tools' | 'weapons' | 'armor' | 'building' | 'survival';

export const RECIPE_GROUPS: RecipeGroup[] = [
    'tools',
    'weapons',
    'armor',
    'building',
    'survival',
];

export interface Recipe {
    result: ItemId;
    count: number;
    needs: [ItemId, number][];
    group: RecipeGroup;
    near?: Station;
}

export const RECIPES: Recipe[] = [
    {
        result: 'stone_axe',
        count: 1,
        group: 'tools',
        needs: [
            ['stick', 2],
            ['stone', 3],
            ['fiber', 2],
        ],
    },
    {
        result: 'stone_pickaxe',
        count: 1,
        group: 'tools',
        needs: [
            ['stick', 2],
            ['stone', 4],
            ['fiber', 2],
        ],
    },
    {
        result: 'torch',
        count: 2,
        group: 'tools',
        needs: [
            ['stick', 1],
            ['fiber', 1],
        ],
    },
    {
        result: 'iron_axe',
        count: 1,
        group: 'tools',
        near: 'workbench',
        needs: [
            ['stick', 2],
            ['iron', 3],
            ['fiber', 1],
        ],
    },
    {
        result: 'iron_pickaxe',
        count: 1,
        group: 'tools',
        near: 'workbench',
        needs: [
            ['stick', 2],
            ['iron', 3],
            ['fiber', 1],
        ],
    },
    {
        result: 'wood_sword',
        count: 1,
        group: 'weapons',
        needs: [
            ['wood', 5],
            ['stick', 1],
        ],
    },
    {
        result: 'stone_sword',
        count: 1,
        group: 'weapons',
        needs: [
            ['stick', 1],
            ['stone', 5],
            ['fiber', 2],
        ],
    },
    {
        result: 'iron_sword',
        count: 1,
        group: 'weapons',
        near: 'workbench',
        needs: [
            ['stick', 1],
            ['iron', 4],
            ['fiber', 1],
        ],
    },
    {
        result: 'leather_helmet',
        count: 1,
        group: 'armor',
        needs: [
            ['hide', 3],
            ['fiber', 2],
        ],
    },
    {
        result: 'leather_jacket',
        count: 1,
        group: 'armor',
        needs: [
            ['hide', 5],
            ['fiber', 3],
        ],
    },
    {
        result: 'leather_boots',
        count: 1,
        group: 'armor',
        needs: [
            ['hide', 2],
            ['fiber', 2],
        ],
    },
    {
        result: 'iron_helmet',
        count: 1,
        group: 'armor',
        near: 'workbench',
        needs: [
            ['iron', 4],
            ['hide', 1],
        ],
    },
    {
        result: 'iron_chestplate',
        count: 1,
        group: 'armor',
        near: 'workbench',
        needs: [
            ['iron', 7],
            ['hide', 2],
        ],
    },
    {
        result: 'iron_boots',
        count: 1,
        group: 'armor',
        near: 'workbench',
        needs: [
            ['iron', 3],
            ['hide', 1],
        ],
    },
    {
        result: 'campfire',
        count: 1,
        group: 'building',
        needs: [
            ['wood', 5],
            ['pebble', 4],
            ['flint', 1],
        ],
    },
    {
        result: 'workbench',
        count: 1,
        group: 'building',
        needs: [
            ['wood', 15],
            ['stone', 6],
        ],
    },
    {
        result: 'chest',
        count: 1,
        group: 'building',
        needs: [
            ['wood', 16],
            ['fiber', 4],
        ],
    },
    {
        result: 'wood_wall',
        count: 1,
        group: 'building',
        needs: [['wood', 8]],
    },
    {
        result: 'wood_door',
        count: 1,
        group: 'building',
        needs: [
            ['wood', 10],
            ['fiber', 2],
        ],
    },
    {
        result: 'sleeping_bag',
        count: 1,
        group: 'building',
        needs: [
            ['hide', 3],
            ['fiber', 4],
        ],
    },
    {
        result: 'iron',
        count: 1,
        group: 'survival',
        near: 'fire',
        needs: [
            ['iron_ore', 2],
            ['wood', 1],
        ],
    },
    {
        result: 'cooked_meat',
        count: 1,
        group: 'survival',
        near: 'fire',
        needs: [['raw_meat', 1]],
    },
    {
        result: 'bandage',
        count: 1,
        group: 'survival',
        needs: [['fiber', 3]],
    },
];
