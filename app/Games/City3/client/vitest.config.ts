/**
 * Unit tests of City Chronicle 3's client logic that runs without a
 * browser (the content bundle, the engine): pure TypeScript, run in Node.
 * Run them with `npm run test:city3`.
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    // Vitest's cache goes with the project's other caches, not into the game's folder.
    cacheDir: fileURLToPath(
        new URL('../../../../node_modules/.vite/city3', import.meta.url),
    ),
    test: {
        include: ['**/*.test.ts'],
        environment: 'node',
    },
});
