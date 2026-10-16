# ui — City Chronicle 2 (epochs) UI layer: EpochsGame.tsx root, ui/*.tsx, epochs.css + shared styles.css, audio, render/iso.ts, main.tsx routing, shared/{api,i18n,usePlaytime}

## Summary
EpochsGame.tsx (1632 lines) is one big React component. It owns the three.js Renderer, the mutable engine Game, the AudioEngine, saving, the rAF loop, keyboard and pointer input, and the whole HUD. React does not hold game state immutably. The UI reads straight from the mutable `game` object, and a `useReducer` counter re-renders the whole tree every 250 ms (EpochsGame.tsx:473-478). Imperative state the renderer needs every frame lives in refs: an `overlayRef: Overlay` (hover, ghost, roadPath, selectedUid/Npc, bulldoze, xray, showDistricts; 84-93), toolRef, speedRef, followRef and pickRef.

Loading (254-347): `new Renderer(canvas)`, then `loadContent()` (GET /api/games/epochs/content), then `new AudioEngine(bundle.sounds)`, then GET epochs/world. A saved world goes through `fromServer` + `catchUp` (offline toast "+N жителей, +N золота", 291-297). With no save it calls `Game.create` and POSTs the new world. After that it calls `renderer.attach` and centers on `game.center` (the town hall) or the map middle (324-329).

The loop (410-481) clamps dt to 0.1 and computes gameDt = dt*speed. A fixed 1 s accumulator calls `game.tick(1)`, `game.npcs.move(gameDt)` runs every frame, WASD/QE/PgUp/PgDn move the camera, follow-cam tracks an NPC, then `renderer.frame(dt, overlay)` and `audio.ambience(...)`. Hotkeys (485-537): Space pause, Esc, B dock, R road, X bulldoze, T tech, G goals, V x-ray, Home recenter, +/- zoom.

Tools are a union (30-34): select | build{type,level} | bulldoze | move{uid}. Panels are a single modal slot (36): stats | epoch | menu | tech | bureau | goals.

Input uses Pointer Events on the canvas (582-1043) with setPointerCapture and a pointers Map. Two pointers do pinch zoom, rotate and pan together (872-884, 916-928). One-finger or left drag pans once it moves past 5 px. Right or middle button, or Shift, rotates and tilts (949-951). Wheel zooms toward the cursor. A tap or click under 5 px becomes `click()`. In select mode that picks an NPC first, then buildings; repeat clicks cycle through stacked buildings (726-768). Bulldoze demolishes the picked building, or calls `game.clear(tile)` on a feature. Build and move place at `overlayRef.ghost`, which only `updateHover` sets on pointermove. Roads use an L-shaped drag path (x first, then y; 631-668). `buildRoad` places or upgrades along the path and stops when money runs out (828-865).

Saving: autosave every 20 s when `game.revision` changed, a keepalive save on tab hide or unmount (558-578), a save on the epoch event, and a manual save in the menu. A PUT 409 opens the conflict modal and pauses (237-240).

Layout:
- Top: the TopBar spans the full width (top:10px).
- Top left: GoalsWidget, under the bar at top:74px, hidden below 900px.
- Left middle: a vertical CameraControls column.
- Right: the Inspector or NpcPanel (top:74px, width 320). Below 760px it moves to the bottom (bottom:150px, max-height 45%).
- Top center: a toast stack (top:74px).
- Bottom center (.hud-bottom, max 980px wide): the hint pill, then the BuildDock (open by default), then the toolbar.
- Overlays: full-screen Modals for tech, bureau, goals, stats, epoch and menu, plus the EpochSplash.

Theme per era: `game.epoch.theme` from epochs.json is written as inline CSS custom properties --hud-bg/-bg-solid/-border/-text/-muted/-accent/-accent-text/-font/-radius on the root `.city.epochs` (1059-1072). Every rule in styles.css and epochs.css paints with those variables. The `.city[data-epoch=…]` themes in styles.css:804-861 belong to the v1 city game and never apply here.

The HUD shows every resource. TopBar first shows population/housing (employment % or a mood face), then power supply/demand once either is non-zero, then every `game.visibleResources()` entry (resources whose era has been reached or that have stock > 0) as icon, value/cap and rate per minute. That strip scrolls sideways and grows to about 20 items. Costs everywhere use CostLine with multi-resource amounts.

i18n: none in the game. Every game string is hard-coded Russian in the TSX (about 270 lines carrying Cyrillic), in game.ts (fail/toast texts) and in the content JSON. shared/i18n.ts (ru/en/uz chosen by `<html lang>`) serves only the Hub shell.

Mobile: input already uses pointer events with pinch, `touch-action:none` is set on the canvas, and there are two breakpoints (900px in epochs.css:1028, 760px in styles.css:1853). There are no safe-area insets (although the shell sets viewport-fit=cover), no pointer:coarse or hover:none queries, and many touch targets are 26-36 px.

render/iso.ts is a 2D-canvas isometric primitive library and a byte-identical copy of city/render/iso.ts. The 3D game does not use it. Only workshop/previews.tsx:12 imports `box` and `shade` from it, for the NPC sprite preview.

## Files
- resources/games/src/epochs/EpochsGame.tsx (1632): Default export EpochsGame, the root. It creates Renderer, Game, AudioEngine and holds the refs (overlayRef, toolRef, speedRef, followRef, pickRef) and React state (tool, selectedUid/Npc, panel, dockOpen, levels, speed, muted, xray, districts, toasts, splash, saveLabel, conflict, hint, yaw, infinite, quality, fps, others). Callbacks: toast(), setTool(), selectBuilding(), selectNpc(), setSpeed(), setInfinite(), setQuality() (localStorage 'city2.quality'), toggleXray(), save() (PUT epochs/world, 409 conflict). Effects: load (254-347), engine events to renderer/audio/toast/splash (350-394), rAF loop + keyboard (398-555), autosave (558-578), pointer input (582-1043, including roadPath, updateHover, pickAt, click, buildRoad). JSX: TopBar, GoalsWidget, CameraControls, Inspector, NpcPanel, toasts, hint, BuildDock, toolbar (Build/Road/Bulldoze/Science/Blueprints/Goals/Stats/Era/Workshop), the panel modals, the Menu modal with quality and tester tools, EpochSplash, the conflict modal.
- resources/games/src/epochs/ui/hud.tsx (418): TopBar (5-232): back, year+era (54: Math.floor(state.year)), clock (time, season and weather icons, 'день N'), resource strip (population, power, every visibleResource with value/cap/rate), research button with progress bar, speed group 0/1/2/5 (+20/50 for testers), mute, ♾️ tester badge, 🐢 low-fps button, save label, ☰ menu. GoalsWidget (235-308): the 3 open goals nearest completion, collapsible. CameraControls (311-418): compass (rotated by -yaw, click turns north), rotate ±90°, tilt, zoom, center 🎯, x-ray 👁, districts 🗺️.
- resources/games/src/epochs/ui/build.tsx (264): Thumb (8-44): a building level picture via scene/thumbnails renderThumbnail (a shared offscreen WebGL renderer, cached as PNG data URLs) with an emoji fallback. tags() (46-74). BuildDock (81-264): category tabs (from CATEGORY_NAMES, each with an open-count badge), search input, collapse; a horizontally scrolling list of dock-cards (thumbnail, level name, family, cost or lock reason, tags) plus a per-card level picker ‹ ур. n/N ›. It shows buildings with firstEpoch <= epoch+1, so next-era ones appear locked. Props: game, active, levels, onLevel, onPick, onCollapse.
- resources/games/src/epochs/ui/inspector.tsx (644): effectLines() (25-88) describes a level's effects. LevelPath (91-125) shows level steps. StyleSection (127-207): blueprint select plus wall/roof colour SWATCHES (needs a Bureau). DistrictSection (209-268): district name and policy buttons. Inspector (270-559): header, 'others under cursor' cycling button, level path, description, under-construction note, problems (no road, no power, starved, workers), live stats (output/input per minute, residents, comfort, workers, nearby features, boost, district), resident NPC names, next level preview, actions (Upgrade with cost, Upgrade all of this type, Move, Demolish). NpcPanel (568-644): name, type, age, thought, activity, home, work, mood, follow-camera toggle.
- resources/games/src/epochs/ui/epoch.tsx (329): EpochPanel (5-120): current → next era (by year), tagline, checklist (game.epochChecklist), 'what unlocks' chips (resources, buildings, level upgrades, 'земли 2t×2t', tech count), the button '🚀 Перейти в {year} год'. Goals (122-187): grid of all goals with progress and rewards. Stats (189-277): score, population, happiness, techs, achievements, NPC employment, days, tourism tiles; per-resource rate list; building counts. EpochSplash (279-329): full-screen animated year count-up from the previous era's year to the new era's year, auto-closes after 5.2 s.
- resources/games/src/epochs/ui/research.tsx (202): bonusLines() (6-44). TechCard (46-140): state done/active/locked/open, 'key to the next era' marker, requires, unlocks and bonuses, cost, duration, 🔬 Изучить button. TechTree (143-202): a Modal with era tabs (labelled by year), lead text and a tech grid; one research runs at a time.
- resources/games/src/epochs/ui/bureau.tsx (121): Bureau (19-121): Architects' Bureau modal listing blueprints (colour swatches, epoch, bureau tier, fits, roof, cost, 📐 Открыть button). Blueprints are applied per building in Inspector › StyleSection.
- resources/games/src/epochs/ui/common.tsx (167): CATEGORY_NAMES (9 categories with Russian names and emoji). Formatters: compact (k/M), perMinute ('+x/мин'), duration ('N мин N с'), face (mood emoji). CostLine (cost chips, red when short). Modal (title, onClose, children, wide, className; Esc and backdrop close). Bar (0..1 progress, tone good/accent).
- resources/games/src/epochs/epochs.css (1787): Lines 1-1044 are game HUD additions on top of styles.css: hud-clock, bar, thumb, hud-research, goals-widget, camera-controls, tester and quality menu, hud-slow, dock and dock-card, inspector additions (level-path, field, swatches, policies), era-tabs, tech-card, blueprint, goal grid, @media(max-width:900px) at 1028-1044. Lines 1046-1787 are Workshop and Skyscraper Studio styles (.ws-*, .ss-*, own @media 960px at 1547). Every colour comes from the --hud-* variables.
- resources/games/src/styles.css (1892): Shared games SPA stylesheet imported by main.tsx. Lines 784-1892 are the base city HUD that epochs relies on: .city root (fixed inset 0, default --hud-* vars), .city__canvas (touch-action:none), .hud-top, .hud-res*, .hud-speed, .hud-save, .inspector*, .hud-button*, .cost, .hud-bottom, .toolbar*, .toasts/.toast, .modal*, .stats__*, .epoch-panel__*, .game-menu*, .epoch-splash*, and @media(max-width:760px) at 1853-1892. The v1-only classes (.goals, .build-menu, .build-card, .tech-tree, .sparkline, .city[data-epoch]) are unused by epochs.
- resources/games/src/epochs/audio/audio.ts (212): AudioEngine class: WebAudio synthesis of sounds.json presets (oscillators, harmonics, noise and filter), or plays a preset's `file`. Methods: unlock() (called on the first pointerdown), setMuted(), play(id, volume), ambience(type, night, weatherSound) called every frame to pick random day/night or weather sounds by era ambience type, setSounds(). Self-contained and reusable.
- resources/games/src/epochs/render/iso.ts (412): 2D canvas isometric primitives (HW=32, HH=16, P(), poly, line, shade, tile, rect, box, gable, pyramid, cylinder, cone, dome, windows, door, flag). Byte-identical to city/render/iso.ts. The 3D game does not use it; only workshop/previews.tsx:12 imports box and shade (NPC sprite preview). Dead weight for v3.
- resources/games/src/main.tsx (42): Games SPA entry: redirects to /login without a token (hasToken), BrowserRouter basename '/games'. Routes: '/' Hub, '/city' CityGame (v1), '/city2' lazy EpochsGame, '/city2/workshop' lazy Workshop, '/epochs/*' redirects to /city2, '*' goes to '/'.
- resources/games/src/shared/api.ts (92): gameApi<T>(path, {method, body, keepalive}) calls /api/games/{path}. apiRequest<T>(url, …) works for any URL. Sends the Bearer token from localStorage 'auth_token', unwraps the {data} envelope, redirects to /login on 401, throws GameApiError(status, message, data). hasToken().
- resources/games/src/shared/i18n.ts (357): Hub-shell dictionaries ru/en/uz (games, ratings, leaderboard, genres, the v1 epoch names array, game titles and descriptions; titles.epochs says 'ten eras … to 3000'). Locale comes from <html lang>; exports t, format(':key'), plural(). The epochs game does not use it.
- resources/games/src/shared/usePlaytime.ts (31): usePlaytime(slug): POST /api/games/{slug}/playtime on mount and every 60 s while the tab is visible. The server meters playtime, which gates ratings (5 min).
- resources/games/src/hub/catalog.ts (90): CATALOG entry for the game (slug 'epochs', path '/city2', resetPath 'epochs/world'). Self-contained games use `href` (e.g. '/games/gu-world') instead of an SPA path. v3 must add an entry here.

## Key data structures
// EpochsGame.tsx
type Tool = {kind:'select'} | {kind:'build'; type:string; level:number} | {kind:'bulldoze'} | {kind:'move'; uid:number};   // :30
type Panel = 'stats'|'epoch'|'menu'|'tech'|'bureau'|'goals'|null;                                                          // :36
interface Toast { id:number; text:string; tone:'info'|'good'|'bad' }                                                      // :38 (max 4, 4.5s/6.5s)
interface PickCycle { x:number; y:number; uids:number[]; index:number }                                                    // :45
const AUTOSAVE_MS=20_000; TITLE='Летопись города 2'; QUALITY_KEY='city2.quality'                                           // :52-54

// scene/renderer.ts:32 — the per-frame contract between the UI and the renderer
interface Overlay { hover:{x,y}|null; ghost:{type,level,x,y,ok,moving?}|null; roadPath:{x,y,ok}[];
  selectedUid:number|null; selectedNpc:number|null; bulldoze:boolean; xray:boolean; showDistricts:boolean }
type Quality = 'low'|'medium'|'high'   // pixelRatio cap 1/1.25/2, shadows off/PCF 1024/PCFSoft 2048 (renderer.ts:237-265)
Renderer API used by the UI: attach, resize, frame(dt,overlay), handle(event), centerOn(x,y,smooth), zoomBy(f,px?,py?), panBy, rotateBy, tiltBy, setYaw,
  view{yaw,pitch,distance,targetX,targetY}, fps, groundAt(px,py), pickBuildings(px,py), pickNpc(px,py), setQuality, dispose

// engine/content/types.ts
interface ResourceDef { id; name; icon; epoch:string; capped:boolean; description }                                       // :108
interface EpochTheme { bg; solid; border; text; muted; accent; accentText; font; radius:number }                           // :221
interface EpochDef { id; year; name; tagline; yearsPerDay; territory; palette; theme:EpochTheme; ambience;
  next:{population; buildings:{type,count,level?}[]; techs:string[]; cost:Amounts}|null }                                 // :233

// engine/sim/game.ts — what the HUD reads
interface Stats { rates:Amounts; caps:Amounts; housing; jobs; workers; employment; powerSupply; powerDemand; defense; happiness; starving; tourism } // :62
interface BuildingStatus { complete; connected; efficiency; starved; noPower; nearbyFeatures; boost; fertility; happiness|null; pollution; residents; workers; district; output:Amounts; input:Amounts } // :43
WorldState(state.ts:22) { seed; width; height; epoch; year; time; resources:Amounts; population; weather; techs[]; research:{id,start,end}|null; blueprints[]; achievements[]; stats{} }
Game methods called from the UI: visibleResources, territory, canPlace/place/move/demolish/clear, upgrade/upgradeAll/relevel/relevelCost, buildCost/upgradeCost/upgradeBlock/canAfford,
  availableLevels/lockReason/levelLock, research/techLock/techUnlocks/researchTime, unlockBlueprint/blueprintLock/blueprintFits/setStyle, setDistrict/policyOf,
  goalProgress/openGoals/epochChecklist/canAdvance/advanceEpoch, score, nameOf/def/levelDef/effects/levelEpoch, tester*(), center, bureau, clock.{clockText,day,light}, season, weather

// Content today: 22 resources (food, wood, stone, gold💰 uncapped, knowledge📜 uncapped, iron, tools, bricks, glass, coal, steel, concrete, oil, plastic, electronics, data, composites, rare_metals, hydrogen, ai_cores, nanomaterials, antimatter)
// 10 eras e0(year 0, 100 yrs/day) e1000(45) e1500(25) e1800(8) e1900(7) e2000(7) e2100(12) e2300 e2500 e3000; world.time: secondsPerDay=240, daysPerSeason=1, maxOfflineSeconds=3600

// GameEvent (engine/core/events.ts): toast | built | placed | upgraded | removed | cleared | epoch | researched | achievement | restyled | season | weather | sound | error

## Couplings
Inbound and routing:
- main.tsx:31-36 routes /games/city2 → EpochsGame and /games/city2/workshop → Workshop (react-router-dom 7: EpochsGame uses useNavigate and Link at EpochsGame.tsx:3,75,1112,1414,1462).
- Hub: hub/catalog.ts:34-40 (slug 'epochs'), Hub.tsx:43-50 progress line (year / epoch_name / population from the server), shared/i18n.ts titles.epochs (106-109, 208-211, 312-315) and progress_epochs.
- Server endpoints used by the UI: GET /api/games/epochs/content (content-api.ts:24), GET/POST/PUT/DELETE /api/games/epochs/world (EpochsGame.tsx:228,284,302,1052), POST /api/games/epochs/playtime (usePlaytime).

Shared modules outside epochs/:
- shared/api.ts: auth token 'auth_token' in localStorage; 401 redirects to /login.
- shared/usePlaytime.ts.
- styles.css (the base HUD; .city/.hud-*/.toolbar/.inspector/.modal/.toast rules at 784-1892, imported once in main.tsx:6). epochs.css alone is NOT enough to style the game.

Engine and scene:
- The UI calls the engine (engine/sim/game.ts) and scene (scene/renderer.ts, scene/thumbnails.ts) directly.
- Content JSON supplies every visible name, icon, theme and cost.
- ui/build.tsx Thumb starts a second WebGL context (scene/thumbnails.ts).
- workshop/* imports AudioEngine, content-api, render/iso and scene/thumbnails; the Workshop shares epochs.css.

Building v3 as a self-contained app/Games/<Name>/client (GuWorld template):
- vite.config.ts only runs the React plugin on /resources\/games\/.*\.tsx?$/ (line ~67). A React client under app/Games/<Name>/client needs that regex extended, plus a laravel input entry and its own tsconfig with "jsx":"react-jsx". The GuWorld client tsconfig has no jsx.
- It would have no BrowserRouter or Hub shell, so it needs its own api.ts (GuWorld has one), its own i18n (GuWorld's client/i18n.ts pattern: TEXTS Record<'ru'|'en'|'uz', Texts>), and its own copy of the base HUD CSS.
- The hub entry would use href '/games/<slug>' like gu-world.

## Requirement impact
### R1 [moderate]
UI side of a fixed 100×40 strip that grows left and right.
- Camera start and Home/🎯 already center on game.center (the town hall), falling back to the map middle (EpochsGame.tsx:324-329, 525-531, 1187-1194). Keep that, but the camera clamp is the whole map (scene/camera.ts:56-58 clamps to [0,width]×[0,height]); it must cover the playable band plus the mountain and sea margins.
- Remove era-driven square territory text: EpochPanel '🗺️ земли {2t}×{2t}' (epoch.tsx:89-91) and Workshop previews (previews.tsx:572-573).
- Add a new UI for unlocking expansion strips (left/right parcels with a price and preview, SimCity BuildIt style): a tappable locked-parcel overlay or a button at the strip edge, plus an Overlay field for highlighting purchasable land.
- canPlace failure reasons (hint pill, EpochsGame.tsx:693, 713) will need a 'land not bought' message.

### R2 [trivial]
Mostly renderer and terrain work. The UI part is camera limits:
- Keep the pitch above horizon-revealing angles and limit the pan target so slab edges never show (camera.ts:9-12 MIN/MAX_DISTANCE/PITCH, 56-58 clamp).
- CameraControls tilt and zoom buttons (hud.tsx:361-392) and pinch (EpochsGame.tsx:916-928) drive the same orbit, so no UI change beyond the limits.

### R3 [moderate]
Remove the UI that assumes small features:
- Bulldoze 'clear' path: game.clear(tile) at EpochsGame.tsx:791-793, and the hint text about trees, rocks and reeds at 1082.
- Inspector '🌲 Ресурсы рядом' (inspector.tsx:376-382) and effectLines 'near' (77-81).
- The 'cleared' event toast.

Add placement feedback for quarries and mines that must touch the mountain edge, and port and water buildings on the shore: the ghost ok/reason already flows through canPlace → overlay.ghost.ok and setHint (EpochsGame.tsx:683-693). Only engine rules and messages change.

### R4 [hard]
The road tool is hard-wired to ONE road building found by role (game.content.byRole('road')).
- Places that depend on it: toolbar button (EpochsGame.tsx:1318-1347), R hotkey (506-515), toolHint (1076-1080), roadPath L-shape on 1-tile cells (631-668), buildRoad (828-865), which levels up an existing road by drawing over it (837-845).
- Multi-lane avenues need:
  - a road-class picker (street/avenue/boulevard, lane count) in a dedicated road sheet;
  - a drag path that reserves 2-4 tile widths and validates the full width;
  - a preview of sidewalks and lanes in the ghost;
  - upgrade-by-redraw generalized to a class change.
- The Inspector for roads should show lanes, traffic and decor slots.
- Most of the visual work is in scene/roads.ts (another subsystem).

### R5 [hard]
New tools and UI:
- Network line tools for rail and metro: drag like roads, but with stations. A metro needs an underground view toggle, a new Overlay flag next to xray/showDistricts (renderer.ts:32-51) and a new CameraControls button (hud.tsx:393-415).
- The airport is a large-footprint normal build (works through BuildDock and the ghost).
- Add a transport category tab to CATEGORY_NAMES (common.tsx:6-17); 'infrastructure' (Город) holds roads today.

Drop eras after 2100: TechTree era tabs (research.tsx:160-180), EpochPanel, i18n titles 'до 3000' (i18n.ts:108, 210, 314).

The Tool union (EpochsGame.tsx:30-34) needs a {kind:'line', network:'rail'|'metro'|'road', class} variant.

### R6 [moderate]
Engine: the year snaps to epoch.year on advanceEpoch and testerNextEpoch (game.ts:1311, 2266), and tick runs at an era-specific yearsPerDay capped at next.year-1 (game.ts:1326-1330).

UI that presents eras as year jumps:
- hud-year 'Math.floor(state.year) г.' (hud.tsx:54);
- EpochSplash animates a count-up from the previous era's year to the new one (epoch.tsx:279-317);
- EpochPanel path shows years (45-55) and the button '🚀 Перейти в {next.year} год' (113-115);
- toolbar 'Эпоха {next.year}' (EpochsGame.tsx:1407-1412);
- TechTree tabs labelled by year (research.tsx:173);
- BuildDock level tooltip '— {epoch.year} г.' (build.tsx:227);
- the first-run toast `${world.epoch.year} год` (EpochsGame.tsx:308-311).

Replace all of these with era names, tiers or a 'from ~year' hint. Show a real calendar (date or month plus year) at one constant rate. Today 'день N' and the season (1 day per season, 240 s) are unrelated to the displayed year (hud.tsx:57-66).

The splash should become a light 'new era unlocked' toast or sheet, not a time jump. Speed buttons already scale the calendar uniformly (gameDt = dt*speed, EpochsGame.tsx:412-420).

### R7 [moderate]
TopBar renders every visibleResource with value, cap and rate (hud.tsx:104-134). Replace it with:
- one wallet chip: the era's currency icon and name (coins → banknotes → card → digital), a formatted amount and income per minute;
- population, mood and power chips.

Move the other resources into a Storage/Warehouse sheet: a new component, opened from the wallet or a toolbar button.

Needs a content field for currency per era (e.g. EpochDef.currency {id, name, icon, symbol, format}) or a CurrencyDef list. Today 'gold' 💰 is a fixed resource (resources.json) and its icon appears everywhere through CostLine (common.tsx:74-98).

Also update:
- the offline catch-up toast hard-codes 'золота' and reads resources.gold (EpochsGame.tsx:295, serializer.ts:311-345);
- research cost UI (research.tsx:122) and 'knowledge 📜' as a pseudo-currency (lead text at research.tsx:183-185);
- goal rewards (epoch.tsx:137-142); bureau costs (bureau.tsx:87-90);
- Stats economy list (epoch.tsx:243-262);
- the tester 'Заполнить ресурсы' button.

### R8 [hard]
The UI has no economic insight beyond per-minute rates (Stats modal, epoch.tsx:189-277) and per-building output/input (inspector.tsx:330-402).

A deep economy needs new panels:
- a budget/ledger: income by source (taxes per zone, trade, tourism) against upkeep (services, roads, transit), with trend sparklines;
- policy and tax sliders;
- RCI-style demand bars;
- supply-chain or production-chain views;
- tooltips that show the formula behind each number.

The styles.css .stats__charts/.sparkline rules (1666-1696) are v1 leftovers that could be revived. The Stats contract (game.ts:62-75) must grow (budget lines, demand, land value, traffic) for the UI to show it.

### R9 [hard]
Full rewrite of ui/*.tsx and the HUD CSS. Current problems:

(a) Phone layout:
- TopBar wraps to two rows below 760px (styles.css:1853-1861).
- The dock is open by default (EpochsGame.tsx:111) and takes about 300px with the toolbar.
- The Inspector at bottom:150px overlaps the open dock (styles.css:1872-1878; selecting a building does not close the dock).
- CameraControls is about 380px tall at left:50% and overflows phone landscape (epochs.css:292-306).
- The toolbar holds 8-9 buttons of ≥52px and scrolls sideways.
- Wide modals (1180px) fill the screen.

(b) Touch build bug: click() places at overlayRef.ghost (EpochsGame.tsx:798-826), but the ghost is only computed in updateHover on pointermove (966). A stationary tap on touch places nothing the first time, and later places at a stale previous ghost. Fix: compute the ghost in onDown/onUp and use a 'drag ghost + confirm ✓/✗' flow like BuildIt.

(c) Other touch gaps:
- in road mode a one-finger drag draws a road instead of panning, with no way to pan;
- no long-press, no confirm buttons;
- rotate and tilt are only reachable through pinch or buttons.

(d) Screen and target sizes:
- no env(safe-area-inset-*) although viewport-fit=cover;
- no pointer:coarse or hover:none rules;
- targets of 26-36px (speed 32, hud-icon 34, dock level 34×26, camera 36×34).

(e) Styling:
- emoji as icons with platform-dependent rendering;
- per-era fonts that do not exist on mobile (Segoe UI, Rockwell, Bahnschrift);
- light themes (e0, e1900, e2000, e2100) make the rgba(255,255,255,.06) chips invisible.

(f) No i18n:
- every string is Russian;
- window.confirm for demolish and restart (EpochsGame.tsx:1048, 1243).

Keep:
- the Modal, Bar, CostLine and formatter ideas;
- the CSS variable theming;
- the pointer, pinch and wheel handling core;
- quality presets and the fps hint.

The default quality is 'high' (pixelRatio 2, 2048 soft shadows) even on phones (EpochsGame.tsx:56-64). Choose it per device.

## Risks
1. Render loop:
   - The whole React tree re-renders every 250 ms (EpochsGame.tsx:473-478).
   - Inspector loops over all buildings each render (inspector.tsx:301-306), DistrictSection over all statuses (221-223), BuildDock filters all building defs, and Stats counts every building.
   - Fine at the current scale. For a 100×40 city with transit, plus more buildings and NPCs on mobile, panels should subscribe to derived, memoized selectors or a revision-keyed store instead of reading the mutable Game on a timer.

2. Two WebGL contexts (main renderer plus the thumbnails renderer, scene/thumbnails.ts:31-37). The first dock open renders every thumbnail synchronously in useMemo (build.tsx:19-25), which can jank on phones. Precompute or lazy-load them.

3. The build tool depends on hover: on touch, tap-to-place does not work reliably (see R9b). The ghost is cleared only on tool change, so a stale ghost can be placed.

4. pointerleave clears hover but not the ghost (EpochsGame.tsx:1021-1023).

5. Keyboard handlers bind to window. Modal adds its own Esc listener, so both fire: Esc closes the modal AND resets the tool and selection.

6. The roadPath L-shape always goes x-first. In a 100-wide by 40-deep strip with a rotated camera this feels arbitrary; it needs a corner toggle or a straight/curved mode.

7. The theme is inline CSS vars per era (EpochsGame.tsx:1059-1072). Light-theme contrast is broken for chips whose backgrounds assume a dark panel (rgba(255,255,255,.04-.12) everywhere). The v1 [data-epoch='7'] fixes in styles.css do not apply to epochs.

8. The main HUD CSS lives in the shared resources/games/src/styles.css, not in epochs.css. Copying only the epochs folder loses the HUD styling. Also, v1 city rules share class names (.city, .inspector, .toolbar): if v3 stays in the SPA, use a fresh class prefix to avoid cascade collisions.

9. React for a self-contained app/Games/<Name>/client needs vite.config.ts react include widened, plus its own tsconfig with jsx. react-router-dom (useNavigate, Link) would no longer be present.

10. Visible strings are Russian-only across the UI, engine (game.ts fail/toast messages) and content. Adding ru/en/uz later is expensive; design v3 with i18n keys from day one.

11. Time and calendar:
   - The calendar mixes three clocks: state.time (seconds), day = time/240 with 1 day per season (a 'year' of seasons is 16 real minutes), and state.year advancing at yearsPerDay (7-100 per day).
   - The HUD shows all three (hud.tsx:53-66).
   - R6 needs one coherent model before UI design.

12. Speed:
   - ×20/×50 tester speeds run up to 50 tick(1) calls per frame at 0.1 s dt cap (EpochsGame.tsx:417-420). Heavy economic maths (R8) must keep tick cheap, or move to a worker.
   - Offline catch-up runs up to 3600 ticks synchronously on load (serializer.ts:330-332).

13. Other:
   - Audio unlock is tied to canvas pointerdown only; HUD buttons other than mute don't unlock it. iOS needs unlock in a user gesture.
   - No orientation, fullscreen or wake-lock handling; no PWA. Mobile-browser chrome resizing relies on the resize listener only.
   - render/iso.ts is a dead duplicate; don't carry it into v3 unless the workshop NPC preview is kept.

## Reusable
- AudioEngine (audio/audio.ts) as-is: synthesized presets, file fallback, ambience by era type, mute, unlock.
- shared/api.ts patterns (envelope, bearer token, GameApiError with status, keepalive saves) and usePlaytime (heartbeat for the ratings gate). Copy them into a self-contained client, as GuWorld does with client/api.ts.
- The save loop design: a revision-diff autosave every 20 s, a keepalive save on visibilitychange/unmount, restoreChanges on failure, and a 409 conflict modal that pauses (EpochsGame.tsx:207-250, 558-578, 1609-1627).
- Pointer input core: a pointers Map with setPointerCapture, two-finger pinch that zooms, rotates and pans at once around the midpoint, a 5px drag threshold, zoom-to-cursor wheel, contextmenu suppression (EpochsGame.tsx:867-1032). Keep it, but fix the touch ghost.
- Pick cycling through stacked buildings (PickCycle, 726-768) and the x-ray toggle.
- The Overlay ref contract between UI and renderer (renderer.ts:32-51): a cheap, frame-synchronous way to drive ghosts, paths and highlights. Extend it rather than replace it.
- Graphics quality presets with a localStorage choice and the automatic '🐢 low fps → lower quality' suggestion (hud.tsx:210-219).
- Era theming through CSS custom properties fed from content (EpochTheme). A good mechanism for 'the currency and UI skin evolve by era'. Restyle the values, keep the mechanism.
- Small helpers: compact/perMinute/duration/face, CostLine (red when short), Bar, Modal (Esc and backdrop close, aria-modal), toasts with tone and auto-expiry, the hint pill fed by canPlace reasons.
- Content-driven BuildDock ideas: category tabs with open counts, search, a level picker per card, locked next-era previews, 3D thumbnails with an emoji fallback.
- Inspector information architecture: problems first (road, power, inputs, workers), live per-minute IO, next-level preview with effect lines, upgrade-all, move, demolish. Re-skin it as a bottom sheet on mobile.
- Tester tools in the menu (infinite resources, finish all, research all, next era), gated by content `editable`. Valuable for balancing the R8 economy.
