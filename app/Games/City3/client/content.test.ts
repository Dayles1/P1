import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentBundle, loadContent } from './content';
import { CONTENT_FILES } from './engine/content/types';

describe('the content bundle', () => {
    it('has every content file and every building, in file-name order', () => {
        const bundle = contentBundle();
        const ids = Object.keys(bundle.buildings);

        for (const file of CONTENT_FILES) {
            expect(bundle[file]).toBeTypeOf('object');
        }

        const files = readdirSync(
            fileURLToPath(new URL('../content/buildings', import.meta.url)),
        )
            .filter((file) => file.endsWith('.json'))
            .map((file) => file.slice(0, -'.json'.length))
            .sort();

        expect(ids.length).toBeGreaterThan(0);
        expect(ids).toEqual(files);
        expect(ids).toContain('road');
        expect(ids).toContain('town_center');

        for (const id of ids) {
            expect(bundle.buildings[id].id).toBe(id);
        }
    });

    it('passes the content validation without issues', () => {
        const { content, issues } = loadContent();

        expect(issues).toEqual([]);
        expect(content.byRole('road')).toBeDefined();
        expect(content.byRole('center')).toBeDefined();
    });

    it('is a fresh copy on every load', () => {
        const first = contentBundle();
        const second = contentBundle();

        expect(second).toEqual(first);
        expect(second.buildings.house).not.toBe(first.buildings.house);
    });
});
