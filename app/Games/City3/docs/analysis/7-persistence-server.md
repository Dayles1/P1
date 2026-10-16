# persistence-server (Epochs save/load + server module, shared Community features, hub card, and the GuWorld/Sandbox self-contained template)

## Summary
Epochs is client-authoritative: the browser simulates everything, and the server only stores and range-checks what it is sent. Each player has one world (epochs_worlds.user_id is unique) spread over 4 tables on the shared `games` connection: epochs_worlds, epochs_tiles (one row per map cell, 72x72 = 5184 rows per player), epochs_buildings (one row per building; every road tile is its own 'road' row) and epochs_npcs. Migrations: app/Games/database/migrations/2026_10_06_100000 (tables) and 2026_10_07_072548 (adds techs/research/blueprints/achievements JSON plus building style/district, and wipes all v1 worlds).

Client side, engine/save/serializer.ts does four jobs:
- toCreatePayload (:159) sends the whole world once: every tile as a compact TileRow [x, y, biomeId, elev0-255, feature], all buildings and all NPCs.
- takeChanges (:177) builds a delta from Game.changedBuildings, Game.deletedBuildings, WorldMap.dirty and NPCs. NPCs are always sent whole. It clears those sets, and restoreChanges (:201) puts them back if the request fails.
- fromServer (:217) rebuilds a Game defensively: it drops unknown techs, blueprints and building types and clamps levels.
- catchUp (:311) replays offline time as 1-second ticks, up to world.json time.maxOfflineSeconds = 3600, and reports the change in population and 'gold'.

EpochsGame.tsx drives it:
- GET epochs/world on load. If empty, it runs Game.create(content), which uses a random seed (game.ts:147-150), then POSTs the create payload.
- Autosave every 20 s when game.revision changed (AUTOSAVE_MS :52, effect :557-578), plus a keepalive save on visibilitychange 'hidden' and on unmount.
- A 409 freezes the game and shows a 'world open in another tab' modal (:237-240, :1609-1629).

Server side:
- WorldController (show/store/sync/destroy, :22-68) extends App\Games\Http\Controllers\GameController, which provides the {success, message, data} envelope and playerId() = auth user id.
- WorldStore does optimistic concurrency. sync() runs in a transaction on config('games.connection'), uses lockForUpdate and compares the revision (409 if it differs), then increments it (:79-101). Tiles are upserted in chunks of 800 on (world_id, x, y). Buildings are upserted in chunks of 500 on (world_id, uid). NPCs are deleted and reinserted on every sync (:188-207).
- Validation lives in the WorldPayloadRules trait. It reads content JSON on every request (epochs/techs/blueprints/goals via Rule::in, building ids by glob) and checks tiles with a hand-written closure for speed (:104-131). Coordinates are limited to 0..255, width/height to 16..256, buildings to 6000 and NPCs to 1000. score, resources and population are only range-checked.

Shared Community features (all on the `games` DB):
- The App\Games\Game enum (city|epochs|sandbox) is the whitelist for the {game} route parameter.
- PlaytimeController counts heartbeat time on the server (at most 60 s per beat, nothing after a gap over 120 s).
- RatingController allows a rating after 300 s of playtime. RatingSummary iterates Game::cases().
- LeaderboardController::query has an exhaustive match over Game that reads epochs_worlds.score.
- GameHubController::progress reads the Epochs World row for the hub card.

The hub (catalog.ts) lists Epochs as an in-SPA route (path '/city2', resetPath 'epochs/world'). Self-contained games use `href`; the Sandbox also uses `api: '/api/sandbox'`, so the hub reads `${api}/summary` and `${api}/leaderboard` and resets with DELETE `${api}/player`.

The self-contained template is app/Games/GuWorld, which mirrors the Sandbox:
- Its provider merges config/gu_world.php and registers its own `gu_world` connection: same driver as the default, with the database swapped to <db>_gu_world or database/gu_world.sqlite, and :memory: in tests.
- It loads Database/Migrations and views (namespace 'gu-world'), registers web route /games/gu-world and API prefix api/gu-world (behind auth.api), and creates or wipes its DB on migrate / migrate:fresh (GuWorldDatabase).
- Its blade shell passes data-back-url plus a JSON settings script.
- client/main.ts checks hasToken() before booting. client/api.ts sends the localStorage 'auth_token' as a Bearer token and redirects to /login on 401. client/i18n.ts picks ru/en/uz from <html lang>.
- The PHP save controller has no base class, and the provider is listed before GamesServiceProvider in bootstrap/providers.php.

GuWorld does not integrate with playtime, ratings or the leaderboard. The Sandbox does: its client posts playtime to /api/games/sandbox/playtime, and it has its own LeaderboardController with leaderboard and summary in the hub's shape.

Note: GuWorld is mid-way through its stage-3 WIP commit and is internally inconsistent. The client sends save format v2 with a `changes` field, but the server accepts only v1 and refuses unknown fields. Do not copy its save code blindly.

## Files
- resources/games/src/epochs/engine/save/serializer.ts (342): WorldPayload/BuildingRow/NpcRow/CreatePayload/SyncPayload/LoadedWorld types (:22-93); worldPayload (:95, year floored :104, resources rounded to 0.01 :109-114); toCreatePayload (:159, all tiles via map.toRows()); takeChanges (:177, delta + NPCs always whole :197); restoreChanges (:201); fromServer (:217, defensive restore, occupant grid rebuild :268-282); catchUp (:311, 1-s ticks up to maxOfflineSeconds, reports 'gold' :314,:330,:340)
- resources/games/src/epochs/EpochsGame.tsx (1632): React root of the game. SPA deps: react-router Link/useNavigate (:3,:75, navigate('/') :1145,:1472, Link to /city2/workshop :1112,:1415,:1462), shared gameApi/GameApiError (:5), usePlaytime('epochs') (:6,:74). save() with 409 conflict handling (:205-249); load/create flow (:253-342); autosave 20 s plus visibilitychange keepalive (:557-578); restart = DELETE epochs/world then reload (:1047-1054); localStorage 'city2.quality' (:54); hard-coded Russian strings (TITLE :53)
- resources/games/src/epochs/content-api.ts (54): loadContent(): GET /api/games/epochs/content via shared gameApi (:6,:20); formatContent (same layout as ContentRepository::encode)
- resources/games/src/epochs/workshop/Workshop.tsx (659): Content editor at /games/city2/workshop: shared gameApi/GameApiError (:4), PUT/DELETE epochs/content/{key} (:222,:359), react-router Link back to /city2 (:2,:286,:410)
- resources/games/src/epochs/engine/world/world-map.ts (169): WorldMap with typed arrays biome/elevation/feature/occupant; FEATURES [null,'tree','rock','reeds'] (:11); TileRow (:35); dirty set (:45); toRows (:128) / fromRows (:147)
- resources/games/src/epochs/engine/sim/state.ts (94): WorldState, BuildingState, NpcState, BuildingStyle, Mood, Research: the saved-state shapes
- resources/games/src/epochs/engine/sim/game.ts (2286): Persistence-relevant parts: revision counter (:110), changedBuildings/deletedBuildings (:115-116), Game.create with random seed and town centre at map centre (:147-196), score() computed on the client (:751-765), advanceEpoch sets year = epoch.year (:1302-1318), tick clamps year to next era year - 1 (:1326-1330), testerNextEpoch (:2259-2270)
- app/Games/Epochs/WorldStore.php (208): find/load/create/sync/delete. WORLD_FIELDS (:19-23), BUILDING_FIELDS (:26); revision-guarded sync with lockForUpdate (:79-101); upsertTiles chunk 800 (:138-154); upsertBuildings chunk 500 (:159-183); replaceNpcs delete + insert (:188-207); uses config('games.connection') (:58,:81,:105)
- app/Games/Epochs/Http/Controllers/WorldController.php (69): GET/POST/PUT/DELETE world; extends shared GameController; 409 world_exists (:33-35), 404 world_missing (:46-48), 409 save_conflict with data.revision (:52-54); translations from games::messages
- app/Games/Epochs/Http/Requests/WorldPayloadRules.php (132): Shared validation: worldRules reads content files on every request (:21-25); width/height 16..256 (:30-31); resources keys unchecked, values numeric >= 0 (:39-40); buildingRules x/y 0..255, max 6000, Rule::in(buildingIds) (:63-82); npcRules max 1000 (:87-102); tilesRule closure (:104-131)
- app/Games/Epochs/Http/Requests/CreateWorldRequest.php (32): world + tiles (required) + buildings + npcs
- app/Games/Epochs/Http/Requests/SyncWorldRequest.php (37): revision + world + tiles (present) + buildings{upsert,delete} + npcs
- app/Games/Epochs/Models/World.php (107): epochs_worlds on the 'games' connection (hard-coded :49); casts JSON for resources/moods/stats/techs/research/blueprints/achievements; hasMany tiles/buildings/npcs
- app/Games/Epochs/Models/Building.php (56): epochs_buildings; style/district JSON casts
- app/Games/Epochs/Models/Tile.php (43): epochs_tiles; no timestamps
- app/Games/Epochs/Models/Npc.php (56): epochs_npcs; no timestamps
- app/Games/Epochs/Database/Factories/WorldFactory.php (56): 96x96 world in e0 with 'gold' resource; inEpoch() state
- app/Games/Epochs/Content/ContentRepository.php (193): Reads/writes content JSON at config('games.epochs.content_path'); bundle/bundleForClient ({} preserved); version hash; buildingIds by glob; encode layout
- app/Games/Epochs/Content/ContentValidator.php (478): Server-side content cross-reference checks, mirroring the client's validateContent; requires roles 'road' and 'center'
- app/Games/Epochs/Http/Controllers/ContentController.php (112): GET content (+ editable flag), Workshop PUT/DELETE content/{key} after validating the whole bundle
- app/Games/Epochs/Workshop.php (21): canEdit from config games.workshop.enabled/editors
- app/Games/database/migrations/2026_10_06_100000_create_epochs_tables.php (106): Creates epochs_worlds (user_id unique, score index), epochs_tiles (unique world,x,y), epochs_buildings (unique world,uid), epochs_npcs; x/y are unsignedSmallInteger
- app/Games/database/migrations/2026_10_07_072548_add_research_and_styles_to_epochs_tables.php (59): Wipes v1 worlds and adds techs/research/blueprints/achievements and style/district JSON columns
- app/Games/database/migrations/2026_10_07_073716_create_game_playtimes_table.php (37): game_playtimes(user_id, game string(32), seconds, last_ping_at), unique(user_id, game)
- app/Games/database/migrations/2026_10_07_073717_create_game_ratings_table.php (38): game_ratings(user_id, game, stars, comment<=500), unique(user_id, game)
- app/Games/routes/api.php (62): /api/games/*: progress; city save; epochs content and world routes (world POST throttle 10/min, PUT throttle 60/min); ratings; {game}/playtime (10/min), rating (20/min), leaderboard
- app/Games/routes/web.php (19): Catch-all /games/{path?} SPA shell, which is why self-contained providers must be listed earlier
- app/Games/Game.php (33): enum Game {City='city', Epochs='epochs', Sandbox='sandbox'}; SECONDS_TO_RATE = 300, HEARTBEAT_SECONDS = 60, HEARTBEAT_GAP_SECONDS = 120
- app/Games/GamesServiceProvider.php (90): Registers the 'games' connection, migrations, views 'games', lang 'games', web and api routes, games:install command, migrate hooks
- app/Games/GamesDatabase.php (76): ensureExists (sqlite file / CREATE DATABASE), dropAllTables
- app/Games/Http/Controllers/GameController.php (33): Abstract base: success(), error(), playerId()
- app/Games/Http/Controllers/GameHubController.php (48): GET /api/games/progress: city and epochs progress (reads Epochs World plus ContentRepository epoch name)
- app/Games/Community/Http/Controllers/PlaytimeController.php (57): Heartbeat counter with lockForUpdate; returns seconds/can_rate
- app/Games/Community/Http/Controllers/RatingController.php (59): index (summary), update (needs >= 300 s), destroy
- app/Games/Community/Http/Controllers/LeaderboardController.php (131): Top 20 by score with shared ranks; exhaustive match over Game in query() (:89-94), where Epochs reads World; details with epoch_name from content
- app/Games/Community/RatingSummary.php (79): Per-game summary over Game::cases(): average, distribution, mine, my_seconds, can_rate, recent 5
- app/Games/Community/PlayerNames.php (32): Names via App\Domain\Identity\Models\User (host coupling)
- app/Games/Community/Models/GamePlaytime.php (55): game cast to Game enum
- app/Games/Community/Models/GameRating.php (54): game cast to Game enum
- resources/games/src/hub/catalog.ts (83): GameEntry {slug, cover, hue, genre, path|null, href?, resetPath?, api?}; epochs = path '/city2', resetPath 'epochs/world'; gu-world = href only; sandbox = href + api
- resources/games/src/hub/Hub.tsx (325): Cards: progress = GET /api/games/progress plus `${api}/summary` per own-API game (:66-77); progressLine (:31-51); rating/board actions only if ratings[slug] exists (:165-167); reset uses resetPath (under /api/games) or DELETE `${api}/player` (:211-215)
- resources/games/src/hub/ratings.tsx (605): RateDialog (PUT /api/games/{slug}/rating), LeaderboardDialog (`${api}/leaderboard` or /api/games/{slug}/leaderboard); Leaderboard/LeaderEntry shapes (:31-60)
- resources/games/src/shared/api.ts (92): gameApi('/api/games/'+path), apiRequest, GameApiError(status, message, data), bearer from localStorage 'auth_token', 401 sends to /login?redirect=
- resources/games/src/shared/usePlaytime.ts (31): React hook: POST /api/games/{slug}/playtime on mount and every 60 s while visible
- resources/games/src/shared/i18n.ts (357): Hub strings ru/en/uz incl. titles[slug] = [title, description] and progress_epochs
- resources/games/src/main.tsx (42): SPA root: hasToken redirect, BrowserRouter basename /games, routes /city2 and /city2/workshop
- resources/games/src/styles.css (1892): SPA base tokens/reset (:1-51) plus the City/Epochs HUD styles (.city era themes :784, top bar :906, goals, inspector, toolbar :1264, toasts, modals :1523, epoch splash, small screens :1851) that EpochsGame depends on
- resources/games/views/app.blade.php (21): SPA shell #games-root with data-home-url; @fonts (bunny Onest); @vite main.tsx
- config/games.php (55): connection 'games', database env, max_save_kb, epochs.content_path, workshop.enabled/editors
- app/Games/GuWorld/GuWorldServiceProvider.php (90): TEMPLATE provider: mergeConfig, registerConnection (sqlite file / :memory: / <db>_gu_world), migrations, views 'gu-world', web routes, api prefix api/gu-world, migrate hooks; doc says to list it before GamesServiceProvider
- app/Games/GuWorld/GuWorldDatabase.php (76): TEMPLATE: ensureExists/dropAllTables for the game's own DB
- app/Games/GuWorld/config/gu_world.php (90): TEMPLATE config: connection, database env, back_url env (default /games), world settings passed to the page and used by server validation
- app/Games/GuWorld/routes/web.php (16): GET /games/gu-world serves the blade view
- app/Games/GuWorld/routes/api.php (21): auth.api group: GET/PUT (throttle 30/min)/DELETE save
- app/Games/GuWorld/views/app.blade.php (26): <html lang=locale>, viewport-fit=cover, Google Fonts, @vite client/main.ts, #gu-world-root data-back-url, <script type=application/json id=gu-world-settings>
- app/Games/GuWorld/Models/Save.php (57): $connection = 'gu_world'; one save per user_id
- app/Games/GuWorld/Http/Controllers/SaveController.php (75): No base class: private success() and playerId() (:62-74); updateOrCreate by user_id
- app/Games/GuWorld/Http/Requests/SaveGameRequest.php (110): VERSION = 1 (:27), MAX_BYTES 8192 checked in prepareForValidation (413), unknown fields refused (FIELDS :36, after() :75-86), bounds from config
- app/Games/GuWorld/Database/Migrations/2026_10_09_102235_create_saves_table.php (39): saves table on the 'gu_world' connection
- app/Games/GuWorld/Database/Factories/SaveFactory.php (35): Factory; uses location 'test_valley', which config does not define (WIP inconsistency)
- app/Games/GuWorld/client/main.ts (135): Entry: hasToken() or goToLogin() (:117-118); reads JSON settings; loadSave; refuses to start a new game if the load failed (:93-100); error card with back link from root.dataset.backUrl (:55-59)
- app/Games/GuWorld/client/api.ts (88): Own fetch wrapper to /api/gu-world/*: Bearer from localStorage 'auth_token' (:8,:16-22), 401 goes to /login?redirect= (:28-30,:60-62), throws a plain Error (no status) (:66-70), keepalive support
- app/Games/GuWorld/client/i18n.ts (147): TEXTS ru/en/uz; language() from document.documentElement.lang (:141-145); export const t
- app/Games/GuWorld/client/vitest.config.ts (20): Node vitest with root = client dir and cacheDir in node_modules/.vite/gu-world; run by npm script test:gu-world
- app/Games/GuWorld/client/tsconfig.json (13): Strict ES2022 bundler config with no jsx option (vanilla TS client)
- app/Games/GuWorld/client/state/save.ts (206): Versioned save: SAVE_VERSION = 2 with `changes` (:28-39); restoreGame repairs bad data; checkSave before sending. Out of sync with the server's v1
- app/Games/GuWorld/client/state/saver.ts (78): One request in flight, latest-only queue, refused/failed reporting: a good pattern to reuse
- app/Games/Sandbox/client/api.ts (142): Same token pattern; playtimeBeat() POSTs /api/games/sandbox/playtime and fails quietly without the hub (:103-128)
- app/Games/Sandbox/Http/Controllers/LeaderboardController.php (127): Own-API leaderboard and summary in the hub's shape; names through config('auth.providers.users.model') (decoupled from host)
- tests/Feature/Games/EpochsWorldTest.php (264): Guests 401, create stored table by table, load round-trip, 409 on second create, delta sync and revision, research/styles round-trip, validation, stale revision 409, ownership isolation, delete cascade, hub progress, tables only on the games DB
- tests/Feature/Games/EpochsContentTest.php (202): Content validity (era years [0..3000] asserted at :31), workshop write/create/delete/permissions, model part kinds, home models inside plot
- tests/Feature/Games/GameRatingsTest.php (254): Playtime heartbeat maths, rating gate, summary, leaderboards; catalog-vs-enum regex test (:248-253)
- tests/Feature/Games/GuWorld/GuWorldSaveTest.php (201): TEMPLATE tests: own page without the SPA root, settings JSON in page, DB isolation across connections, guests 401, round-trip, replace, validation dataset, 413 size cap, cross-user isolation, delete only own, throttle 30/min
- tests/TestCase.php (18): $connectionsToTransact = [null, 'games', 'sandbox', 'gu_world']; a new game connection must be added here
- bootstrap/providers.php (20): Sandbox and GuWorld providers listed before GamesServiceProvider because of the catch-all route
- vite.config.ts (73): laravel inputs include app/Games/Sandbox/client/main.ts and app/Games/GuWorld/client/main.ts (:39-43); react plugin include only /resources\/games\/.*\.tsx?$/ (:67)

## Key data structures
// ---- Client save shapes (serializer.ts:22-93) ----
type TileRow = [x:number, y:number, biomeId:string, elevation0_255:number, feature:'tree'|'rock'|'reeds'|null];
interface WorldPayload { seed; width; height; epoch:string; epoch_index; year:int(floored); time:int /*game seconds*/; population; happiness; score /*client-computed*/;
  resources: Record<string,number>; weather; weather_until; next_event_at; moods:{until,amount,reason}[]; next_uid; techs:string[];
  research:{id,start,end}|null; blueprints:string[]; achievements:string[]; stats:{built,upgraded,demolished,events} }
interface BuildingRow { uid; type; x; y; level; build_start; build_end; style:{blueprint:string|null; colors:Record<string,'#rrggbb'>}|null; district:{name; policy:string|null}|null }
interface NpcRow { uid; type; name; age; home_uid; work_uid:number|null; x; y; activity:'home'|'walking'|'working'|'leisure'; offset }
interface CreatePayload { world:WorldPayload; tiles:TileRow[]; buildings:BuildingRow[]; npcs:NpcRow[] }            // POST /api/games/epochs/world
interface SyncPayload { revision; world:WorldPayload; tiles:TileRow[] /*dirty only*/; buildings:{upsert:BuildingRow[]; delete:number[]}; npcs:NpcRow[] /*all*/ } // PUT
interface LoadedWorld { revision; saved_at:string|null; world; tiles; buildings; npcs }                            // GET
// Game: revision (UI counter), changedBuildings:Set<uid>, deletedBuildings:Set<uid>, map.dirty:Set<index>

// ---- DB (games connection) ----
epochs_worlds(id, user_id UNIQUE, revision, seed uint, width/height usmallint, epoch str32, epoch_index utinyint, year usmallint, time ubigint,
  population uint, happiness utinyint, score uint INDEX, resources json, weather, weather_until, next_event_at, moods json, next_uid, stats json,
  techs json?, research json?, blueprints json?, achievements json?, timestamps)
epochs_tiles(id, world_id FK cascade, x, y usmallint, biome str32, elevation utinyint, feature str16?) UNIQUE(world_id,x,y)
epochs_buildings(id, world_id FK, uid, type str64, x, y usmallint, level utinyint, build_start, build_end ubigint, style json?, district json?, timestamps) UNIQUE(world_id,uid)
epochs_npcs(id, world_id FK, uid, type, name str80, age utinyint, home_uid, work_uid?, x/y decimal(8,2), activity str16, offset float) UNIQUE(world_id,uid)
game_playtimes(user_id, game str32 (enum), seconds, last_ping_at) UNIQUE(user_id,game)
game_ratings(user_id, game, stars 1-5, comment<=500) UNIQUE(user_id,game)
gu_world.saves(user_id UNIQUE, version usmallint, location str64, world_minutes double, player json{x,y,z,yaw})

// ---- API envelope / hub contracts ----
type Envelope<T> = { success:boolean; message:string; data:T };   // 409 conflict: data = {revision}
type HubProgress = { epoch:string|number; epoch_name?:string|null; year; population; score; played_at }  // GET /api/games/progress -> {city, epochs}; own API: GET {api}/summary
type Leaderboard = { game:string; entries:{rank; name:string|null; score; details:{epoch, epoch_name?, year, population}|{kills,trees,artifacts}; is_me}[]; me:{rank,name,score,details}|null }
type GameRatings = { average:number|null; count; distribution:{'1'..'5':number}; mine:{stars,comment}|null; my_seconds; can_rate; recent:{name,stars,comment,at,is_me}[] }
interface GameEntry { slug; cover; hue; genre; path:string|null; href?:string; resetPath?:string /*under /api/games*/; api?:string /*own API: /summary, /leaderboard, DELETE /player*/ }
enum Game { City='city', Epochs='epochs', Sandbox='sandbox' }  // SECONDS_TO_RATE=300, HEARTBEAT 60/gap 120

## Couplings
HOW TO MAKE EPOCHS SELF-CONTAINED (client dependencies on the games SPA, each with the GuWorld/Sandbox solution):
1) Router: EpochsGame.tsx:3 imports Link/useNavigate. navigate('/') is the back button (:1145) and 'Other games' (:1472). Links to /city2/workshop are at :1112, :1415, :1462. Workshop.tsx links back with Link to '/city2' (:286, :410). Solution: no router. GuWorld uses a plain <a href={root.dataset.backUrl}> (main.ts:55-59), with data-back-url = url(config('gu_world.back_url')) set in views/app.blade.php:21 (env GU_WORLD_BACK_URL, default '/games'). Make the Workshop its own web route (e.g. /games/<slug>/workshop) serving the same blade with a data-mode attribute, or an in-page mode.
2) Shared API: gameApi/GameApiError come from ../shared/api in EpochsGame.tsx:5, content-api.ts:6 and Workshop.tsx:4, all hitting /api/games/epochs/*. Solution: own client/api.ts as in GuWorld (api.ts:8-73). It reads TOKEN_KEY 'auth_token' from localStorage, sends Authorization: Bearer, sets credentials same-origin, goes to /login?redirect=<path> on 401, and supports keepalive. Base path becomes /api/<slug>/ (registered by the module's provider prefix). GuWorld throws a plain Error and loses the HTTP status, so v3 must keep a GameApiError-style class with status/data: the 409 conflict at EpochsGame.tsx:237 and the Workshop 422 issues depend on it.
3) Token gate: the SPA's main.tsx:143-145 redirects guests. Solution: GuWorld main.ts:117-118 does `if (!hasToken()) goToLogin()` before booting. The HTML route stays public (routes/web.php), and only the API is behind auth.api (auth:sanctum + EnsureUserIsNotBanned + TouchLastSeen, bootstrap/app.php:57-61).
4) Playtime: usePlaytime('epochs') is a React hook from ../shared (EpochsGame.tsx:6, :74). Solution: Sandbox api.ts:103-128 playtimeBeat() POSTs /api/games/<slug>/playtime every 60 s while visible and fails quietly without the hub. GuWorld has no playtime at all. The server accepts the slug only if it is a case of App\Games\Game.
5) Ratings and leaderboard: these live in the hub, not in the game. The card shows Rate and Leaderboard only if GET /api/games/ratings has the slug, which needs a Game enum case (RatingSummary iterates Game::cases()). Adding a case requires a new arm in Community LeaderboardController::query (:89-94), which is an exhaustive match (abort(404) or a real query); otherwise there is an UnhandledMatchError. For its own leaderboard and progress, follow the Sandbox: catalog `api: '/api/<slug>'` and implement GET /leaderboard and GET /summary in the hub's shapes (Sandbox LeaderboardController). The hub resets own-API games with DELETE `${api}/player` (Hub.tsx:211-215), so expose that or extend the hub. A summary {epoch:string, epoch_name, year, population, score, played_at} is rendered with t.progress_epochs (Hub.tsx:43-50). The catalog test regex (GameRatingsTest.php:250) requires every [a-z0-9]+ slug that has a path/href to be in the enum.
6) i18n: Epochs client strings are hard-coded Russian (TITLE :53, toasts, labels, content JSON names). Server messages use the shared namespace games::messages (app/Games/lang/{ru,en,uz}/messages.php: world_exists, world_missing, save_conflict, content_*, workshop_forbidden). Solution: GuWorld client/i18n.ts keeps a TEXTS map per ru/en/uz chosen from document.documentElement.lang (:141-147); the blade sets <html lang=app()->getLocale()> (SetLocale reads the X-Locale header / 'locale' cookie / Accept-Language). Server messages are literals in GuWorld, or v3 can call loadTranslationsFrom(__DIR__.'/lang', '<ns>') in its provider. The hub card title/description stays in resources/games/src/shared/i18n.ts titles[slug] (a hub-side edit).
7) Styles and fonts: Epochs relies on resources/games/src/styles.css (tokens and reset :1-51, .city/.hud-button/top bar/toolbar/modals/toasts/splash/small screens :784-1892) besides epochs.css (1787 lines). The SPA blade loads fonts with @fonts (bunny Onest). v3 needs its own stylesheet and font link (GuWorld/Sandbox blades use Google Fonts).
8) React build: the react plugin only includes /resources\/games\/.*\.tsx?$/ (vite.config.ts:67). A React client under app/Games/<Name>/client needs that regex extended, a laravel input entry (vite.config.ts:39-43 pattern), and a client tsconfig with "jsx": "react-jsx" (GuWorld's tsconfig has no jsx). Mount with createRoot in the module's own main.tsx (no BrowserRouter).
9) localStorage key 'city2.quality' (EpochsGame.tsx:54): rename it per game.

SERVER COUPLINGS TO CUT:
- WorldController extends App\Games\Http\Controllers\GameController. Inline success/error/playerId as GuWorld SaveController:62-74 does.
- WorldStore uses config('games.connection'). Models hard-code $connection = 'games' and tables epochs_*. Use the new connection name and plain table names in the module's own DB.
- ContentRepository uses config('games.epochs.content_path') and Workshop uses config('games.workshop.*'). Move these to the module's config, and the content JSON into app/Games/<Name>/content. Keep it as JSON: WorldPayloadRules needs ids from PHP.
- Migrations come from app/Games/database/migrations. Move them to <Name>/Database/Migrations with protected $connection = '<name>' and NEW unique filenames.
- PlayerNames uses App\Domain\Identity\Models\User. The Sandbox uses config('auth.providers.users.model') instead.
- GameHubController::progress and Community LeaderboardController read Epochs\Models\World. Do not extend these for v3; use own /summary and /leaderboard.

HOST WIRING (the only edits outside the module):
- bootstrap/providers.php: list the provider BEFORE GamesServiceProvider, whose /games/{path?} catch-all (app/Games/routes/web.php:17) would shadow /games/<slug>.
- vite.config.ts: add the input and react include.
- package.json: add a test:<slug> vitest script.
- tests/TestCase.php:17: add the connection to $connectionsToTransact.
- resources/games/src/hub/catalog.ts: add an entry with href and api.
- shared/i18n.ts: add titles[slug].
- Optionally app/Games/Game.php: add the enum case, plus the LeaderboardController arm.

## Requirement impact
### R1 [moderate]
A fixed shared map makes per-player tiles unnecessary. Drop the tiles table and the tiles payload:
- serializer.ts:73, :81, :91, :167, :183, :212-214, :246
- WorldStore.php:44-45, :65, :90, :138-154
- WorldPayloadRules.php:104-131 and the tiles rules in Create/SyncWorldRequest
- migration epochs_tiles
This removes about 4-5k rows per player and about 150 KB from the create POST. Build the map deterministically from content (world.json map), or from a constant seed instead of Math.random() at game.ts:147-150.

Remove seed/width/height from the payload (WorldPayloadRules:29-31, migration :29-31, serializer :23-25, :99-101, :224-226). Width and height become server config constants, used to validate footprints.

Add persisted expansion state: e.g. worlds.unlocked_left / unlocked_right (or a plots JSON), with a starting 30-wide strip centred in the 100 width. Validate it on the server: monotonic, within 0..100, cost paid. Check building x/y (currently only 0..255, WorldPayloadRules:69-70) against the unlocked range and the playable depth.

The town hall placed 'at center' (game.ts:176-181) already uses map.width/2. Keep x/y non-negative (unsigned columns) and include the mountain-foot row and beach rows in the grid if things can be built there.

### R2 [trivial]
No persistence change; rendering only. Note: the map, mountains, beach and water become static content, so nothing about the terrain beyond the playable zone is saved.

### R3 [trivial]
Tree/rock/reeds features exist only as per-tile save state (world-map.ts:11 FEATURES, feature column, setFeature marks dirty at :82-87, bulldoze clears features). Removing them removes the last mutable per-tile data, which supports dropping tiles (R1). Mountain range, 20 sand rows and water are content, not saves. If mines must touch the mountain, add a server-side placement check per building type (e.g. a content flag `needsMountain` and y == mountain-foot row) to WorldPayloadRules buildingRules; today the server checks only type and 0..255 coordinates.

### R4 [moderate]
Roads are currently one 1x1 'road' building row per tile (BuildingRow, the role 'road' required by ContentValidator), with the tier as `level`. Multi-lane avenues with sidewalks and decor need a road class/lanes/orientation per segment. Options:
(a) add fields to BuildingRow and buildings (variant/rotation/lanes JSON) and to WorldPayloadRules buildingRules;
(b) better: store roads as a compact packed layer on the world row (e.g. base64 of a Uint8Array[100*40] of road class plus a decor bitmask), validated by a closure like tilesRule.
Option (b) cuts thousands of building rows and delta upserts, and keeps the keepalive body small. The score (game.ts:755-757) excludes roads by role; keep that consistent.

### R5 [moderate]
Metro, rail and airport need network state the save cannot hold today: metro lines (ordered station uids, colour), rail track tiles, airport runway orientation. Add world JSON columns (e.g. transit: {metro:[{id, stations:number[]}], rail: packed layer}) with validation in WorldPayloadRules, and a buildings.delete cascade check (deleting a station must fix its lines). Eras capped at 2100: epochs.json shrinks. Validation Rule::in($epochs/techs/goals) follows the content automatically, but EpochsContentTest.php:31 hard-codes years up to 3000 and must be rewritten. Leaderboard/hub epoch_name comes from content.

### R6 [moderate]
The year jump is game.ts:1311 and :2266 (year = epoch.year on advance) plus the clamp in tick (:1326-1330), with per-era yearsPerDay.

Persistence currently stores `year` as an int floored on every save (serializer.ts:104; migration :34 unsignedSmallInteger). With a slow constant calendar, each reload drops up to a year of fractional progress.

For v3, derive the calendar from `time` (ubigint, already saved): year = startYear + time / secondsPerYear, with one constant in world.json. Keep a `year` column only as a denormalised value for the leaderboard and hub, or recompute it on the server in WorldStore::sync from time. Era advance must no longer write year.

catchUp (serializer.ts:311-342) already advances time offline at the same rate. Its cost of 3600 one-second ticks should become coarser steps or an analytic catch-up for mobile.

### R7 [trivial]
world.resources is a free-form JSON map: values are validated as numeric >= 0 but keys are not checked (WorldPayloadRules:39-40). Use ONE stable resource id for money (e.g. 'money') in every era. Make the era-specific name and icon (coins, banknotes, cards, digital) a content property of the era, so an era change never migrates save data.

Replace hard-coded 'gold' in:
- catchUp (serializer.ts:314, :330, :340)
- the offline toast (EpochsGame.tsx:292-296)
- WorldFactory.php:33
- tests (EpochsWorldTest.php:24)
- world.json start resources and events

Optionally validate resource keys against resources.json (Rule::in on array_keys) and cap them by storage.

### R8 [hard]
A deeper economy adds state to persist: budget, tax rates, loans (principal, rate, term), market prices, demand (RCI), land value, rolling income/expense history for charts. Put it in typed JSON columns on worlds (e.g. economy, finances_history capped at N entries), each with explicit validation rules: GuWorld-style strictness, unknown fields refused, a MAX_BYTES cap.

The server trusts client-computed score, population and resources (WorldPayloadRules:36-40; score only min:0 at :38), and the leaderboard ranks on that score (Community LeaderboardController:41-46). With a shared fixed map, leaderboard fairness matters more. Consider computing the score on the server from stored buildings and population (WorldStore::sync), or plausibility caps (resources <= storage caps, population <= housing capacity from content).

Simulation stays in the client. Keep the economy pure TS with vitest unit tests (GuWorld vitest pattern) so the maths is verifiable.

### R9 [moderate]
New self-contained page and blade:
- viewport-fit=cover, theme-color, no SPA chrome, data-back-url, settings JSON
- own CSS (Epochs leans on resources/games/src/styles.css :784-1892)
- own client entry and i18n

Keep mobile-friendly save behaviour: autosave plus a visibilitychange/pagehide keepalive save (EpochsGame.tsx:557-578), because mobile tabs are killed without unload.

Keep keepalive bodies under the browser's 64 KB limit. NPCs are sent whole every sync (serializer.ts:197), so send them only when changed, or drop NPC persistence and regenerate NPCs from homes.

Use a compact save-status indicator and a conflict modal (current :1609-1629). The hub card integration (summary/leaderboard/reset/rating) follows the Sandbox pattern.

## Risks
- Migration name collision: the migrations table lives on the DEFAULT connection and is global. Copying 2026_10_06_100000_create_epochs_tables.php (or any existing filename) into the new module means Laravel treats it as already run and silently skips it. Use new timestamps and names.
- Provider order: the new provider must come before GamesServiceProvider in bootstrap/providers.php. Otherwise /games/<slug> is swallowed by the SPA catch-all (app/Games/routes/web.php:17) and GamesPageTest's '/games/anything/else' assumption.
- Adding a Game enum case without a match arm in Community LeaderboardController::query (:89-94) raises UnhandledMatchError (500). RatingSummary, GamePlaytime and GameRating casts all iterate or depend on the enum. The catalog test regex (GameRatingsTest.php:250) matches only [a-z0-9]+ slugs: a hyphenated slug escapes it, but then gets no ratings on the hub. game_playtimes.game is string(32).
- tests/TestCase.php:17: forgetting to add the new connection to $connectionsToTransact leaks rows between tests, since each :memory: connection lives for the whole process.
- The GuWorld template is WIP and inconsistent. The client sends SAVE_VERSION = 2 with a `changes` field (client/state/save.ts:28-39), but the server accepts only VERSION = 1 and refuses unknown fields (SaveGameRequest.php:27, :36, :75-86), so every GuWorld autosave currently gets 422. GuWorldSaveTest even asserts that v2 is refused (:137). SaveFactory uses location 'test_valley', which config does not define. Copy the structure, not this save code.
- GuWorld api.ts throws a plain Error without the HTTP status. v3 needs the status for 409 conflicts and 422 Workshop issues.
- Client-authoritative trust: score, population and resources are only range-checked, so the leaderboard can be faked. Mitigate with server-side score or plausibility caps (R8).
- Store race: WorldController::store does find() then create() without a lock (:31-37). Two concurrent POSTs give a unique(user_id) violation, i.e. a 500 instead of a 409.
- The conflict response returns the revision of the pre-transaction read (:53), which is acceptable.
- Write amplification: replaceNpcs deletes and reinserts every NPC on every 20 s sync (WorldStore:188-207). WorldPayloadRules reads 4 content JSON files and globs buildings on EVERY save request (:21-25, :68); cache by ContentRepository::version().
- Laravel wildcard validation over up to 6000 building rows with about 14 rules each is slow if a big batch arrives. Prefer a compact road layer (R4) and closure validation like tilesRule.
- The browser keepalive fetch caps the body at 64 KB: tab-hide saves with many changed rows or NPCs fail. Keep deltas small.
- year is floored on save (serializer.ts:104): with a constant slow calendar, reloads lose fractional years unless year is derived from time (R6).
- catchUp runs up to 3600 synchronous full-simulation ticks on load (serializer.ts:333-335). On mobile, with a bigger economy, this can freeze the page for seconds.
- Coordinates are unsigned (unsignedSmallInteger x/y; validation 0..255). Mountain-foot or beach buildings need a coordinate system with all buildable cells >= 0.
- Map size assumptions to remove: factory 96x96, world.json 72x72, Game.create centres on map.width/2 and map.height/2 (game.ts:176-181), and fromServer re-derives occupancy from width.
- For 100x40 on mobile, map memory is trivial (4000 cells of typed arrays). The real costs are the renderer and per-building sync.
- Hub own-API reset is hard-wired to DELETE `${api}/player` (Hub.tsx:211-215). Hub progressLine assumes either the Sandbox shape ('kills') or the city/epochs shape, and `epoch` must be a string id with epoch_name.
- The 2026_10_07_072548 migration wipes worlds when the rules change. v3 should instead version its save format (a version column, as GuWorld does) and repair on load.
- Workshop writes JSON files inside the repo, which is only acceptable locally. Gate it by the module's config (and `tester` tools: EpochsGame passes tester = editable).
- `npm run format` runs prettier only over resources/, so client code under app/Games is not covered by that script.

## Reusable
Keep as-is in v3:
- Optimistic concurrency: a revision column; WorldStore::sync takes lockForUpdate, compares the revision, increments it and returns 409 with the current revision; the client shows a conflict modal and stops the simulation (EpochsGame.tsx:237-240).
- Create-once then delta-sync: changedBuildings/deletedBuildings/dirty sets in the engine, takeChanges clears them, restoreChanges puts them back on failure (serializer.ts:177-215).
- Building upsert keyed on (world_id, uid), in chunks, inside a transaction. Client-assigned uids (next_uid) avoid id round-trips.
- Defensive load: fromServer drops unknown techs, blueprints and building types and clamps levels (serializer.ts:217-308). Combine it with GuWorld's restoreGame repair-and-report approach (state/save.ts) and an explicit save format version.
- Compact row arrays validated by one PHP closure instead of wildcard rules (WorldPayloadRules::tilesRule), for any packed layer such as roads, rail or zoning.
- Autosave every ~20 s when dirty, plus a keepalive save on visibilitychange and unmount (EpochsGame.tsx:557-578). GuWorld's Saver (one request in flight, latest-only queue, refused/failed reporting) is a cleaner implementation of the same idea.
- The {success, message, data} envelope.
- Content-driven server validation: Rule::in over ids read from the content JSON; ContentRepository's bundleForClient that keeps {} as {}; the version hash; the Workshop with whole-bundle validation (ContentValidator).
- The self-contained module skeleton, as in GuWorld and the Sandbox:
  - provider with mergeConfigFrom, registerConnection (sqlite file, :memory: in tests, or <db>_<name>), loadMigrationsFrom, loadViewsFrom, web route, api prefix behind auth.api, migrate/migrate:fresh hooks
  - <Name>Database helper
  - config with connection, database env and back_url env
  - blade shell with <html lang>, data-back-url and a <script type=application/json> settings block
  - client api.ts (bearer 'auth_token', goToLogin on 401, keepalive)
  - client i18n.ts keyed on <html lang>
  - vitest config with cacheDir in node_modules/.vite/<name> and an npm test:<name> script
- The Sandbox's hub integration: playtimeBeat() to /api/games/<slug>/playtime, and its own LeaderboardController with index plus summary in the hub's shapes, with names via config('auth.providers.users.model').
- Test suites to port by renaming endpoints: EpochsWorldTest scenarios (guests 401, create/load round-trip, 409 second create, delta sync, stale revision, ownership isolation, delete cascade, tables only on the module DB) and GuWorldSaveTest scenarios (own page without the SPA root, settings JSON present, strict validation dataset, 413 size cap, throttle).
