/**
 * World-anchored strip plaques and off-screen edge chips (ui-spec §5.1
 * StripPlaque/EdgeChip, §6.6): a plaque at the next purchasable strip on
 * each side, «+ Полоса [face] 4,4K · бухта»; when its anchor is off
 * screen (idle only) an edge chip «‹ (+) 4,4K» glides the camera there.
 * Positions are written from the frame loop, not through React.
 */

import { useRef } from 'react';
import { useCtl, useGame, useHud, useSecond, useUi } from '../context';
import { layoutOf } from '../controller';
import { formatExact, formatNumber } from '../format';
import { landOffer, stripInfo } from '../game/strips';
import type { LandOffer, Side } from '../game/strips';
import { t } from '../i18n';
import { CurrencyFace, Icon } from '../icons/Icon';
import { useFrame } from '../store/frame';

const SIDES: Side[] = ['west', 'east'];

function safeZone(width: number, height: number) {
    const layout = layoutOf(width, height);

    return layout === 'portrait'
        ? { top: 170, bottom: 200 }
        : layout === 'landscape'
          ? { top: 120, bottom: 80 }
          : { top: 130, bottom: 160 };
}

export function StripPlaques() {
    const ctl = useCtl();
    const game = useGame();
    const face = useHud((s) => s.money.face);
    const tool = useUi((s) => s.tool.kind);
    const sheet = useUi((s) => s.sheet);
    const plaques = useRef<Record<Side, HTMLButtonElement | null>>({
        west: null,
        east: null,
    });
    const edges = useRef<Record<Side, HTMLButtonElement | null>>({
        west: null,
        east: null,
    });

    useSecond();

    const offers: { side: Side; offer: LandOffer }[] = [];

    for (const side of SIDES) {
        const offer = landOffer(game, side);

        if (offer) {
            offers.push({ side, offer });
        }
    }

    const hidden = tool !== 'select' || sheet === 'build';
    const idle = tool === 'select' && !sheet;

    useFrame(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const zone = safeZone(width, height);
        // The plaque sits on the ground row under the middle of the view.
        const middle = ctl.renderer.groundAt(width / 2, height * 0.52);
        const row = Math.min(
            Math.max(middle?.y ?? game.layout.beachY * 0.6, 3),
            game.layout.beachY - 3,
        );

        for (const { side, offer } of offers) {
            const plaque = plaques.current[side];
            const edge = edges.current[side];

            if (!plaque || !edge) {
                continue;
            }

            const at = ctl.renderer.worldToScreen(
                (offer.minX + offer.maxX + 1) / 2,
                row,
                0,
            );
            const onScreen =
                at.visible &&
                at.x > 70 &&
                at.x < width - 70 &&
                at.y > zone.top &&
                at.y < height - zone.bottom;

            if (onScreen && !hidden) {
                plaque.style.display = '';
                plaque.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px) translate(-50%, calc(-100% - 10px))`;
                edge.style.display = 'none';

                continue;
            }

            plaque.style.display = 'none';

            if (!idle) {
                edge.style.display = 'none';
                continue;
            }

            const left =
                side === 'west'
                    ? at.x < width / 2 || !at.visible
                    : at.x < width * 0.15;
            const y = Math.min(
                Math.max(at.visible ? at.y : height / 2, height * 0.4),
                height * 0.55,
            );

            edge.style.display = '';
            edge.classList.toggle('c3-edge--r', !left);
            edge.style.left = left ? 'var(--lft)' : '';
            edge.style.right = left ? '' : 'var(--rgt)';
            edge.style.top = `${Math.round(y)}px`;
        }
    });

    if (!offers.length) {
        return null;
    }

    return (
        <div className="c3-plaques">
            {offers.map(({ side, offer }) => {
                const info = stripInfo(offer.minX);
                const label = t('strip.aria', {
                    feature: info.word,
                    price: formatExact(offer.price),
                });

                return (
                    <div key={side}>
                        <button
                            ref={(element) => {
                                plaques.current[side] = element;
                            }}
                            type="button"
                            className={`c3-plaque c3-chip${offer.affordable ? '' : ' is-short'}`}
                            style={{ display: 'none' }}
                            aria-label={label}
                            onClick={() => ctl.openStrip(side)}
                        >
                            <span className="c3-plaque__add">
                                <Icon name="plus" />
                            </span>
                            <span className="c3-plaque__body">
                                <span className="c3-plaque__title">
                                    {t('strip.plaque')}
                                    <span className="c3-plaque__price c3-num c3-disp">
                                        <CurrencyFace era={face} />
                                        {formatNumber(offer.price)}
                                    </span>
                                </span>
                                <span className="c3-plaque__feat">
                                    <Icon name={info.icon} />
                                    {info.word}
                                </span>
                            </span>
                        </button>
                        <button
                            ref={(element) => {
                                edges.current[side] = element;
                            }}
                            type="button"
                            className="c3-edge c3-chip"
                            style={{ display: 'none' }}
                            aria-label={label}
                            onClick={() => ctl.openStrip(side)}
                        >
                            <Icon
                                name={side === 'west' ? 'chev-l' : 'chev'}
                                className="c3-edge__chev"
                            />
                            <span className="c3-edge__add">
                                <Icon name="plus" />
                            </span>
                            <span className="c3-num">
                                {formatNumber(offer.price)}
                            </span>
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
