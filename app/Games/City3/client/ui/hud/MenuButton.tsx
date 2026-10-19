/**
 * The menu button with its save dot (green saved, pulsing amber saving,
 * red failed or off) and the menu popover (ui-spec §5.1, §6.12): the
 * Chronicle, discoveries, layers, blueprints, settings, how long ago the
 * game saved (with «Повторить» after a failure), back to the hub.
 */

import { useCtl, useHud, useUi } from '../context';
import { t } from '../i18n';
import { Icon } from '../icons/Icon';
import { Kbd } from '../kit/kit';
import type { SaveState } from '../store/hud-store';

function saveText(save: SaveState, savedAt: number, now: number): string {
    if (save === 'saving') {
        return t('save.saving');
    }

    if (save === 'failed') {
        return t('save.failed');
    }

    if (save === 'off') {
        return t('save.off');
    }

    const seconds = Math.max(0, Math.round((now - savedAt) / 1000));

    if (!savedAt || seconds < 3) {
        return t('save.justNow');
    }

    return t('save.ok', {
        ago:
            seconds < 60
                ? t('save.seconds', { n: seconds })
                : t('save.minutes', { n: Math.round(seconds / 60) }),
    });
}

function Menu() {
    const ctl = useCtl();
    const save = useHud((s) => s.save);
    const savedAt = useHud((s) => s.savedAt);
    const second = useHud((s) => s.second);
    const item = (action: () => void) => () => {
        ctl.closePopover();
        action();
    };

    return (
        <nav className="c3-menu c3-pop c3-chip" aria-label={t('menu.aria')}>
            <button type="button" onClick={item(() => ctl.open('chronicle'))}>
                <Icon name="book" />
                {t('menu.chronicle')}
                <Kbd>H</Kbd>
            </button>
            <button
                type="button"
                onClick={item(() => ctl.openGoals('research'))}
            >
                <Icon name="flask" />
                {t('menu.research')}
                <Kbd>T</Kbd>
            </button>
            <button type="button" onClick={item(() => ctl.open('overlays'))}>
                <Icon name="layers" />
                {t('menu.layers')}
                <Kbd>L</Kbd>
            </button>
            <button type="button" onClick={item(() => ctl.open('bureau'))}>
                <Icon name="pen" />
                {t('menu.bureau')}
            </button>
            <button type="button" onClick={item(() => ctl.open('settings'))}>
                <Icon name="sliders" />
                {t('menu.settings')}
            </button>
            <div className="c3-rule" />
            <div className={`c3-menu__save is-${save}`}>
                <i />
                <span>{saveText(save, savedAt, second * 1000)}</span>
                {save === 'failed' && (
                    <button
                        type="button"
                        className="c3-link"
                        onClick={() => void ctl.session?.save()}
                    >
                        {t('save.retry')}
                    </button>
                )}
            </div>
            <a
                href={ctl.backUrl}
                onClick={(event) => {
                    event.preventDefault();
                    void leave(ctl.backUrl, ctl);
                }}
            >
                <Icon name="back" />
                {t('menu.back')}
            </a>
        </nav>
    );
}

/** Back to the hub with a last save on the way out (keepalive). */
async function leave(
    url: string,
    ctl: ReturnType<typeof useCtl>,
): Promise<void> {
    const session = ctl.session;

    if (session) {
        await session.flush();

        if (session.dirty()) {
            void session.save(true);
        }
    }

    window.location.href = url;
}

export function MenuButton() {
    const ctl = useCtl();
    const save = useHud((s) => s.save);
    const open = useUi((s) => s.popover === 'menu');
    const label =
        save === 'saved'
            ? t('save.justNow')
            : save === 'saving'
              ? t('save.saving')
              : save === 'failed'
                ? t('save.failed')
                : t('save.off');

    return (
        <div className="c3-menuwrap">
            <button
                type="button"
                className="c3-btn c3-iconbtn"
                aria-expanded={open}
                aria-label={t('menu.button', { save: label })}
                onClick={() => ctl.togglePopover('menu')}
            >
                <Icon name="menu" />
                <i className={`c3-savedot is-${save}`} />
            </button>
            {open && <Menu />}
        </div>
    );
}
