import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { MATERIALS } from '../engine/content/registry';
import type { Amounts, Category, CurrencyFace } from '../engine/content/types';
import type { Game } from '../engine/sim/game';

export const CATEGORY_NAMES: Record<Category, { name: string; icon: string }> =
    {
        housing: { name: 'Жильё', icon: '🏠' },
        food: { name: 'Еда', icon: '🌾' },
        resources: { name: 'Добыча', icon: '⛏️' },
        industry: { name: 'Производство', icon: '🏭' },
        power: { name: 'Энергия', icon: '⚡' },
        trade: { name: 'Торговля', icon: '⚖️' },
        services: { name: 'Услуги', icon: '⛲' },
        science: { name: 'Наука', icon: '🔬' },
        infrastructure: { name: 'Город', icon: '🛤️' },
    };

const SUFFIXES = ['', 'K', 'M', 'B', 'T'];
const MINUS = '−';
const THIN_SPACE = ' ';

/**
 * The one number format of the game (gdd §3.2): three significant digits
 * with Latin suffixes and a decimal comma — 999, 1,24K, 12,4K, 124K,
 * 1,24M, 1,24B; negative values with a real minus sign.
 */
export function formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
        return '∞';
    }

    const sign = value < 0 ? MINUS : '';
    let abs = Math.abs(value);
    let tier = 0;
    let rounded = Number(abs.toPrecision(3));

    while (rounded >= 1000 && tier < SUFFIXES.length - 1) {
        abs /= 1000;
        tier++;
        rounded = Number(abs.toPrecision(3));
    }

    if (tier === 0) {
        rounded = Math.round(rounded * 100) / 100;
    }

    if (rounded === 0) {
        return '0';
    }

    return `${sign}${String(rounded).replace('.', ',')}${SUFFIXES[tier]}`;
}

/** A yearly rate: +12,4K/год, −80/год. */
export function formatRate(perYear: number): string {
    return `${perYear < 0 ? '' : '+'}${formatNumber(perYear)}/год`;
}

/** An exact whole number for tooltips and sheets: 12 400 (thin spaces). */
export function formatExact(value: number): string {
    if (!Number.isFinite(value)) {
        return '∞';
    }

    const digits = String(Math.round(Math.abs(value))).replace(
        /\B(?=(\d{3})+(?!\d))/g,
        THIN_SPACE,
    );

    return `${value < 0 && Math.round(value) !== 0 ? MINUS : ''}${digits}`;
}

/** A signed whole number with thin spaces: +1 352, −34. */
export function formatSigned(value: number): string {
    const rounded = Math.round(value);

    return `${rounded > 0 ? '+' : ''}${formatExact(rounded)}`;
}

/** Russian plural: 1 год, 2 года, 5 лет. */
export function plural(
    count: number,
    one: string,
    few: string,
    many: string,
): string {
    const n = Math.abs(Math.round(count)) % 100;
    const last = n % 10;

    if (n > 10 && n < 20) {
        return many;
    }

    return last === 1 ? one : last >= 2 && last <= 4 ? few : many;
}

/** «12 лет», «1 год». */
export function years(count: number): string {
    return `${formatExact(count)} ${plural(count, 'год', 'года', 'лет')}`;
}

/** Two #rrggbb colours mixed: 0 = the first, 1 = the second. */
export function mixColor(from: string, to: string, share: number): string {
    const parse = (hex: string) =>
        [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
    const a = parse(from);
    const b = parse(to);
    const t = Math.max(0, Math.min(1, share));

    return `#${a
        .map((value, i) =>
            Math.round(value + (b[i] - value) * t)
                .toString(16)
                .padStart(2, '0'),
        )
        .join('')}`;
}

/** The current era's face of the money: its symbol in a coin. */
export function MoneyIcon({ face }: { face: CurrencyFace }) {
    return (
        <span className="money-icon" aria-hidden="true" title={face.short}>
            {face.symbol}
        </span>
    );
}

export function duration(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds));

    if (s < 60) {
        return `${s} с`;
    }

    const m = Math.floor(s / 60);

    return s % 60 ? `${m} мин ${s % 60} с` : `${m} мин`;
}

export function face(value: number): string {
    return value >= 80
        ? '😄'
        : value >= 60
          ? '🙂'
          : value >= 40
            ? '😐'
            : value >= 25
              ? '🙁'
              : '😠';
}

/**
 * A price: the money with any materials bought on the spot included, the
 * materials, and — when the stores are short — what is bought and for how
 * much («▦ 20 докупим за 80»).
 */
export function CostLine({ game, cost }: { game: Game; cost: Amounts }) {
    const quote = game.quote(cost);
    const coin = game.content.currencyFace(game.state.epoch);
    const materials = game.content.resource(MATERIALS);
    const icon = materials?.icon ?? MATERIALS;

    if (!quote.total && !quote.mat) {
        return <span className="cost cost--free">бесплатно</span>;
    }

    const short = !game.canAfford(cost);

    return (
        <span
            className="cost"
            title={`${coin.short}: ${formatExact(quote.total)}${quote.mat ? ` · ${materials?.name ?? MATERIALS}: ${formatExact(quote.mat)}` : ''}`}
        >
            <span
                className={
                    short ? 'cost__item cost__item--short' : 'cost__item'
                }
            >
                <MoneyIcon face={coin} /> {formatNumber(quote.total)}
            </span>
            {quote.mat > 0 && (
                <span className="cost__item">
                    + {icon} {formatNumber(quote.mat)}
                </span>
            )}
            {quote.bought > 0 && (
                <span className="cost__note">
                    {icon} {formatNumber(quote.bought)} докупим за{' '}
                    {formatNumber(quote.importMoney)}
                </span>
            )}
        </span>
    );
}

export function Modal({
    title,
    onClose,
    children,
    wide,
    className,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    wide?: boolean;
    className?: string;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) =>
            event.key === 'Escape' && onClose();

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onMouseDown={(event) =>
                event.target === event.currentTarget && onClose()
            }
        >
            <div
                className={`modal__box${wide ? ' modal__box--wide' : ''}${className ? ` ${className}` : ''}`}
            >
                <header className="modal__head">
                    <h2>{title}</h2>
                    <button
                        type="button"
                        className="inspector__close"
                        onClick={onClose}
                        title="Закрыть (Esc)"
                    >
                        ✕
                    </button>
                </header>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}

/** A thin progress bar, 0..1. */
export function Bar({
    value,
    tone,
}: {
    value: number;
    tone?: 'good' | 'accent' | 'bad';
}) {
    return (
        <span className={`bar${tone ? ` bar--${tone}` : ''}`}>
            <span
                style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
            />
        </span>
    );
}
