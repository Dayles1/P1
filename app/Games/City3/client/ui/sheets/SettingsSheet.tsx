/**
 * Settings (ui-spec §5.2 SettingsSheet): graphics (Авто · Низкая ·
 * Средняя · Высокая), sound, language, coach hints, the keys, «Сбросить
 * город» behind a typed confirmation, and — for testers — the tester
 * tools (everything free, refill, finish all, all discoveries, next era,
 * the per-era telemetry).
 */

import { useState } from 'react';
import type { TelemetryRow } from '../../engine/sim/game';
import { useCtl, useGame, useHud, useUi } from '../context';
import type { QualitySetting } from '../controller';
import { availableLocales, t } from '../i18n';
import { Icon } from '../icons/Icon';
import { Segmented } from '../kit/kit';
import { Section, Sheet } from './Sheet';

function TesterTools() {
    const ctl = useCtl();
    const game = useGame();
    const infinite = useHud((s) => s.infinite);
    const [telemetry, setTelemetry] = useState<TelemetryRow[] | null>(null);

    return (
        <Section title={t('settings.tester')}>
            <p className="c3-hint">{t('settings.testerNote')}</p>
            <label className="c3-check">
                <input
                    type="checkbox"
                    checked={infinite}
                    onChange={(event) => ctl.setInfinite(event.target.checked)}
                />
                {t('settings.infinite')}
            </label>
            <div className="c3-act-row">
                <button
                    type="button"
                    className="c3-btn c3-btn--small"
                    onClick={() => game.testerGrant()}
                >
                    {t('settings.grant')}
                </button>
                <button
                    type="button"
                    className="c3-btn c3-btn--small"
                    onClick={() => game.testerFinish()}
                >
                    {t('settings.finish')}
                </button>
                <button
                    type="button"
                    className="c3-btn c3-btn--small"
                    onClick={() => game.testerResearchAll()}
                >
                    {t('settings.researchAll')}
                </button>
                <button
                    type="button"
                    className="c3-btn c3-btn--small"
                    disabled={!game.nextEpoch}
                    onClick={() => {
                        game.testerNextEpoch();
                        ctl.close();
                    }}
                >
                    {t('settings.nextEra')}
                </button>
                <button
                    type="button"
                    className="c3-btn c3-btn--small"
                    onClick={() => {
                        const rows = game.telemetry();

                        // For the ±20 % retune (gdd §12.9): copy from the console.
                        console.table(
                            rows.map((row) => ({
                                ...row,
                                coverage: JSON.stringify(row.coverage),
                                income: JSON.stringify(row.income),
                            })),
                        );
                        setTelemetry(rows);
                    }}
                >
                    {t('settings.telemetry')}
                </button>
            </div>
            {telemetry && (
                <div className="c3-tablewrap">
                    <table className="c3-table">
                        <thead>
                            <tr>
                                <th>Эпоха</th>
                                <th>лет</th>
                                <th>ρ</th>
                                <th>охват, %</th>
                                <th>налог/экспорт/туризм/метро, %</th>
                                <th>расходы</th>
                            </tr>
                        </thead>
                        <tbody>
                            {telemetry.map((row) => (
                                <tr key={row.era}>
                                    <td>{row.era}</td>
                                    <td>{row.years}</td>
                                    <td>{row.rho.toFixed(2)}</td>
                                    <td>
                                        {Object.entries(row.coverage)
                                            .map(
                                                ([id, share]) =>
                                                    `${id.slice(0, 3)} ${Math.round(share * 100)}`,
                                            )
                                            .join(' · ')}
                                    </td>
                                    <td>
                                        {[
                                            row.income.tax,
                                            row.income.trade,
                                            row.income.tourism,
                                            row.income.fares,
                                        ]
                                            .map((share) =>
                                                Math.round(share * 100),
                                            )
                                            .join('/')}
                                    </td>
                                    <td>{Math.round(row.costs * 100)} %</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Section>
    );
}

export function SettingsSheet() {
    const ctl = useCtl();
    const tester = useHud((s) => s.tester);
    const fps = useHud((s) => s.fps);
    const hints = useUi((s) => s.hints);
    const [quality, setQuality] = useState<QualitySetting>(ctl.quality);
    const [muted, setMuted] = useState(ctl.muted);
    const locales = availableLocales();

    return (
        <Sheet title={t('settings.title')}>
            <Section title={t('settings.graphics')}>
                <Segmented<QualitySetting>
                    label={t('settings.graphics')}
                    value={quality}
                    onChange={(value) => {
                        ctl.setQuality(value);
                        setQuality(value);
                    }}
                    options={[
                        { value: 'auto', label: t('settings.auto') },
                        { value: 'low', label: t('settings.low') },
                        { value: 'medium', label: t('settings.medium') },
                        { value: 'high', label: t('settings.high') },
                    ]}
                />
                <p className="c3-hint">{t('settings.fps', { n: fps })}</p>
            </Section>
            <Section title={t('settings.sound')}>
                <Segmented
                    label={t('settings.sound')}
                    value={muted ? 'off' : 'on'}
                    onChange={(value) => {
                        ctl.setMuted(value === 'off');
                        setMuted(value === 'off');
                    }}
                    options={[
                        { value: 'on', label: t('settings.on') },
                        { value: 'off', label: t('settings.off') },
                    ]}
                />
            </Section>
            <Section title={t('settings.language')}>
                <Segmented
                    label={t('settings.language')}
                    value="ru"
                    onChange={() => undefined}
                    options={[
                        { value: 'ru', label: 'Русский' },
                        {
                            value: 'en',
                            label: 'English',
                            disabled: !locales.includes('en'),
                        },
                        {
                            value: 'uz',
                            label: 'Oʻzbekcha',
                            disabled: !locales.includes('uz'),
                        },
                    ]}
                />
                {locales.length === 1 && (
                    <p className="c3-hint">{t('settings.languageSoon')}</p>
                )}
            </Section>
            <Section title={t('settings.hints')}>
                <Segmented
                    label={t('settings.hints')}
                    value={hints ? 'on' : 'off'}
                    onChange={(value) => ctl.setHints(value === 'on')}
                    options={[
                        { value: 'on', label: t('settings.on') },
                        { value: 'off', label: t('settings.off') },
                    ]}
                />
                <p className="c3-hint">{t('settings.hintsHint')}</p>
            </Section>
            <Section title={t('settings.keys')}>
                <p className="c3-hint">{t('settings.keysText')}</p>
            </Section>
            {tester && <TesterTools />}
            <div className="c3-rule" />
            <button
                type="button"
                className="c3-btn c3-btn--danger c3-btn--wide"
                onClick={() => ctl.ui.set({ dialog: 'reset' })}
            >
                <Icon name="bulldoze" size="s" />
                {t('settings.reset')}
            </button>
        </Sheet>
    );
}
