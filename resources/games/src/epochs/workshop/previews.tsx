import { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioEngine } from '../audio/audio';
import { Content } from '../engine/content/registry';
import type {
    BuildingDef,
    ContentBundle,
    NpcTypeDef,
} from '../engine/content/types';
import { Clock } from '../engine/core/clock';
import { generateMap } from '../engine/world/generator';
import { FEATURES } from '../engine/world/world-map';
import { HW, P, box, poly, rect, shade, tile } from '../render/iso';
import { drawModel, modelHeight } from '../render/model';

function useAnimationFrame(callback: (t: number) => void): void {
    const ref = useRef(callback);

    useEffect(() => {
        ref.current = callback;
    });

    useEffect(() => {
        let frame = 0;
        const start = performance.now();
        const loop = (now: number) => {
            ref.current((now - start) / 1000);
            frame = requestAnimationFrame(loop);
        };

        frame = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(frame);
    }, []);
}

function setupCanvas(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
): CanvasRenderingContext2D {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== width * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
    }

    const ctx = canvas.getContext('2d')!;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    return ctx;
}

// ———————————————————————————————————————— A building, every level

export function BuildingPreview({
    bundle,
    building,
    audio,
}: {
    bundle: ContentBundle;
    building: BuildingDef;
    audio: AudioEngine;
}) {
    const content = useMemo(() => new Content(bundle), [bundle]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [level, setLevel] = useState(1);
    const [epoch, setEpoch] = useState(() =>
        Math.max(0, content.epochOrder(building.epoch)),
    );
    const [night, setNight] = useState(false);
    const [winter, setWinter] = useState(false);
    const levels = building.levels ?? [];
    const levelDef = levels[Math.min(level, levels.length) - 1];

    useAnimationFrame((t) => {
        const canvas = canvasRef.current;

        if (!canvas || !levelDef) {
            return;
        }

        const width = canvas.clientWidth || 420;
        const height = 320;
        const ctx = setupCanvas(canvas, width, height);
        const palette = content.palette(epoch);
        const { w, h } = building.size ?? { w: 1, h: 1 };
        const parts = levelDef.model?.parts ?? [];
        const top = modelHeight(parts);
        const span = Math.max(w, h) + 2;
        const zoom = Math.min(
            2.4,
            Math.max(
                0.7,
                Math.min(
                    width / (span * HW * 2.2),
                    (height - 40) / (span * 16 * 2 + top),
                ),
            ),
        );
        const [cx, cy] = P(w / 2, h / 2);
        const sky = ctx.createLinearGradient(0, 0, 0, height);

        sky.addColorStop(0, palette.sky[0]);
        sky.addColorStop(1, palette.sky[1]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, width, height);
        ctx.save();
        ctx.translate(
            width / 2 - cx * zoom,
            height * 0.62 - cy * zoom + (top * zoom) / 3,
        );
        ctx.scale(zoom, zoom);

        const glows: {
            x: number;
            y: number;
            z: number;
            r: number;
            c: string;
        }[] = [];

        for (let y = -1; y < h + 1; y++) {
            for (let x = -1; x < w + 1; x++) {
                const inside = x >= 0 && y >= 0 && x < w && y < h;

                poly(
                    ctx,
                    tile(x, y),
                    winter
                        ? '#e9eff3'
                        : inside
                          ? '#7cae4c'
                          : (x + y) % 2
                            ? '#73a545'
                            : '#79ab4a',
                );
            }
        }

        if (building.render === 'road') {
            poly(ctx, tile(0, 0, 0.5), palette.road);
        }

        poly(ctx, rect(0.05, 0.05, w + 0.1, h + 0.1), 'rgba(0,0,0,0.12)');
        drawModel(parts, {
            ctx,
            x: 0,
            y: 0,
            palette,
            seed: 11,
            time: t,
            night,
            grow: 1,
            snow: winter ? 0.75 : 0,
            treeTint: winter ? '#2f5f3a' : '#3f8a3e',
            emit: (x, y, z, kind) => {
                const [sx, sy] = P(x, y, z + ((t * 12) % 14));

                ctx.fillStyle =
                    kind === 'water'
                        ? 'rgba(159,216,245,0.8)'
                        : 'rgba(150,150,150,0.4)';
                ctx.beginPath();
                ctx.arc(sx + Math.sin(t * 2) * 2, sy, 3, 0, Math.PI * 2);
                ctx.fill();
            },
            light: (x, y, z, r, c) => glows.push({ x, y, z, r, c }),
        });
        ctx.restore();

        if (night) {
            ctx.fillStyle = 'rgba(8,14,40,0.62)';
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';

            for (const g of glows) {
                const [gx, gy] = P(g.x, g.y, g.z);
                const sx = width / 2 + (gx - cx) * zoom;
                const sy = height * 0.62 + (gy - cy) * zoom + (top * zoom) / 3;
                const radius = Math.max(6, g.r * HW * zoom * 0.8);
                const gradient = ctx.createRadialGradient(
                    sx,
                    sy,
                    0,
                    sx,
                    sy,
                    radius,
                );

                gradient.addColorStop(
                    0,
                    `${g.c.length === 7 ? g.c : '#ffd27a'}88`,
                );
                gradient.addColorStop(
                    1,
                    `${g.c.length === 7 ? g.c : '#ffd27a'}00`,
                );
                ctx.fillStyle = gradient;
                ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
            }

            ctx.globalCompositeOperation = 'source-over';
        }
    });

    if (!levelDef) {
        return <p className="ws-empty">У здания нет уровней.</p>;
    }

    const effects = levelDef.effects;
    const resource = (id: string) => content.resource(id)?.icon ?? id;

    return (
        <div className="ws-preview">
            <div className="ws-preview__bar">
                <div className="ws-tabs">
                    {levels.map((l) => (
                        <button
                            key={l.level}
                            type="button"
                            aria-pressed={l.level === level}
                            onClick={() => setLevel(l.level)}
                        >
                            Ур. {l.level}
                        </button>
                    ))}
                </div>
                <select
                    value={epoch}
                    onChange={(event) => setEpoch(Number(event.target.value))}
                    aria-label="Эпоха (палитра)"
                >
                    {content.epochs.map((e, index) => (
                        <option key={e.id} value={index}>
                            {e.year} · {e.name}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    aria-pressed={night}
                    onClick={() => setNight(!night)}
                >
                    {night ? '🌙' : '☀️'}
                </button>
                <button
                    type="button"
                    aria-pressed={winter}
                    onClick={() => setWinter(!winter)}
                >
                    ❄️
                </button>
            </div>

            <canvas
                ref={canvasRef}
                className="ws-preview__canvas"
                style={{ height: 320 }}
            />

            <div className="ws-facts">
                <div>
                    <b>{content.nameOf(building, epoch)}</b> ·{' '}
                    {building.size?.w}×{building.size?.h} · с эпохи{' '}
                    {content.epochs[content.epochOrder(building.epoch)]?.year ??
                        building.epoch}
                    {levelDef.requiresEpoch &&
                        ` · уровень ${level} с ${content.epochs[content.epochOrder(levelDef.requiresEpoch)]?.year}`}
                </div>
                <div>
                    Цена:{' '}
                    {Object.entries(levelDef.cost ?? {})
                        .map(([id, v]) => `${resource(id)} ${v}`)
                        .join('  ') || '—'}{' '}
                    · стройка {levelDef.buildTime} с
                </div>
                <div>
                    {effects.housing > 0 && `👥 ${effects.housing}  `}
                    {effects.jobs > 0 && `👷 ${effects.jobs}  `}
                    {Object.entries(effects.produces ?? {}).map(
                        ([id, v]) => `+${resource(id)} ${v}/с  `,
                    )}
                    {Object.entries(effects.consumes ?? {}).map(
                        ([id, v]) => `−${resource(id)} ${v}/с  `,
                    )}
                    {effects.storage > 0 && `📦 +${effects.storage}  `}
                    {effects.power > 0 && `⚡ +${effects.power}  `}
                    {effects.powerUse > 0 && `🔌 ${effects.powerUse}  `}
                    {effects.aura &&
                        `😊 +${effects.aura.happiness} (r${effects.aura.radius})  `}
                    {effects.pollution &&
                        `🏭 −${effects.pollution.amount} (r${effects.pollution.radius})`}
                </div>
                <div className="ws-sounds">
                    {Object.entries(building.sounds ?? {}).map(([slot, id]) =>
                        id ? (
                            <button
                                key={slot}
                                type="button"
                                onClick={() => {
                                    audio.unlock();
                                    audio.play(id);
                                }}
                            >
                                🔊 {slot}: {id}
                            </button>
                        ) : null,
                    )}
                </div>
            </div>
        </div>
    );
}

// ———————————————————————————————————————— The map a world would get

export function MapPreview({ bundle }: { bundle: ContentBundle }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [seed, setSeed] = useState(777);
    const result = useMemo(() => {
        try {
            const content = new Content(bundle);
            const map = generateMap(content, seed);
            const counts = new Map<string, number>();

            for (let i = 0; i < map.biome.length; i++) {
                const id = content.biomes[map.biome[i]].id;

                counts.set(id, (counts.get(id) ?? 0) + 1);
            }

            return { content, map, counts, error: null as string | null };
        } catch (failure) {
            return {
                content: null,
                map: null,
                counts: new Map<string, number>(),
                error:
                    failure instanceof Error
                        ? failure.message
                        : String(failure),
            };
        }
    }, [bundle, seed]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const { map, content } = result;

        if (!canvas || !map || !content) {
            return;
        }

        const cell = Math.max(
            2,
            Math.floor(360 / Math.max(map.width, map.height)),
        );
        const ctx = setupCanvas(canvas, map.width * cell, map.height * cell);

        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const index = map.index(x, y);
                const biome = content.biomes[map.biome[index]];
                const feature = FEATURES[map.feature[index]];

                ctx.fillStyle = biome.colors[0];
                ctx.fillRect(x * cell, y * cell, cell, cell);

                if (feature) {
                    ctx.fillStyle =
                        feature === 'tree'
                            ? '#2f6b3a'
                            : feature === 'rock'
                              ? '#c9c4bc'
                              : '#8a9a4a';
                    ctx.fillRect(
                        x * cell + cell / 4,
                        y * cell + cell / 4,
                        cell / 2,
                        cell / 2,
                    );
                }
            }
        }

        // Land each era opens up.
        content.epochs.forEach((epoch, index) => {
            const r = epoch.territory;
            const cx = Math.floor(map.width / 2);
            const cy = Math.floor(map.height / 2);

            ctx.strokeStyle = `rgba(255,255,255,${0.9 - index * 0.15})`;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(
                (cx - r) * cell,
                (cy - r) * cell,
                r * 2 * cell,
                r * 2 * cell,
            );
        });

        ctx.setLineDash([]);
    }, [result]);

    if (result.error) {
        return (
            <p className="ws-error">
                Генератор не смог построить карту: {result.error}
            </p>
        );
    }

    const total = (result.map?.width ?? 1) * (result.map?.height ?? 1);

    return (
        <div className="ws-preview">
            <div className="ws-preview__bar">
                <label>
                    Сид{' '}
                    <input
                        type="number"
                        value={seed}
                        onChange={(event) =>
                            setSeed(Number(event.target.value) || 0)
                        }
                    />
                </label>
                <button
                    type="button"
                    onClick={() => setSeed(Math.floor(Math.random() * 1e6))}
                >
                    🎲 Другая карта
                </button>
                <span>
                    {result.map?.width}×{result.map?.height} клеток · пунктир —
                    земли эпох
                </span>
            </div>
            <canvas ref={canvasRef} className="ws-preview__map" />
            <ul className="ws-legend">
                {result.content?.biomes.map((biome) => (
                    <li key={biome.id}>
                        <i style={{ background: biome.colors[0] }} />
                        {biome.name}{' '}
                        <small>
                            {Math.round(
                                ((result.counts.get(biome.id) ?? 0) / total) *
                                    100,
                            )}
                            %
                        </small>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ———————————————————————————————————————— Day, night and seasons

export function ClimatePreview({ bundle }: { bundle: ContentBundle }) {
    const content = useMemo(() => new Content(bundle), [bundle]);
    const clock = useMemo(() => new Clock(content), [content]);
    const day = bundle.world.time.secondsPerDay;
    const samples = Array.from({ length: 97 }, (_, i) =>
        clock.light((i / 96) * day),
    );
    const points = samples
        .map((s, i) => `${(i / 96) * 400},${110 - s.level * 100}`)
        .join(' ');

    return (
        <div className="ws-preview">
            <h4>Свет в течение суток ({day} с игрового времени)</h4>
            <svg viewBox="0 0 400 120" className="ws-chart">
                {samples.map((s, i) => (
                    <rect
                        key={i}
                        x={(i / 96) * 400}
                        y={0}
                        width={4.3}
                        height={120}
                        fill={s.tint ?? '#ffffff'}
                        opacity={s.tintStrength * 1.4}
                    />
                ))}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#f5b942"
                    strokeWidth="2.5"
                />
                {[0, 6, 12, 18, 24].map((h) => (
                    <text
                        key={h}
                        x={(h / 24) * 396 + 2}
                        y={118}
                        fontSize="9"
                        fill="currentColor"
                    >
                        {h}:00
                    </text>
                ))}
            </svg>
            <div className="ws-seasons">
                {content.seasons.map((season) => (
                    <div
                        key={season.id}
                        style={{ borderColor: season.groundTint ?? '#7cae4c' }}
                    >
                        <b>
                            {season.icon} {season.name}
                        </b>
                        <span>
                            {season.temperature}°C · урожай ×{season.fertility}
                        </span>
                        <span>
                            {Object.entries(season.weather)
                                .map(
                                    ([id, chance]) =>
                                        `${content.weather.find((w) => w.id === id)?.icon ?? id} ${Math.round(chance * 100)}%`,
                                )
                                .join(' ')}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ———————————————————————————————————————— Eras: palettes and architecture

function MiniStreet({
    bundle,
    epochIndex,
}: {
    bundle: ContentBundle;
    epochIndex: number;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const content = useMemo(() => new Content(bundle), [bundle]);

    useAnimationFrame((t) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const ctx = setupCanvas(canvas, 260, 150);
        const palette = content.palette(epochIndex);
        const sample = content.buildings
            .filter(
                (b) =>
                    !b.hidden &&
                    b.render !== 'road' &&
                    content.epochOrder(b.epoch) <= epochIndex &&
                    b.size.w === 1,
            )
            .slice(-3);
        const sky = ctx.createLinearGradient(0, 0, 0, 150);

        sky.addColorStop(0, palette.sky[0]);
        sky.addColorStop(1, palette.sky[1]);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 260, 150);
        ctx.save();
        ctx.translate(130, 40);
        ctx.scale(0.9, 0.9);

        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 4; x++) {
                poly(ctx, tile(x, y), y === 1 ? palette.road : '#7cae4c');
            }
        }

        sample.forEach((def, i) => {
            const level = def.levels.filter(
                (l) =>
                    !l.requiresEpoch ||
                    content.epochOrder(l.requiresEpoch) <= epochIndex,
            ).length;

            drawModel(content.level(def, Math.max(1, level)).model.parts, {
                ctx,
                x: i + 0.5,
                y: 0,
                palette,
                seed: i * 13,
                time: t,
                night: false,
                grow: 1,
                snow: 0,
                treeTint: '#3f8a3e',
            });
        });

        ctx.restore();
    });

    return <canvas ref={canvasRef} className="ws-mini" />;
}

export function EpochsPreview({ bundle }: { bundle: ContentBundle }) {
    const epochs = bundle.epochs?.epochs ?? [];

    return (
        <div className="ws-preview ws-epochs">
            {epochs.map((epoch, index) => (
                <div
                    key={epoch.id}
                    className="ws-epoch"
                    style={{
                        background: epoch.theme?.solid,
                        color: epoch.theme?.text,
                        fontFamily: epoch.theme?.font,
                    }}
                >
                    <div className="ws-epoch__head">
                        <b>
                            {epoch.year} · {epoch.name}
                        </b>
                        <span
                            style={{
                                background: epoch.theme?.accent,
                                color: epoch.theme?.accentText,
                            }}
                        >
                            акцент
                        </span>
                    </div>
                    <MiniStreet bundle={bundle} epochIndex={index} />
                    <div className="ws-swatches">
                        {Object.entries(epoch.palette ?? {})
                            .filter(
                                ([, v]) =>
                                    typeof v === 'string' && v.startsWith('#'),
                            )
                            .map(([key, value]) => (
                                <i
                                    key={key}
                                    title={`${key}: ${value}`}
                                    style={{ background: value as string }}
                                />
                            ))}
                    </div>
                    <small>
                        {epoch.yearsPerDay} лет/сутки · земли{' '}
                        {epoch.territory * 2}×{epoch.territory * 2}
                        {epoch.next
                            ? ` · дальше: 👥 ${epoch.next.population}`
                            : ' · последняя эпоха'}
                    </small>
                </div>
            ))}
        </div>
    );
}

// ———————————————————————————————————————— NPCs

function Sprite({ type }: { type: NpcTypeDef }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useAnimationFrame((t) => {
        const canvas = canvasRef.current;

        if (!canvas) {
            return;
        }

        const ctx = setupCanvas(canvas, 120, 70);

        ctx.save();
        ctx.translate(60, 45);
        ctx.scale(2.6, 2.6);

        if (type.vehicle) {
            const hover =
                type.vehicle === 'hover' ? 8 + Math.sin(t * 3) * 1.5 : 0;

            box(
                ctx,
                -0.2,
                -0.1,
                0.2,
                0.1,
                1 + hover,
                3.5,
                type.body[0],
                shade(type.body[0], 0.2),
            );
            box(
                ctx,
                -0.12,
                -0.08,
                0.1,
                0.08,
                4.5 + hover,
                2.5,
                type.vehicle === 'cart' ? '#e8d9b0' : '#9fc7de',
            );
        } else {
            type.body.slice(0, 4).forEach((color, i) => {
                const x = (i - 1.5) * 6;
                const step = Math.sin(t * 6 + i) * 0.8;

                ctx.fillStyle = shade(color, -0.25);
                ctx.fillRect(x - 1.4, -3 + step * 0.3, 1.2, 3);
                ctx.fillRect(x + 0.2, -3 - step * 0.3, 1.2, 3);
                ctx.fillStyle = color;
                ctx.fillRect(x - 1.8, -7.5, 3.6, 4.8);
                ctx.fillStyle =
                    type.skin?.[i % (type.skin?.length || 1)] ?? '#f1c9a0';
                ctx.beginPath();
                ctx.arc(x, -9, 1.7, 0, Math.PI * 2);
                ctx.fill();

                if (type.hat) {
                    ctx.fillStyle = type.hat;
                    ctx.fillRect(x - 2, -11, 4, 1.4);
                }
            });
        }

        ctx.restore();
    });

    return <canvas ref={canvasRef} className="ws-sprite" />;
}

export function NpcsPreview({ bundle }: { bundle: ContentBundle }) {
    const npcs = bundle.npcs;
    const schedule = npcs?.schedule;
    const names = npcs?.names;

    return (
        <div className="ws-preview">
            <div className="ws-npcs">
                {(npcs?.types ?? []).map((type) => (
                    <div key={type.id} className="ws-npc">
                        <Sprite type={type} />
                        <b>{type.name}</b>
                        <small>
                            {type.role === 'traffic' ? 'транспорт' : 'житель'} ·{' '}
                            {type.epochs.join(', ')} · {type.speed} кл/с
                        </small>
                    </div>
                ))}
            </div>
            {schedule && (
                <>
                    <h4>Распорядок дня</h4>
                    <div className="ws-schedule">
                        <i
                            style={{
                                left: 0,
                                width: `${schedule.wake * 100}%`,
                            }}
                            title="сон"
                        >
                            сон
                        </i>
                        <i
                            style={{
                                left: `${schedule.wake * 100}%`,
                                width: `${(schedule.leisure - schedule.wake) * 100}%`,
                            }}
                            title="работа"
                        >
                            работа
                        </i>
                        <i
                            style={{
                                left: `${schedule.leisure * 100}%`,
                                width: `${(schedule.home - schedule.leisure) * 100}%`,
                            }}
                            title="отдых"
                        >
                            отдых
                        </i>
                        <i
                            style={{
                                left: `${schedule.home * 100}%`,
                                width: `${(1 - schedule.home) * 100}%`,
                            }}
                            title="сон"
                        >
                            сон
                        </i>
                    </div>
                </>
            )}
            {names && (
                <p className="ws-names">
                    Например:{' '}
                    {Array.from(
                        { length: 5 },
                        (_, i) =>
                            `${names.first[(i * 7) % names.first.length]} ${names.last[(i * 5) % names.last.length]}`,
                    ).join(', ')}
                </p>
            )}
        </div>
    );
}

// ———————————————————————————————————————— Sounds

export function SoundsPreview({
    bundle,
    audio,
}: {
    bundle: ContentBundle;
    audio: AudioEngine;
}) {
    useEffect(() => {
        audio.setSounds(bundle.sounds);
    }, [audio, bundle.sounds]);

    return (
        <div className="ws-preview">
            <div className="ws-sound-grid">
                {Object.entries(bundle.sounds?.presets ?? {}).map(
                    ([id, preset]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => {
                                audio.unlock();
                                audio.play(id);
                            }}
                        >
                            ▶ {id}
                            <small>
                                {preset.file
                                    ? `файл ${preset.file}`
                                    : `${preset.synth?.noise ? 'шум' : (preset.synth?.wave ?? 'sine')} · ${preset.synth?.duration} с`}
                            </small>
                        </button>
                    ),
                )}
            </div>
            <h4>Фон</h4>
            <ul className="ws-ambience">
                {Object.entries(bundle.sounds?.ambience ?? {}).map(
                    ([id, set]) => (
                        <li key={id}>
                            <b>{id}</b> · днём: {set.day.join(', ')} · ночью:{' '}
                            {set.night.join(', ')}
                        </li>
                    ),
                )}
            </ul>
        </div>
    );
}

export function ResourcesPreview({ bundle }: { bundle: ContentBundle }) {
    return (
        <div className="ws-preview">
            <ul className="ws-legend ws-legend--big">
                {(bundle.resources?.resources ?? []).map((resource) => (
                    <li key={resource.id}>
                        <span>{resource.icon}</span> {resource.name}{' '}
                        <small>
                            {resource.capped
                                ? 'копится до объёма складов'
                                : 'без предела'}
                        </small>
                    </li>
                ))}
            </ul>
        </div>
    );
}
