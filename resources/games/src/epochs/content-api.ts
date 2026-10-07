/**
 * Loading the content files from the server, and the one JSON layout they
 * are kept in (the same one ContentRepository::encode writes).
 */

import { gameApi } from '../shared/api';
import { Content, validateContent } from './engine/content/registry';
import type { ContentIssue } from './engine/content/registry';
import type { ContentBundle } from './engine/content/types';

export interface LoadedContent {
    content: Content;
    bundle: ContentBundle;
    version: string;
    editable: boolean;
    issues: ContentIssue[];
}

export async function loadContent(): Promise<LoadedContent> {
    const data = await gameApi<{
        version: string;
        editable: boolean;
        content: ContentBundle;
    }>('epochs/content');
    const issues = validateContent(data.content);

    return {
        content: new Content(data.content),
        bundle: data.content,
        version: data.version,
        editable: data.editable,
        issues,
    };
}

/** Pretty JSON with every flat object or array on one line. */
export function formatContent(data: unknown): string {
    let json = JSON.stringify(data, null, 4);
    let previous: string;

    do {
        previous = json;
        json = json.replace(
            /([{[])\n\s*([^{}[\]]*?)\n\s*([}\]])/g,
            (_m, open: string, body: string) => {
                const inner = body.split(/,\n\s*/).join(', ');

                return open === '{' ? `{ ${inner} }` : `[${inner}]`;
            },
        );
    } while (json !== previous);

    return `${json}\n`;
}
