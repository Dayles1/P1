/**
 * Prices and the treasury on screen (gdd §4.9–§4.12): the price sheet —
 * how an upgrade's price comes about (list price, trade-in credit of the
 * money paid, the floor, Spirit of the Age, materials from the stores or
 * bought), what demolition returns, the loan when it is short — and the
 * Treasury chest card on return.
 */

import { MATERIALS } from '../engine/content/registry';
import type { Game } from '../engine/sim/game';
import type { BuildingState } from '../engine/sim/state';
import { LoanOffer } from './chronicle';
import { formatExact, Modal, MoneyIcon } from './common';

/** How a price comes about (the Inspector's and the Town Hall's «Как считается цена»). */
export function PriceSheet({
    game,
    building,
    level,
    onClose,
}: {
    game: Game;
    building: BuildingState;
    level: number;
    onClose: () => void;
}) {
    const economy = game.content.world.economy;
    const money = game.content.currency;
    const coin = game.content.currencyFace(game.state.epoch);
    const materials = game.content.resource(MATERIALS);
    const target = game.content.level(game.def(building), level);
    const price = game.priceBreakdown(building, level);
    const quote = price.quote;
    const short = Math.max(0, quote.total - game.money);
    const center = game.roleOf(building) === 'center';
    const listMoney = price.list[money] ?? 0;

    return (
        <Modal title={`Цена: «${target.name}»`} onClose={onClose}>
            <table className="price">
                <tbody>
                    <tr>
                        <td>Цена уровня</td>
                        <td>
                            <MoneyIcon face={coin} /> {formatExact(listMoney)} +{' '}
                            {materials?.icon}{' '}
                            {formatExact(price.list[MATERIALS] ?? 0)}
                        </td>
                    </tr>
                    {!center && (
                        <tr>
                            <td>
                                Зачёт: {Math.round(economy.tradeIn * 100)} %
                                уплаченного за здание ({formatExact(price.paid)}
                                ), не больше цены нынешнего уровня
                            </td>
                            <td>−{formatExact(price.credit)}</td>
                        </tr>
                    )}
                    {price.floor && (
                        <tr>
                            <td>
                                Но не дешевле{' '}
                                {Math.round(economy.upgradeFloor * 100)} % цены
                                уровня
                            </td>
                            <td />
                        </tr>
                    )}
                    {price.spirit > 0 && (
                        <tr>
                            <td>История ушла вперёд (дух времени)</td>
                            <td>−{Math.round(price.spirit * 100)} %</td>
                        </tr>
                    )}
                    <tr>
                        <td>Деньгами</td>
                        <td>
                            <MoneyIcon face={coin} /> {formatExact(quote.money)}
                        </td>
                    </tr>
                    {quote.mat > 0 && (
                        <tr>
                            <td>
                                {materials?.name}:{' '}
                                {formatExact(quote.fromStock)} со складов
                                {quote.bought > 0 &&
                                    `, ${formatExact(quote.bought)} докупим`}
                            </td>
                            <td>
                                {quote.importMoney > 0
                                    ? `+${formatExact(quote.importMoney)}`
                                    : '—'}
                            </td>
                        </tr>
                    )}
                    <tr className="price__total">
                        <td>Итого</td>
                        <td>
                            <MoneyIcon face={coin} /> {formatExact(quote.total)}
                        </td>
                    </tr>
                    <tr>
                        <td>В казне</td>
                        <td>{formatExact(game.money)}</td>
                    </tr>
                </tbody>
            </table>
            {!center && (
                <p className="epoch-panel__note">
                    Цепочка улучшений никогда не дешевле прямой постройки: в
                    зачёт идёт только {Math.round(economy.tradeIn * 100)} %
                    реально уплаченного. Снос вернёт{' '}
                    {Math.round(economy.refundShare * 100)} % уплаченного:{' '}
                    {formatExact(game.refund(building))}.
                </p>
            )}
            {short > 0 && (
                <>
                    <p className="epoch-panel__note neg">
                        Не хватает {formatExact(short)}.
                    </p>
                    <LoanOffer game={game} offer={game.loanOffer()} />
                </>
            )}
        </Modal>
    );
}

/** The Treasury chest on return (gdd §4.12, ui-spec §5.4 ChestCard). */
export function ChestCard({
    game,
    amount,
    onTake,
    onClose,
}: {
    game: Game;
    amount: number;
    onTake: () => void;
    onClose: () => void;
}) {
    const coin = game.content.currencyFace(game.state.epoch);

    return (
        <div className="chest" role="dialog" aria-label="Казна">
            <div className="chest__card">
                <span className="chest__icon" aria-hidden="true">
                    🧰
                </span>
                <p>
                    Пока вас не было, казна собрала{' '}
                    <b>
                        <MoneyIcon face={coin} /> {formatExact(amount)}
                    </b>
                </p>
                <div className="chest__actions">
                    <button
                        type="button"
                        className="hud-button hud-button--primary"
                        onClick={onTake}
                    >
                        Забрать
                    </button>
                    <button
                        type="button"
                        className="hud-button"
                        onClick={onClose}
                    >
                        Потом
                    </button>
                </div>
            </div>
        </div>
    );
}
