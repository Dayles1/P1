# content (Epochs / City Chronicle 2 data packs: types, registry+validation, loader, JSON files, server repository/validator/controller, Workshop)

## Summary
Everything the game is made of is JSON under resources/games/content/epochs: 10 top-level files (world, resources, biomes, climate, epochs, techs, blueprints, goals, npcs, sounds) plus one file per building in buildings/ (42 files). That is about 14.4k lines, 882 KB raw and 108 KB gzipped, and all of it is sent to the client on every boot. Each top-level file carries a "$doc" string, and all text is Russian.

Server: ContentRepository (app/Games/Epochs/Content/ContentRepository.php) reads the folder named by config('games.epochs.content_path') (config/games.php:40-42). It has three readers:
- bundle() returns assoc arrays for PHP validation.
- bundleForClient() decodes as stdClass so an empty {} stays {} and does not come back as [] (lines 55-70).
- version() returns an md5 over every file (lines 86-95).
write() uses a special pretty layout, encode() at lines 167-185, which puts every flat object or array on one line; the client mirrors it as formatContent in content-api.ts:37-54. Keys are limited to the FILES list or buildings/<id> (isValidKey, line 159).

ContentController: index (GET /api/games/epochs/content) returns {version, editable, content}. update (PUT content/{key}, body {json: text}) decodes the text twice (as an array for validation, as an object for writing), merges it into the on-disk bundle, runs ContentValidator over the WHOLE bundle, and only then writes the file. destroy only deletes building files, and refuses when the bundle without that file fails validation (i.e. the building is still referenced). Workshop::canEdit gates all writes: config games.workshop.enabled (default only when APP_ENV=local) plus an editors id list, where an empty list means every signed-in user. Routes are in app/Games/routes/api.php:35-42. Storage is plain files on disk: no DB, no cache, no per-player overrides.

Client: EpochsGame.tsx:264 calls loadContent() (content-api.ts:19-34). It fetches through gameApi('epochs/content'), runs the TS validateContent (registry.ts:175-666) and wraps the bundle in a Content class (registry.ts:31-169). Content holds lookups (epochOrder, epochById, building, byRole, level, levelPalette, tech, blueprint, resource, emptyAmounts, npcTypesFor) and sorts buildings by the era of their first level, which is the build-menu order. Any validation issue blocks the game with 'fix it in the Workshop' (EpochsGame.tsx:272-279). The returned version hash is never used.

The Workshop (/city2/workshop, workshop/Workshop.tsx 659 lines plus previews.tsx 800, SkyscraperStudio 482, skyscraper.ts 1277) is a raw-JSON textarea per file. It re-validates the full draft bundle as you type, shows live previews (map, eras, buildings, climate, NPCs, sounds), saves with PUT, can create a building by cloning house.json, and can delete with DELETE.

Validation is duplicated in TS (registry.ts) and PHP (ContentValidator.php, 478 lines). Both check cross-references:
- every era, resource, tech, building, biome, season, weather and sound id exists;
- tech prerequisites are acyclic and never from a later era;
- level numbering is sequential and level eras never go backwards;
- a level's tech is not from a later era than the level;
- map size is 16..256;
- building footprint is 1..4 x 1..4;
- the 'road' and 'center' roles both exist and every role is unique.

Content semantics:
- An era (EpochDef) has: year, yearsPerDay (calendar speed while the era is current), territory (half-width of a SQUARE of owned land around the map centre), palette (architecture materials plus road look plus sky), theme (HUD CSS variables), ambience, and next (requirements to advance: population, buildings at a given level, techs, cost).
- A building has levels. Each level has its own era, optional tech, cost, buildTime, effects and a procedural model built from 35 part kinds (about 3,900 parts in total). A level is drawn with its own era's palette.
- The road is a 1x1 building with 9 levels whose model.parts are all empty. Its look comes only from palette.road/roadEdge/roadMark/roadStyle of the level's era, drawn by scene/roads.ts:322.
- Resource producers that depend on map features (Effects.near: tree or rock) are lumber, quarry, mine and coal_mine.
- 'gold' and 'food' are hard-coded in the simulation (tax, tourism, eating).

## Files
- resources/games/src/epochs/engine/content/types.ts (991): All content schemas: WorldFile(11-72), DistrictPolicyDef(74-94), GameEventDef(96-106), ResourceDef(108-116), BiomeDef/FeatureId 'tree'|'rock'|'reeds'(118-136), BiomesFile.generator(138-150), Season/Weather/Climate(152-187), RoadStyle 'dirt'|'cobble'|'paved'|'asphalt'|'smart'|'glow'(189-190), Palette incl. road*/sky(197-219), EpochTheme(221-231), EpochDef(233-249), TechBonus/TechDef(251-278), RoofShape, BlueprintDef(298-311), GoalCondition/GoalDef(313-336), ModelPart union of 35 kinds(374-822), Effects(826-845), LevelDef(847-870), Category(872-881), BuildingDef with role 'road'|'center'|'district'|'bureau' and placement{requiresRoad,biomes,nearWater,overWater}(883-910), NpcTypeDef vehicle 'cart'|'car'|'bus'|'hover'|'drone'(912-923), NpcsFile, SoundsFile, ContentBundle(964-976), CONTENT_FILES(978-989)
- resources/games/src/epochs/engine/content/registry.ts (666): class Content (31-169): indexes plus lookups epochOrder/epoch/epochById/biomeIndexOf/building/hasBuilding/byRole/level/firstEpoch/levelPalette/tech/blueprint/resource/emptyAmounts/npcTypesFor; buildings sorted by first-level era (77-81). validateContent(bundle) returns ContentIssue[] {file,path,message} (175-666): map 16..256 (259-270), secondsPerDay>=10, start refs, districts, events; resources' era; last biome must have an empty 'when' (326-332); climate keyframes 0..1; eras' years ascending plus next refs plus ambience exists (362-404); techs refs/era order/cycles (407-465); blueprints; goals; npcs; sounds; buildings: id equals file name, unique roles (554-564), size 1..4 (566-572), level numbering, non-decreasing level eras, tech era <= level era, amounts, boost targets, parts array; roles road+center required (659-663). Messages are hard-coded in Russian.
- resources/games/src/epochs/content-api.ts (54): loadContent(): GET epochs/content through shared gameApi, returns {content: new Content, bundle, version, editable, issues: validateContent}. formatContent(): the same one-line-flat-objects pretty printer as ContentRepository::encode.
- app/Games/Epochs/Content/ContentRepository.php (193): File-based store. FILES const (19); path() from config games.epochs.content_path (21-26); bundle() as arrays (33-48); bundleForClient() as stdClass, keeping {} vs [] (55-81); version() md5 of every file (86-95); buildingIds() by glob (100-110); read/write/delete (115-155, only buildings/* deletable); isValidKey regex ^buildings/[a-z][a-z0-9_]{1,40}$ (157-160); encode() pretty layout (167-185).
- app/Games/Epochs/Content/ContentValidator.php (478): PHP mirror of validateContent: checkWorld (89-140; map 16..256 and is_int at 94), checkResources, checkTechs plus cycle detection (158-211), checkBlueprints, checkGoals (unknown condition type is an error, 241-262), checkClimate, checkEpochs (303-336), checkNpcs, checkBuilding (366-442; size 1..4 at 377), checkAmounts (non-negative numbers, known ids). Unlike the TS version, it does not check sound presets, ambience members or the default last biome.
- app/Games/Epochs/Http/Controllers/ContentController.php (112): index (25-32): {version, editable, content}. update (38-72): json text, then validate the whole bundle with the edited file merged in, then write. destroy (77-98): only building files, refused while referenced. deny() (100-111): Workshop::canEdit plus isValidKey. Extends shared App\Games\Http\Controllers\GameController (success/error envelope, playerId).
- app/Games/Epochs/Workshop.php (21): canEdit(userId): config games.workshop.enabled && (editors==[] || in editors).
- config/games.php (55): Shared config: games.epochs.content_path (40-42), games.workshop.enabled/editors (50-53). A self-contained v3 needs its own config file, as GuWorld does with config/gu_world.php.
- app/Games/routes/api.php: Shared routes 35-42: GET epochs/content, PUT|DELETE epochs/content/{key} (key regex [a-z]+(?:/[a-z0-9_]+)?), world show/store/sync/destroy.
- app/Games/Epochs/Http/Requests/WorldPayloadRules.php: Save validation coupled to content: epoch ids from epochs.json (21-32), seed/width/height 16..256 (29-31), year 0..9999, building types Rule::in(buildingIds()) (68).
- resources/games/src/epochs/workshop/Workshop.tsx (659): In-browser JSON editor for every content file: FILES list (30-91), live draft validation (181-206), save with PUT (213-256), create a building by cloning house (309-337), delete (339-385); previews.tsx (800 lines) renders map/era/building/climate/NPC/sound previews; SkyscraperStudio/skyscraper.ts produce tower parts (no shipped level carries model.studio).
- resources/games/content/epochs/world.json (215): map {width:72,height:72,seed:null}: the seed is never read, and Game.create uses Math.random (game.ts:147-150). time {secondsPerDay:240, daysPerSeason:1, tickSeconds:1, maxOfflineSeconds:3600}. start {epoch e0, population 6, resources food120 wood150 stone60 gold80 knowledge0, town_center L1 at 'center'}. population {foodPerPerson .04, workforceShare .6, growthRate .03, taxPerPerson .02, baseHappiness 45, penalties, declines}. economy {storageBase 300, refundShare .5, upgradeShare .7, moveCostPerTile 6, clearFeature tree/rock/reeds}. districts {radius 7, 5 policies historic/industrial/residential/business/green}. npc caps. events: firstAfter 200, every [120,220], 18 events (gold/food/knowledge/etc. gains and losses, some era-gated up to e3000).
- resources/games/content/epochs/epochs.json (386): 10 eras with palette/theme/ambience/next (see keyDataStructures for inventory).
- resources/games/content/epochs/resources.json (27): 22 resources {id,name,icon(emoji),epoch,capped,description}; only gold and knowledge are uncapped.
- resources/games/content/epochs/techs.json (882): 77 techs {id,name,icon,epoch,description,cost,time(s),requires[],bonus{produces%,happiness,housing,storage,buildSpeed,tax,research}|null}.
- resources/games/content/epochs/goals.json (491): 54 goals {id,name,icon,description,epoch,condition,reward}; per era e0 7, e1000 6, e1500 7, e1800 5, e1900 5, e2000 5, e2100 4, e2300 4, e2500 4, e3000 7. Includes techs:55 and techs:77 (all_techs) counters.
- resources/games/content/epochs/blueprints.json (317): 26 architectural styles unlocked by architect_bureau tier: tier 1 at e1500 x6, tier 2 at e1900 x6, tier 3 at e2100 x6 plus e2300 x2, tier 4 at e2500 x3 plus e3000 x3. Each has {colors palette overrides, roof shape|null, buildings[] (empty = all)}.
- resources/games/content/epochs/biomes.json (122): Noise generator config {elevationScale 16, moistureScale 11, temperatureScale 24, octaves 3, edgeFalloff .25, lake{count1,radius[4,7]}, river{count1,width1}, clearRadius 6}. 8 biomes in priority order: deep_water, water, beach(rock .02), mountain(rock 1), hills(rock .4, tree .08), marsh(reeds .45), forest(tree .75), meadow(default, when:[] as an array, tree .04, rock .01).
- resources/games/content/epochs/climate.json (111): 4 seasons (temperature, fertility, groundTint, snow, treeTint, weather weights), 5 weather types (clear/cloudy/rain/snow/fog with light, particles, sound), weatherMinutes [0.5,1.5], dayNight keyframes 0..1.
- resources/games/content/epochs/npcs.json (167): schedule {wake .24, work .3, leisure .66, home .8, jitter}. 15 types: 10 residents (one per era) plus traffic cart(e1000-e1800), car(e1900-2000), bus(e2000-2100), hovercar(e2100-2500), drone(e2500-3000). Also names, age, 12 thought strings.
- resources/games/content/epochs/sounds.json (226): master volume, 23 synth presets (click, place, upgrade, demolish, error, coin, epoch, bell, hammer, water, wind, machine, hum, chime, moo, bird, cricket, rain, traffic, fire, whistle, pulse, shimmer) with optional file, 9 ambience sets (camp, village, town, industrial, city, future, space, ai, nano).
- resources/games/content/epochs/buildings/*.json (11553): 42 building files: {id,name,icon,category,description,size{w,h},unique,hidden,role?,placement,sounds{place,upgrade,demolish,select,ambient},levels[]}. 205 levels in total, 155 of them in eras <= e2100. Largest: house 1107 lines (14 levels), block 1026 (8 levels, one level has 306 parts), manor 710, town_center 555, school 469. road.json 249 lines: 9 levels, all parts empty.
- tests/Feature/Games/EpochsContentTest.php (202): Pest tests over the shipped content plus the workshop API (valid content; empty-object round trip; save layout; create; refuse invalid; delete in-use market vs unused vertical_farm; editors gate; known part kinds; home models inside plot; studio level). They swap games.epochs.content_path to a temp copy.

## Key data structures
type Amounts = Record<ResourceId, number>;
WorldFile { map{width,height,seed:number|null /*unused*/}; time{secondsPerDay:240,daysPerSeason:1,tickSeconds,maxOfflineSeconds}; start{epoch,population,resources:Amounts,buildings:{type,level?,at:'center'|[x,y]}[]}; population{foodPerPerson,workforceShare,growthRate,taxPerPerson,baseHappiness,starvingPenalty,noPowerPenalty,coldPenalty,starvingDecline,unhappyDecline,overcrowdingDecline}; economy{storageBase,refundShare,upgradeShare,moveCostPerTile,clearFeature:Record<feature,{cost,gain}>}; districts{radius,policies:{id,name,icon,description,effects{produces?{id|'*':%},happiness?,housing?,pollution?,tourism?}}[]}; npc{residentsPerNpc,maxNpcs,trafficPerRoads,maxTraffic}; events{firstAfter,every:[min,max],list:{id,weight,text,gain?,lose?(<1 = share of stock),mood?{amount,seconds},seasons?,epochs?}[]} }
ResourceDef { id,name,icon,epoch,capped:boolean,description }   // no 'kind'/currency notion
EpochDef { id,year,name,tagline,yearsPerDay,territory /*half side of square*/, palette:Palette, theme:{bg,solid,border,text,muted,accent,accentText,font,radius}, ambience, next:{population,buildings:{type,count,level?}[],techs:string[],cost:Amounts}|null }
Palette { wall,walls[],roof,trim,window,lit,glass,metal,road,roadEdge,roadMark|null,roadStyle:'dirt'|'cobble'|'paved'|'asphalt'|'smart'|'glow',plaza,crop,flag,accent,sky:[zenith,horizon],[k]:unknown }
TechDef { id,name,icon,epoch,description,cost,time,requires[],bonus:{produces?,happiness?,housing?,storage?,buildSpeed?,tax?,research?}|null }
BiomeDef { id,name,colors[2],buildable,walkable,fertility,speed,water?,when{elevation?,moisture?,temperature?:[min,max]},features:{tree?|rock?|reeds?:chance} }
BuildingDef { id,name,icon,category:'housing'|'food'|'resources'|'industry'|'power'|'trade'|'services'|'science'|'infrastructure', size{w,h 1..4}, unique, hidden, role?:'road'|'center'|'district'|'bureau' (unique per role), placement{requiresRoad,biomes?,nearWater?,overWater?}, sounds{place,upgrade,demolish,select,ambient}, levels:LevelDef[] }
LevelDef { level,name,epoch,tech?,description?,cost,upgrade? /*never used; upgrade = cost*0.7*/,buildTime, effects:Effects, model{parts:ModelPart[],studio?} }
Effects { housing,jobs,produces,consumes /*per second*/,storage,power,powerUse,aura{radius,happiness}|null,pollution{radius,amount}|null,boost{targets[],radius,percent}|null,near{feature:'tree'|'rock'|'reeds',radius,perTile,max}|null,seasonal,defense /*always 0, dead*/ }
GoalCondition = population|building{building,count,level?}|epoch|tech|techs{count}|resource{resource,value}|happiness|districts|blueprints|heritage{count,age}
BlueprintDef { id,name,icon,description,epoch,tier,cost,buildings[],colors:Partial<Palette keys>,roof|null }
NpcTypeDef { id,name,role:'resident'|'traffic',epochs[],speed,body[],skin?,hat?,glow?,vehicle?:'cart'|'car'|'bus'|'hover'|'drone' }
ContentBundle { world,resources{resources[]},biomes,climate,epochs{epochs[]},techs{techs[]},blueprints{blueprints[]},goals{goals[]},npcs,sounds,buildings:Record<id,BuildingDef> }
API GET /api/games/epochs/content -> {success,message,data:{version:string(12 hex),editable:boolean,content:ContentBundle}}; PUT /content/{key} body {json:string} -> {version} | 422 {issues:{file,path,message}[]}

INVENTORY
Eras (id year name | yearsPerDay | territory -> owned square | next.population):
 e0 0 Античность | 100 | 8 -> 16x16 | 50 (TC L2, school, market; agriculture, writing, masonry; wood300 stone200 gold300 knowledge50)
 e1000 1000 Средневековье | 45 | 10 -> 20x20 | 150 (TC L3, smithy x2, temple L2; metallurgy, smithing, brickmaking; bricks400 tools200 gold1500 kn300)
 e1500 1500 Возрождение | 25 | 12 -> 24x24 | 350 (TC L4, architect_bureau, glassworks; printing, architecture, scientific_method)
 e1800 1800 Индустриальная эра | 8 | 14 -> 28x28 | 800 (TC L5, steel_mill x2, coal_mine; steam_engine, steelmaking, factory_system)
 e1900 1900 Эпоха модерна | 7 | 17 -> 34x34 | 1600 (TC L6, power_plant, cement_plant; electricity, reinforced_concrete, oil_drilling)
 e2000 2000 Современность | 7 | 20 -> 40x40 | 3000 (TC L7, electronics_fab, house L10 x2; computers, semiconductors, internet)
 e2100 2100 Ближнее будущее | 12 | 23 -> 46x46 | 5000 (next goes to e2300; v3 must set it to null)
 DROP in v3: e2300 2300 Космическая эра | 12 | 27; e2500 2500 Эра ИИ | 25 | 31; e3000 3000 Нано-эра | 20 | 35 (next null)
Resources (22; all capped except gold and knowledge):
 e0 food wood stone gold knowledge | e1000 iron tools bricks | e1500 glass | e1800 coal steel | e1900 concrete oil | e2000 plastic electronics | e2100 data composites
 DROP: e2300 rare_metals hydrogen | e2500 ai_cores | e3000 nanomaterials antimatter
Techs per era: e0 7, e1000 9, e1500 8, e1800 8, e1900 8, e2000 8, e2100 8 (56 kept) | e2300 7, e2500 7, e3000 7 (21 dropped); 77 in total.
Buildings (id | category | role | size | level eras first..last (#levels) | produces <- consumes, other):
 town_center | infrastructure | center, hidden, unique | 2x2 | e0..e3000 (11) | food/wood/stone/iron/tools/gold/knowledge/data small amounts; housing 6-200; storage 300-100000; aura
 road | infrastructure | road | 1x1 | e0..e2500 (9) | no effects; look from era palette; overWater becomes a bridge
 district_hall | infrastructure | district | 1x1 | e1000..e2100 (5) | aura; L5 data .3
 architect_bureau | infrastructure | bureau, unique | 2x2 | e1500..e2500 (4) | knowledge .1-3; unlocks blueprints
 house | housing | 1x1 | e0..e3000 (14) | housing 4->500; powerUse from L8
 manor | housing | 2x2 | e1000..e3000 (9) | housing 8-130 + gold .3-40 + aura
 block | housing | 2x2 | e1800..e3000 (8) | housing 60-1300
 skyscraper | housing | 2x2 | e2000..e3000 (5) | housing 420-1700 + jobs 40-220
 farm | food | 2x2 | e0..e3000 (9) | food 1.5->110 (seasonal to L5) <- oil at L4-5
 fishery | food | 1x1 nearWater 1 | e0..e2500 (5) | food .8-45
 vertical_farm | food | 2x2 | e2100..e3000 (3) | food 35-140
 lumber | resources | 1x1 | e0..e2100 (5) | wood .6-14 (near tree) <- coal at L3
 quarry | resources | 2x2 | e0..e2100 (5) | stone .5-16 (near rock) <- oil at L4
 mine | resources | 2x2 | e1000..e2100 (5) | iron .5-11 (near rock) <- coal at L3
 coal_mine | resources | 2x2 | e1800..e2000 (3) | coal 2-9 (near rock) <- oil at L3
 oil_well | resources | 1x1 | e1900..e2100 (3) | oil 1.5-7
 electrolyzer (DROP) | resources | 2x2 nearWater 2 | e2300..e2500 | hydrogen
 spaceport (DROP) | resources | 3x3 | e2300..e3000 | rare_metals <- hydrogen, composites
 kiln | industry | 1x1 | e1000..e1900 (3) | bricks .4-5 <- stone, wood/coal
 smithy | industry | 1x1 | e1000..e2100 (5) | tools .3-10 <- iron, wood/coal, later steel/composites
 glassworks | industry | 2x2 | e1500..e2100 (4) | glass .3-8 <- stone, wood/coal/oil
 steel_mill | industry | 2x2 | e1800..e2100 (4) | steel .8-10 <- iron, coal
 cement_plant | industry | 2x2 | e1900..e2100 (3) | concrete 2-10 <- stone, coal
 chemical_plant | industry | 2x2 | e2000..e2100 (2) | plastic 2-6 <- oil (L2: food)
 electronics_fab | industry | 2x2 | e2000..e2500 (3) | electronics .8-8 <- plastic, glass, steel
 composites_plant | industry | 2x2 | e2100..e2300 (2) | composites 1.5-4.5 <- plastic, steel
 ai_foundry, nanofab, antimatter_collider (all DROP) | industry | e2500/e3000
 windmill | power | 1x1 | e1500..e2100 (3) | L1 boost farm +25% r3; L2-3 power 12/40
 power_plant | power | 2x2 | e1900..e2100 (3) | power 60-300 <- coal/oil, pollution
 solar_farm | power | 2x2 | e2100..e2300 (2) | power 120/400
 fusion_reactor (DROP) | power | 3x3 | e2500..e3000
 market | trade | 2x2 | e0..e2500 (9) | gold .6-170 + aura
 storehouse | trade | 1x1 | e0..e2500 (7) | storage 400-80000
 school | science | 2x2 | e0..e3000 (10) | knowledge .15-30
 data_center | science | 2x2 | e2100..e2500 (3) | data 2-12 + knowledge <- electronics
 clinic | services | 1x1 | e1000..e2500 (6) | aura 5-16
 park | services | 1x1 | e0..e2500 (6) | aura 3-13
 temple | services | 2x2 | e0..e1500 (3) | aura + knowledge .05-.2
 theater | services | 2x2 | e0..e2500 (7) | aura + gold .5-25
 well | services | 1x1 | e0..e2000 (5) | aura 4-11
Blueprints 26 (18 kept to e2100). Goals 54 (39 kept). NPC types 15 (11 kept). Ambience sets 9 (6 kept).

## Couplings
Client:
- shared/api.ts gameApi() with the /api/games/ prefix and the {success,message,data} envelope plus GameApiError.
- main.tsx routes /city2 and /city2/workshop (lines 15, 31-32); hub/catalog.ts:38 path '/city2'.
- 25 files import content types or registry: audio/audio.ts, engine/core/clock.ts, engine/save/serializer.ts, engine/sim/{game,npcs,state}.ts, engine/world/{generator,world-map}.ts, scene/{architecture,buildings,colors,model,overlays,people,roads,terrain,thumbnails,viewer}.ts, ui/{build,bureau,common,inspector,research}.tsx, workshop/*.

Where content fields are consumed by the engine:
- Game.create random seed: game.ts:147-150; world.map.seed is ignored.
- territory() square: game.ts:298-313.
- levelLock by era and tech: game.ts:333-350.
- upgradeCost via upgradeShare: game.ts:383-402.
- advanceEpoch sets year = epoch.year: game.ts:1302-1316; testerNextEpoch does the same at 2260-2270.
- tick advances year at epoch.yearsPerDay, clamped to nextEra.year-1: game.ts:1325-1330.
- clearFeature: game.ts:1159.
- near-feature output: game.ts:1767-1774 and 1905-1908.
- Hard-coded 'gold' in tourism (game.ts:1936-1945) and tax (1984-1993); hard-coded 'food' in eating (1992-1996).
- visibleResources feeds the HUD: game.ts:323-329, hud.tsx:104.
- serializer.ts:330-340 offline gold summary; EpochsGame.tsx:295 says 'золота'.
- generator.ts:25-227 uses biomes.generator and features and ensureStartingResources.
- scene/roads.ts:322 roadStyle from the level-era palette.
- scene/sky.ts:65 palette.sky of the current era.
- EpochsGame.tsx:1059-1071 applies epoch.theme as --hud-* CSS variables; EpochsGame.tsx:467 epoch.ambience.
- ui/epoch.tsx:289-317 animates the year jump between era start years.

Server:
- Shared app/Games/Http/Controllers/GameController (success/error/playerId).
- Shared config/games.php (epochs.content_path, workshop.*).
- Shared app/Games/routes/api.php:35-42.
- Shared lang app/Games/lang/{en,ru}/messages.php keys content_invalid_json, content_invalid, content_not_deletable, content_in_use, workshop_forbidden, content_unknown_file.
- WorldPayloadRules.php:21-34 and 68 reads epochs and buildingIds on every save.
- Community/Http/Controllers/LeaderboardController.php:34 and Http/Controllers/GameHubController.php:17-40 read epochs.json for era names (cross-game coupling that v3 must not reuse).
- tests/Feature/Games/EpochsContentTest.php.

## Requirement impact
### R1 [hard]
world.map {width:72,height:72,seed:null} (world.json:3; types.ts:12-16) becomes a fixed layout. The seed is dead today because Game.create picks Math.random (game.ts:147-150), so a fixed map needs either a constant seed or, better, a deterministic band layout with no noise. Suggested shape: map {width:100, playable:{depth:40}, mountainRows, beachRows:20, waterRows:30} plus a land model. Era 'territory' (epochs.json; types.ts:239) is the half-side of a SQUARE centred on width/2,height/2 (game.ts:298-313), which does not fit 'start 30 wide, full 40 depth, expand left/right'. Replace it with a land/expansion schema in world.json, e.g. land {startWidth:30, strips:[{width, cost, era?}]}, with the land bought like Clash/SimCity expansions rather than granted per era. The town hall 'center' is computed from the whole map, so with extra mountain/beach/sea rows the centre must be defined against the playable rect (start.buildings at 'center'). Validator map bounds 16..256 (registry.ts:259-270, ContentValidator.php:94, WorldPayloadRules.php:30-31) accept 100 and ~96 rows, so they can stay. Remove the biomes.generator noise/lake/river/edgeFalloff/clearRadius (biomes.json:3-15; types.ts:139-148) and generator.ts. The districts radius of 7 still works.

### R2 [moderate]
The content side is small: drop biomes.generator.edgeFalloff and the lake/river settings, which create the water ring and islands. Add horizon/backdrop settings, e.g. world.backdrop {mountainColors, seaColor, farFog, skirtTiles}, so the renderer can extend mountains, sand and water past the playable rect. The actual work is in scene/terrain.ts and scene/sky.ts (another subsystem). Era palette.sky can stay but should blend gradually (see R6).

### R3 [moderate]
Remove FeatureId 'tree'|'rock'|'reeds' (types.ts:136), BiomeDef.features (types.ts:133), world.economy.clearFeature (world.json:19-32; types.ts:54; game.ts:1159) and generator ensureStartingResources (generator.ts:175-227). Effects.near (types.ts:837-842) is used by lumber, quarry, mine and coal_mine (game.ts:1767-1774, 1905-1908); replace it with a terrain-adjacency placement rule, e.g. placement.adjacent:'mountain'|'coast' plus an optional output bonus per touching edge tile. Quarry, mine and coal_mine must then stand against the mountain row. Fishery (nearWater:1) and future harbour/airport-seaplane go on the coast. Wood has no trees left: either turn lumber into a 'tree farm' with no map feature, or retire wood after the early eras. Biomes collapse to fixed bands: mountain (unbuildable, outside the zone), grass (buildable), sand (20 rows, buildable or limited), water. Tree parts inside building models (329 'tree' parts, e.g. parks) are decoration and can stay or become planters.

### R4 [hard]
Today a road is one 1x1 building (road.json) with 9 levels whose model.parts are []. The look comes only from the level-era palette fields road/roadEdge/roadMark/roadStyle (types.ts:189-219; epochs.json palettes; scene/roads.ts:322+), and 'asphalt' to 'smart' to 'glow' is literally a colour/style swap. Effects are all zero, so roads carry no capacity or traffic gameplay. Needed: a road-class schema owned by the road levels, not by the eras, e.g. level.road {lanes:1|2|4|6, widthTiles:1..3, surface, sidewalk:boolean, median, markings:'none'|'center'|'lanes'|'crosswalks', decor:['lamp','planter_tree','bench','bus_stop'], capacity, speed}. Either several road building ids (street/avenue/boulevard/highway) or levels that widen. The single-role rule (registry.ts:554-564, ContentValidator.php:64-77) plus game.byRole('road') allow only ONE road building, so roles must become a network concept (e.g. role 'road' with network:'road'|'rail'|'metro'). Multi-tile-wide roads also conflict with the 1x1 road grid assumptions in scene/roads.ts and game connectivity (connectedRoads).

### R5 [hard]
Trimming is mechanical:
- Delete eras e2300/e2500/e3000 and set e2100.next = null (epochs.json:265-276).
- Delete resources rare_metals, hydrogen, ai_cores, nanomaterials, antimatter.
- Delete buildings ai_foundry, antimatter_collider, electrolyzer, fusion_reactor, nanofab, spaceport (42 to 36 files).
- Cut 50 of 205 levels (to 155) from 21 buildings: house L12-14, block L6-8, manor L7-9, skyscraper L3-5, farm L7-9, market L8-9, school L8-10, town_center L9-11, road L8-9, etc.
- Cut 21 techs (77 to 56), 15 goals (54 to 39; fix techs_55), 8 blueprints (26 to 18), NPC types spacer/synth/nanite/drone plus the hovercar eras, ambience space/ai/nano, and events solar_flare/meteor/ai_glitch/nano_bloom plus blackout's e2300.

Adding metro, rail and airport needs schema work:
- Building size is capped at 1..4 (registry.ts:566-572, ContentValidator.php:374-379); an airport runway needs e.g. 8-12 x 3-4, a rail station 4x2.
- Rail and metro are line networks: new roles/network types plus station buildings with coverage radius (a SimCity-BuildIt-style service).
- NpcTypeDef.vehicle (types.ts:922) needs 'tram'|'train'|'metro'|'plane'.
- Category likely needs 'transport'.
- The tech 'railways' exists (e1800, only +15% buildSpeed) and can gate rail; add techs such as subway (e1900), aviation (e1900/e2000) and maglev (e2100).

### R6 [moderate]
Remove EpochDef.yearsPerDay (types.ts:238; per-era values 100/45/25/8/7/7/12) and add a single world.time.yearsPerDay (or daysPerYear). In the engine:
- Drop the clamp `year <= nextEra.year-1` (game.ts:1325-1330).
- Drop `state.year = this.epoch.year` in advanceEpoch (game.ts:1311) and testerNextEpoch (game.ts:2266).
- Drop the year-jump animation (ui/epoch.tsx:289-317).

Pacing maths for the planner: at secondsPerDay 240 the current per-era durations are e0 10 days, e1000 11.1, e1500 12, e1800 12.5, e1900 14.3, e2000 14.3. That is 74.2 game days (about 4.9 h real) to reach 2100, an average of 28.3 years/day. A constant rate therefore makes antiquity 35 days and each 20th-century era 3.5 days, unless v3 re-dates its eras (e.g. starts later, or treats era.year as a minimum calendar year plus requirements). Seasons are already inconsistent (daysPerSeason 1, so one 4-day seasonal year spans 28-400 calendar years). The other things that 'change everything' on era change, all keyed to the current era, should become gradual or player-driven: EpochDef.theme restyling the whole HUD (EpochsGame.tsx:1059-1071), palette.sky (scene/sky.ts:65), ambience and NPC/traffic swaps (npcTypesFor). Building looks already stay per level era (Content.levelPalette, registry.ts:140-142), which is good.

### R7 [hard]
ResourceDef (types.ts:108-116) has no notion of currency: gold is simply the uncapped resource used in almost every cost, plus knowledge, plus 20 capped materials. All visibleResources are shown in the HUD (game.ts:323-329, hud.tsx:104). Add:
- ResourceDef.kind 'currency'|'material'|'research'|'utility' plus hudPinned.
- world.economy.currency:'money' (single id).
- Per-era money presentation in epochs.json, e.g. currency {name:'Монеты'|'Банкноты'|'Карты'|'Цифровые', icon, symbol}, so the id stays stable while the look changes with the era.

Replace the hard-coded 'gold' (game.ts:1936-1945 tourism, 1984-1993 tax; serializer.ts:330-340; EpochsGame.tsx:295 text) and 'food' (game.ts:1992-1996) with configured ids. Rebalance every cost (all 155 kept levels mix gold with 1-5 materials), events, policies (business produces gold), tech costs (knowledge) and goal rewards. Reduce the 17 kept resources to a few material tiers or make the intermediates (iron/tools/bricks/coal/plastic...) internal production-chain stock that is not shown in the main HUD.

### R8 [hard]
What the economy model can express today:
- Per-second produces/consumes per level, with jobs as the efficiency driver.
- Tax = population * taxPerPerson(.02) * (0.5 + happiness/100) * (1 + taxBonus%); food per person .04/s.
- storageBase 300 plus storage buildings.
- upgrade = 70% of the level cost (no level uses the 'upgrade' override).
- refundShare .5; tech % bonuses; district policies.
- Effects.defense is always 0 and only summed (game.ts:1851), so it is dead.

What it lacks: upkeep/maintenance, land prices, demand (RCI), commodity prices or trade, traffic capacity, service coverage, education/health levels, loans, inflation. A v3 economy needs new Effects fields (upkeep:Amounts|{money:number}, capacity, coverage{service,radius}, demand) and world.economy formulas/curves (cost growth per level, land strip price curve, tax brackets per era). Both validators (TS plus PHP) must learn the new fields.

### R9 [moderate]
On the content side:
- EpochDef.theme (types.ts:221-231) carries per-era fonts, colours and radius that restyle the HUD. Drop it, or reduce it to an accent colour, for a single designed UI.
- Icons everywhere are emoji (resources, buildings, techs, goals, blueprints, policies); a designed UI may want an icon-id field instead.
- All names and descriptions are Russian-only, and validator messages are hard-coded Russian (registry.ts, ContentValidator.php).
- The Workshop (Workshop.tsx plus previews, ~3.3k lines) is a desktop JSON editor. Decide whether v3 copies it (it is useful for balancing the new economy) or drops it; it needs no mobile UI.
- Content payload is 882 KB raw / 108 KB gzipped per boot, plus a full client-side validation pass. On mobile, consider bundling the JSON with Vite (as GuWorld does with client/content) or caching it by version, which the client currently ignores.

## Risks
Validation:
- Validation exists twice, in TS (registry.ts validateContent) and PHP (ContentValidator), and the two have already drifted. PHP rejects unknown goal condition types; TS checks sound presets/ambience members and the default last biome, PHP does not. Every schema change in v3 must update both, or the TS side must be dropped.
- Validators hard-limit building footprints to 1..4 tiles, which blocks an airport or station, and enforce unique roles, which blocks several networks (road/rail/metro).

Map and save assumptions:
- Game code assumes a square territory around map centre, with centre = width/2,height/2.
- world.map.seed is dead config. The save payload (WorldPayloadRules.php:29) still requires an integer seed, so keep sending a constant.

Era and year coupling:
- Era transition is tightly coupled to the calendar: year is clamped to the next era's year-1, so an unadvanced city's calendar freezes at 999/1499/..., and it jumps on advance.
- Pacing per era relies on per-era yearsPerDay.

Hard-coded resource ids:
- 'gold' and 'food' are hard-coded in game.ts/serializer and the UI text.
- The emptyAmounts() initial state includes every resource id, so removing resources breaks old saves. v3 is a new game with its own DB, so that is fine, but do not share saves with v2.

Map features:
- Map features (trees/rocks) feed resource output through Effects.near. Removing them silently zeroes the 'nearby' bonus but does not break validation, since near is nullable. Lumber/quarry/mine/coal_mine then produce only base amounts.

Roads:
- Road visuals depend on the level-era palette, not the road level. Upgrading a road to a later-era level is what changes its style.
- The road has no gameplay effects; multi-lane roads wider than one tile clash with the 1x1 road mask and connectivity in scene/roads.ts and game.connectedRoads.

Server reads and shared couplings:
- Content is read from disk on every request with no caching: bundleForClient plus md5 of 52 files, and WorldPayloadRules globs buildings and reads epochs.json on every sync (throttle 60/min).
- Leaderboard and GameHub controllers read the Epochs content (era names), a cross-game coupling. A self-contained v3 must provide its own or stay out of those.
- Config, routes and lang are shared (config/games.php, app/Games/routes/api.php, app/Games/lang) and must be copied into app/Games/<Name>/ like GuWorld (config/gu_world.php, routes/api.php, own DB connection).

Workshop and content format:
- The Workshop writes straight into the content folder. In production it is off by default, but GAMES_WORKSHOP=true with an empty editor list means any signed-in user can rewrite game data.
- biomes.json meadow has `"when": []` (an array, not an object); harmless but quirky.
- PHP decode with assoc=true loses the {} vs [] distinction, which is why bundleForClient exists. Keep the object-decode path for writing.

Performance on a 100x~96 world on mobile:
- Building models are heavy: up to 306 parts per level (block L5) and 169 (house L11). About 3,900 parts in total, plus a procedural ModelPart DSL rendered per building, is a mobile risk on a bigger map with more buildings. Consider instancing and LOD, and capping parts per level in the validator.

Tests:
- tests/Feature/Games/EpochsContentTest.php hard-codes ids (house, market, vertical_farm, park, skyscraper) and the workshop API paths; v3 needs its own copy.

## Reusable
Data-driven core:
- The architecture is fully data-driven: ContentBundle with one JSON per building and per-level {era, tech, cost, buildTime, effects, model}.
- The Effects schema is a solid base to extend with upkeep, capacity and coverage.

Look and models:
- The "level drawn with its own era's palette" rule (Content.levelPalette) already supports R6: old buildings keep their look when the era changes.
- The procedural ModelPart DSL (35 part kinds: floors, tower, roof shapes, facades, balconies, columns, awnings, solar, neon, helipad, blades, emitters, lights, trees) can model metro entrances, stations, terminals, street lamps and planters for the new road decor.
- The existing building models up to e2100 (36 buildings, 155 levels) can be kept and trimmed.

Loading, validation and editing:
- ContentRepository's file store, its stable pretty JSON layout (encode/formatContent, identical in PHP and TS) and the {}-preserving bundleForClient.
- Whole-bundle validation returning {file,path,message} issues, used both client-side (fail-fast at boot) and server-side (guarding Workshop writes).
- The Workshop flow (live-validated JSON editor with previews, PUT/DELETE, editor gating) is very useful for balancing a new economy and is worth keeping desktop-only.

Other content worth keeping:
- Tech tree e0..e2100 (56 techs, acyclic, era-ordered, typed bonuses), including 'railways' as a hook for trains.
- Goal condition union and goals as tasks/achievements.
- Blueprints and the architect bureau (18 styles <= e2100).
- Climate: seasons, weather and day-night keyframes.
- NPC schedule, names and thoughts.
- Synthesized sound presets with optional files, and ambience sets.
- District policies.
- Event system with share-or-amount gains.
