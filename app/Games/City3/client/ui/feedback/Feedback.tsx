/**
 * Feedback (ui-spec §5.4): the toast (top-centre, one at a time, tap opens
 * its sheet, an action button such as «Отменить»), the 2.5 s era banner
 * with the coin flip and «Что нового», the Treasury chest card on return,
 * and the two modal dialogs — the save conflict (load the other version,
 * keep this one, or stay without saving) and the typed reset.
 */

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { api } from '../../api';
import { useCtl, useFeedback, useGame, useUi } from '../context';
import { formatExact, years } from '../format';
import { t } from '../i18n';
import { CurrencyFace, Icon } from '../icons/Icon';
import { starStrip } from '../race';

export function Toasts() {
    const ctl = useCtl();
    const toast = useFeedback((s) => s.toast);

    if (!toast) {
        return null;
    }

    return (
        <div
            key={toast.id}
            className={`c3-toast c3-chip c3-toast--${toast.tone}`}
            role="status"
            aria-live={toast.tone === 'bad' ? 'assertive' : 'polite'}
        >
            <Icon name={toast.icon} />
            <button
                type="button"
                className="c3-toast__text"
                onClick={() => {
                    toast.open?.();
                    ctl.feedback.dismiss(toast.id);
                }}
            >
                {toast.text}
            </button>
            {toast.action && (
                <button
                    type="button"
                    className="c3-btn c3-btn--small c3-toast__action"
                    onClick={() => {
                        toast.action?.run();
                        ctl.feedback.dismiss(toast.id);
                    }}
                >
                    <Icon name="undo" size="xs" />
                    {toast.action.label}
                </button>
            )}
        </div>
    );
}

export function EraBanner() {
    const ctl = useCtl();
    const game = useGame();
    const banner = useFeedback((s) => s.banner);

    useEffect(() => {
        if (!banner) {
            return;
        }

        const timer = window.setTimeout(
            () => ctl.feedback.set({ banner: null }),
            2500,
        );

        return () => window.clearTimeout(timer);
    }, [banner, ctl]);

    if (!banner) {
        return null;
    }

    const era = game.content.epoch(banner.epoch);

    return (
        <div className="c3-banner-era c3-chip" role="status" key={banner.epoch}>
            <span className="c3-banner-era__coin">
                <CurrencyFace era={era.id} />
            </span>
            <div className="c3-banner-era__text">
                <b>{era.name}</b>
                <span className="c3-saffron c3-banner-era__stars">
                    {starStrip(banner.stars)}
                </span>
                <small>
                    {banner.lead >= 0
                        ? t('banner.ahead', { n: years(banner.lead) })
                        : t('banner.behind', { n: years(-banner.lead) })}
                </small>
            </div>
            <button
                type="button"
                className="c3-link"
                onClick={() => {
                    ctl.feedback.set({ banner: null });
                    ctl.open('whatsNew');
                }}
            >
                {t('banner.whatsNew')}
            </button>
        </div>
    );
}

/** A modal dialog: the map dims, focus is trapped, the game keys wait. */
function Modal({
    label,
    children,
    onEscape,
}: {
    label: string;
    children: ReactNode;
    onEscape?: () => void;
}) {
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        box.current?.querySelector<HTMLElement>('button, input')?.focus();
    }, []);

    const onKeyDown = (event: ReactKeyboardEvent) => {
        if (event.key === 'Escape' && onEscape) {
            event.stopPropagation();
            onEscape();
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusable = [
            ...(box.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input',
            ) ?? []),
        ];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    };

    return (
        <div className="c3-modal" role="presentation">
            <div
                className="c3-modal__box c3-chip"
                role="dialog"
                aria-modal="true"
                aria-label={label}
                ref={box}
                onKeyDown={onKeyDown}
            >
                {children}
            </div>
        </div>
    );
}

export function ChestCard() {
    const ctl = useCtl();
    const chest = useFeedback((s) => s.chest);
    const game = useGame();

    if (chest <= 0) {
        return null;
    }

    return (
        <Modal
            label={t('chest.text', { n: formatExact(chest) })}
            onEscape={() => ctl.laterChest()}
        >
            <span className="c3-modal__icon c3-pos">
                <Icon name="chest" />
            </span>
            <p className="c3-modal__text">
                {t('chest.text', { n: '' })}
                <b className="c3-num">
                    <CurrencyFace
                        era={game.epoch.id}
                        className="c3-cur--inline"
                    />
                    {formatExact(chest)}
                </b>
            </p>
            <div className="c3-modal__actions">
                <button
                    type="button"
                    className="c3-btn c3-btn--ok"
                    onClick={() => ctl.takeChest()}
                >
                    {t('chest.take')}
                </button>
                <button
                    type="button"
                    className="c3-btn c3-btn--quiet"
                    onClick={() => ctl.laterChest()}
                >
                    {t('chest.later')}
                </button>
            </div>
        </Modal>
    );
}

export function ConflictDialog() {
    const ctl = useCtl();
    const open = useUi((s) => s.dialog === 'conflict');
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    if (!open) {
        return null;
    }

    return (
        <Modal label={t('conflict.title')}>
            <span className="c3-modal__icon c3-warn">
                <Icon name="cloud" />
            </span>
            <h2 className="c3-modal__title">{t('conflict.title')}</h2>
            <p className="c3-modal__text">{t('conflict.text')}</p>
            <div className="c3-modal__actions c3-modal__actions--column">
                <button
                    type="button"
                    className="c3-btn c3-btn--primary"
                    onClick={() => window.location.reload()}
                >
                    {t('conflict.reload')}
                </button>
                <button
                    type="button"
                    className="c3-btn"
                    disabled={busy}
                    onClick={() => {
                        setBusy(true);
                        setFailed(false);
                        void ctl.session?.keepThisVersion().then((ok) => {
                            setBusy(false);

                            if (ok) {
                                ctl.ui.set({ dialog: null });
                                ctl.setSpeed(1);
                            } else {
                                setFailed(true);
                            }
                        });
                    }}
                >
                    {t('conflict.keep')}
                </button>
                <p className="c3-hint c3-hint--center">
                    {failed ? t('conflict.keepFailed') : t('conflict.keepHint')}
                </p>
                <button
                    type="button"
                    className="c3-link c3-link--center"
                    onClick={() => ctl.ui.set({ dialog: null })}
                >
                    {t('conflict.stay')}
                </button>
            </div>
        </Modal>
    );
}

export function ResetDialog() {
    const ctl = useCtl();
    const open = useUi((s) => s.dialog === 'reset');
    const [typed, setTyped] = useState('');
    const confirmWord = t('settings.resetWord');

    if (!open) {
        return null;
    }

    const close = () => {
        setTyped('');
        ctl.ui.set({ dialog: null });
    };

    return (
        <Modal label={t('settings.reset')} onEscape={close}>
            <span className="c3-modal__icon c3-neg">
                <Icon name="alert" />
            </span>
            <h2 className="c3-modal__title">{t('settings.reset')}</h2>
            <p className="c3-modal__text">
                {t('settings.resetText', { word: confirmWord })}
            </p>
            <input
                className="c3-input"
                value={typed}
                aria-label={confirmWord}
                onChange={(event) => setTyped(event.target.value)}
            />
            <div className="c3-modal__actions">
                <button
                    type="button"
                    className="c3-btn c3-btn--danger-fill"
                    disabled={typed.trim().toUpperCase() !== confirmWord}
                    onClick={async () => {
                        await api('world', { method: 'DELETE' }).catch(
                            () => null,
                        );
                        window.location.reload();
                    }}
                >
                    {t('settings.resetGo')}
                </button>
                <button
                    type="button"
                    className="c3-btn c3-btn--quiet"
                    onClick={close}
                >
                    {t('common.cancel')}
                </button>
            </div>
        </Modal>
    );
}
