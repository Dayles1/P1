# City Chronicle 3 (Летопись города 3) — design brief

## What exists
"City Chronicle 2" (slug `epochs`, played at /games/city2) is a 3D city builder in the browser: React 19 HUD + three.js scene +
a client-authoritative TypeScript simulation (1-second ticks) driven entirely by JSON content (eras, resources, techs, goals,
buildings with per-level 3D models made of procedural "parts"). Saves go to a Laravel server (delta sync).
It is being ported right now into a new self-contained module `app/Games/City3` that, for now, plays exactly like v2.
Your design is what v3 turns into. Deep analysis of the v2 code (read what you need; it cites file:line):
`C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\understand\`
  1-sim-core.md (economy formulas, calendar, territory) · 2-content.md (content inventory: eras, resources, every building,
  techs, goals) · 3-world-terrain.md · 4-roads-traffic.md · 5-buildings-render.md · 6-ui.md · 7-persistence-server.md · 8-renderer-perf.md
The v2 content itself: `D:\www\P1\resources\games\content\epochs\` (world.json, epochs.json, resources.json, techs.json,
goals.json, buildings/*.json). The v2 engine: `D:\www\P1\resources\games\src\epochs\engine\sim\game.ts`.

## The user's requirements (translated from Russian, complete)
1. One big map, the SAME for every player. Playable land 100 tiles wide × 40 deep. At the start only a 30-wide strip in the
   middle (full depth) is open; the player expands to BOTH sides (left and right). The town hall stands at the map centre.
2. It must no longer look like the map hangs in the air (no floating-slab edges) — the world continues to the horizon.
3. Map assets: no small rocks and trees at all — remove every rock and tree. Along the top (far, north) edge: a mountain range
   OUTSIDE the playable zone but right against it, so stone quarries/mines can be built against it. Along the bottom (near,
   south) edge: sand for about 20 tiles, then water (about 30 tiles of it visible).
4. Roads must improve beyond asphalt into multi-lane roads. "You only change the colour — change the design instead": more
   lanes, sidewalks, decor, etc.
5. Add metro, trains, airport. Content goes only up to the year 2100 for now.
6. Remove the "stupid mechanism" where moving to a new era instantly changes the game year. The game year must always flow at the
   same rate (unless the player speeds the game up). An era transition must not change everything.
7. Fewer currencies: the currency must be ONE unit of something; everything else is just resources; the main interface shows
   only the main currency. The main currency changes from era to era — e.g. once there were coins, then cash, then digital.
8. "Do complex mathematical calculations and try to make the game well thought-out. I don't mind if you turn the game 180°."
9. Redesign the whole interface: convenient on every device, compact, not in the way of the game. SimCity (BuildIt) and Clash of
   Clans are the references. A mobile version is needed.

## Decisions already made (hard constraints)
- TIMELINE (the user chose it): the FULL history, year 0 → 2100. Seven eras kept from v2: Античность (nominal year 0),
  Средневековье (1000), Возрождение (1500), Индустриальная эра (1800), Модерн (1900), Современность (2000), Ближнее будущее (2100).
  Everything after 2100 (e2300/e2500/e3000 and their buildings/resources/techs) is removed.
- CALENDAR: one constant rate for the whole game (we told the user "about 1 year per 25 s at 1×" — tune it only with a strong
  reason). Speed buttons multiply it (×1/×2/×5; testers also ×20/×50). The year never jumps. Eras open by the city's ACHIEVEMENTS,
  not by dates — so "Middle Ages in the year 300" is possible; the historical era years become targets ("ahead of history" /
  "опередить историю") that the design must turn into a real mechanic (bonus, score, prestige… your call). Seasons and the visual
  day/night must be reconciled with this calendar in some sensible way (they cannot be tied 1:1 to a 25-second year).
- MAP GRID: 100 columns (x 0..99). From north to south: the mountain range (outside play; drawn as backdrop; its foot touches
  land row 0), 40 land rows (playable), 20 sand/beach rows (part of the world grid — YOU decide what may be built on sand),
  then the sea (≈30 rows visible, horizon beyond; only rows next to the beach may matter for piers/ports). No trees, rocks or reeds
  anywhere. Start unlocked: columns 35..64 over the full depth; expansion strips are bought on the left and on the right.
  The 2×2 town hall stands at x 49–50, land rows 19–20.
- ONE CURRENCY: one stable resource id `money` across all eras, with a per-era face (name, icon, symbol, look):
  coins → … → banknotes/cash → cards → digital. The main HUD shows only money; everything else is a resource seen elsewhere.
- ROADS: drawn one road per tile. A tile scale like ~16 m lets a 4-lane avenue (4×3 m) plus two 2 m sidewalks fit one tile; widen
  beyond one tile only with a strong reason. Road levels/classes must differ in cross-section (lanes, sidewalks, markings,
  crossings, lamps, trees in planters, benches, bus stops, traffic lights…), not just colour, and should matter for gameplay.
- TRANSPORT: metro, railway with trains, airport — each with a real gameplay function and a place in the eras.
  (Optional extras if they pull their weight: bus/tram, port/harbour, ferry.)
- CONTENT REUSE: v2 has 36 buildings / 155 levels up to 2100 with hand-authored 3D models; every new building needs a new hand-made
  model (expensive). Reuse v2 buildings/levels wherever possible and keep the list of NEW buildings focused.
- PERFORMANCE: phones must run it. Per-tick work must be cheap (no O(N²) per tick); recalculations on structural change are fine
  if indexed. Offline progress exists (v2 caps at 3600 s of 1-s ticks) — you may redesign it (e.g. analytic catch-up, longer cap).
- Single player. The Workshop content editor is NOT carried into v3. A leaderboard exists (score is ranked across players).

## References
SimCity BuildIt (one soft currency Simoleons + production chains of materials, expansions bought with land, services with coverage,
road upgrades, population driven by service coverage, specialisations) and Clash of Clans (builders/timers, clear era-like Town
Hall progression gates, compact mobile UI, satisfying collect loops). Also classic SimCity (RCI demand, budget/taxes, land value,
traffic). Borrow what makes THIS game better; do not clone blindly.
