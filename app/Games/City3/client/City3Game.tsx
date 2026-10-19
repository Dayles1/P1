import { useEffect, useRef, useState } from 'react';
import { api, startPlaytime } from './api';
import { AudioEngine } from './audio/audio';
import { loadContent } from './content';
import type { LoadedContent } from './content';
import {
    fromServer,
    hoursAway,
    toCreatePayload,
} from './engine/save/serializer';
import type { LoadedWorld } from './engine/save/serializer';
import { Game } from './engine/sim/game';
import { Renderer } from './scene/renderer';
import { ControllerContext } from './ui/context';
import { Controller, qualityFor, savedQuality } from './ui/controller';
import { Hud } from './ui/Hud';
import { t } from './ui/i18n';
import { attachCanvas, attachKeys } from './ui/input/attach';
import { SaveSession } from './ui/session';
import './ui/styles/tokens.css';
import './ui/styles/hud.css';
import './ui/styles/sheets.css';
import './ui/styles/tools.css';

const TITLE = 'Летопись города 3';

/** What GET /api/city3/world answers. */
interface WorldResponse {
    /** Tester tools (infinite resources, faster speeds, …) are on for this player. */
    tester: boolean;
    world: LoadedWorld | null;
}

type Phase = 'content' | 'world' | 'ready' | 'error';

/**
 * «Летопись города 3»: wiring only (ui-spec §11) — the renderer, the
 * game, the controller with its stores, the loop and input, saving, and
 * the interface over the scene. Everything the game is made of comes from
 * the content files. `backUrl` is where «К списку игр» leads.
 */
export default function City3Game({ backUrl }: { backUrl: string }) {
    useEffect(() => startPlaytime(), []);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ctl, setCtl] = useState<Controller | null>(null);
    const [phase, setPhase] = useState<Phase>('content');
    const [error, setError] = useState('');
    const [issues, setIssues] = useState<LoadedContent['issues']>([]);

    // Content, the world (loaded or created), the controller.
    useEffect(() => {
        const renderer = new Renderer(canvasRef.current!);
        let controller: Controller | null = null;
        let cancelled = false;

        renderer.setQuality(qualityFor(savedQuality()));
        document.title = TITLE;

        (async () => {
            const content = loadContent();

            if (content.issues.length) {
                setIssues(content.issues);
                setError(t('common.contentBroken'));
                setPhase('error');

                return;
            }

            setPhase('world');

            const audio = new AudioEngine(content.bundle.sounds);
            const response = await api<WorldResponse>('world');

            if (cancelled) {
                return;
            }

            const saved = response.world;
            let world: Game;
            let revision: number;
            let chest = 0;

            if (saved) {
                world = fromServer(content.content, saved);
                revision = saved.revision;
                chest = world.chestOffer(hoursAway(saved.saved_at));
            } else {
                world = Game.create(content.content);

                const created = await api<{ revision: number }>('world', {
                    method: 'POST',
                    body: toCreatePayload(world),
                });

                revision = created.revision;
            }

            if (cancelled) {
                return;
            }

            renderer.attach(world);
            renderer.resize();

            const center = world.center;

            renderer.centerOn(
                center ? center.x + 1 : world.map.width / 2,
                center ? center.y + 1 : world.map.height / 2,
            );

            const next = new Controller(
                world,
                renderer,
                audio,
                response.tester,
            );

            next.backUrl = backUrl;
            next.session = new SaveSession(world, revision, {
                onState: (state, savedAt) => next.hud.setSave(state, savedAt),
                onConflict: () => {
                    next.ui.set({ dialog: 'conflict' });
                    next.setSpeed(0);
                },
            });
            next.hud.setSave('saved', Date.now());
            next.feedback.set({ chest });

            if (!saved) {
                next.feedback.toast(
                    'event',
                    'hall',
                    t('toast.newWorld', {
                        year: world.year,
                        tagline: world.epoch.tagline,
                    }),
                );
            }

            controller = next;
            setCtl(next);
            setPhase('ready');
        })().catch((failure: unknown) => {
            if (!cancelled) {
                setError(
                    failure instanceof Error
                        ? failure.message
                        : t('common.loadFailed'),
                );
                setPhase('error');
            }
        });

        return () => {
            cancelled = true;
            controller?.dispose();
            renderer.dispose();
        };
    }, [backUrl]);

    // The loop, pointer and keys, saving.
    useEffect(() => {
        if (!ctl) {
            return;
        }

        let frame = 0;
        const loop = (now: number) => {
            ctl.frame(now);
            frame = requestAnimationFrame(loop);
        };
        const onResize = () => ctl.renderer.resize();
        const detachCanvas = attachCanvas(ctl, canvasRef.current!);
        const detachKeys = attachKeys(ctl);
        const stopSaving = ctl.session?.start();

        frame = requestAnimationFrame(loop);
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            detachCanvas();
            detachKeys();
            stopSaving?.();
            window.removeEventListener('resize', onResize);
        };
    }, [ctl]);

    return (
        <div className="c3">
            <canvas
                ref={canvasRef}
                className="c3-canvas"
                role="img"
                aria-label={t('common.canvas')}
            />
            {phase !== 'ready' && (
                <div className="c3-loading">
                    {phase === 'content' && <p>{t('common.loadingContent')}</p>}
                    {phase === 'world' && <p>{t('common.loadingWorld')}</p>}
                    {phase === 'error' && (
                        <div className="c3-error c3-chip">
                            <p>{error}</p>
                            {issues.slice(0, 8).map((issue) => (
                                <code
                                    key={
                                        issue.file + issue.path + issue.message
                                    }
                                >
                                    {issue.file} · {issue.path}: {issue.message}
                                </code>
                            ))}
                            <button
                                type="button"
                                className="c3-btn c3-btn--primary"
                                onClick={() => window.location.reload()}
                            >
                                {t('common.retry')}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {ctl && (
                <ControllerContext value={ctl}>
                    <Hud />
                </ControllerContext>
            )}
        </div>
    );
}
