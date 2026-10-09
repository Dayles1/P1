import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../epochs.css';
import { GameApiError, gameApi } from '../../shared/api';
import { AudioEngine } from '../audio/audio';
import { formatContent, loadContent } from '../content-api';
import { validateContent } from '../engine/content/registry';
import type { ContentIssue } from '../engine/content/registry';
import type { BuildingDef, ContentBundle } from '../engine/content/types';
import { PreviewBoundary } from './PreviewBoundary';
import { SkyscraperStudio } from './SkyscraperStudio';
import {
    BuildingPreview,
    ClimatePreview,
    EpochsPreview,
    MapPreview,
    NpcsPreview,
    ResourcesPreview,
    SoundsPreview,
} from './previews';

/** One editable content file: its key on the server and what it is. */
interface FileEntry {
    key: string;
    title: string;
    icon: string;
    hint: string;
}

const FILES: FileEntry[] = [
    {
        key: 'world',
        title: 'Мир',
        icon: '🌍',
        hint: 'Размер карты, длина суток, старт, население, экономика, события',
    },
    {
        key: 'biomes',
        title: 'Биомы и карта',
        icon: '🗺️',
        hint: 'Биомы, их правила и генератор карты',
    },
    {
        key: 'climate',
        title: 'Климат и сутки',
        icon: '🌦️',
        hint: 'Сезоны, погода, смена дня и ночи',
    },
    {
        key: 'epochs',
        title: 'Эпохи',
        icon: '⏳',
        hint: 'Годы, палитры архитектуры, оформление, условия перехода',
    },
    {
        key: 'resources',
        title: 'Ресурсы',
        icon: '💰',
        hint: 'Еда, дерево, камень и остальное',
    },
    {
        key: 'techs',
        title: 'Технологии',
        icon: '🔬',
        hint: 'Древо технологий: цены, время, требования, бонусы',
    },
    {
        key: 'blueprints',
        title: 'Чертежи',
        icon: '📐',
        hint: 'Стили бюро архитекторов: цвета, крыши, уровни бюро',
    },
    {
        key: 'goals',
        title: 'Цели',
        icon: '🏆',
        hint: 'Задания и достижения с наградами',
    },
    {
        key: 'npcs',
        title: 'Жители (NPC)',
        icon: '🚶',
        hint: 'Типы жителей и транспорта, расписание, имена, мысли',
    },
    {
        key: 'sounds',
        title: 'Звуки',
        icon: '🔊',
        hint: 'Пресеты синтеза или свои файлы, фоновые звуки',
    },
];

function fileData(bundle: ContentBundle, key: string): unknown {
    return key.startsWith('buildings/')
        ? bundle.buildings[key.slice(10)]
        : bundle[key as keyof ContentBundle];
}

function withFile(
    bundle: ContentBundle,
    key: string,
    data: unknown,
): ContentBundle {
    if (key.startsWith('buildings/')) {
        return {
            ...bundle,
            buildings: {
                ...bundle.buildings,
                [key.slice(10)]: data as BuildingDef,
            },
        };
    }

    return { ...bundle, [key]: data };
}

function parseError(text: string, error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    const position = /position (\d+)/.exec(message);

    if (position) {
        const line = text.slice(0, Number(position[1])).split('\n').length;

        return `Строка ${line}: ${message}`;
    }

    return message;
}

/**
 * The Workshop: every content file of «Летопись города 2» with a live preview.
 * Edits are checked against the whole set as you type; saving writes the
 * file on the server, and the next game load uses it.
 */
export default function Workshop() {
    const audio = useMemo(
        () => new AudioEngine({ master: 0.5, presets: {}, ambience: {} }),
        [],
    );
    const [saved, setSaved] = useState<ContentBundle | null>(null);
    const [editable, setEditable] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [active, setActive] = useState('buildings/house');
    const [texts, setTexts] = useState<Record<string, string>>({});
    const [newFiles, setNewFiles] = useState<string[]>([]);
    const [serverIssues, setServerIssues] = useState<ContentIssue[]>([]);
    const [status, setStatus] = useState('');
    const [filter, setFilter] = useState('');
    const [studio, setStudio] = useState(false);
    const [studioLevel, setStudioLevel] = useState(1);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        document.title = 'Мастерская · Летопись города 2';
        loadContent()
            .then((loaded) => {
                setSaved(loaded.bundle);
                setEditable(loaded.editable);
                audio.setSounds(loaded.bundle.sounds);
            })
            .catch((failure: unknown) =>
                setLoadError(
                    failure instanceof Error
                        ? failure.message
                        : 'Не удалось загрузить настройки',
                ),
            );
    }, [audio]);

    const originalText = useCallback(
        (key: string) =>
            saved ? formatContent(fileData(saved, key) ?? {}) : '',
        [saved],
    );
    const text = texts[active] ?? originalText(active);
    const dirtyKeys = Object.keys(texts).filter(
        (key) => texts[key] !== originalText(key),
    );

    // The draft: saved content with every edited file that parses.
    const draft = useMemo(() => {
        if (!saved) {
            return {
                bundle: null as ContentBundle | null,
                errors: {} as Record<string, string>,
            };
        }

        let bundle = saved;
        const errors: Record<string, string> = {};

        for (const [key, value] of Object.entries(texts)) {
            try {
                bundle = withFile(bundle, key, JSON.parse(value));
            } catch (failure) {
                errors[key] = parseError(value, failure);
            }
        }

        return { bundle, errors };
    }, [saved, texts]);

    const issues = useMemo(
        () => (draft.bundle ? validateContent(draft.bundle) : []),
        [draft.bundle],
    );
    const activeIssues = [
        ...issues.filter((issue) => issue.file === active),
        ...serverIssues.filter((issue) => issue.file === active),
    ];
    const otherIssues = issues.filter((issue) => issue.file !== active);

    const saveActive = useCallback(async () => {
        if (!draft.bundle || draft.errors[active]) {
            return;
        }

        setStatus('Сохраняю…');
        setServerIssues([]);

        try {
            await gameApi(`epochs/content/${active}`, {
                method: 'PUT',
                body: { json: text },
            });

            const data = JSON.parse(text);

            setSaved((current) =>
                current ? withFile(current, active, data) : current,
            );
            setTexts((all) => {
                const next = { ...all };

                delete next[active];

                return next;
            });
            setNewFiles((list) => list.filter((key) => key !== active));
            setStatus(
                '✓ Сохранено. Игра подхватит изменения при следующей загрузке.',
            );
        } catch (failure) {
            if (failure instanceof GameApiError && failure.status === 422) {
                setServerIssues(
                    ((failure.data as { issues?: ContentIssue[] })?.issues ??
                        []) as ContentIssue[],
                );
                setStatus(`✕ ${failure.message}`);
            } else {
                setStatus(
                    `✕ ${failure instanceof Error ? failure.message : 'Ошибка сохранения'}`,
                );
            }
        }
    }, [active, draft, text]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === 's'
            ) {
                event.preventDefault();
                void saveActive();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [saveActive]);

    if (loadError) {
        return <div className="ws-center">{loadError}</div>;
    }

    if (!saved || !draft.bundle) {
        return <div className="ws-center">Загружаем настройки…</div>;
    }

    if (!editable) {
        return (
            <div className="ws-center">
                <p>Мастерская доступна только редакторам игры.</p>
                <Link to="/city2">← К игре</Link>
            </div>
        );
    }

    const buildingKeys = [
        ...new Set([
            ...Object.keys(saved.buildings).map((id) => `buildings/${id}`),
            ...newFiles,
        ]),
    ].sort();
    const visibleBuildings = buildingKeys.filter((key) => {
        const def = draft.bundle!.buildings[key.slice(10)];

        return (
            !filter ||
            key.includes(filter.toLowerCase()) ||
            def?.name?.toLowerCase().includes(filter.toLowerCase())
        );
    });
    const current = fileData(draft.bundle, active);
    const isBuilding = active.startsWith('buildings/');

    const createBuilding = () => {
        const id = window
            .prompt('id нового здания (латиница, цифры, _): например tea_house')
            ?.trim();

        if (!id) {
            return;
        }

        if (!/^[a-z][a-z0-9_]{1,40}$/.test(id) || saved.buildings[id]) {
            window.alert('Такой id не подходит или уже занят.');

            return;
        }

        const template = structuredClone(
            saved.buildings.house ?? Object.values(saved.buildings)[0],
        );

        template.id = id;
        template.name = 'Новое здание';
        template.description = 'Описание нового здания.';

        const key = `buildings/${id}`;

        setNewFiles((list) => [...list, key]);
        setTexts((all) => ({ ...all, [key]: formatContent(template) }));
        setActive(key);
    };

    const deleteBuilding = async () => {
        if (!isBuilding || !window.confirm(`Удалить файл ${active}.json?`)) {
            return;
        }

        if (newFiles.includes(active)) {
            setNewFiles((list) => list.filter((key) => key !== active));
            setTexts((all) => {
                const next = { ...all };

                delete next[active];

                return next;
            });
            setActive('buildings/house');

            return;
        }

        try {
            await gameApi(`epochs/content/${active}`, { method: 'DELETE' });
            setSaved((bundle) => {
                if (!bundle) {
                    return bundle;
                }

                const buildings = { ...bundle.buildings };

                delete buildings[active.slice(10)];

                return { ...bundle, buildings };
            });
            setActive('buildings/house');
            setStatus('✓ Удалено');
        } catch (failure) {
            if (failure instanceof GameApiError && failure.status === 422) {
                setServerIssues(
                    ((failure.data as { issues?: ContentIssue[] })?.issues ??
                        []) as ContentIssue[],
                );
            }

            setStatus(
                `✕ ${failure instanceof Error ? failure.message : 'Не удалось удалить'}`,
            );
        }
    };

    const fileButton = (key: string, label: string, icon: string) => (
        <button
            key={key}
            type="button"
            className="ws-file"
            aria-pressed={active === key}
            onClick={() => setActive(key)}
        >
            <span>{icon}</span>
            <span className="ws-file__name">{label}</span>
            {dirtyKeys.includes(key) && (
                <i className="ws-dot" title="Есть несохранённые изменения" />
            )}
            {issues.some((issue) => issue.file === key) && (
                <i className="ws-dot ws-dot--bad" title="Есть ошибки" />
            )}
        </button>
    );

    return (
        <div className="ws">
            <aside className="ws-side">
                <div className="ws-side__head">
                    <Link to="/city2" className="ws-back">
                        ← В игру
                    </Link>
                    <h1>🛠️ Мастерская</h1>
                    <p>
                        Настройки «Города эпох» — файлы в
                        resources/games/content/epochs
                    </p>
                </div>

                <nav className="ws-files">
                    {FILES.map((file) =>
                        fileButton(file.key, file.title, file.icon),
                    )}
                    <div className="ws-files__group">
                        <span>Здания ({buildingKeys.length})</span>
                        <button
                            type="button"
                            onClick={createBuilding}
                            title="Новое здание"
                        >
                            ＋
                        </button>
                    </div>
                    <input
                        className="ws-search"
                        placeholder="Найти здание…"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                    />
                    {visibleBuildings.map((key) => {
                        const def = draft.bundle!.buildings[key.slice(10)];

                        return fileButton(
                            key,
                            def?.name ?? key.slice(10),
                            def?.icon ?? '🏠',
                        );
                    })}
                </nav>
            </aside>

            <main className="ws-main">
                <header className="ws-main__head">
                    <div>
                        <h2>{active}.json</h2>
                        <p>
                            {FILES.find((f) => f.key === active)?.hint ??
                                (isBuilding
                                    ? 'Тип, размер, уровни: цена, экономика, модель (дизайн) и звуки здания'
                                    : '')}
                        </p>
                    </div>
                    <div className="ws-actions">
                        {isBuilding && (
                            <button
                                type="button"
                                className="hud-button hud-button--danger"
                                onClick={deleteBuilding}
                            >
                                🗑️ Удалить
                            </button>
                        )}
                        <button
                            type="button"
                            className="hud-button"
                            disabled={!dirtyKeys.includes(active)}
                            onClick={() =>
                                setTexts((all) => {
                                    const next = { ...all };

                                    delete next[active];

                                    return next;
                                })
                            }
                        >
                            ↺ Отменить правки
                        </button>
                        <button
                            type="button"
                            className="hud-button hud-button--primary"
                            disabled={
                                Boolean(draft.errors[active]) ||
                                activeIssues.length > 0 ||
                                (!dirtyKeys.includes(active) &&
                                    !newFiles.includes(active))
                            }
                            onClick={saveActive}
                            title="Ctrl+S"
                        >
                            💾 Сохранить
                        </button>
                    </div>
                </header>

                {status && <p className="ws-status">{status}</p>}

                <div className="ws-split">
                    <section className="ws-editor">
                        {isBuilding && (
                            <div className="ws-tabs ws-editor__tabs">
                                <button
                                    type="button"
                                    aria-pressed={!studio}
                                    onClick={() => setStudio(false)}
                                >
                                    {'{ }'} JSON
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={studio}
                                    onClick={() => setStudio(true)}
                                    title="Собрать модель уровня как в «Студии небоскрёбов»"
                                >
                                    🏙️ Студия
                                </button>
                            </div>
                        )}
                        {isBuilding && studio ? (
                            <div className="ws-studio">
                                {draft.errors[active] || !current ? (
                                    <p className="ws-empty">
                                        Исправьте JSON, чтобы открыть студию.
                                    </p>
                                ) : (
                                    <SkyscraperStudio
                                        building={current as BuildingDef}
                                        level={Math.min(
                                            studioLevel,
                                            Math.max(
                                                1,
                                                (current as BuildingDef).levels
                                                    ?.length ?? 1,
                                            ),
                                        )}
                                        onLevel={setStudioLevel}
                                        onChange={(next) =>
                                            setTexts((all) => ({
                                                ...all,
                                                [active]: formatContent(next),
                                            }))
                                        }
                                    />
                                )}
                            </div>
                        ) : (
                            <textarea
                                ref={textareaRef}
                                spellCheck={false}
                                value={text}
                                onChange={(event) =>
                                    setTexts((all) => ({
                                        ...all,
                                        [active]: event.target.value,
                                    }))
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Tab') {
                                        event.preventDefault();

                                        const el = event.currentTarget;
                                        const start = el.selectionStart;
                                        const value = `${text.slice(0, start)}    ${text.slice(el.selectionEnd)}`;

                                        setTexts((all) => ({
                                            ...all,
                                            [active]: value,
                                        }));
                                        requestAnimationFrame(() =>
                                            el.setSelectionRange(
                                                start + 4,
                                                start + 4,
                                            ),
                                        );
                                    }
                                }}
                            />
                        )}
                        <div className="ws-issues">
                            {draft.errors[active] && (
                                <p className="ws-error">
                                    JSON: {draft.errors[active]}
                                </p>
                            )}
                            {activeIssues.map((issue) => (
                                <p
                                    key={issue.path + issue.message}
                                    className="ws-error"
                                >
                                    {issue.path || 'файл'}: {issue.message}
                                </p>
                            ))}
                            {otherIssues.length > 0 && (
                                <p className="ws-warning">
                                    Ошибки в других файлах:{' '}
                                    {[
                                        ...new Set(
                                            otherIssues.map(
                                                (issue) => issue.file,
                                            ),
                                        ),
                                    ].join(', ')}
                                </p>
                            )}
                            {!draft.errors[active] &&
                                activeIssues.length === 0 && (
                                    <p className="ws-ok">✓ Файл в порядке</p>
                                )}
                        </div>
                    </section>

                    <section className="ws-view">
                        <PreviewBoundary resetKey={active + text.length}>
                            {draft.errors[active] ? (
                                <p className="ws-empty">
                                    Исправьте JSON, чтобы увидеть превью.
                                </p>
                            ) : isBuilding && current ? (
                                <BuildingPreview
                                    bundle={draft.bundle}
                                    building={current as BuildingDef}
                                    audio={audio}
                                    focusLevel={
                                        studio ? studioLevel : undefined
                                    }
                                />
                            ) : active === 'world' || active === 'biomes' ? (
                                <MapPreview bundle={draft.bundle} />
                            ) : active === 'climate' ? (
                                <ClimatePreview bundle={draft.bundle} />
                            ) : active === 'epochs' ? (
                                <EpochsPreview bundle={draft.bundle} />
                            ) : active === 'npcs' ? (
                                <NpcsPreview bundle={draft.bundle} />
                            ) : active === 'sounds' ? (
                                <SoundsPreview
                                    bundle={draft.bundle}
                                    audio={audio}
                                />
                            ) : (
                                <ResourcesPreview bundle={draft.bundle} />
                            )}
                        </PreviewBoundary>
                    </section>
                </div>
            </main>
        </div>
    );
}
