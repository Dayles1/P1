import type { IconName } from './sprite';

/** One stroke icon from the sprite; decorative unless given a label. */
export function Icon({
    name,
    size,
    className,
    label,
}: {
    name: IconName;
    size?: 'xs' | 's' | 'm';
    className?: string;
    label?: string;
}) {
    return (
        <svg
            className={`c3-i${size ? ` c3-i--${size}` : ''}${className ? ` ${className}` : ''}`}
            aria-hidden={label ? undefined : true}
            role={label ? 'img' : undefined}
            aria-label={label}
            focusable="false"
        >
            <use href={`#c3-i-${name}`} />
        </svg>
    );
}

/** The era's money face (gdd §3.1); `era` is the era id (e1000). */
export function CurrencyFace({
    era,
    className,
}: {
    era: string;
    className?: string;
}) {
    return (
        <svg
            className={`c3-cur${className ? ` ${className}` : ''}`}
            aria-hidden="true"
            focusable="false"
        >
            <use href={`#c3-cur-${era}`} />
        </svg>
    );
}
