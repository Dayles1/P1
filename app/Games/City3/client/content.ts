/**
 * The game's content: the JSON files in ../content, bundled with the page
 * by Vite (there is no content API). The bundle has the same shape City
 * Chronicle 2's server sent; it is checked for broken cross-references and
 * wrapped in the engine's lookups. The server reads the same files to
 * check saves against.
 */

import biomes from '../content/biomes.json';
import blueprints from '../content/blueprints.json';
import climate from '../content/climate.json';
import epochs from '../content/epochs.json';
import goals from '../content/goals.json';
import npcs from '../content/npcs.json';
import resources from '../content/resources.json';
import sounds from '../content/sounds.json';
import techs from '../content/techs.json';
import world from '../content/world.json';
import { Content, validateContent } from './engine/content/registry';
import type { ContentIssue } from './engine/content/registry';
import type { BuildingDef, ContentBundle } from './engine/content/types';

export interface LoadedContent {
    content: Content;
    bundle: ContentBundle;
    issues: ContentIssue[];
}

/** One file per building, keyed by its path ('../content/buildings/house.json'). */
const buildingFiles = import.meta.glob<BuildingDef>(
    '../content/buildings/*.json',
    { eager: true, import: 'default' },
);

/** Every building, keyed by its file name, in file-name order (as the server listed them). */
function buildings(): Record<string, BuildingDef> {
    const byId: Record<string, BuildingDef> = {};
    const entries = Object.entries(buildingFiles)
        .map(
            ([path, def]) => [path.replace(/^.*\/|\.json$/g, ''), def] as const,
        )
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    for (const [id, def] of entries) {
        byId[id] = def;
    }

    return byId;
}

/**
 * Everything at once, as City Chronicle 2's GET content returned it. A
 * fresh copy each time, so nothing the game does to it can leak into the
 * next load.
 */
export function contentBundle(): ContentBundle {
    return structuredClone({
        world,
        resources,
        biomes,
        climate,
        epochs,
        techs,
        blueprints,
        goals,
        npcs,
        sounds,
        buildings: buildings(),
    }) as unknown as ContentBundle;
}

export function loadContent(): LoadedContent {
    const bundle = contentBundle();

    return {
        content: new Content(bundle),
        bundle,
        issues: validateContent(bundle),
    };
}
