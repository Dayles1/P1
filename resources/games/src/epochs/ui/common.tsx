import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Amounts, Category } from '../engine/content/types';
import type { Game } from '../engine/sim/game';

export const CATEGORY_NAMES: Record<Category, { name: string; icon: string }> =
    {
        housing: { name: 'Жильё', icon: '🏠' },
        food: { name: 'Еда', icon: '🌾' },
        resources: { name: 'Добыча', icon: '⛏️' },
        industry: { name: 'Производство', icon: '🏭' },
        power: { name: 'Энергия', icon: '⚡' },
        trade: { name: 'Торговля', icon: '💰' },
        services: { name: 'Услуги', icon: '⛲' },
        science: { name: 'Наука', icon: '🔬' },
        infrastructure: { name: 'Город', icon: '🛤️' },
    };

export function compact(value: number): string {
    const n = Math.floor(value);

    if (!Number.isFinite(n)) {
        return '∞';
    }

    if (Math.abs(n) < 1000) {
        return String(n);
    }

    if (Math.abs(n) < 1_000_000) {
        return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
    }

    return `${(n / 1_000_000).toFixed(1)}M`;
}

export function perMinute(rate: number): string {
    const value = rate * 60;
    const abs = Math.abs(value);
    const text =
        abs >= 1000
            ? compact(abs)
            : abs >= 10
              ? String(Math.round(abs))
              : String(Math.round(abs * 10) / 10);

    return `${value >= 0 ? '+' : '−'}${text}/мин`;
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

export function CostLine({ game, cost }: { game: Game; cost: Amounts }) {
    const entries = Object.entries(cost);

    if (!entries.length) {
        return <span className="cost cost--free">бесплатно</span>;
    }

    return (
        <span className="cost">
            {entries.map(([id, amount]) => (
                <span
                    key={id}
                    className={
                        (game.state.resources[id] ?? 0) >= amount
                            ? 'cost__item'
                            : 'cost__item cost__item--short'
                    }
                    title={game.content.resource(id)?.name}
                >
                    {game.content.resource(id)?.icon ?? id} {compact(amount)}
                </span>
            ))}
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
    tone?: 'good' | 'accent';
}) {
    return (
        <span className={`bar${tone ? ` bar--${tone}` : ''}`}>
            <span
                style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
            />
        </span>
    );
}
