# sim-core (engine/sim/game.ts, engine/sim/state.ts, engine/core/*.ts + world.json/epochs.json/resources.json fields the sim reads)

## Summary
Game (engine/sim/game.ts:96) is a single facade class that holds the saved WorldState plus derived state: the WorldMap, a Map of BuildingState by uid, a per-building BuildingStatus, connectedRoads, Stats and tech Bonuses. It exposes queries, player actions and tick(). The UI drives it with a fixed-step accumulator in EpochsGame.tsx:410-420: frame dt (max 0.1 s) times speed (0/1/2/5, plus 20/50 for testers) is added up, and game.tick(1) runs once per accumulated game second. world.time.tickSeconds is never read. Offline catch-up calls tick(1, true) up to 3600 times (serializer.ts:311-342). Random events are skipped while quiet, but their timer still advances.

Each tick (game.ts:1321-1378) does: time += dt; year += epoch.yearsPerDay*dt/secondsPerDay, clamped to nextEpoch.year-1; expire moods; weather; detect finished construction; research; recalculate() if the structure is dirty; updateEconomy(dt); updatePopulation(dt); updateGoals; random event; NPC think; revision++.

The calendar is not derived from time. state.year is a separately stored float with three faults: (a) its speed changes per era (yearsPerDay 100,45,25,8,7,7,12,12,25,20), (b) it freezes at nextEra.year-1 (999, 1499, …) until the player advances, and (c) advanceEpoch() (game.ts:1302-1317) and testerNextEpoch() (game.ts:2260-2270) set state.year = newEpoch.year, so the year jumps by up to a whole era. The splash in ui/epoch.tsx:289-301 then animates the count-up. Seasons come from time alone: daysPerSeason=1 and secondsPerDay=240, so one 4-season cycle is 960 s. That is fully decoupled from the year: in e0 one season cycle equals 400 'years'.

Economy (updateEconomy, game.ts:1817-2005):
- Only complete and road-connected buildings count.
- Employment is one global ratio: min(1, pop*0.6/Σjobs). Power is one global ratio: min(1, Σpower/ΣpowerUse).
- Each building's inputs are taken first, with efficiency scaled down when stock is short. Outputs are (base + nearFeatureBonus)*(1+boost)*(1+techs%+policy%)*seasonal*efficiency.
- Tax is pop*0.02*(0.5+happiness/100)*(1+tech.tax%) gold/s. Food eaten is pop*0.04/s.
- Every capped resource is clamped to one shared storage value: (300+Σstorage)*(1+tech.storage%). Gold and knowledge are uncapped.
- There is no upkeep, no price and no demand, so money only grows.

Population (game.ts:2007-2040) grows logistically toward housing when happiness ≥ 40, stagnates between 25 and 40, and declines when starving, unhappy or overcrowded. Happiness is per home: 45 + min(aura,55) + policy − pollution − cold(8) + tech − power penalty, then a housing-weighted city average, plus moods, minus 25 if starving, clamped to 0..100.

Territory (game.ts:298-320) is a square of half-size epochs[i].territory (8,10,12,14,17,20,23,27,31,35) centred on the 72x72 map centre. It grows only when the era advances. Placement and clearing are gated by inTerritory(). Era advance needs epochChecklist(): population, buildings (type/count/level), techs and a paid cost. It then opens new levels, techs, resources, goals and events all at once. At the same moment the sky/UI theme/ambience switch (palette by state.epoch), all NPC residents are re-dressed and vehicles reset (npcs.ts:273-288), and the territory border jumps.

Maps are random: Game.create uses a Math.random seed (game.ts:147-150), and world.json map.seed is ignored. The start town centre is put at the map centre. Trees and rocks are both placement blockers (canPlace, game.ts:837-842) and production inputs (effects.near for lumber, quarry, mine and coal_mine).

## Files
- D:\www\P1\resources\games\src\epochs\engine\sim\game.ts (2286): Game class. Queries: epoch, palette, season, weather, center, bureau, def/levelDef/effects, isComplete, count, territory(epoch) 298-314, inTerritory 316-320, visibleResources 323-329. Prices: levelLock 334, lockReason 361, buildCost 377, upgradeCost 395-414 (upgradeShare 0.7), buildTime 416-420 (×max(0.2,1-buildSpeed%)), moveCost 422-434 (gold hard-coded), canAfford/missing. Looks: paletteOf, lookKey. Districts: districtAt 540-562 (radius 7). Techs: techLock, researchTime 588-590. Goals: goalProgress 609-674, openGoals. Era: epochChecklist 694-743, canAdvance 745, score 751-765. Placement: around 770, countFeatureNear 789-805, canPlace 807-876 (bounds+territory, biome.buildable/overWater, placement.biomes, feature blocker, occupant, nearWater). Actions: place 880, upgrade 932, relevel 1002 (road over older road), upgradeAll 1042, demolish 1066 (refundShare 0.5 of current level cost), move 1103, clear 1148 (cut tree/rock/reeds), research 1185, unlockBlueprint, setStyle, setDistrict, advanceEpoch 1302-1317. Sim: tick 1321-1378. Internals: collectBonuses 1399, pay 1442 (floors 0), gain 1455 (clamps), addBuilding/removeBuilding/occupy, structureChanged 1550, isConnected 1574-1614, findConnectedRoads 1616-1662 (BFS from roots), recalculate 1669-1790 (O(B²) boost/pollution/aura), housingOf 1801, updateEconomy 1817-2005, updatePopulation 2007-2040, updateResearch 2042, updateGoals 2071, clampToCaps 2102, updateWeather 2113, randomEvent 2139-2205. Tester tools 2210-2270.
- D:\www\P1\resources\games\src\epochs\engine\sim\state.ts (94): Saved shapes: WorldState (seed,width,height,epoch index,year,time,resources,population,weather,weatherUntil,nextEventAt,moods,nextUid,techs,research,blueprints,achievements,stats), BuildingState (uid,type,x,y,level,buildStart,buildEnd,style,district), BuildingStyle, NpcState, Mood, Research, ActionResult.
- D:\www\P1\resources\games\src\epochs\engine\core\clock.ts (90): Clock: secondsPerDay (world.time, 240), timeOfDay, day, season (floor(day/daysPerSeason)%4), seasonProgress, clockText, light() from climate.dayNight keyframes. Pure functions of state.time. Does NOT compute the year.
- D:\www\P1\resources\games\src\epochs\engine\core\events.ts (62): Typed EventBus and GameEvent union (toast, built, placed, upgraded, removed, cleared, epoch, researched, achievement, restyled, season, weather, sound, error). Sim emits; renderer/audio/UI listen.
- D:\www\P1\resources\games\src\epochs\engine\core\random.ts (52): mulberry32 seeded RNG, hash2 (stable per-building look noise), pick, between, weighted. Game rng = mulberry32(state.seed ^ floor(time)) (game.ts:132), reseeded on every load.
- D:\www\P1\resources\games\src\epochs\engine\core\noise.ts (42): valueNoise/fractalNoise used only by world/generator.ts for random maps. Not needed for a fixed authored map.
- D:\www\P1\resources\games\content\epochs\world.json (215): map {width 72,height 72,seed null (ignored)}; time {secondsPerDay 240, daysPerSeason 1, tickSeconds 1 (unused), maxOfflineSeconds 3600}; start {epoch e0, population 6, resources food120 wood150 stone60 gold80 knowledge0, buildings [town_center L1 at 'center']}; population {foodPerPerson .04, workforceShare .6, growthRate .03, taxPerPerson .02, baseHappiness 45, starvingPenalty 25, noPowerPenalty 20, coldPenalty 8, starvingDecline .003, unhappyDecline .002, overcrowdingDecline .1}; economy {storageBase 300, refundShare .5, upgradeShare .7, moveCostPerTile 6, clearFeature tree/rock/reeds}; districts {radius 7, 5 policies}; npc limits; events {firstAfter 200, every [120,220], 18 events incl. e2300+ ones}.
- D:\www\P1\resources\games\content\epochs\epochs.json (386): 10 eras e0,e1000,e1500,e1800,e1900,e2000,e2100,e2300,e2500,e3000. Sim uses: year (era start, also jump target), yearsPerDay (100,45,25,8,7,7,12,12,25,20), territory half-size (8..35), next {population, buildings[{type,count,level?}], techs[], cost{}} (e2100.next requires big_data/composites/robotics), palette (incl. roadStyle dirt/cobble/paved/asphalt/smart/glow), theme, ambience.
- D:\www\P1\resources\games\content\epochs\resources.json (27): 22 resources {id,name,icon,epoch,capped,description}. Uncapped: gold, knowledge. Capped: food wood stone iron tools bricks glass coal steel concrete oil plastic electronics data composites rare_metals hydrogen ai_cores nanomaterials antimatter. HUD shows all visible ones (ui/hud.tsx:101+).
- D:\www\P1\resources\games\src\epochs\engine\save\serializer.ts (342): Coupled: WorldPayload (year floored), full tile dump on create (167), dirty tiles on sync, fromServer rebuilds Game, catchUp() 311-342 (ticks quietly ≤3600 s, reports gold delta: gold hard-coded).
- D:\www\P1\resources\games\src\epochs\engine\content\registry.ts (666): Coupled: Content lookups (epoch(i) clamps index, epochOrder, level(def,n) clamps, levelPalette = level's era palette, emptyAmounts). validateContent enforces map 16..256, unique building role (554-563), building size 1..4 (566-573), ascending era years.
- D:\www\P1\resources\games\src\epochs\engine\content\types.ts (991): Coupled: WorldFile 11-72, DistrictPolicyDef 74-94, GameEventDef 96-106, ResourceDef 108-116, EpochDef 233-249, TechBonus 252-264, GoalCondition 313-324, Effects 826-845, LevelDef 847-870, BuildingDef 883-910.

## Key data structures
WorldState { seed:number; width:number; height:number; epoch:number /*index*/; year:number /*float, stored, NOT derived*/; time:number /*game s since founding*/; resources:Record<id,number>; population:number /*float*/; weather:string; weatherUntil:number; nextEventAt:number; moods:{until,amount,reason}[]; nextUid:number; techs:string[]; research:{id,start,end}|null; blueprints:string[]; achievements:string[]; stats:{built,upgraded,demolished,events} }
BuildingState { uid; type; x; y; level; buildStart; buildEnd; style:{blueprint:string|null; colors:Record<string,string>}|null; district:{name; policy:string|null}|null }
BuildingStatus (derived) { complete; connected; efficiency; starved:string|null; noPower; nearbyFeatures; boost; fertility; happiness:number|null; pollution; residents; workers; district:uid|null; output:Amounts; input:Amounts }
Stats (derived each tick) { rates:Amounts /*per s*/; caps:Amounts; housing; jobs; workers; employment; powerSupply; powerDemand; defense /*unused*/; happiness; starving; tourism }
Bonuses { produces:Record<id|'*',pct>; happiness; housing; storage; buildSpeed; tax; research }
EpochDef { id; year; name; tagline; yearsPerDay; territory /*half-size*/; palette:{...,road,roadEdge,roadMark,roadStyle:'dirt'|'cobble'|'paved'|'asphalt'|'smart'|'glow',sky}; theme; ambience; next:{population; buildings:{type,count,level?}[]; techs:string[]; cost:Amounts}|null }
Effects { housing; jobs; produces:Amounts; consumes:Amounts; storage; power; powerUse; aura:{radius,happiness}|null; pollution:{radius,amount}|null; boost:{targets[],radius,percent}|null; near:{feature:'tree'|'rock'|'reeds',radius,perTile,max}|null; seasonal:boolean; defense }
LevelDef { level; name; epoch; tech?; cost; upgrade?; buildTime; effects; model }
BuildingDef { id; category; size:{w,h} /*1..4*/; unique; hidden; role?:'road'|'center'|'district'|'bureau' /*each role unique*/; placement:{requiresRoad; biomes?; nearWater?; overWater?}; sounds; levels[] }
WorldFile.population/economy: see world.json.
FORMULAS (dt=1 game s):
year' = min((epochs[e+1]?.year ?? 3999) - 1, year + yearsPerDay_e*dt/240)   // game.ts:1326-1330
advanceEpoch: year = epochs[e+1].year                                       // game.ts:1311
employment = jobs>0 ? min(1, pop*0.6/Σjobs) : 1 ; powerRatio = min(1, Σpower/ΣpowerUse)
eff_b = (jobs?employment:1)*(powerUse?powerRatio:1); for each input r: if stock<amt*eff*dt: eff*=stock/need
out_r = (amt + min(near.max, nFeatures*near.perTile)) * (1+Σboost%/100) * max(0,1+(tech[r]+tech['*']+policy[r]+policy['*'])/100) * (seasonal? season.fert*weather.fert*avgBiomeFert : 1) * eff
tourism gold/s = policy.tourism(0.02) * (eraIndex - levelEra) per non-road building in a 'historic' district
tax gold/s = pop*0.02*(0.5 + prevHappiness/100)*(1+Σtech.tax/100) ; food -= pop*0.04*dt
cap(capped r) = (300 + Σeffects.storage of active)*(1+Σtech.storage/100)  (same number for each capped resource)
home happiness = 45 + min(Σaura in radius,55) + policy.happiness - Σpollution*(1+srcPolicy.pollution/100) - (winter?8:0) + Σtech.happiness - (powerUse?(1-powerRatio)*20:0)
city happiness = clamp0..100(housingWeightedAvg (or 55 if no homes) + Σmoods - (starving?25:0))
pop: if pop>H: pop=max(H, pop - max(0.2,(pop-H)*0.1)); elif starving: pop*=1-0.003; elif hap<25: pop*=1-0.002; elif hap>=40: pop=min(H, pop + (H-pop)*0.03*hap/70 + 0.1)
housing H = Σ floor(effects.housing*(1+(tech.housing+policy.housing)/100))
score = pop + 10*Σ(non-road levels) + 1000*eraIndex + 50*techs + 100*achievements

## Couplings
Within the epochs folder:
- content/registry.ts + content/types.ts: every number comes from the content bundle. Validator limits: building size ≤4 (registry.ts:566-573), unique role (554-563), map 16..256 (259-270).
- world/generator.ts (random noise map, lakes/river, clearRadius 6, ensureStartingResources trees/rocks) and world/world-map.ts (Uint8 biome/elevation/feature, Int32 occupant: ONE occupant per tile, dirty set, isOpenWater, toRows).
- sim/npcs.ts: constructed by Game. think() runs every tick. onEpochChanged re-dresses every resident and clears vehicles (npcs.ts:273-288). onBuildingRemoved. Uses game.random(), game.stats.
- save/serializer.ts: WorldPayload mirrors WorldState. Full tiles are sent on create. catchUp ticks quietly and reads gold.
- EpochsGame.tsx: game loop (410-420), speed state (95,114,170), Game.create without seed (300), the 'epoch' event triggers splash + save (381-385).
- ui/hud.tsx: year at 54, all visibleResources at 101+, speed buttons 168-190. ui/epoch.tsx: checklist, year count-up splash 289-301, territory size label 90, tourism 235. ui/build.tsx:227 shows the era year per level. ui/research.tsx, ui/inspector.tsx, ui/bureau.tsx, ui/common.tsx.
- scene/terrain.ts: territory grid/borders and the next-era border preview at 472, 644, 688-691. scene/roads.ts, buildings.ts, people.ts, overlays.ts, sky.ts and features.ts read state, palette and events.
- workshop/previews.tsx:336, 572: territory and yearsPerDay display.

Server side (app/Games/Epochs):
- Http/Requests/WorldPayloadRules.php: seed 0..2^32-1 required, width/height 16..256, year 0..9999, epoch must be in epochs.json, buildings ≤6000, x/y ≤255, level ≤60. Tile rows are validated by hand.
- Content/ContentValidator.php: role uniqueness 58-75, map size 91-94, building size ≤4 at 374-378.
- WorldStore.php columns (seed, width, height, epoch, epoch_index, year, time, population, happiness, score, …).
- Models/World.php, Database/Factories/WorldFactory.php (year 0, inEpoch(...)).
- Tests: tests/Feature/Games/EpochsContentTest.php, EpochsWorldTest.php.

Strings: all sim strings (fail reasons, toasts, district names game.ts:1474-1497) are hard-coded Russian. There is no i18n layer.

## Requirement impact
### R1 [moderate]
Game.create (game.ts:147-196):
- Drop the Math.random seed (149) and generateMap(content, seed) (152). Use a deterministic authored layout instead: rows from the top are mountain band (unbuildable), 40 playable rows, ~20 sand rows, then water. world.json map.seed is ignored today.
- Keep a constant seed (e.g. 0) only for the weather/event/NPC rng (game.ts:132). The server still requires world.seed (WorldPayloadRules.php).
- start.at 'center' (181-187) uses the WHOLE map centre. It must use the playable strip centre (x≈49, y = playTop+19 for the 2x2 town hall).

Territory:
- Replace territory(epoch) (game.ts:298-314), a square radius from epochs.json `territory`, with a persisted horizontal range, e.g. WorldState.unlocked {minX,maxX} (state.ts:22-51). y stays fixed at [playTop, playTop+39]. Start with 30 columns centred (35..64 for width 100).
- Add an action expand('left'|'right', columns) with a cost curve. It must be decoupled from era advance.
- Keep inTerritory (316-320), which canPlace (812) and clear (1151) use.
- Update everything that calls territory(epoch+1) for the next-era preview: scene/terrain.ts:688-691, ui/epoch.tsx:90, workshop/previews.tsx:336.
- Remove `territory` from EpochDef (types.ts:239) and epochs.json.

Persistence:
- Because the map is identical for all players, tiles do not need to be stored or sent. Remove tiles from toCreatePayload (serializer.ts:167) and from the server, or send only diffs.
- WorldPayloadRules width/height ≤256 is fine for 100 x ~100.
- Add server columns for the unlocked range.

### R2 [trivial]
The sim already separates map.inBounds from inTerritory. The map array can be larger than the playable zone (mountain band, sand, water and side margins), and canPlace rejects anything outside the territory (game.ts:812).

Sim-side work:
- Keep the visual horizon outside the map arrays (renderer).
- Or make the non-playable margins part of the map with unbuildable biomes.

The floating-slab look comes from scene/terrain.ts (the `skirt` mesh around terrain.ts:640). That is a renderer change, not a sim change.

### R3 [moderate]
Remove trees/rocks/reeds from the sim:
- the feature blocker in canPlace (game.ts:837-842)
- clear() (1147-1183) and world.economy.clearFeature (world.json:19-32)
- countFeatureNear (789-805) and BuildingStatus.nearbyFeatures (recalculate 1767-1776)
- the near bonus in production (1905-1910) and Effects.near (types.ts:837-842)
- generator features and ensureStartingResources

lumber depends on trees. quarry, mine and coal_mine depend on rock via effects.near. Replace that with a placement rule such as placement.touches:'mountain' (or nearBiome:{id,radius}), modelled on the nearWater scan (game.ts:852-873). around() checks map.inBounds, not territory, so a mountain band just outside the playable rows is detected correctly. A production bonus could come from the number of mountain tiles touched.

Wood needs a new source, since there are no trees (tree plantation building, or wood dropped after the early eras).

Biomes: sand = 'beach' (buildable, fertility 0.3); water = 'water' (isOpenWater, so fisheries/ports pass nearWater and roads pass overWater). Mountain must be in-bounds but outside the territory.

### R4 [moderate]
How roads work today:
- Roads are one BuildingDef with role 'road' (buildings/road.json: 9 levels, 1x1, overWater, effects empty).
- isRoad (game.ts:273-277) and findConnectedRoads (1616-1662) do a 4-neighbour BFS from tiles next to the centre/district halls.
- isConnected (1574-1614) requires an orthogonally adjacent connected road.
- relevel (1002-1039) upgrades an old road when a new one is laid over it.
- The look is the level's era palette.roadStyle (types.ts:189-211). That is why each era is only a colour/style swap.

Changes for multi-lane avenues:
- Either keep one 'road' def with more levels and a `lanes`/`profile` field (sidewalk, median, decor) that the renderer reads,
- or add separate road classes. Separate classes need the role-uniqueness rule relaxed (registry.ts:554-563, ContentValidator.php:58-75) or a `network:'road'` field instead of role, plus isRoad changed to test that field.
- Footprints wider than 1 tile still work with the occupant-based BFS (isRoad uses map.occupant per tile). But isConnected for a road checks only its top-left tile (1578-1580).

Give road levels real effects: aura happiness for planters/lamps, and capacity or land value if R8 adds traffic.

### R5 [hard]
Prune content to ≤2100: drop eras e2300/e2500/e3000 (epochs.json; set e2100.next=null).
- Buildings to drop: ai_foundry, antimatter_collider, electrolyzer, fusion_reactor, nanofab, spaceport.
- 38 of 205 levels in kept buildings must be trimmed (road levels 8-9; town_center 9-11, …).
- Also 21 techs, 15 goals, 8 of 26 blueprints.
- Resources rare_metals, hydrogen, ai_cores, nanomaterials, antimatter.
- World events: meteor, solar_flare, ai_glitch, nano_bloom; blackout lists e2300.

New transport (sim):
- Rail and metro need their own networks. Generalise connectedRoads (game.ts:104, 1616-1662) to per-network sets plus station nodes.
- WorldMap has a single Int32 occupant per tile (world-map.ts). An underground metro under roads/buildings needs a second layer (e.g. map.underground Int32Array) and a canPlace variant.
- The airport needs a footprint larger than 4x4. Relax registry.ts:566-573 and ContentValidator.php:374-378 (also max x/y 255 in WorldPayloadRules).
- Optionally add new Effects (tourism, trade capacity, commuter capacity) handled in updateEconomy.

### R6 [moderate]
Remove the jumps:
- Delete `this.state.year = this.epoch.year` at game.ts:1311 and 2266.
- Delete the clamp `min(nextEpoch.year-1, …)` and the per-era rate in tick (game.ts:1326-1330).
- Remove EpochDef.yearsPerDay (types.ts:238, epochs.json) and the count-up splash (ui/epoch.tsx:289-301).

Make the year derived: year = world.time.startYear + state.time / (secondsPerDay*daysPerYear). The speed buttons multiply game dt, so speeding up stays the only way to go faster. Keep `year` in WorldPayload for the server (serializer.ts:104; server cap 9999).

The maths (240 s/day, 1 day per season): with a season-aligned year of 4 days, 1 year = 960 s at 1x, so 300 years (1800→2100) take 80 h at 1x or 16 h at x5. Starting at year 0 is unplayable at a constant rate. Choose a later start year, or make eras independent of the calendar.

Staggered era change, so not everything switches at once:
- Palette/theme/sky is keyed to state.epoch (game.ts:205-207). Blend it over time.
- npcs.onEpochChanged (npcs.ts:273-288) re-dresses all residents and clears vehicles in one step. Switch NPCs gradually on respawn.
- Territory no longer grows with the era (see R1).
- Content unlocks could be staged by year or tech rather than all at once at the era index (levelLock 334-352, techLock 566-586, visibleResources 323-329, goals 677-690, events 2142-2146).

### R7 [moderate]
gold is the de-facto currency, hard-coded in:
- moveCost (game.ts:427)
- tourism (1939-1945)
- tax (1984-1993)
- catchUp (serializer.ts:330, 340)
- events: caravan, merchant_fleet, gold_rush, stock_crash in world.json
- clearFeature costs

In content, gold is in 191 level costs, 35 producers, 38 goal rewards and 4 tech costs.

knowledge is a second uncapped pseudo-currency: 77 tech costs, 31 producers.

Changes:
- Rename it to one resource id (e.g. 'money') and mark it with ResourceDef.kind:'currency' (types.ts:108-116). Give each era its own display { name, icon, symbol } in epochs.json: coins, banknotes, cards, digital. This is presentation only, with no conversion and no state change.
- Turn knowledge into research points, or keep it as a non-HUD resource.
- Collapse the 22 resources to about 8-10 goods for ≤2100 (e.g. food, wood, stone, metal, building materials, fuel/energy, goods, electronics).
- The HUD (ui/hud.tsx:101+) renders every visibleResource. v3 shows only the currency, with goods in a storage panel.
- Replace the hard-coded 'gold'/'food' ids in game.ts with world.json-configured ids (e.g. world.economy.currency, world.population.foodResource).

### R8 [hard]
Today the economy is linear and closed:
- no upkeep (money only accumulates)
- tax linear in population
- one global employment ratio and one global power ratio (game.ts:1861-1868)
- no demand, prices or trade
- one shared storage number for every good (1825-1859)
- order-dependent consumption: buildings in uid order consume before later ones produce in the same tick (1870-1932)
- tax uses the previous tick's happiness (1987)

A deep v3 economy needs a rewrite of updateEconomy (1817-2005), updatePopulation (2007-2040) and recalculate (1669-1790). It also needs new Effects fields (types.ts:826-845) such as upkeep, landValue, demand and transport capacity, and new world.json parameters (types.ts:33-55).

Two-phase settlement fixes the order bug: first collect supply and demand, then allocate proportionally.

Ideas to plan:
- RCI zone demand
- land value from services, pollution and transport
- tax-rate slider with happiness elasticity
- per-building upkeep in the era currency
- goods sold at supply/demand prices via market/port/rail/airport
- loans and interest
- commute capacity per network

Keep the per-second rates (stats.rates) for UI forecasts.

### R9 [moderate]
The sim is mostly UI-agnostic: EventBus, a revision counter, ActionResult with reasons, and Stats for the HUD. For the new UI:
- Move the hard-coded Russian strings (game.ts:338-350, 362-371, 385-392, 813-871, 1076, 1107, 1152-1156, 1253-1266, 1306, toasts at 1336, 2065, 2095, district names 1475-1488) into content/i18n.
- Add compact selectors (hudSummary, mainCurrency).

Mobile performance matters:
- recalculate is O(B²) over all buildings including every road tile.
- updateGoals runs every tick and calls count() per goal (O(goals×B)).
- catchUp runs up to 3600 such ticks on load.

All three need indexing (spatial grid for aura/boost/pollution, cached counts by type/level) before a 100-wide city on phones.

## Risks
Map and territory:
- territory() assumes a square box centred on floor(width/2), floor(height/2) with a symmetric radius (game.ts:298-314). The start building at 'center' also uses the whole map centre (181-187). Both are wrong for a 100-wide strip with a mountain band above and sand/water below.
- Game.create ignores world.map.seed (random seed at game.ts:149). Rng reseeds from seed^time on load (132), so events are only reproducible per save.

Year and era:
- state.year is stored separately (state.ts:28) and only increments. The server caps it at 9999 (WorldPayloadRules).
- Many systems key off the era index: palette, NPC types, events, goals, tourism age, heritage goals, score (+1000/era). Removing eras (e2300+) breaks old saves: epoch id not in Rule::in, techs/blueprints filtered on load (serializer.ts:237-239).
- The splash and HUD assume the year jumps.

Validator and data limits:
- Validator limits block v3 content: building size ≤4 (no airport/rail yard), one building per role (no separate avenue/rail/metro roles), x/y ≤255, ≤6000 buildings per sync. Roads are buildings: one per tile.
- WorldMap has one occupant per tile, so metro under roads or rail over roads needs a new layer.

Performance (100 x ~100 map on mobile):
- recalculate() is O(B²) across all buildings, including roads, on every structural change: place/upgrade/finish/research.
- updateGoals is O(goals×B) every tick; catchUp is ≤3600 ticks.
- isConnected/around allocate generator tuples.
- The full tile dump on world create is ~10k rows with no compression.
- At B≈2000 this is millions of ops per change, plus hundreds of millions in a catch-up.

Economy behaviour:
- Global employment and power ratios starve every building equally; there is no prioritisation.
- Consumption is order-dependent.
- Goal rewards in capped resources are clamped away (gain→clampToCaps).
- Event gains below 1 on uncapped resources use 1000 as the base. Gains of 1 or more are multiplied by (1+eraIndex).
- Random events are silently skipped offline.
- Stats.defense is computed but never used; world.time.tickSeconds is unused.
- The tester 'infinite' flag bypasses pay/canAfford.

Seasons: one season equals one day (240 s). If v3 aligns calendar years to seasons, the current day/season pacing must be re-tuned against the constant year rate.

## Reusable
Keep these:
- Clock (pure time → day/season/light), EventBus and the GameEvent union, mulberry32/hash2/weighted/between.
- The data-driven Content and validateContent pattern, mirrored server-side.
- The minimal persisted BuildingState (type/pos/level/style/district; everything else derived).
- The structureDirty/recalculate vs per-tick updateEconomy split.
- changedBuildings/deletedBuildings/dirty delta sync with restoreChanges.
- The action API with ActionResult (place/upgrade/relevel/upgradeAll/demolish/move/research/setStyle/setDistrict) and levelLock/upgradeBlock/lockReason gating.
- The upgrade-cost share and refund share.
- Tech Bonuses aggregation (collectBonuses).
- District policies (as an economy lever).
- Goals with typed conditions (goalProgress/openGoals/updateGoals).
- Road connectivity BFS from roots (generalisable to multiple networks).
- canPlace with nearWater/overWater adjacency scans (template for 'touches mountain').
- The fixed-step accumulator loop with a speed multiplier.
- The catchUp concept, capped and quiet.
- Tester tools (infinite, finish, researchAll, nextEpoch).
- Stats.rates per second for UI forecasts.
- The header principle (game.ts:7-9) that buildings keep their level/look when an era begins. Roads and buildings never change by themselves; only the year, territory, NPCs and theme do, and v3 must stagger those.
