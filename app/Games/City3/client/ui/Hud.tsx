/**
 * The interface over the scene (ui-spec §4, §11.2 `Hud.tsx`): the zones
 * (top-left readouts, top-right calendar and menu, the quest row, the map
 * buttons, the thumb zone), the tool bar that replaces the thumbs, the one
 * open sheet, world-anchored plaques and marks, and feedback. It renders
 * again only when the sheet, the tool kind, the popover or the era accent
 * changes.
 */

import type { CSSProperties } from 'react';
import { useCtl, useHud, useUi } from './context';
import {
    ChestCard,
    ConflictDialog,
    EraBanner,
    ResetDialog,
    Toasts,
} from './feedback/Feedback';
import { AdvisorLine, MapButtons, ThumbBar } from './hud/bottom';
import { CalendarInstrument, SpeedOptions } from './hud/CalendarInstrument';
import { MenuButton } from './hud/MenuButton';
import { QuestChip } from './hud/QuestChip';
import { AlertBadges, CitizensChip, MoneyPill } from './hud/readouts';
import { IconSprite } from './icons/sprite';
import { StripPlaques } from './map/StripPlaques';
import { ToolMarks } from './map/ToolMarks';
import { BuildTray } from './sheets/build/BuildTray';
import { ChronicleSheet } from './sheets/ChronicleSheet';
import { CitySheet } from './sheets/CitySheet';
import { GoalsSheet } from './sheets/goals/GoalsSheet';
import {
    BureauSheet,
    LayerChip,
    OverlaysSheet,
    PriceSheet,
    WhatsNewSheet,
} from './sheets/InfoSheets';
import { Inspector } from './sheets/inspector/Inspector';
import { SettingsSheet } from './sheets/SettingsSheet';
import { StripSheet } from './sheets/StripSheet';
import { TownHallSheet } from './sheets/TownHallSheet';
import { UpgradeSheet } from './sheets/UpgradeSheet';
import type { SheetId } from './store/ui-store';
import { CoachChip, ToolBar } from './tools/ToolBars';

function OpenSheet({ sheet }: { sheet: SheetId }) {
    switch (sheet) {
        case 'build':
            return <BuildTray />;
        case 'inspect':
            return <Inspector />;
        case 'upgrade':
            return <UpgradeSheet />;
        case 'hall':
            return <TownHallSheet />;
        case 'city':
            return <CitySheet />;
        case 'goals':
            return <GoalsSheet />;
        case 'chronicle':
            return <ChronicleSheet />;
        case 'strip':
            return <StripSheet />;
        case 'overlays':
            return <OverlaysSheet />;
        case 'settings':
            return <SettingsSheet />;
        case 'bureau':
            return <BureauSheet />;
        case 'whatsNew':
            return <WhatsNewSheet />;
        case 'price':
            return <PriceSheet />;
    }
}

export function Hud() {
    const ctl = useCtl();
    const sheet = useUi((s) => s.sheet);
    const tool = useUi((s) => s.tool.kind);
    const popover = useUi((s) => s.popover);
    const accent = useHud((s) => s.calendar.accent);
    const sheetKind = sheet ? (sheet === 'build' ? 'tray' : 'panel') : 'none';

    return (
        <div
            className="c3-ui"
            data-sheet={sheetKind}
            data-tool={tool}
            style={{ '--era': accent } as CSSProperties}
        >
            <IconSprite />
            <StripPlaques />
            <ToolMarks />
            {popover && (
                <div
                    className="c3-scrim"
                    aria-hidden="true"
                    onPointerDown={() => ctl.closePopover()}
                />
            )}
            <div className="c3-hud">
                <div className="c3-zone c3-tl">
                    <MoneyPill />
                    <CitizensChip />
                    <AlertBadges />
                </div>
                <div className="c3-zone c3-tr">
                    <CalendarInstrument />
                    <div
                        className={`c3-speedpop${popover === 'speed' ? ' is-open' : ''}`}
                    >
                        <SpeedOptions />
                    </div>
                    <MenuButton />
                </div>
                <div className="c3-zone c3-qz">
                    <QuestChip />
                    <LayerChip />
                </div>
                <div className="c3-zone c3-mapbtns">
                    <MapButtons />
                </div>
                <div className="c3-zone c3-bottom">
                    <AdvisorLine />
                    <ThumbBar />
                </div>
            </div>
            <CoachChip />
            <ToolBar />
            {sheet && <OpenSheet key={sheet} sheet={sheet} />}
            <Toasts />
            <EraBanner />
            <ChestCard />
            <ConflictDialog />
            <ResetDialog />
        </div>
    );
}
