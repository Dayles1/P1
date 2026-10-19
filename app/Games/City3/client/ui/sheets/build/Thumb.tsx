/**
 * Rendered building thumbnails (ui-spec §10, lead decision 7): one per
 * level, rendered lazily — one per idle frame, never all at once on the
 * first tray open — and cached for the session.
 */

import { useEffect, useState } from 'react';
import type { BuildingDef } from '../../../engine/content/types';
import { renderThumbnail } from '../../../scene/thumbnails';
import { useGame } from '../../context';
import { Icon } from '../../icons/Icon';
import type { IconName } from '../../icons/sprite';

const cache = new Map<string, string | null>();
const queue: { key: string; run: () => void }[] = [];
let busy = false;

type IdleCallback = (callback: () => void) => void;

const idle: IdleCallback = (callback) => {
    const request = (
        window as unknown as {
            requestIdleCallback?: (
                cb: () => void,
                options?: { timeout: number },
            ) => number;
        }
    ).requestIdleCallback;

    if (request) {
        request(callback, { timeout: 120 });
    } else {
        window.setTimeout(callback, 16);
    }
};

function pump(): void {
    if (busy || !queue.length) {
        return;
    }

    busy = true;
    idle(() => {
        queue.shift()?.run();
        busy = false;
        pump();
    });
}

export function Thumb({
    def,
    level,
    size,
    fallback,
    className,
}: {
    def: BuildingDef;
    level: number;
    size: number;
    fallback: IconName;
    className?: string;
}) {
    const game = useGame();
    const key = `${def.id}:${level}:${size}`;
    const [loaded, setLoaded] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        if (cache.has(key)) {
            return;
        }

        let alive = true;

        queue.push({
            key,
            run: () => {
                if (!cache.has(key)) {
                    let src: string | null = null;

                    try {
                        src = renderThumbnail(
                            game.content,
                            def,
                            level,
                            size * 2,
                        );
                    } catch {
                        src = null;
                    }

                    cache.set(key, src);
                }

                if (alive) {
                    setLoaded(cache.get(key) ?? null);
                }
            },
        });
        pump();

        return () => {
            alive = false;
        };
    }, [key, game, def, level, size]);

    const src = cache.get(key) ?? loaded;

    if (src) {
        return (
            <img
                className={`c3-thumbimg${className ? ` ${className}` : ''}`}
                src={src}
                alt=""
                draggable={false}
            />
        );
    }

    return (
        <span
            className={`c3-thumbimg c3-thumbimg--icon${src === undefined ? ' is-loading' : ''}${className ? ` ${className}` : ''}`}
        >
            <Icon name={fallback} />
        </span>
    );
}
