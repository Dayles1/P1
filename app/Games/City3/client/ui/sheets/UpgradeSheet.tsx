/**
 * The bulk upgrade sheet (ui-spec §5.2 UpgradeSheet, §6.5): homes in the
 * frame grouped by target level, a price button per group, blocked groups
 * with their reason and «Показать», and «Улучшить всё доступное», which
 * buys groups in order while the money lasts. No toast: the homes show
 * scaffolding.
 */

import type { Amounts } from '../../engine/content/types';
import { useCtl, useGame, useSecond } from '../context';
import { addAmounts } from '../controller';
import { formatNumber } from '../format';
import { affordableCount, upgradeGroups, upgradeHomes } from '../game/upgrades';
import { t, word } from '../i18n';
import { Icon } from '../icons/Icon';
import { CostLine } from '../kit/kit';
import { Sheet } from './Sheet';

export function UpgradeSheet() {
    const ctl = useCtl();
    const game = useGame();

    useSecond();

    const width = window.innerWidth;
    const height = window.innerHeight;
    const groups = upgradeGroups(game, (building) => {
        const { w, h } = game.def(building).size;
        const at = ctl.renderer.worldToScreen(
            building.x + w / 2,
            building.y + h / 2,
            0,
        );

        return (
            at.visible &&
            at.x >= 0 &&
            at.x <= width &&
            at.y >= 0 &&
            at.y <= height
        );
    });
    const open = groups.filter((group) => group.reason === null);
    const homes = open.flatMap((group) => group.homes);
    let total: Amounts = {};

    for (const group of open) {
        total = addAmounts(total, group.cost);
    }

    const enough = affordableCount(game, homes);
    const play = () => ctl.audio?.play('upgrade');

    return (
        <Sheet title={t('upgrade.title')} sub={t('upgrade.sub')}>
            {groups.length === 0 && (
                <p className="c3-empty">{t('upgrade.empty')}</p>
            )}
            <ul className="c3-lst">
                {groups.map((group) => {
                    const count = group.homes.length;
                    const title = t('upgrade.group', {
                        n: count,
                        word: word(count, 'homes'),
                        level: group.level,
                    });

                    return group.reason === null ? (
                        <li key={group.key} className="c3-li">
                            <Icon name="upgrade" className="c3-pos" />
                            <span>
                                {title}
                                <span className="c3-li__sub">
                                    {t('upgrade.gain', {
                                        n: formatNumber(group.gain),
                                    })}
                                </span>
                            </span>
                            <button
                                type="button"
                                className="c3-btn c3-btn--small"
                                disabled={
                                    affordableCount(game, group.homes) === 0
                                }
                                onClick={() =>
                                    upgradeHomes(game, group.homes) && play()
                                }
                            >
                                <CostLine cost={group.cost} />
                            </button>
                        </li>
                    ) : (
                        <li key={group.key} className="c3-li">
                            <Icon name="lock" className="c3-mut" />
                            <span>
                                {title}
                                <span className="c3-li__sub c3-warn">
                                    {group.reason}
                                </span>
                            </span>
                            <button
                                type="button"
                                className="c3-btn c3-btn--quiet c3-btn--small"
                                onClick={() => ctl.select(group.homes[0].uid)}
                            >
                                {t('common.show')}
                            </button>
                        </li>
                    );
                })}
            </ul>
            {homes.length > 0 && (
                <>
                    <button
                        type="button"
                        className="c3-btn c3-btn--primary c3-btn--wide"
                        disabled={enough === 0}
                        onClick={() => upgradeHomes(game, homes) && play()}
                    >
                        {t('upgrade.all')}
                        <CostLine cost={total} short={false} />
                    </button>
                    {enough < homes.length && (
                        <p className="c3-why">
                            {t('upgrade.enough', {
                                k: enough,
                                n: homes.length,
                            })}
                        </p>
                    )}
                </>
            )}
        </Sheet>
    );
}
