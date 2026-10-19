/**
 * The build tray (ui-spec §5.2 BuildTray/BuildCard, gdd §11.2): ten tabs
 * in gdd order with a saffron dot where a card is new, the bulldozer in
 * the header, and the cards — thumbnail, name, cost line, one effect line,
 * «Новое», the lock line, «Уже построен: показать». A card opens
 * placement (roads: the line tool).
 */

import { useEffect, useRef } from 'react';
import { useCtl, useGame, useSecond, useUi } from '../../context';
import { buildCatalog, TABS } from '../../game/catalog';
import type { Card } from '../../game/catalog';
import { t } from '../../i18n';
import type { CopyKey } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { CostLine } from '../../kit/kit';
import { CloseButton, Sheet } from '../Sheet';
import { Thumb } from './Thumb';

function BuildCard({
    card,
    icon,
}: {
    card: Card;
    icon: (typeof TABS)[number]['icon'];
}) {
    const ctl = useCtl();
    const locked = Boolean(card.locked);

    return (
        <button
            type="button"
            className={`c3-card${locked ? ' c3-card--locked' : ''}`}
            aria-disabled={locked}
            title={card.level.description ?? card.def.description}
            onClick={() => ctl.pickCard(card)}
        >
            <Thumb
                key={`${card.def.id}:${card.level.level}`}
                def={card.def}
                level={card.level.level}
                size={156}
                fallback={icon}
                className="c3-card__img"
            />
            {card.isNew && (
                <span className="c3-card__new">{t('common.newTag')}</span>
            )}
            <span className="c3-card__name">{card.level.name}</span>
            {card.locked ? (
                <span className="c3-lockline">
                    <Icon name="lock" />
                    {card.locked}
                </span>
            ) : card.builtUid !== null ? (
                <span className="c3-card__fx c3-card__built">
                    <Icon name="target" size="xs" />
                    {t('build.built')}
                </span>
            ) : (
                <>
                    <CostLine cost={card.cost} />
                    <span className="c3-card__fx">{card.effect}</span>
                </>
            )}
        </button>
    );
}

export function BuildTray() {
    const ctl = useCtl();
    const game = useGame();
    const tab = useUi((s) => s.buildTab);
    const tabsRef = useRef<HTMLDivElement>(null);

    useSecond();

    const catalog = buildCatalog(game);
    const cards = catalog[tab];
    const current = TABS.find((item) => item.id === tab) ?? TABS[0];

    useEffect(() => {
        tabsRef.current
            ?.querySelector('.is-on')
            ?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [tab]);

    const empty =
        tab === 'energy'
            ? t('build.empty.energy')
            : tab === 'transport'
              ? t('build.empty.transport')
              : t('build.empty');

    return (
        <Sheet
            kind="tray"
            title={t('build.title')}
            className="c3-tray"
            head={
                <header className="c3-tray__head">
                    <div
                        className="c3-tabs"
                        role="tablist"
                        aria-label={t('build.tabs')}
                        ref={tabsRef}
                    >
                        {TABS.map((item) => {
                            const fresh = catalog[item.id].some(
                                (card) => card.isNew,
                            );

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={item.id === tab}
                                    className={`c3-tab${item.id === tab ? ' is-on' : ''}`}
                                    onClick={() => ctl.setBuildTab(item.id)}
                                >
                                    <Icon name={item.icon} />
                                    <span>{t(item.label as CopyKey)}</span>
                                    {fresh && (
                                        <i
                                            className="c3-tab__dot"
                                            aria-label={t('build.newDot')}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        className="c3-tool"
                        aria-label={t('build.bulldozeAria')}
                        aria-keyshortcuts="X"
                        onClick={() => ctl.startBulldoze()}
                    >
                        <Icon name="bulldoze" />
                        <span>{t('build.bulldoze')}</span>
                    </button>
                    <CloseButton />
                </header>
            }
        >
            {cards.length ? (
                <div className="c3-cards" role="tabpanel">
                    {cards.map((card) => (
                        <BuildCard
                            key={`${card.def.id}:${card.level.level}`}
                            card={card}
                            icon={current.icon}
                        />
                    ))}
                </div>
            ) : (
                <p className="c3-empty">{empty}</p>
            )}
        </Sheet>
    );
}
