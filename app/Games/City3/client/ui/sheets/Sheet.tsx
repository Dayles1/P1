/**
 * The one sheet primitive (ui-spec §5.2): a bottom sheet on phones in
 * portrait (peek at content height up to 62 %, the grip drags it to 90 %,
 * a swipe down closes it), a right side panel in phone landscape, a
 * 400-px right panel on desktop; `tray` is the build tray (bottom sheet on
 * phones and desktop). Non-modal; focus moves to the title on open and
 * back to the opener on close; Esc closes (the window listener).
 */

import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCtl, useUi } from '../context';
import { t } from '../i18n';
import { Icon } from '../icons/Icon';

export function Sheet({
    kind = 'panel',
    title,
    sub,
    thumb,
    head,
    className,
    children,
}: {
    kind?: 'panel' | 'tray';
    title?: ReactNode;
    sub?: ReactNode;
    thumb?: ReactNode;
    /** A custom header (the build tray's tabs) instead of the title. */
    head?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    const ctl = useCtl();
    const expanded = useUi((s) => s.expanded);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const drag = useRef<{ y: number; moved: number } | null>(null);

    useEffect(() => {
        const opener =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        titleRef.current?.focus({ preventScroll: true });

        return () => {
            if (opener && document.contains(opener)) {
                opener.focus({ preventScroll: true });
            }
        };
    }, []);

    const onGripDown = (event: ReactPointerEvent) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { y: event.clientY, moved: 0 };
    };
    const onGripMove = (event: ReactPointerEvent) => {
        if (drag.current) {
            drag.current.moved = event.clientY - drag.current.y;
        }
    };
    const onGripUp = () => {
        const moved = drag.current?.moved ?? 0;

        drag.current = null;

        if (moved < -24) {
            ctl.expandSheet(true);
        } else if (moved > 60) {
            if (expanded) {
                ctl.expandSheet(false);
            } else {
                ctl.close();
            }
        } else if (Math.abs(moved) < 6) {
            ctl.expandSheet(!expanded);
        }
    };

    return (
        <section
            className={`c3-sheet c3-sheet--${kind}${expanded ? ' is-expanded' : ''}${className ? ` ${className}` : ''}`}
            role="dialog"
            aria-modal="false"
            aria-label={typeof title === 'string' ? title : undefined}
        >
            <button
                type="button"
                className="c3-grip"
                aria-label={t('sheet.grip')}
                onPointerDown={onGripDown}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={() => {
                    drag.current = null;
                }}
            />
            {head ?? (
                <header className="c3-sh-head">
                    {thumb}
                    <div className="c3-sh-head__text">
                        <h2
                            className="c3-sh-title"
                            ref={titleRef}
                            tabIndex={-1}
                        >
                            {title}
                        </h2>
                        {sub && <p className="c3-sh-sub">{sub}</p>}
                    </div>
                    <CloseButton />
                </header>
            )}
            <div className="c3-sh-body">{children}</div>
        </section>
    );
}

export function CloseButton() {
    const ctl = useCtl();

    return (
        <button
            type="button"
            className="c3-xbtn"
            aria-label={t('common.close')}
            aria-keyshortcuts="Escape"
            onClick={() => ctl.close()}
        >
            <Icon name="x" />
        </button>
    );
}

/** A labelled section inside a sheet. */
export function Section({
    title,
    children,
}: {
    title?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="c3-sec">
            {title && <h3>{title}</h3>}
            {children}
        </div>
    );
}
