# renderer-perf (scene orchestration, camera, sky/fog/horizon, weather, overlays, fx, picking, performance) of Epochs / City Chronicle 2

## Summary
Renderer (scene/renderer.ts) owns one THREE.WebGLRenderer (antialias, ACES tone mapping at 1.15 exposure, sRGB, PCFSoft shadows, RoomEnvironment PMREM as scene.environment) and one Scene (renderer.ts:106-137). attach(game) builds a World made of Terrain, Roads, Features, Buildings, People and Overlays inside one Group (renderer.ts:151-211). It calls buildings.sync(), then reflatten(), then features.sync(true), and centres the camera on game.center. The camera is OrbitCamera (camera.ts). It is a PerspectiveCamera with a 40° FOV, so it is not orthographic or true isometric. Defaults are yaw 45°, pitch 55° and distance 30. Pitch is clamped to 20°–85° and distance to 6–120. Every frame near = 0.02·distance and far = 6·distance + 160 (camera.ts:9-12, 37-45, 95-96). Yaw and pitch are free: Q/E keys, right-drag and two-finger pinch all rotate. The target is clamped to [0,W]×[0,H] (camera.ts:56-59). The loop is driven from EpochsGame.tsx:410-483 by requestAnimationFrame. It runs the sim in fixed 1-second ticks, moves NPCs and calls renderer.frame(dt, overlay) (renderer.ts:297-392). On top of that, the whole React HUD re-renders every 250 ms (EpochsGame.tsx:473-478).

Each frame, frame() does the following in order:
- orbit.update, then sky.update (sun, moon, hemisphere, environment intensity, fog, sky gradient)
- updates the shared uniforms uTime/uSnow/uLit
- terrain.update (water normal-map scroll; recolour only on season or epoch change)
- buildings.sync(), a per-frame O(N) diff of every building by a signature string (buildings.ts:246-306)
- reflatten() whenever structureRevision changed (renderer.ts:286-294, 344-346). This is a full rebuild of the terrain heights and normals, the skirt and the grid, plus a full roads rebuild, a full features rebuild and an overlay invalidate.
- roads.sync() every 0.25 s (full W·H signature scan; any change triggers a full rebuild), features.sync() every 0.5 s
- static glows rebuilt per revision, dynamic headlight glows, emitter particles, weather, overlays, and HTML labels (badges and progress bars from a full scan of all entries every frame)
- gl.render

Buildings are partly incremental. Each look is built once into ModelCache (ref-counted by lookKey + wall + seed). Complete buildings are merged per material bucket into 8×8-tile chunk meshes (buildings.ts:27, 547-619), and only dirty chunks are re-merged. Buildings under construction are drawn individually: the model plus scaffolding, scaled in Y as they grow. Moving parts (spin/blink) are separate Meshes per instance (model.ts:1745-1781). Fake contact shadows are one InstancedMesh, recreated on every change (buildings.ts:621-663).

Day/night comes from climate.json keyframes through game.clock.light(state.time). A day lasts 240 real seconds at 1×. The sun direction is derived from time of day. The sun follows the camera target at 80 units, and the shadow ortho box is ±clamp(0.9·distance, 8, 70) (sky.ts:86-127). At night the light becomes a bluish moon. Lit windows use a uLit threshold against a per-window aLit.a, and night glows are additive point sprites (fx.ts GlowLayer).

The sky is a 2×256 canvas gradient set as scene.background. That is a screen-space texture, so its 'horizon' (the 75% stop) does not track the real horizon (sky.ts:45-52, 166-193). The colours come from the current era palette (game.palette.sky), so they jump on an era change. Fog is linear THREE.Fog coloured like the horizon, with near = 1.6·d and far = 5.5·d + 30, tightened by fog or rain weather (sky.ts:144-161). The 'floating island' look comes from three things: Terrain.buildSkirt draws earthen sides down to y = −1.4 on all four map edges (terrain.ts:21, 565-641); the water plane is only map-sized (terrain.ts:216-223); and nothing exists beyond the map, so the gradient shows around the slab.

Picking uses no Three raycast against meshes. groundAt ray-marches the analytic terrain.heightAt from y=4 down to y=−0.7 in 0.1 steps, then bisects 10 times, and returns null outside the map (renderer.ts:753-828). pickBuildings tests the ray against every entry's Box3, brute force, sorted by distance, with a fallback to game.buildingAt(tile) (renderer.ts:831-871). pickNpc projects every drawn resident to the screen within 16 px (renderer.ts:873-903).

The overlays (overlays.ts) are keyed-rebuild meshes that rebuild only when their string key changes:
- hover tile, road-drag path, ghost footprint
- effect ranges (TileMesh plus RectLines for aura/boost/pollution/near)
- districts tint (full W·H scan of districtAt)
- the ghost model (shared cache, single translucent emissive material)
- selection outline (inverted hull)
- a ring under the selected NPC

Territory is drawn in terrain.ts instead: land outside the territory is darkened, a dashed glowing border and curtain marks the current era's square territory, a white border marks the next era's, and a placement grid covers the territory (terrain.ts:468-563, 643-790). Territory is a square radius around the map centre taken from epochs.json (game.ts:298-314).

FX are a CPU particle system (a JS object per particle; a new array each frame; cap 3000) and additive glow point sprites (fx.ts). Weather is rain LineSegments or snow Points (3000 max) in a box following the target, updated on the CPU (weather.ts). ModelViewer (viewer.ts) is a separate single-model renderer with its own WebGL context, used only in the content Workshop. Thumbnails use a third, shared offscreen context and synchronous toDataURL (thumbnails.ts).

## Files
- resources/games/src/epochs/scene/renderer.ts (932): Renderer class: WebGLRenderer/scene setup (106-137), attach/detach World (151-230), setQuality presets low/medium/high (237-264: shadows on/off, PCFSoft vs PCF, 2048/1024 map, DPR caps 2/1.25/1), resize (267-283), reflatten cascade (286-294), frame() per-frame orchestration (297-392), static glow rebuild (395-427), emitter spawning (429-460), labels per frame (480-556), engine-event FX incl. 'epoch' confetti+flash (559-708), camera passthroughs (710-738), groundAt ray-march picking (753-828), pickBuildings Box3 brute force (831-871), pickNpc screen-space (873-903), worldToScreen (909-917, unused). Exports Overlay, Quality, Renderer.
- resources/games/src/epochs/scene/camera.ts (203): OrbitCamera: PerspectiveCamera fov 40, yaw/pitch/distance/target with exponential damping (damp 10), constants MIN_DISTANCE 6, MAX_DISTANCE 120, MIN_PITCH 20°, MAX_PITCH 85°; setBounds/clampTarget to [0,W]x[0,H]; zoom toward pointer; pan in screen pixels scaled by distance; dynamic near/far.
- resources/games/src/epochs/scene/sky.ts (200): Sky: DirectionalLight sun (2048 shadow map, bias), HemisphereLight, linear Fog, 2x256 CanvasTexture gradient as scene.background. update(): era palette sky colours lerped to night colours, dawn/dusk tint, weather gloom, sun/moon direction from time of day, shadow camera box sized by camera distance, ambient, environmentIntensity, fog near/far by distance and weather. Returns {night, level}.
- resources/games/src/epochs/scene/weather.ts (191): Weather: rain LineSegments and snow Points (MAX 3000) in a wrapping box around the camera target, CPU-updated each frame with DynamicDrawUsage; fog handled by Sky.
- resources/games/src/epochs/scene/overlays.ts (744): Overlays: TileMesh (translucent per-tile quads, 4 sub-quads following terrain height, keyed rebuild), RectLines (range outlines), hover tile, road path, ghost model via ModelCache + ghost material, footprint, effect ranges (aura/boost/pollution/near feature), selection outline (inverted hull), NPC ring, district tint (W·H scan).
- resources/games/src/epochs/scene/fx.ts (516): PointBuffer (growable point-sprite buffer with custom ShaderMaterial, size attenuation via uScale), GlowLayer (additive night glows: lamps, model lights, headlights), Particles (CPU sim of smoke/steam/dust/water/sparks/sparkle/confetti, max 3000, burst()).
- resources/games/src/epochs/scene/viewer.ts (345): ModelViewer for the Workshop editor: own WebGLRenderer + rAF loop, single model on a ground plate, orbit by drag, wheel zoom, night/snow preview, own sun/hemisphere. Not used in gameplay.
- resources/games/src/epochs/scene/terrain.ts (805): Terrain: one height-field mesh SUB=2 (2 verts per tile edge) from WorldMap biome/elevation with value-noise roughness, vertex colours per biome + season tint + snow + darker outside territory; animated transparent water plane (map-sized); diorama skirt down to -1.4 (floating-island look); territory borders (current + next epoch) and placement grid; flatten() under building footprints; heightAt/surfaceAt/baseOf used by everything incl. picking.
- resources/games/src/epochs/scene/buildings.ts (708): ModelCache (ref-counted model geometry per look key + scaffold cache), modelGroup(), lookOf(), Buildings: per-frame diff sync(), place/detach/remove, CHUNK=8 merged meshes per bucket (rebuildChunk via mergeTranslated), individual groups for construction (growing scale.y + scaffold), animated instances, blob shadow InstancedMesh, emitters().
- resources/games/src/epochs/scene/roads.ts (792): Roads: per-tile flat quads (curb + surface inset joined to neighbours, cobbles, centre marks, glowing edge lines, red unconnected marker) by palette.roadStyle/road/roadEdge/roadMark; lamps (InstancedMesh pole+head on 28% of connected non-dirt tiles); bridges (InstancedMesh boxes); full rebuild on any change; sets terrain decks.
- resources/games/src/epochs/scene/features.ts (313): Trees/rocks/reeds as 5 InstancedMeshes, rebuilt when map.feature changes (full compare every 0.5 s). To be deleted in v3 (R3).
- resources/games/src/epochs/scene/people.ts (750): Residents (bodies/heads/hats/halos InstancedMesh pools) and vehicles (cart/car/bus/hover/drone, body+detail pools per kind), per-frame matrix/colour updates for all, headlights into dynamic GlowLayer; frustumCulled=false; drawn map for picking.
- resources/games/src/epochs/scene/materials.ts (280): Shared MaterialSet: buckets matte/metal/glass/glow/windows/foliage/flag (all MeshStandard/Basic with vertex colours), shader patches: snow on upward faces (USE_INSTANCING aware), lit windows (aLit vs uLit), waving flags (aWave, uTime); ghost and outline materials; setXray toggles transparency (recompiles).
- resources/games/src/epochs/scene/model.ts (1855): Procedural model builder: GeoBucket (non-indexed position/normal/color + aLit/aWave), buildModel(parts, palette, opts) -> ModelGeometry {buckets, animated, emitters, lights, bounds, height}; createAnimated (one Mesh per moving part), buildScaffold, treeGeometries, mergeTranslated (used for chunks).
- resources/games/src/epochs/scene/labels.ts (292): HTML overlay layer next to canvas: keyed pools of warning badges and progress bars repositioned by CSS transform every frame, floating texts, white era flash.
- resources/games/src/epochs/scene/thumbnails.ts (193): Shared offscreen WebGLRenderer + OrthographicCamera rendering building thumbnails synchronously to PNG data URLs (cached per content).
- resources/games/src/epochs/scene/colors.ts (108): color() cached THREE.Color by CSS string, hash3, wallsOf, resolveColor, clamp, smoothstep, damp.
- resources/games/src/epochs/EpochsGame.tsx: Host of the renderer: creates Renderer and default quality 'high' (54-64, 254-258), attaches game (321), the rAF loop with fixed 1 s sim ticks + renderer.frame + 250 ms full HUD rerender (410-483), keyboard camera, window resize only (541), pointer/touch input: hover-driven ghost (670-724), click/place (770-826), pinch zoom+rotate+pan (916-927), drag pan / right-drag rotate (940-964), tap threshold 5 px (943).

## Key data structures
// renderer.ts:32-50
interface Overlay { hover:{x,y}|null; ghost:{type:string; level:number; x:number; y:number; ok:boolean; moving?:number}|null; roadPath:{x,y,ok}[]; selectedUid:number|null; selectedNpc:number|null; bulldoze:boolean; xray:boolean; showDistricts:boolean }
// renderer.ts:53-62
interface World { game:Game; terrain:Terrain; roads:Roads; features:Features; buildings:Buildings; people:People; overlays:Overlays; group:THREE.Group }
type Quality = 'low'|'medium'|'high'   // high: DPR<=2, PCFSoft 2048; medium: DPR<=1.25, PCF 1024; low: DPR 1, no shadows
// camera.ts
interface CameraState { yaw:number /*0 = looking north (y-)*/; pitch:number; distance:number; x:number; z:number } // goal + current, damped
// sky.ts
interface SkyState { night:number /*0 day..1 night*/; level:number /*light 0..1*/ }
// clock.ts (engine) Light { level; tint:string|null; tintStrength; phase; night:boolean } from climate.dayNight.keyframes[{at,name,light,tint}]
// buildings.ts:34-54
interface BuildingEntry { uid; building:BuildingState; def:BuildingDef; signature:string; cacheKey:string; model:ModelGeometry; chunk:number /*8x8*/; base:number; complete:boolean; shownLevel; completeLevel; upgrading:boolean; box:THREE.Box3 /*picking*/; animated:AnimatedInstance[]; animatedGroup:Group|null; individual:Group|null }
// model.ts:64-73
interface ModelGeometry { buckets:Partial<Record<Bucket,BufferGeometry>> /*non-indexed: position,normal,color (+aLit vec4 windows, +aWave flag)*/; animated:AnimatedSpec[]; emitters:{position:Vector3; type:'smoke'|'steam'|'dust'|'water'|'sparks'}[]; lights:{position;radius;color}[]; bounds:Box3; height:number; dispose() }
interface AnimatedSpec { kind:'spin'|'blink'; geometry; bucket:Bucket; pivot:Vector3; orient:Euler; axis:'x'|'y'|'z'; speed:number }
type Bucket = 'matte'|'metal'|'glass'|'glow'|'windows'|'foliage'|'flag'
interface MaterialSet { uniforms:{uTime,uSnow,uLit}; buckets:Record<Bucket,Material>; foliage; glow; ghost; outline; setXray(on); dispose() }
// terrain.ts
interface Footprint { x;y;w;h;base } ; WATER_Y=-0.1; DECK_Y=0; SUB=2; SKIRT_BOTTOM=-1.4
// territory (game.ts:298-314): {minX,minY,maxX,maxY} = square of radius epochs[i].territory (8..35) around map centre; map 72x72, seed null (random) in content/epochs/world.json
// roads.ts: LampSpot {position;color}; BridgeTile {x;y;near:boolean[4];inset;style;water}; palette.roadStyle 'dirt'|'cobble'|'paved'|'asphalt'|'smart'|'glow'
// fx.ts: Particle {x,y,z,vx,vy,vz,life,max,size,grow,r,g,b,alpha,gravity,drag}; ParticleKind 'smoke'|'steam'|'dust'|'water'|'sparks'|'sparkle'|'confetti'
// Measured (scratch run of buildModel over all 205 levels): avg 4.8k non-indexed vertices/model, ~4 buckets/model, 0.53 animated parts/model, 1.56 lights/model; late residential: house L9-L14 7k-20k, block 11k-37k, skyscraper 10k-39k verts.

## Couplings
Imports from engine: engine/sim/game (Game: map{width,height,feature,occupant,biomeOfIndex,elevation,inBounds,index,isOpenWater}, buildings, def, levelDef, effects, isComplete, center, season, palette (era palette -> sky), weather, clock.light/timeOfDay, state.time/epoch, status, npcs{residents,vehicles,isVisible,typeOf}, territory(), districtHalls/districtAt, lookKey, paletteOf, roofOf, noise, isRoad, connectedRoads, countFeatureNear, around, content.*), engine/core/events (GameEvent: placed/removed/upgraded/built/cleared/epoch/achievement), engine/sim/state (BuildingState, NpcState), engine/world/world-map (featureCode, isWaterBiome), engine/content/types (Palette, BuildingDef, ModelPart, RoofShape, Effects, NpcTypeDef), engine/sim/npcs (Vehicle). Scene modules: buildings, model (+architecture.ts 2081 lines), materials, terrain, roads, features, people, labels, colors. three@0.180 + three/examples/jsm/environments/RoomEnvironment. Used by: EpochsGame.tsx (Renderer lifecycle, loop, input, quality UI), workshop/previews.tsx (ModelViewer, renderThumbnail), ui/build.tsx (renderThumbnail). Shared outside epochs: resources/games/src/styles.css:863-873 (.city__canvas: 100% size, touch-action:none, cursors). Content inputs: content/epochs/world.json (map 72x72, seed null, time.secondsPerDay 240), epochs.json (territory radius, palette incl. sky/road*/lit), climate.json (dayNight keyframes, seasons snow/tints, weather light/particles), buildings/*.json (model parts). No dependency on shared/api.ts or i18n inside scene/ (Russian strings hard-coded, e.g. renderer.ts:616 '⬆ Улучшение').

## Requirement impact
### R1 [moderate]
Camera bounds: renderer.attach calls orbit.setBounds(map.width, map.height) (renderer.ts:196). camera.ts:56-59 clamps to the full map. Add setPlayArea(minX,maxX,minY,maxY) driven by the unlocked x-range ± a margin and called on every expansion. Centring on game.center (renderer.ts:202-210) can stay, because the town hall sits at the map centre. Territory visuals are tied to the epoch: game.territory() is a square radius per epoch (game.ts:298-314); Terrain.recolor darkens outside it (terrain.ts:511-521); buildBorders draws the current and next-epoch rectangles (terrain.ts:684-726); the recolour/border key is `${season.id}:${epoch}` (terrain.ts:437). Replace these with an explicit unlocked {minX,maxX} from state and a territory revision in the key. Draw the purchasable plots to the left and right (border plus price sign) instead of the next-epoch square. groundAt must keep returning locked tiles so they can be bought (renderer.ts:818-825 bounds check is fine if the logical map is 100 x (40 + beach)). Terrain is built from a random WorldMap biome/elevation (terrain.ts:269-315; world.json map.seed null). v3 needs a deterministic, hand-defined layout: flat land y=0, a sand band, then water. That also lets computeNatural, the roughness/valueNoise and flatten() go away. Buildings CHUNK math already handles width 100 (buildings.ts:213).

### R2 [moderate]
1. Delete the diorama skirt (Terrain.buildSkirt terrain.ts:565-641, SKIRT_BOTTOM :21, calls at :428, :562).
2. Replace the map-sized water plane (terrain.ts:216-223, normal repeat :201) with an ocean plane of about 2000 units, opaque beyond the shallows, with the normal repeat in world units.
3. Add a backdrop mesh (1-3 draw calls, no shadows): locked/wild land continuing east and west beyond x=0..100 out to the fog distance, and the mountain range to the north (see R3).
4. Replace the screen-space scene.background CanvasTexture (sky.ts:45-52, 166-193) with a world-space sky dome: a BackSide sphere with a gradient shader based on view-direction y, a sun halo, fog:false and depthWrite:false, following the camera and with radius < camera.far.
5. Keep linear fog but make fog.color equal the dome's horizon colour. Size near/far in world units so the backdrop edge is always fogged; today they scale with distance (sky.ts:148-154).
6. Constrain the camera (camera.ts:9-12, 37-45, 95-96): fixed yaw 0 (or at most ±15°) so mountains are always at the top and the sea at the bottom; pitch tied to zoom (about 32° zoomed in, which shows the sky and horizon behind the mountains, up to about 58° zoomed out); MAX_DISTANCE around 70; far >= dome radius.
7. Use an aspect-aware FOV (fixed horizontal FOV in portrait), because a vertical FOV of 40° gives only about 19° horizontally on a 9:19.5 phone.

### R3 [moderate]
Remove Features entirely: features.ts, plus renderer.ts:19, 57, 156, 176, 200, 292, 357-359, and the per-0.5 s feature-array compare. Building models may keep 'tree' parts (park decor in the foliage bucket), since R3 targets map clutter. Mountain range: a new static heightfield strip north of y=0, wider than the map, with a fixed-seed ridge and vertex colours rock→snow. Its foot must meet the ground exactly at y=0 so quarries and mines on row 0 sit against the cliff. Add an optional far silhouette layer for depth. Beach: a sand band of about 20 rows in the terrain colours, sloping into the water in the last 2-3 rows (WATER_Y -0.1). Water: about 30 rows visible, then the ocean to the horizon (R2). Picking: groundAt ray-marches between y=4 and -0.7 (renderer.ts:770-771). With flat v3 ground, replace it with an exact y=0 ray-plane intersection, which is O(1) and correct even when tall mountains are in view. Overlays sample terrain.heightAt per vertex (overlays.ts:71-72, 177-180); with flat ground these become constants, which is cheaper.

### R4 [hard]
Roads today are single-tile flat quads. Only the palette colour/style changes per era: roadStyle dirt/cobble/paved/asphalt/smart/glow (roads.ts:322-337, 358-425; epochs.json palettes). Decor is just lamps on 28% of tiles (roads.ts:438-440, 696-766). Every change triggers a full rebuild (roads.ts:231-261 signature over W·H, rebuild 263-449).

v3 needs:
- road classes in content (lanes 1/2/4/6, width in tiles, median yes/no, sidewalk width)
- generation per chunk (16x16) so an edit only rebuilds its chunk
- geometry: raised sidewalks with curb faces, asphalt with lane markings by lane count (dashed lanes, double centre line, stop lines), zebra crosswalks at intersections, a median with planters
- decor as one InstancedMesh per kind: paired lamps, trees in planters, benches, bus stops, traffic lights at intersections, bollards (about 8 draw calls total)
- per-era looks (dirt→cobble→paved→asphalt→avenue→smart), and lane offsets for vehicles (people.ts:646-647 uses v.px/v.py).

Option: render road surfaces as instanced tile pieces (straight/corner/T/cross/end) with a procedural canvas texture atlas. That gives rich markings with 1-2 draw calls. Reuse the neighbour-joining logic shape() (roads.ts:616-661) and the bridge builder (452-608).

### R5 [hard]
Drop the content beyond 2100: palettes e2300/e2500/e3000 (glow road style; roads.ts:375) and the hover/drone vehicle kinds (people.ts:161-235). Add:
- Rail network layer, analogous to Roads: ballast strip, instanced sleepers, rails as thin boxes, catenary poles later; 1 draw per kind.
- Trains as articulated vehicles along a polyline: N cars, each with its own matrix, instanced. People.updateVehicles only supports rigid single bodies (people.ts:626-729).
- Metro: stations and entrances are buildings; the tunnels appear only in an 'underground' overlay mode built like the districts TileMesh (overlays.ts:680-724), or as a line ribbon.
- Airport: a large footprint (runway likely on the beach band or along the shore) with runway markings and animated planes (taxi, take-off roll, climb out over the sea and vanish at the horizon). The only existing animation system is spin/blink parts (model.ts:1745-1781), so a path-animation system for trains, planes and metro is needed. Planes leaving over the sea depend on R2's far plane and fog.

### R6 [trivial]
Renderer side of the 'everything changes at once' era jump:
- the 'epoch' event spawns 260 confetti particles and a full-screen white flash (renderer.ts:672-687, labels.ts:238-275); drop the flash and keep at most a small local effect
- sky colours come from game.palette.sky of the current era (sky.ts:65), so the sky jumps; use a natural sky independent of era, or interpolate era palettes by calendar year
- terrain recolour and borders are keyed on epoch (terrain.ts:437-447), and the next-epoch territory border (terrain.ts:688-711) must go
- the HUD theme switch per era is in EpochsGame.tsx:1059-1068 (UI subsystem)

Buildings already keep their own level palettes, so the city itself does not repaint on an era change. Day length is game.clock (secondsPerDay 240) and only reads state.time, so a constant calendar rate is a sim-side change.

### R7 [trivial]
Minimal for the renderer. Floating texts (Labels.float) can show the era currency icon for income or cost popups. The '⬆ Улучшение' and 'cleared' texts (renderer.ts:615-623, 657-667) are hard-coded and would move to i18n. Badges 🚧⚡📦👷 (renderer.ts:518-538) need re-specifying for the new resource model (starved = which input).

### R8 [moderate]
A deeper economy needs data-map views: land value, traffic, pollution, service coverage, happiness. The TileMesh pattern (overlays.ts:33-117) rebuilds geometry with 4 sub-quads per tile, which is wasteful for full-map heatmaps. Use one ground-aligned plane with a 100x60 DataTexture (one texel per tile, NearestFilter or Linear) updated in place: 1 draw call and trivial to update every sim tick. Range previews (overlays.ts:452-602) stay valid for building radii. Status badges need the new economy states (renderer.ts:512-551).

### R9 [hard]
Touch and mobile:
- Placement is hover-driven: the ghost is only set in updateHover from pointermove without a drag (EpochsGame.tsx:670-724, 966), and click() returns if no ghost exists (798-802). On touch, tap-to-place is unreliable. v3 needs a BuildIt-style flow: the ghost appears at the screen centre or tap point, can be dragged by finger, then confirmed with ✓/✗ buttons.
- Pinch also rotates (EpochsGame.tsx:923); disable rotation with a fixed yaw (R2).
- Raise the tap threshold from 5 px to 8-10 px for touch (943).
- Add pan inertia (fling) in OrbitCamera.pan (camera.ts:140-162).
- Use a ResizeObserver instead of window resize (EpochsGame.tsx:541) for orientation changes and panel layouts.
- Replace the 250 ms full-tree React rerender (EpochsGame.tsx:473-478) with a store that has selectors.
- Labels: DOM badges repositioned every frame for every flagged building (renderer.ts:480-556, labels.ts:59-61). Limit to visible buildings when zoomed in, or move to instanced WebGL sprites with an icon atlas.
- Pick the quality preset automatically: the default is 'high' for everyone (EpochsGame.tsx:56-64), and antialias cannot change after construction (renderer.ts:108-112).
- Thumbnails render synchronously with toDataURL (thumbnails.ts:181-186), which janks the build menu on phones. Pre-render them, or render lazily in requestIdleCallback.

## Risks
Hidden assumptions:
- The map is square 72x72 from a random seed (world.json map.seed null), and the territory is a square radius around the centre per epoch (game.ts:298-314).
- The camera clamps to [0,W]x[0,H] (camera.ts:56-59).
- groundAt rejects anything outside the map and assumes ground in [-0.7, 4] (renderer.ts:770-771, 818-825).
- The water plane and its normal repeat are map-sized (terrain.ts:201, 216-219).
- The skirt makes the slab look like a floating diorama (terrain.ts:565-641).
- The background gradient is screen-space and can never line up with a real horizon (sky.ts:51).
- Fog and far plane scale with zoom distance (sky.ts:148-154; camera.ts:96).
- The vertical 40° FOV gives about 19° horizontal in portrait (camera.ts:37).

Rebuild cascades:
- Any footprint change triggers terrain.flatten: (201x181 = 36k verts, heightAt with noise, computeVertexNormals), then skirt and grid, then a full roads rebuild, then a full features rebuild, then an overlay invalidate (renderer.ts:286-294, 344-346, terrain.ts:382-431). On mobile this is a hitch on every placement.
- Roads always rebuild the whole map (roads.ts:263-449), with heightAt per vertex and 2x2 sub-quads.
- Per-frame CPU is O(N) in buildings: a signature string per building every frame (buildings.ts:246-306), the label scan with Vector3 clone per projection (renderer.ts:467, 480-556), and the emitter generator (renderer.ts:443).
- NPC and vehicle pools update every resident every frame, with no view culling (people.ts:293, 517-580).
- Particles allocate objects and an array every frame (fx.ts:479-511). setQuality and xray force-recompile all materials (renderer.ts:252-262, materials.ts:253-269).

Measured geometry and estimated draw calls (scratch run of buildModel over all 205 content levels):
- Average 4.8k non-indexed vertices, about 4 buckets and 0.53 animated parts per model. Late residential levels reach 7k–39k vertices (house L11 19k, block L6 37k, skyscraper L5 39k).
- Estimate for a 100x90 world full of buildings (about 2,000 buildings, all 156 chunks visible when zoomed out, shadows on):
  - chunk meshes: 156 × ~6 buckets ≈ 940
  - shadow pass: 156 × 5 casting buckets (matte/metal/glass/foliage/flag) ≈ 780
  - per-instance animated meshes: ≈ 1,000+, plus their spin shadows ≈ 500
  - construction: ≈ 100
  - terrain/roads/people/fx/overlays: ≈ 65
  - total ≈ 3,300–3,800 draw calls per frame
- For the realistic 100x40 built area (about 920 buildings, 65 chunks) the total is about 1,600–1,800.
- Zoomed in (distance 30), frustum culling cuts this to about 400–600, because chunk meshes have bounding spheres. The shadow frustum (±27 units) still re-renders about 45 chunks.
- Triangles: a late-game 100x40 city at about 10k verts per building ≈ 9M vertices ≈ 3M triangles in the main pass, plus about 2.5M in the shadow pass.
- Memory: at about 40 B/vertex non-indexed, that is about 370 MB of GPU buffers plus the same again retained in the JS heap (BufferAttribute arrays kept, chunk merges duplicate per-look geometry). This will crash or thrash iOS Safari and mid-range Android.

Device and quality:
- Default quality is 'high' on every device: DPR up to 2, MSAA, PCFSoft 2048 shadows re-rendered every frame because the sun moves continuously (240 s days) and follows the camera target.
- MeshStandardMaterial plus PMREM environment everywhere. The glass bucket casts shadows.
- No WebGL context-loss handling.
- Up to 3 WebGL contexts: main, thumbnails, and the workshop viewer.
- Glow point sprites can clip at the GPU's max point size on some mobiles.

Plan for smooth mobile:
1. Draw all complete buildings with one BatchedMesh per bucket (three r180 BatchedMesh: addGeometry once per look, addInstance per building, deleteInstance on removal, per-object frustum culling, multi-draw with a fallback loop). Building draws drop from about 1,000 to about 7, there are no chunk re-merges, and memory is one copy per look. The snow patch then needs a USE_BATCHING branch next to USE_INSTANCING (materials.ts:51-60), and attribute layouts must match per bucket (aLit, aWave).
2. Animate spin/blink in the vertex shader via pivot/axis/speed attributes plus uTime so moving parts join the batch, or use one InstancedMesh per animated geometry.
3. LOD per look: full detail versus a simplified variant with no windows, doors or trim, switched with setGeometryIdAt by distance with hysteresis.
4. Indexed, quantized attributes (Int8 normals, Uint8 colours), releasing CPU arrays after upload with a rebuild-on-context-restore path.
5. Shadow tiers. Mobile: blob shadows only. Mid: 1024 PCF with shadowMap.autoUpdate=false, re-rendered only when the sun direction crosses a ~1° step or the camera moves more than about 2 texels, with texel-snapped centring. Desktop: 2048.
6. Device-tiered DPR (mobile ≤1.5, dynamic 1.0–1.5 driven by Renderer.fps), with antialias chosen at construction (off on high-DPR phones).
7. Lambert-based materials on low/medium, and no RoomEnvironment on low.
8. Event-driven sync from sim revisions instead of per-frame diffs. Drop terrain flatten (flat v3 ground). Rebuild roads in 16x16 chunks.
9. Cull NPC and vehicle updates to the view rectangle and hide people beyond about 60 units.
10. Instanced WebGL icon sprites instead of DOM badges at scale.
11. Optional 30 fps cap when paused and the camera is idle.

Target after these changes: about 70–90 draw calls regardless of city size, and ≤0.5–1M visible triangles at the default zoom.

## Reusable
Keep and port these:
- The procedural model pipeline: buildModel/GeoBucket/architecture kit, which builds JSON parts with era palettes into per-bucket geometry. Also ModelCache (ref-counted by look key), modelGroup and lookOf (stable look variants from hash noise).
- The single shared MaterialSet with its cheap shader patches: snow on upward faces, lit-window share via uLit vs aLit, waving flags. Few materials means batching-friendly. On low tiers the same patches can sit on MeshLambertMaterial.
- The Sky lighting model: day/night keyframes, then sun/moon direction, tint, hemisphere, environment intensity, and a sun that follows the target with a distance-sized shadow box. Keep the logic and swap the background for a dome.
- GlowLayer and Particles point-sprite system (one draw call each), including the GLSL. Convert the particle storage to typed arrays.
- Weather (rain/snow box around the target).
- Overlays: the TileMesh/RectLines keyed-rebuild pattern, ghost via cache + ghost material, inverted-hull outline, range visualisation.
- The blob-shadow InstancedMesh, the right default shadow on mobile.
- People Pool (growable InstancedMesh with per-instance colour) and the vehicle geometry builder.
- Road neighbour-joining shape() and the bridge builder.
- Labels keyed DOM pools (fine for a handful of items).
- OrbitCamera damping, zoom-to-cursor and pixel-accurate pan math.
- Renderer.handle event→FX mapping.
- The fps meter (renderer.ts:298-305), reusable for adaptive quality.
- ModelViewer (workshop) and the single shared thumbnail renderer.
