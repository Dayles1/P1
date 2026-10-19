/**
 * Shared pieces (ui-spec §11.2 kit): the cost line (money face + the
 * materials icon, cinnabar when short, the materials bought on the spot),
 * progress bars, segmented controls and key caps.
 */

import type { ReactNode } from 'react';
import type { Amounts } from '../../engine/content/types';
import { useGame, useHud } from '../context';
import { formatExact, formatNumber } from '../format';
import { t } from '../i18n';
import { CurrencyFace, Icon } from '../icons/Icon';

/** «[face] 510 + [mat] 26»; cinnabar when the treasury is short. */
export function CostLine({
    cost,
    bought = false,
    short,
    className,
}: {
    cost: Amounts;
    /** Also say what the stores lack and is bought («докупим 20 за 80»). */
    bought?: boolean;
    /** Force the short colour (or not); by default the treasury decides. */
    short?: boolean;
    className?: string;
}) {
    const game = useGame();
    const face = useHud((s) => s.money.face);
    const quote = game.quote(cost);
    const isShort = short ?? !game.canAfford(cost);

    if (!quote.total && !quote.mat) {
        return (
            <span className={`c3-cost${className ? ` ${className}` : ''}`}>
                {t('common.free')}
            </span>
        );
    }

    return (
        <span
            className={`c3-cost c3-num${isShort ? ' c3-cost--short' : ''}${className ? ` ${className}` : ''}`}
            title={`${formatExact(quote.total)}${quote.mat ? ` + ${formatExact(quote.mat)}` : ''}`}
        >
            <CurrencyFace era={face} />
            {formatNumber(quote.money)}
            {quote.mat > 0 && (
                <>
                    <span className="c3-cost__plus">+</span>
                    <Icon name="mat" />
                    {formatNumber(quote.mat)}
                </>
            )}
            {bought && quote.bought > 0 && (
                <span className="c3-cost__note">
                    {t('place.bought', {
                        n: formatNumber(quote.bought),
                        m: formatNumber(quote.importMoney),
                    })}
                </span>
            )}
        </span>
    );
}

/** A thin progress bar, 0..1 (era accent unless a tone is given). */
export function Bar({ value, tone }: { value: number; tone?: 'good' | 'bad' }) {
    return (
        <span className={`c3-bar${tone ? ` c3-bar--${tone}` : ''}`}>
            <b style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
        </span>
    );
}

export function Segmented<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly {
        value: T;
        label: string;
        hint?: string;
        disabled?: boolean;
    }[];
    onChange: (value: T) => void;
}) {
    return (
        <div
            className="c3-seg"
            role="group"
            aria-label={label}
            style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    disabled={option.disabled}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                    {option.hint !== undefined && (
                        <small>{option.hint || ' '}</small>
                    )}
                </button>
            ))}
        </div>
    );
}

export function Kbd({ children }: { children: ReactNode }) {
    return <kbd className="c3-kbd">{children}</kbd>;
}

/** A key–value row in a sheet. */
export function Row({
    label,
    children,
}: {
    label: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="c3-kv">
            <span>{label}</span>
            <span className="c3-num">{children}</span>
        </div>
    );
}
