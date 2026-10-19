/**
 * «Задачи» (ui-spec §5.2 GoalsSheet, §6.8, gdd §9.2–§9.3): tabs Эпоха
 * (the gate summary, the story goal, the discovery under way),
 * Открытия (the research timeline), Задачи (open story goals) and
 * Достижения. A reward to collect — the Treasury chest put off on return
 * — sits on top with «Забрать».
 */

import type { GoalDef } from '../../../engine/content/types';
import { useCtl, useFeedback, useGame, useSecond, useUi } from '../../context';
import { formatExact, formatNumber, years } from '../../format';
import { t } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Bar } from '../../kit/kit';
import type { GoalsTab } from '../../store/ui-store';
import { Section, Sheet } from '../Sheet';
import { ResearchTab } from './ResearchTab';

const TABS: {
    id: GoalsTab;
    label:
        | 'goals.tab.era'
        | 'goals.tab.research'
        | 'goals.tab.tasks'
        | 'goals.tab.achievements';
}[] = [
    { id: 'era', label: 'goals.tab.era' },
    { id: 'research', label: 'goals.tab.research' },
    { id: 'tasks', label: 'goals.tab.tasks' },
    { id: 'achievements', label: 'goals.tab.achievements' },
];

function GoalRow({ goal, story }: { goal: GoalDef; story?: boolean }) {
    const game = useGame();
    const progress = game.goalProgress(goal);
    const money = goal.reward[game.content.currency] ?? 0;

    return (
        <div className="c3-li">
            <Icon name="flag" className={story ? 'c3-saffron' : 'c3-mut'} />
            <span>
                {goal.name}
                <span className="c3-li__sub">{goal.description}</span>
                <Bar value={progress.current / Math.max(1, progress.target)} />
            </span>
            <span
                className="c3-num c3-mut"
                title={t('goals.reward', { n: formatExact(money) })}
            >
                {money > 0 ? formatNumber(money) : ''}
            </span>
        </div>
    );
}

function Reward() {
    const ctl = useCtl();
    const chest = useFeedback((s) => s.pendingChest || s.chest);

    if (chest <= 0) {
        return null;
    }

    return (
        <div className="c3-loss c3-loss--reward">
            <span>
                <Icon name="chest" size="s" className="c3-pos" />{' '}
                {t('goals.chest', { n: formatExact(chest) })}
            </span>
            <button
                type="button"
                className="c3-btn c3-btn--ok c3-btn--small"
                onClick={() => ctl.takeChest()}
            >
                {t('goals.take')}
            </button>
        </div>
    );
}

function EraTab() {
    const ctl = useCtl();
    const game = useGame();
    const next = game.nextEpoch;
    const lines = game.gateLines();
    const story = game.openGoals()[0];
    const research = game.state.research;
    const tech = research ? game.content.tech(research.id) : undefined;
    const spy = game.clock.secondsPerYear;

    return (
        <>
            {next && (
                <Section title={t('goals.gate', { era: next.name })}>
                    {lines.map((line) => (
                        <div
                            key={line.label}
                            className={`c3-li${line.done ? ' c3-li--done' : ''}`}
                        >
                            <Icon
                                name={line.done ? 'check' : 'hall'}
                                className={line.done ? '' : 'c3-era'}
                            />
                            <span>
                                {line.label}
                                {!line.done && (
                                    <Bar
                                        value={
                                            line.current /
                                            Math.max(1, line.target)
                                        }
                                    />
                                )}
                            </span>
                            <span className="c3-num c3-mut">
                                {formatNumber(line.current)} /{' '}
                                {formatNumber(line.target)}
                            </span>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="c3-btn c3-btn--quiet"
                        onClick={() => ctl.open('hall')}
                    >
                        <Icon name="hall" size="s" />
                        {t('hud.quest.open')}
                    </button>
                </Section>
            )}
            <Section title={t('goals.story')}>
                {story ? (
                    <GoalRow goal={story} story />
                ) : (
                    <p className="c3-hint">{t('goals.allDone')}</p>
                )}
            </Section>
            <Section
                title={tech ? t('goals.researchNow') : t('goals.tab.research')}
            >
                {tech && research ? (
                    <div className="c3-li">
                        <Icon name="flask" className="c3-era" />
                        <span>
                            {tech.name}
                            <span className="c3-li__sub">
                                {t('research.left', {
                                    t: years(
                                        Math.max(
                                            1,
                                            Math.round(
                                                (research.end -
                                                    game.state.time) /
                                                    spy,
                                            ),
                                        ),
                                    ),
                                })}
                            </span>
                            <Bar
                                value={
                                    (game.state.time - research.start) /
                                    Math.max(1, research.end - research.start)
                                }
                            />
                        </span>
                        <span />
                    </div>
                ) : (
                    <button
                        type="button"
                        className="c3-btn c3-btn--quiet"
                        onClick={() => ctl.openGoals('research')}
                    >
                        <Icon name="flask" size="s" />
                        {t('goals.researchIdle')}
                    </button>
                )}
            </Section>
        </>
    );
}

function TasksTab() {
    const game = useGame();
    const open = game.openGoals();
    const done = game.content.goals.filter((goal) =>
        game.state.achievements.includes(goal.id),
    );

    return (
        <>
            <Section title={t('goals.more')}>
                {open.length ? (
                    open.map((goal, index) => (
                        <GoalRow
                            key={goal.id}
                            goal={goal}
                            story={index === 0}
                        />
                    ))
                ) : (
                    <p className="c3-hint">{t('goals.allDone')}</p>
                )}
            </Section>
            {done.length > 0 && (
                <Section title={t('goals.done')}>
                    {done
                        .slice(-6)
                        .reverse()
                        .map((goal) => (
                            <div key={goal.id} className="c3-li c3-li--done">
                                <Icon name="check" />
                                <span>{goal.name}</span>
                                <span className="c3-num c3-mut">
                                    {formatNumber(
                                        goal.reward[game.content.currency] ?? 0,
                                    )}
                                </span>
                            </div>
                        ))}
                </Section>
            )}
        </>
    );
}

function AchievementsTab() {
    const game = useGame();
    const list = game.content.achievements;
    const got = list.filter((item) =>
        game.state.achievements.includes(item.id),
    ).length;

    return (
        <Section title={t('goals.achieved', { n: got, total: list.length })}>
            {list.map((item) => {
                const done = game.state.achievements.includes(item.id);
                const progress = game.goalProgress({
                    ...item,
                    epoch: game.content.epochs[0].id,
                    icon: '',
                    reward: {},
                });

                return (
                    <div
                        key={item.id}
                        className={`c3-li${done ? ' c3-li--done' : ''}`}
                    >
                        <Icon
                            name={done ? 'trophy' : 'star'}
                            className={done ? 'c3-saffron' : 'c3-mut'}
                        />
                        <span>
                            {item.name}
                            <span className="c3-li__sub">
                                {item.description}
                            </span>
                            {!done && progress.target > 1 && (
                                <Bar
                                    value={
                                        progress.current /
                                        Math.max(1, progress.target)
                                    }
                                />
                            )}
                        </span>
                        <span />
                    </div>
                );
            })}
        </Section>
    );
}

export function GoalsSheet() {
    const ctl = useCtl();
    const tab = useUi((s) => s.goalsTab);

    useSecond();

    return (
        <Sheet
            title={t('goals.title')}
            sub={t('goals.sub')}
            className="c3-goals"
        >
            <Reward />
            <div
                className="c3-seg c3-seg--tabs"
                role="tablist"
                aria-label={t('goals.title')}
            >
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        aria-pressed={tab === item.id}
                        onClick={() => ctl.ui.set({ goalsTab: item.id })}
                    >
                        {t(item.label)}
                    </button>
                ))}
            </div>
            {tab === 'era' && <EraTab />}
            {tab === 'research' && <ResearchTab />}
            {tab === 'tasks' && <TasksTab />}
            {tab === 'achievements' && <AchievementsTab />}
        </Sheet>
    );
}
