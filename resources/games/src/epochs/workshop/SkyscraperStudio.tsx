import { useState } from 'react';
import type { BuildingDef } from '../engine/content/types';
import {
    DEFAULTS,
    FIELDS,
    PRESETS,
    TYPE_NAMES,
    layout,
    parseStudioJson,
    sanitize,
    studioSummary,
    toModelParts,
} from './skyscraper';
import type { StudioPart, StudioSource, StudioType } from './skyscraper';

const ADDABLE: StudioType[] = [
    'block',
    'crown',
    'spire',
    'antenna',
    'helipad',
    'garden',
    'lantern',
    'bridge',
];

/** The studio design a level was built from, if it was. */
function sourceOf(building: BuildingDef, level: number): StudioSource | null {
    const saved = building.levels?.[level - 1]?.model?.studio as
        | Partial<StudioSource>
        | undefined;

    if (!saved || !Array.isArray(saved.parts)) {
        return null;
    }

    return {
        name: typeof saved.name === 'string' ? saved.name : '',
        parts: saved.parts.map(sanitize),
        height: Number(saved.height) > 0 ? Number(saved.height) : 5,
    };
}

function withLevelModel(
    building: BuildingDef,
    level: number,
    source: StudioSource,
): BuildingDef {
    const size = building.size ?? { w: 1, h: 1 };

    return {
        ...building,
        levels: building.levels.map((def, index) =>
            index === level - 1
                ? {
                      ...def,
                      model: {
                          parts: toModelParts(source.parts, {
                              size,
                              height: source.height,
                          }),
                          studio: source,
                      },
                  }
                : def,
        ),
    };
}

const fmt = (value: number) =>
    value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

/**
 * «Студия небоскрёбов» inside the Workshop: a level's model designed as a
 * tower of blocks, crowns and spires in metres, the way the studio artifact
 * does it, and written into the building file as Epochs model parts. The
 * design itself is kept in the level (`model.studio`) to be opened again.
 */
export function SkyscraperStudio({
    building,
    level,
    onLevel,
    onChange,
}: {
    building: BuildingDef;
    level: number;
    onLevel: (level: number) => void;
    onChange: (building: BuildingDef) => void;
}) {
    const [selected, setSelected] = useState(0);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState('');
    const levels = building.levels ?? [];
    const source = sourceOf(building, level);

    const apply = (next: StudioSource) =>
        onChange(withLevelModel(building, level, next));
    const setParts = (parts: StudioPart[], select = selected) => {
        apply({
            name: source?.name ?? '',
            height: source?.height ?? 5,
            parts,
        });
        setSelected(Math.max(0, Math.min(select, parts.length - 1)));
    };

    const levelTabs = (
        <div className="ws-tabs">
            {levels.map((def) => (
                <button
                    key={def.level}
                    type="button"
                    aria-pressed={def.level === level}
                    onClick={() => {
                        onLevel(def.level);
                        setSelected(0);
                    }}
                    title={def.name}
                >
                    {def.level}
                </button>
            ))}
        </div>
    );

    const presets = (
        <div className="ss-presets">
            {PRESETS.map((preset) => (
                <button
                    key={preset.id}
                    type="button"
                    className="ss-preset"
                    onClick={() => {
                        apply({
                            name: preset.name,
                            height: source?.height ?? 5,
                            parts: preset.parts(),
                        });
                        setSelected(0);
                    }}
                >
                    <b>{preset.name}</b>
                    <small>{preset.note}</small>
                </button>
            ))}
        </div>
    );

    const importer = (
        <details className="ss-import">
            <summary>Вставить JSON из «Студии небоскрёбов»</summary>
            <textarea
                spellCheck={false}
                value={importText}
                placeholder='{"name": "…", "parts": [ … ]} — кнопка «JSON» в студии'
                onChange={(event) => setImportText(event.target.value)}
            />
            <button
                type="button"
                className="hud-button"
                disabled={!importText.trim()}
                onClick={() => {
                    try {
                        const parsed = parseStudioJson(importText);

                        apply({ ...parsed, height: source?.height ?? 5 });
                        setImportText('');
                        setImportError('');
                        setSelected(0);
                    } catch (failure) {
                        setImportError(
                            failure instanceof Error
                                ? failure.message
                                : 'Не удалось прочитать JSON',
                        );
                    }
                }}
            >
                Применить к уровню {level}
            </button>
            {importError && <p className="ws-error">{importError}</p>}
        </details>
    );

    if (!levels.length) {
        return <p className="ws-empty">У здания нет уровней.</p>;
    }

    if (!source) {
        return (
            <div className="ss">
                <div className="ss-row">
                    <span>Уровень</span>
                    {levelTabs}
                </div>
                <p className="ws-empty">
                    Модель уровня {level} собрана вручную. Выберите основу, и
                    студия заменит ею детали модели этого уровня (отменить можно
                    кнопкой «Отменить правки»).
                </p>
                {presets}
                <button
                    type="button"
                    className="hud-button"
                    onClick={() =>
                        apply({
                            name: '',
                            height: 5,
                            parts: [{ ...DEFAULTS.block }],
                        })
                    }
                >
                    ＋ Начать с одного блока
                </button>
                {importer}
            </div>
        );
    }

    const { parts } = source;
    const summary = studioSummary(parts);
    const placed = layout(parts);
    const current = parts[selected];

    const update = (key: string, value: unknown) =>
        setParts(
            parts.map((part, index) =>
                index === selected ? sanitize({ ...part, [key]: value }) : part,
            ),
        );
    const move = (index: number, by: number) => {
        const target = index + by;

        if (target < 0 || target >= parts.length) {
            return;
        }

        const next = [...parts];

        [next[index], next[target]] = [next[target], next[index]];
        setParts(next, target);
    };

    return (
        <div className="ss">
            <div className="ss-row">
                <span>Уровень</span>
                {levelTabs}
            </div>

            <p className="ss-meta">
                {source.name || 'Без названия'} · {fmt(summary.height)} м ·{' '}
                {summary.floors} этажей · {parts.length} частей
            </p>

            <label className="ss-field">
                <span>
                    Высота в игре, клеток <output>{fmt(source.height)}</output>
                </span>
                <input
                    type="range"
                    min={1}
                    max={12}
                    step={0.1}
                    value={source.height}
                    onChange={(event) =>
                        apply({ ...source, height: Number(event.target.value) })
                    }
                />
            </label>

            <div className="ss-add">
                {ADDABLE.map((type) => (
                    <button
                        key={type}
                        type="button"
                        onClick={() =>
                            setParts(
                                [
                                    ...parts,
                                    sanitize({
                                        ...DEFAULTS[type],
                                        stack: current?.stack ?? 0,
                                    }),
                                ],
                                parts.length,
                            )
                        }
                    >
                        ＋ {TYPE_NAMES[type]}
                    </button>
                ))}
            </div>

            <ol className="ss-parts">
                {parts.map((part, index) => (
                    <li key={index}>
                        <button
                            type="button"
                            className="ss-part"
                            aria-pressed={index === selected}
                            onClick={() => setSelected(index)}
                        >
                            <i
                                style={{
                                    background:
                                        'color' in part
                                            ? part.color
                                            : '#6aa84f',
                                }}
                            />
                            <span>
                                <b>{part.label ?? TYPE_NAMES[part.type]}</b>
                                <small>
                                    {part.type === 'block'
                                        ? `${part.floors} эт. · `
                                        : ''}
                                    {fmt(placed[index].base)}–
                                    {fmt(placed[index].top)} м
                                    {part.stack
                                        ? ` · башня ${part.stack + 1}`
                                        : ''}
                                </small>
                            </span>
                        </button>
                        <span className="ss-ops">
                            <button
                                type="button"
                                aria-label="Выше"
                                onClick={() => move(index, 1)}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                aria-label="Ниже"
                                onClick={() => move(index, -1)}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                aria-label="Удалить"
                                disabled={parts.length === 1}
                                onClick={() =>
                                    setParts(
                                        parts.filter((_, i) => i !== index),
                                        Math.min(selected, parts.length - 2),
                                    )
                                }
                            >
                                ✕
                            </button>
                        </span>
                    </li>
                ))}
            </ol>

            {current && (
                <div className="ss-editor">
                    <label className="ss-field">
                        <span>Подпись</span>
                        <input
                            type="text"
                            maxLength={40}
                            value={current.label ?? ''}
                            placeholder={TYPE_NAMES[current.type]}
                            onChange={(event) =>
                                update('label', event.target.value)
                            }
                        />
                    </label>
                    <label className="ss-field">
                        <span>
                            Башня (стопка) <output>{current.stack + 1}</output>
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={5}
                            step={1}
                            value={current.stack}
                            onChange={(event) =>
                                update('stack', Number(event.target.value))
                            }
                        />
                    </label>
                    {FIELDS[current.type].map((field) => {
                        const value = (
                            current as unknown as Record<string, unknown>
                        )[field.key];

                        if (
                            field.kind === 'number' &&
                            field.when &&
                            current.type === 'block' &&
                            !field.when(current)
                        ) {
                            return null;
                        }

                        if (field.kind === 'number') {
                            return (
                                <label key={field.key} className="ss-field">
                                    <span>
                                        {field.label}{' '}
                                        <output>{fmt(Number(value))}</output>
                                    </span>
                                    <input
                                        type="range"
                                        min={field.min}
                                        max={field.max}
                                        step={field.step}
                                        value={Number(value)}
                                        onChange={(event) =>
                                            update(
                                                field.key,
                                                Number(event.target.value),
                                            )
                                        }
                                    />
                                </label>
                            );
                        }

                        if (field.kind === 'color') {
                            return (
                                <label
                                    key={field.key}
                                    className="ss-field ss-field--inline"
                                >
                                    <span>{field.label}</span>
                                    <input
                                        type="color"
                                        value={String(value)}
                                        onChange={(event) =>
                                            update(
                                                field.key,
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                            );
                        }

                        return (
                            <label key={field.key} className="ss-field">
                                <span>{field.label}</span>
                                <select
                                    value={String(value)}
                                    onChange={(event) =>
                                        update(field.key, event.target.value)
                                    }
                                >
                                    {field.options.map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        );
                    })}
                </div>
            )}

            <p className="ws-empty">
                В игре здание стоит на участке {building.size?.w ?? 1}×
                {building.size?.h ?? 1}: план вписывается в него, высота
                масштабируется. Закрутка и поворот не переносятся, сужение
                рисуется уступами.
            </p>

            <details className="ss-import">
                <summary>Основы</summary>
                {presets}
            </details>
            {importer}
        </div>
    );
}
