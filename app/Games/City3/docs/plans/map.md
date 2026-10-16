# Map + calendar implementation plan

Written by the map agent (it was blocked by the usage limiter before editing code).

The work stopped before I changed anything. Your usage-limit hook blocked the next command with this message: "Остановлено ограничителем: использовано 80% 5-часового лимита (порог 80%). Сброс в 20:10. Не продолжай работу и не запускай агентов; сообщи пользователю." So I stopped, as it says.

**State:** I only read files. No file is edited in `D:\www\P1\app\Games\City3` or `D:\www\P1\tests\Feature\Games\City3`. I ran no build, tests or screenshots, and made no commits or branches.

**What I found while reading (for when the work resumes after 20:10):**
- **Server:** the tile check in `WorldPayloadRules.php` accepts any biome id up to 32 characters, but each row must still have 5 elements (the fifth null or a string). Width and height must be 16–256, so a 100×64 grid passes. The server keeps a stored year column (`world.year`, max 9999); the client can compute it and still send it. Nothing on the PHP side checks map, biome, territory or `yearsPerDay` content, so no PHP change looks necessary. `land` has no server column yet, so it would default from `world.json` `map.start` when a save loads.
- **Content:**
  - Four buildings have a real `near` bonus: `lumber.json`, `quarry.json`, `mine.json` and `coal_mine.json`. Every other `near` is `null`.
  - All 205 `"near"` entries sit on one line each, so they can be removed mechanically.
  - `content.ts` casts the JSON through `unknown`, so taking a field out of the TypeScript types does not break the JSON imports.
  - `territory` and `yearsPerDay` are in every era in `epochs.json`, and its `$doc` text mentions both.
- **Year:** `Game.create` starts the clock at `secondsPerDay * 0.3` (morning). If the year is simply time / 25, a new game would open in year 2.88, not year 0. My plan is to start the clock at 0 and add a `time.dayStart: 0.3` offset to the day/night clock instead.
- **Every place that has to change, with line numbers:**
  - `game.ts`: map creation 147–196, `territory()` 298–320, `countFeatureNear` 789–805, the feature check in `canPlace` 837–842, `clear()` 1148–1182, the year jump in `advanceEpoch` 1311, the year in `tick` 1326–1330, the feature status and bonus 1767–1776 and 1905–1909, the tester next-era jump 2266.
  - `renderer.ts`: the features wiring, `groundAt` 753–828, the `cleared` effect 652–670.
  - `pathfinding.ts` 105–107; `overlays.ts` 486–490, 536–555, 596–597; `inspector.tsx` 77–80, 376–382; `epoch.tsx` land text at line 90; the bulldoze fallback in `City3Game.tsx` 802–804; the HUD year in `hud.tsx` 54; the camera and fog constants in `camera.ts` and `sky.ts`.

**Planned files:**
- New: `client/engine/world/layout.ts` (the fixed map builder and the shared ground height for flat land, beach slope and sea) and `client/scene/backdrop.ts` (mountain ridge layers).
- Deleted: `client/engine/world/generator.ts` and `client/scene/features.ts`.
- Rewritten:
  - `scene/terrain.ts`: no skirt, side aprons, a sea plane reaching about 1,500 units, darker locked columns, a border around the strip.
  - `scene/sky.ts`: a sky dome whose horizon colour matches the fog, fog set in world units, no era colours.
  - `scene/camera.ts`: yaw limited to ±35°, pitch about 24–68°, max distance 70, target kept to the strip plus a margin, field of view that adapts to portrait screens, fixed far plane.
- Edited: `game.ts`, `state.ts`, `clock.ts`, `serializer.ts`, `types.ts`, `registry.ts`, `world-map.ts`, `pathfinding.ts`, `overlays.ts`, `renderer.ts`, `events.ts`, `City3Game.tsx`, `ui/hud.tsx`, `ui/epoch.tsx`, `ui/inspector.tsx`, plus `world.json`, `biomes.json`, `epochs.json` and the building JSON files.
- New tests: `client/engine/world/layout.test.ts` and `client/engine/sim/game.test.ts`.

The server at `http://192.168.10.77:8000/games/city3` answers 200 and serves the built bundle (there is no `public/hot`), so the screenshot step should work once the code is in.
