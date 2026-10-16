# roads-traffic (roads, bridges, street lamps, traffic, pedestrians, pathfinding, glow/particle FX)

## Summary
Roads are not a tile layer. Each road tile is an ordinary 1x1 building: a `BuildingState` with `type:'road'`, and its building def has `role:'road'`. It is stored in `WorldMap.occupant` (Int32Array of uids), saved as a row in the epochs buildings table (serializer.ts:134-144), and recognised by `Game.isRoad(index)`, which looks up occupant -> building -> def.role (game.ts:273-277). road.json has 9 levels, e0..e2500. Every level has all-zero `effects`. The only differences between levels are cost and look, because `paletteOf()` -> `content.levelPalette(level)` returns the palette of the level's **era** (registry.ts:140-142), and that palette carries `road`, `roadEdge`, `roadMark` and `roadStyle` ('dirt'|'cobble'|'paved'|'asphalt'|'smart'|'glow') in epochs.json (types.ts:189-211). So the "era style" is just a level->era->palette colour lookup.

Connectivity is a BFS in `Game.findConnectedRoads()` (game.ts:1616-1662). It starts from road tiles touching a root building (role 'center' or 'district', `isRoot` game.ts:1568-1572) and fills `Game.connectedRoads: Set<number>`. A building counts as connected if a side-adjacent (not diagonal) tile is a connected road or a root (`isConnected` game.ts:1574-1614). For the economy this is binary: `updateEconomy` skips every building whose status is not connected, so it gets no housing, jobs, production or power (game.ts:1842). NPC homes and jobs also require connected buildings (npcs.ts:307, 381). Road level, length, capacity and traffic have **no** economic effect. Roads have no upkeep and are excluded from the score (game.ts:755).

Rendering is done by `scene/roads.ts` `Roads`. `sync()` (roads.ts:231-261) hashes every map tile every 0.25 s (renderer.ts:348-354) and does a full `rebuild()` (263-449) when anything changes. The rebuild:
- builds a road mask and marks bridge decks: road tiles on open water plus their road neighbours, passed to `terrain.setDecks` (283-303);
- per tile, gets the palette, computes the NESW `near[]` and draws two inset shapes. `shape()` (616-661) is a centre square plus arms toward neighbours plus corner fills when the diagonal is also road. There is no explicit junction/curve typing; corners are square L-shapes;
- uses `Layer` (71-141), which collects non-indexed, vertex-coloured, terrain-draped quads (subdivided 2x2 when wider than 0.36);
- adds cobble specks (358-369) and a centre dash only on tiles with at most 2 links (no markings at junctions, 382-420), plus glowing edge lines for smart/glow (422-424) and a red marker on unconnected tiles (427-436);
- picks lamp spots on 28% of connected non-dirt tiles by hash (438-440). `buildLamps` (696-766) places one pole plus sphere per spot on a side with no road, as InstancedMeshes, and fills `lamps[]`, which renderer.ts:395-427 turns into static glow sprites;
- builds bridges in `buildBridges` (452-608): instanced boxes for deck, piles and railings, with timber/stone/modern looks from `BRIDGE_LOOKS` (28-59).

Traffic lives in `NpcSystem.driveTraffic` (npcs.ts:528-614). It is not saved. The target count is min(`maxTraffic` 36, connectedRoads / `trafficPerRoads` 6). Vehicles spawn on a random connected tile and random-walk tile to tile without reversing (except at dead ends). `v.p` advances by `type.speed*dt`. The lane offset is a fixed ±0.14 perpendicular (609-610), which in this camera convention is left-hand traffic. The `lane` field is never used. There are no junction rules, no collisions and no destinations. `People.updateVehicles` (people.ts:626-729) interpolates the position, snaps heading and offset at turns, draws per-kind InstancedMesh pools (cart/car/bus/hover/drone geometry from `vehicleGeometry`, people.ts:88-263) and pushes headlight and taillight glows into the dynamic `GlowLayer`.

Pedestrians are real residents (`NpcState`):
- one per 5 population, max 160 (world.json:80);
- they follow the npcs.json schedule in `think()` (79-145), with at most 6 A* plans per tick (`PATHS_PER_TICK`);
- `headTo` (438-476) uses `findPath` and teleports the resident when the target is unreachable;
- they walk along tile **centres**, i.e. in the middle of the road where cars drive, with a cosmetic 1.3x speed on roads (148-191);
- they are rendered as instanced figures in people.ts:502-624.

Pathfinding (`findPath`, pathfinding.ts:110-183) is a 4-neighbour A* using a MinHeap and Maps (maxNodes 6000). Costs: roads 0.4, building tiles are walls except the home/target footprints, water and mountains are walls, otherwise 1/biome.speed plus tree/rock penalties (86-108).

fx.ts is generic: `GlowLayer` (additive point sprites for lamps, headlights and model lights) and `Particles` (CPU smoke, steam, dust, water, sparks, confetti).

On the input side (EpochsGame.tsx):
- `R` selects the newest available road level (506-515);
- a drag builds an L-shaped path, x then y (631-668);
- `buildRoad` places each tile, or calls `relevel()` to upgrade an older road underneath (828-865, game.ts:1002-1039);
- each `place()` calls `structureChanged()`, which runs a full `recalculate()` plus `updateEconomy`.

There is no metro, rail or airport anywhere. The nearest existing things are spaceport (3x3, e2300+), the helipad model part, and the xray toggle (materials.ts:253-268), which could serve as an underground view.

## Files
- resources/games/src/epochs/scene/roads.ts (792): Road mesh builder. `Layer` (71-141) makes terrain-draped vertex-colour quads. `Roads.sync()` (231-261) rebuilds when a signature over every tile changes. `rebuild()` (263-449) covers the mask, bridge decks -> terrain.setDecks, per-tile palette style, curb and surface `shape()` (616-661), cobbles, centre dashes (links<=2 only), glow edge lines (`edgeLines` 664-694), the unconnected red marker and lamp spots. Also `buildBridges()` (452-608, BRIDGE_LOOKS 28-59), `buildLamps()` (696-766, InstancedMesh pole+head, `lamps: LampSpot[]`) and `update(night)` (769-774).
- resources/games/src/epochs/scene/people.ts (750): Draws residents and vehicles. `build()` merges vertex-coloured parts. `vehicleGeometry(kind)` (88-263) covers cart/bus/drone/hover/car. `Pool` (265-323) is a growable dynamic InstancedMesh with instance colours. `People.update()` (502-593) draws residents (body/head/hat/halo pools, heading smoothing in `track()` 595-624). `updateVehicles()` (626-729) interpolates nx/ny with lane offset px/py and adds headlight/taillight glows. Exposes `drawn` and `positionOf` for picking.
- resources/games/src/epochs/engine/sim/npcs.ts (615): `NpcSystem`. Residents: `think()` (79-145) handles spawn/leave, `assignJobs`, the schedule and up to 6 path plans per tick. `move(dt)` (148-191) walks the paths, with a 1.3x boost on roads. Also `headTo` (438-476), `stroll` (478-500), `entrance` (397-408, nearest connected road next to a building), and `onEpochChanged` (273-288), which re-types every resident and clears all vehicles at once. Traffic: `Vehicle` interface (16-27) and `driveTraffic` (528-614), a random walk on connectedRoads with a ±0.14 lane offset.
- resources/games/src/epochs/engine/world/pathfinding.ts (183): `MinHeap`, `stepCost()` (86-108: road 0.4, occupied tile = wall unless `allowed`, non-walkable biome = wall, 1/biome.speed plus feature penalties tree 0.8 / rock 2) and `findPath()` (110-183: 4-neighbour A*, Maps for cost/cameFrom, maxNodes 6000, heuristic Manhattan*0.4). Used only by npcs.ts headTo/stroll.
- resources/games/src/epochs/scene/fx.ts (516): `PointBuffer` (52-172) is a growable point-sprite buffer with a custom shader. `GlowLayer` (175-235) draws additive glows for lamps, headlights and model lights. `Particles` (269-516) runs CPU particles: smoke, steam, dust, water, sparks, sparkle, confetti. Generic and road-agnostic.
- resources/games/content/epochs/buildings/road.json (249): The road building: role 'road', size 1x1, placement {requiresRoad:false, overWater:true}. 9 levels: Тропа e0, Мостовая e1000, Брусчатка e1500, Макадам e1800, Асфальт e1900, Магистраль e2000, Смарт-дорога e2100, Маглев e2300, Световая трасса e2500. Costs in gold/stone/bricks/concrete/oil/steel/electronics/composites/rare_metals. All effects are zero and model parts are empty.
- resources/games/content/epochs/epochs.json (386): Per-era palette road fields: road/roadEdge/roadMark/roadStyle/lit (e0 dirt :20-23, e1000 cobble :59-62, e1500 cobble :98-101, e1800 paved :137-140, e1900 asphalt :176-179, e2000 asphalt :215-218, e2100 smart :254-257, e2300 smart :293-296, e2500 glow :332-335, e3000 glow :371-374). It also holds yearsPerDay and territory per era.
- resources/games/content/epochs/npcs.json: Schedule (wake .24/work .3/leisure .66/home .8/jitter .04). 10 resident types, one per era. Traffic types: cart (e1000-e1800, speed .7), car (e1900-e2000, 1.8), bus (e2000-e2100, 1.4), hovercar (e2100-e2500, 2.4), drone (e2500-e3000, 2.8).
- resources/games/content/epochs/world.json: Line 80: npc {residentsPerNpc 5, maxNpcs 160, trafficPerRoads 6, maxTraffic 36}. Line 3: map 72x72, seed null. Start: town_center at 'center'.
- resources/games/src/epochs/engine/sim/game.ts (2286): Road and connectivity logic: `isRoad` (273-277), `territory`/`inTerritory` (298-319, a square around the map centre), `paletteOf`/`lookKey` (460-497), `canPlace` (807-876: overWater bridge 817-818, feature block 837-842), `place` -> structureChanged (880-930), `relevelCost`/`relevel` (981-1039), `advanceEpoch` jumps the year (1311), `tick` clamps the year (1326-1330), `isRoot`/`isConnected`/`findConnectedRoads` (1568-1662), `recalculate` (1669-1790, O(N^2) over all buildings including roads), `updateEconomy` skips unconnected buildings (1842). Roads are excluded from score (755) and from built stats (917).
- resources/games/src/epochs/engine/content/types.ts (960): `RoadStyle` (189-190), `Palette` road fields (197-219), `WorldFile.npc` (61-66), `BuildingDef.role` union 'road'|'center'|'district'|'bureau' (894), `placement` (895-901), `NpcTypeDef` with `vehicle` union (912-923), `FeatureId` (136).
- resources/games/src/epochs/scene/renderer.ts (932): Wiring. attach() creates Roads(game, terrain) and People(game, terrain) (151-211). reflatten -> roads.sync(true) (286-294). frame(): roads.sync every 0.25 s (348-354), roads.update(night) (362), people.update into dynamicGlow (364-367). updateGlow() turns roads.lamps into staticGlow when buildings/roads revision changes (395-427).
- resources/games/src/epochs/EpochsGame.tsx (1632): Road input. Loop calls game.npcs.move(gameDt) every frame (422). 'R' hotkey (506-515). `roadPath()` L-shaped preview with ok flags (631-668). `buildRoad(level)` places tiles or relevels existing ones (828-865). pointerdown starts a road drag with a single finger/left button (886-906), pointerup builds (989-995). Tool hint text (1075-1085).
- resources/games/src/epochs/scene/overlays.ts (744): Road drag preview tiles, green/red (292-302). Hover is hidden while dragging (323-340).
- resources/games/src/epochs/scene/terrain.ts (805): DECK_Y=0 / WATER_Y=-0.1 (17-19). `heightAt` (341-348) is what roads drape on. `setDecks`/`surfaceAt` (351-364) is used by bridges, lamps, people and vehicles.
- resources/games/src/epochs/scene/buildings.ts (708): Skips role 'road' (254). Merges completed buildings per 8x8 chunk keyed by origin tile (CHUNK=8 at 27, 339-341), which matters for big footprints like an airport.
- resources/games/src/epochs/engine/save/serializer.ts (343): Every road tile is a BuildingRow (134-144) in create/sync payloads. Traffic is not saved; residents are saved whole on every sync (196-197).
- app/Games/Epochs/Content/ContentValidator.php: Server-side check that exactly one building has each role and that 'road' and 'center' exist (58-77). Mirrored in registry.ts:659-663.

## Key data structures
// Each road tile is a building
BuildingState { uid; type:'road'; x; y; level; buildStart; buildEnd; style:null; district:null }   // state.ts:59-71, size 1x1
WorldMap { width; height; feature: Uint8Array /*1 tree,2 rock,3 reeds*/; occupant: Int32Array /*uid per tile, single layer*/; dirty:Set<number>; isOpenWater(x,y); inBounds; index(x,y)=y*W+x }
Game.connectedRoads: Set<number>          // tile indices reachable by BFS from center/district roots
BuildingStatus.connected: boolean          // false => building is skipped by the whole economy
// Road look = the era palette of the road LEVEL's epoch (types.ts:197-219)
Palette { road:string; roadEdge:string; roadMark:string|null; roadStyle:'dirt'|'cobble'|'paved'|'asphalt'|'smart'|'glow'; lit:string; ... }
LevelDef { level; name; epoch; description; cost:Amounts; upgrade?:Amounts; buildTime; effects:Effects /*all 0 for roads*/; model:{parts:[]} }
BuildingDef { id; role?:'road'|'center'|'district'|'bureau'; size:{w,h}; placement:{requiresRoad; biomes?; nearWater?; overWater?}; levels[] }
// Rendering internals (roads.ts)
Layer { position:number[]; color:number[]; floor:number /*deck height*/; rect(x0,y0,x1,y1,color,lift) }
BridgeTile { x; y; near:[n,e,s,w]; inset; style; water:boolean }
LampSpot { position:Vector3; color:Color }                  // -> renderer staticGlow
// Traffic (not saved)
Vehicle { type:NpcTypeDef; x; y; nx; ny /*next tile*/; px; py /*lane offset ±0.14*/; p /*0..1 progress*/; color; lane /*unused, always 1*/ }
NpcTypeDef { id; name; role:'resident'|'traffic'; epochs:string[]; speed; body:string[]; skin?; hat?; glow?; vehicle?:'cart'|'car'|'bus'|'hover'|'drone' }
world.npc { residentsPerNpc:5; maxNpcs:160; trafficPerRoads:6; maxTraffic:36 }
// Residents (saved)
NpcState { uid; type; name; age; homeUid; workUid|null; x; y; activity:'home'|'walking'|'working'|'leisure'; goal; offset }
Walk { path: [x,y][]; step }      // in-memory only
PathOptions { isRoad(i):boolean; allowed?:Set<number>; maxNodes?:number /*6000*/ }
// Suggested v3 additions (sketch, not in code)
RoadProfile { lanes; laneWidth; sidewalk; curbHeight; median?:'none'|'paint'|'planter'; markings:{center:'none'|'dashed'|'solid'|'double'; lane:'dashed'|'none'; edge:boolean}; crosswalk:'none'|'zebra'; lamps:{model; spacing; bothSides}; trees?:{spacing}; decor?:string[]; capacity; upkeep }
Network layers: road | rail (surface occupant) + metro (separate under: Int32Array) ; StationDef { network; radius; capacity }

## Couplings
- game.ts (sim facade): isRoad, connectedRoads, isConnected/findConnectedRoads, paletteOf/lookKey (road look), canPlace (territory, overWater bridges, feature block), place/relevel (road drag), recalculate/updateEconomy (connected gate), advanceEpoch -> npcs.onEpochChanged, tick -> npcs.think.
- content registry.ts: levelPalette (140-142), byRole('road') (124-126), npcTypesFor (162-168), role validation (659-663). types.ts: RoadStyle/Palette/NpcTypeDef/WorldFile.npc/BuildingDef.role.
- Content JSON: road.json (levels and costs), epochs.json palette road* and lit fields, npcs.json (resident and traffic types, schedule), world.json npc block.
- scene/terrain.ts: heightAt/surfaceAt/setDecks/DECK_Y (roads drape on the terrain; bridges raise decks; people and vehicles use surfaceAt).
- scene/renderer.ts: owns Roads/People, the sync cadence, staticGlow from lamps, dynamicGlow for headlights, Particles; pickNpc uses people.drawn.
- scene/overlays.ts: road path preview, NPC selection ring via people.positionOf.
- scene/buildings.ts: ignores roads; its chunking matters for station and airport footprints.
- scene/colors.ts: color() cache, hash3 (stable per-tile randomness).
- scene/model.ts treeGeometries (reusable for street trees); materials.ts setXray (possible metro view).
- EpochsGame.tsx: road tool, drag-build, 'R' hotkey, npcs.move in the RAF loop, tool hints (all Russian strings inline, no i18n layer).
- serializer.ts plus server: road tiles are rows in the epochs buildings table (migration 2026_10_06_100000_create_epochs_tables.php, unique world_id+uid). ContentValidator.php requires the 'road' and 'center' roles.
- Nothing in shared/api.ts or i18n is road-specific; gameApi('epochs/...') is the only server coupling.

## Requirement impact
### R1 [moderate]
Roads code is size-agnostic: masks are sized from map.width*height (roads.ts:179, 277-279). But (a) Game.create puts the town hall at map.width/2, map.height/2 (game.ts:181-187); once mountain rows sit above and sand/sea rows below, the centre must be the playable band's centre. (b) territory()/inTerritory() is a square radius (game.ts:298-319) and gates road placement in canPlace (812); it must become an x-range [cx-15, cx+15) x full playable depth that widens left/right. (c) Every player gets the same map, so a fixed starting road spine (e.g. a main avenue through the hall) can be added to world.start.buildings. (d) Traffic density (trafficPerRoads/maxTraffic, npcs.ts:533-538) and maxNpcs should be retuned for about 4000 playable tiles. (e) findPath maxNodes 6000 still covers 100x40.

### R2 [trivial]
Nothing in roads/people. They only drape on terrain.heightAt/surfaceAt. Bridge piles sample heightAt (roads.ts:528); with a flat endless ground and sea this keeps working.

### R3 [trivial]
Remove the feature penalties from stepCost (pathfinding.ts:105-107). Remove the feature block from canPlace (game.ts:837-842) and the clear() path. Decide whether roads may go over the sea: placement.overWater in road.json:11 plus the bridge code in roads.ts:286-303/452-608. Long piers into the sea are probably unwanted, so restrict them to bridges or piers of limited length or drop overWater. Quarries/mines 'against the mountain' need a placement rule like nearWater, e.g. `nearBiome:{mountain:1}`, next to canPlace's nearWater (game.ts:852-873). They also need road access along the top edge, because isConnected wants an orthogonally adjacent connected road (game.ts:1587-1611).

### R4 [hard]
This is a rewrite of roads.ts rebuild(). (1) Decouple the look from the era palette: drop the road/roadEdge/roadMark/roadStyle fields (types.ts:189-211, epochs.json) and give each road LEVEL in road.json a `profile` (lanes, laneWidth, sidewalk width, curb height, median, marking types, crosswalk type, lamp model and spacing, street trees and planters, decor list, capacity, upkeep). (2) Classify each tile by its NESW bitmask (near[] is already computed at roads.ts:324) into end/straight/corner/T/cross. Generate per-piece cross-section geometry: raised sidewalks with real curbs instead of two coplanar layers with polygonOffset (roads.ts:180-194, 355-356); lane dashes, edge lines and medians on straights; zebra crossings and stop lines on the arms of tiles next to a junction (a neighbour with links>=3); rounded curb corners. A canvas-generated marking texture atlas with UVs or an indexed piece cache would keep vertex counts down. Rebuild per 8x8 chunk like buildings.ts:27, not the whole map (roads.ts:263-449). (3) Lamps: replace the single 28%-random pole+sphere (roads.ts:438-440, 696-766) with spacing-based placement on both sidewalks, an arm/cobra-head model and InstancedMesh per model. Street trees can reuse model.ts treeGeometries (as features.ts does). Benches, bins and bus stops are instanced too. (4) Width: either keep 1 road = 1 tile and fit 2/4 lanes inside it (sidewalk ~0.12 + 4x0.17 lanes; shrink car geometry in people.ts:237-261 from 0.12 to about 0.09 wide), or add avenue widths, which needs parallel-tile merging and is much harder. Keeping 1 tile is recommended. (5) Traffic must use real lanes: Vehicle.lane exists but is unused (npcs.ts:26, 563). Offsets come from the profile instead of the constant 0.14 (npcs.ts:609-610). Interpolate the lane offset and heading through turns (people.ts:645-670 currently snap). Choose right-hand traffic (the current offsets give left-hand). (6) Pedestrians: render them on sidewalks, offset perpendicular to heading on road tiles (npcs.ts:166-167 targets tile centres), so they stop walking in the car lanes. (7) Relevel-over-existing (EpochsGame.tsx:828-865) stays as the upgrade path.

### R5 [hard]
Drop road levels 8-9 (road.json:196-247), roadStyle 'glow', the drone vehicle (npcs.json, people.ts:161-199) and the resident types for e2300+. Hover cars stay only if e2100 keeps them.

RAIL:
- Add a new role 'rail' (types.ts:894 union, ContentValidator.php:73, registry.ts:659) with its own mask/auto-tiling renderer cloned from Roads: ballast strip, sleepers as instanced boxes, two rails, curves/switches from the NESW mask, and bridges reusing buildBridges.
- Add a 'rail_station' building (e.g. 4x2) that must sit on a straight track, and a connectivity BFS like findConnectedRoads (game.ts:1616-1662) generalised to N networks.
- Road/rail level crossings cannot share a tile with a single-layer occupant (world-map occupant Int32Array). Either add a combined 'crossing' piece, or give every tile a network bitmask (road|rail) separate from building occupancy. The bitmask is cleaner for v3.
- Trains are transient entities like Vehicle but follow a path through the rail graph, with N carriages following at arc-length offsets (keep a short history of positions), drawn with people.ts Pool and lit with GlowLayer.

METRO:
- Add a second occupant layer `under: Int32Array` (or a metro bitmask) and drag-build tunnels that ignore surface occupancy.
- Show them only in an 'underground' view; materials.setXray (materials.ts:253-268) already fades buildings, and a terrain fade could be added.
- Stations are 1x1/2x1 surface entrances with a service radius, an aura-like coverage used by the economy. Trains are visible only in that view.

AIRPORT:
- A large building (e.g. 12x5, buildings are max 3x3 today). Placement probably near the beach, with planes approaching over the sea.
- Needs new model part kinds 'runway'/'apron' (model.ts parts list, types.ts:376-812) plus terminal and tower.
- Terrain flatten already handles any footprint (terrain.ts:382-403). Chunk merging is by origin tile (buildings.ts:339-341), which is fine.
- Planes: a separate procedural system (spline approach, roll, taxi, take-off, exit off-map) with InstancedMesh, nav-light glows and no pathfinding. orbit.setBounds(width,height) (renderer.ts:196) may need headroom.

### R6 [moderate]
npcs.ts onEpochChanged (273-288) instantly re-types every resident to the new era's type and empties `vehicles`. That is the visible 'everything changes at once'. Instead, pick the resident/vehicle type mix by blending old and new types over the years since the era began, and do not clear traffic. Road looks are already per level, not per current era (game.ts:7-9 comment, paletteOf 460-479), so roads are fine. The year jump itself lives outside this subsystem but nearby: advanceEpoch sets state.year = epoch.year (game.ts:1311); tick uses a per-era yearsPerDay and clamps the year to the next era's start minus 1 (game.ts:1326-1330).

### R7 [trivial]
Road and transit costs in road.json:19-227 use 'gold' plus many resources. Switch to the single main currency id plus a few build resources. Tourism income is hardcoded to resources.gold (game.ts:1941-1945), which affects the economy, not roads. Nothing in roads/people reads currencies.

### R8 [hard]
Today roads only carry a binary 'connected' gate (game.ts:1574-1614, 1842). Level, lanes, traffic and transit do nothing. A thought-through model needs:
- per-tile road upkeep by level (new effects fields: upkeep, capacity);
- commute demand: residents' homes to jobs, computed as shortest paths on the road graph with multi-source Dijkstra over about 4000 tiles, run on structure change rather than per frame;
- traffic load per road tile vs capacity (lanes x per-lane capacity) giving congestion, which lowers worker efficiency/happiness and raises pollution;
- transit modal share: bus stops, metro and rail stations with service radii and capacity remove car trips;
- land value from road class plus station proximity, feeding taxes;
- airport/rail station multipliers for trade/tourism.
Traffic visuals should then come from the computed load (vehicles per tile proportional to flow, npcs.ts:533-538) instead of random density. Watch performance: recalculate() is already O(N^2) over all buildings including roads (game.ts:1714-1752).

### R9 [moderate]
The road tool needs a touch redesign. In EpochsGame.tsx:886-906 any single-pointer down with the road tool starts a drag-build, so the player cannot pan with one finger while building roads. Use tap-start / drag / confirm (a check button) or a two-finger pan. The L-shaped path, x-first then y (631-668), should offer a toggle for the bend direction. A compact network picker (street / avenue / boulevard / rail / metro) replaces the 'R' hotkey (506-515). Hint strings (1075-1085) move into the new compact HUD. Add map overlays (traffic congestion heatmap, transit coverage, unconnected buildings) using the overlays.ts tile mesh helpers (292-302). Picking residents via people.drawn should get a larger touch radius.

## Risks
PERFORMANCE (100x40 on mobile):
- Every road tile is a full building. place() calls structureChanged() -> recalculate() + updateEconomy() for each tile (game.ts:918, 1550-1555). recalculate is O(N^2) over ALL buildings including roads (game.ts:1714-1752), so dragging a 30-tile road with about 1500 buildings costs about 30 x 2.25M distance() calls, a multi-second hitch on phones. Batch placements and exclude roads from the boost/pollution/aura loops, or move roads to a tile network layer.
- Roads.sync() hashes every map tile every 0.25 s via game.isRoad (Map lookups, roads.ts:237-251). A taller v3 map (mountain + 40 + 20 sand + about 30 sea, so about 100x100 tiles) means 10k lookups 4x per second. Acceptable, but a revision counter on the game is better.
- rebuild() regenerates the whole road mesh on any change, using non-indexed quads and JS arrays. Richer avenues (sidewalks, markings, decor) multiply vertices 3-5x, so chunked or instanced piece geometry is needed.
- The two coplanar layers 0.016/0.024 above ground rely on polygonOffset; expect z-fighting on low-precision mobile depth buffers.
- driveTraffic allocates [...connectedRoads] every frame (npcs.ts:532).
- typeOf() is an Array.find per resident per frame (npcs.ts:63-68, used in move and People.update).
- A* uses Maps and object-heap entries; typed arrays are better for mobile.
- Vehicle pools use frustumCulled=false (people.ts:293).
- GlowLayer point sprites can be clamped by the device's max gl_PointSize on some mobile GPUs, so big lamp glows look clipped when zoomed in.

BEHAVIOUR / HIDDEN ASSUMPTIONS:
- Single-layer occupant (Int32Array) means no road+rail crossing and no underground network without a new layer.
- territory() is a square around the map centre (game.ts:298-319), and Game.create centres the town hall on the whole map (181-187). Both are wrong once mountain and sea rows are added.
- Traffic random-walks with no junction logic or collisions. The lane offset snaps sideways and heading snaps at every turn (npcs.ts:609-610, people.ts:645-670). It is left-hand traffic. vehicle.p overshoot is discarded at high game speed (dt is game seconds), so cars stutter at x10.
- Pedestrians walk in the middle of the road. When a target is unreachable, residents teleport (npcs.ts:465-472), which hides broken networks from the player.
- Lamps and cobbles use hash3(x,y) randomness. That is stable, but lamp placement is 28% random, not spacing-based.
- Unconnected roads get a red marker plus darkening (roads.ts:333-336, 427-436) and no traffic.
- The road look is era-palette based, so a new road style means editing every era's palette. Move it to the road level instead.
- road.json has 9 levels up to e2500, and npcs.json traffic types reach e3000. R5 must prune both and the validator must still pass.
- Bridges assume DECK_Y=0 just above WATER_Y=-0.1. A sea-side map lets players build endless piers unless overWater is limited.
- onEpochChanged wipes traffic and re-skins everyone at once (R6).
- No client unit tests exist for roads/npcs/pathfinding. tests/Feature/Games/EpochsWorldTest.php only round-trips a road building row.

## Reusable
- fx.ts as a whole (GlowLayer, Particles, PointBuffer): generic and clean, keep as-is.
- people.ts building blocks: build() vertex-colour merge, Pool (growable dynamic InstancedMesh with instance colours), the vehicleGeometry factory pattern (add tram/train carriage/plane/metro car), the headlight/taillight glow logic and the heading smoothing in track().
- roads.ts pieces: the Layer terrain-draping quad helper, the shape() join-with-neighbours plus diagonal corner-fill idea (a starting point for sidewalks), the whole bridge generator (BRIDGE_LOOKS, piles, railings, terrain.setDecks/surfaceAt contract), lamp InstancedMesh -> LampSpot -> staticGlow pipeline with night update(), and the signature-based lazy rebuild.
- pathfinding.ts: MinHeap plus findPath with PathOptions (isRoad/allowed/maxNodes). Keep the API and swap internals to typed arrays.
- game.ts findConnectedRoads: multi-root BFS. Generalise it to road/rail/metro networks. The isConnected side-adjacency rule is good.
- NpcSystem schedule model: npcs.json schedule, think/headTo/stroll/arrive, PATHS_PER_TICK budget, entrance() using the nearest connected road, and the residents-per-NPC scaling.
- The drag-to-build road UX (roadPath preview with ok flags in overlays, buildRoad that relevels older roads underneath). Keep the logic and redo the touch handling.
- materials.setXray as the basis for an underground/metro view.
- model.ts treeGeometries, already used instanced by features.ts, for street trees in planters.
