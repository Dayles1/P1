# Judge panel results (GDD concepts)

Three judges (math, experience, feasibility) scored the three concepts. Raw output below.

## Judge 1

### player — 8

**strengths:** Clearest and most mobile-ready of the three. §0 'whole game on one card' fits the full model into 9 concepts. HUD: one money pill plus a year/era/lead chip `1253 · Средневековье · +247`. Four thumb buttons. Alert badges open the overlay that explains them. The one-line Advisor and bulk actions (drag-paint, 'upgrade this street (12 tiles)', 'outdated homes in view: 14 → one tap') are minimum scope, not polish. Only 3 stocked goods (Food/Materials/Goods) plus an Energy gauge. Prices are fixed and shown on every card. Missing materials are auto-imported, so the player is never blocked. Balance comes from payback targets, so each build card can say 'repays in 14 min'. The Town Hall gate is at most 4 lines, and its two signature buildings teach the next era's transport (harbour → station → metro → airport). Transitions are gradual and well specified: 20-year sky/ambience blend, residents re-dress when they next leave home, income rises only as homes are upgraded. Heritage gives a positive reason to keep old landmarks. Coin faces: Драхмы ₯ → Гроши ₰ → Флорины ƒ → Банкноты ₤ → Наличные ¤ → Карты ▣ → Кредиты ◈, with a coin-flip, the tooltip '1 ₰ = 1 ₯' and a 6-character pill. Two road classes with a one-line choice: 'Avenues move traffic. Streets make homes happy.' There are 11 real cross-sections. Strips are priced by count only, and the first choice is flavoured (ore vein left, deep bay right). A faint 'future airport' plot is drawn from day one: it teases the late game and prevents a soft-lock. The sim found 5 soft-locks and the design fixes each one. Every era is longer than the last (27→105 min). A daily-player table is included. Atmosphere clock has no economic effect.

**weaknesses:** Offline time runs at 0.1× and advances the calendar. A 20-min/day player (the primary mobile audience) therefore drops to ★ from the Renaissance on, so being away is punished. The doc admits this and only floats a fix. Middle Ages and Renaissance bring mostly bigger numbers: the new verbs (port, rail, metro, airport) are crammed into later gates. The economy may be too shallow for mid-core players: factories need no materials, there is one chain per good, and prices are fixed. The Chronicle is only ~13% of the score, so the 'ahead of history' race barely moves the leaderboard. 10×Σ building levels also rewards spamming buildings. Rate units are mixed (money/s in formulas, /min in the HUD and upkeep, years for the calendar). The ★★★ thresholds for the first three eras were reached by no simulated player. '21 Chronicle stars' and the 'Золотое столетие (21 stars)' achievement are impossible: only 6 era entries award stars, so the maximum is 18 (sim-player.mjs entries.slice(1)). The Town Hall builds in only 1–4 min, a weak CoC anticipation beat. About 1,170 actions to the Near Future is a lot for phones.

**fatalFlaws:** Borderline, not an outright break: offline catch-up advances the calendar by up to 115 years 'in one jump' on return. That conflicts with 'the year never jumps' and makes the lead race depend on play schedule rather than skill. Fix: freeze the calendar offline.

### progression — 7.5

**strengths:** Best motivation spine across 0→2100. The Lead is live: it drops 1 per idle year, jumps with each milestone, is shown on the HUD under the year, and turns amber when history gains. The arc 'История догоняет' gives the late game tension. Gold/silver/bronze medals use reachable pars (gold = optimised×1.05) and trigger a Golden Age. A World Expo finale gives a clear end, and 'New Chronicle' adds a replay meta. It is the only concept with an explicit NEW VERB per era: districts+charters → harbour trade orders → railways → metro lines + power grid → airport flight routes (tourist/cargo/business) → smart programs → Expo. Gates are built from the previous era's verb, so they teach, and the Town Hall builds for 5–16 years (a CoC beat). The house need ladder is the most readable density rule: each level adds one named need (water, commerce, health, culture, education, leisure, power, transit, LV, data), so the advisor can say '42 houses can't reach L5: culture'. Organic growth of 1.5%/yr keeps a neglected city alive and cuts taps. Metro UX: tap stations in order, L-shaped auto-routed tunnels, transfers, 6 colours. Money is worth 0 score points, so hoarding earns nothing. The offline calendar pauses, with a capped dividend. Pacing is checked over 5 seeds. 'Upgrade all eligible' is named a mobile must-have.

**weaknesses:** Heavy resource load for phones: 7 goods plus knowledge plus a power flow. Recipes split one cost across up to 6 resources (the Renaissance hall costs money + wood + stone + mat + metal + goods), which clutters cost lines. The price index is tied to the CURRENT era, so export, order and import prices jump ×1.6–1.7 at the moment of era entry: a hidden 'everything changes' effect. The visual clock is speed-scaled (day = season = 240 game-s, 48 s real at ×5, strobing at tester speeds). A seasonal farm modifier of ±20% adds noise the player cannot act on. The national trunk railway is fixed along sand row 40, cutting the land off from the beach with level crossings. There are no tunnel portals. No airport plot is reserved, though the beach allows markets, parks, storehouses, windmills, solar farms, vertical farms and data centres, so it can fill up (the player sim hit exactly this). Upkeep reaches 46% of gross at the finale, which feels like money vanishing. The equivalent-historical-year formula is abstract and needs a 'milestone +40 years' explanation. The roads are a mostly linear 7-step ladder with weaker choice. Score is almost pure speed (√population is a small term), so a beautiful, happy city is barely rewarded.

**fatalFlaws:** Borderline: current-era price indexing (PI_e) makes trade prices jump at era entry. That contradicts 'an era transition must not change everything', but it is a one-line fix (index by the level's era, or fix prices).

### economist — 6

**strengths:** Best cause→effect transparency per decision. Ledger lines on cards read like 'Market: 3 500 customers × 7; city has 2 900 → 83%'. The Treasury panel ranks the top three constraints by money lost per year: a ready-made advisor for mid-core players. Wages follow the workplace level's era and goods demand follows the home level's era, which is the cleanest economic reason the era change is gradual. The calendar freezes offline, with a Treasury Chest collect ritual, so the lead is fair for daily players. The scene clock is capped at ×2, so nothing strobes. The tram boulevard and 4-lane avenue are a real residential-vs-arterial choice, and transit is built into the road classes. The novelty bonus (+40% on exports and tourism, fading) adds a per-era urgency. It has the best proof that the economy is bounded and never dead-ends: saturating sources, arrears instead of debt, mothballing, loans. Sand works as a second economic zone, with the airport at sand row ≥46 so its noise misses the homes. Metro fares and the X-ray tunnel view are good.

**weaknesses:** Too dense for a casual-to-midcore phone audience. One play session meets 7 goods plus fuel inputs, export saturation bars, sell thresholds, the novelty and diffusion formulas, LV gates on high-rises, arrears, mothballing, loans, district policies, crews, a 0–20% tax slider, 44 techs, 35 tasks and 30 achievements. The design's own risk #3 admits it. A fiscal-year toast fires every 25 s (every 5 s at ×5), which is notification spam on phones. Each era gate is a 6-part checklist and double-charges: a Town Hall level AND a separate fee of 3–6 years of income, a pure sink that is less satisfying than watching a hall build. The lead lives in the Chronicle screen, not on the main HUD. The city is still small when the late content lands: 13k residents at Near Future entry and metros at 3.8k population. Most growth (to 95k) happens in a post-content 'sandbox', so the metropolis fantasy arrives after the story ends. Metro, airport and the tram boulevard all unlock in e1900, and there is no clear one-verb-per-era structure. Strip rings are gated by era and must be bought contiguously, so there is less choice. Some currency glyphs are misused or odd: ₯ (the drachma sign) is used for ducats, plus ǥ and ₳. Keeping district_hall, data_center, chemical and composites plants adds roster clutter.

**fatalFlaws:** 

### Best per section

[
 {
  "section": "1. Vision and core loops",
  "from": "player (+progression)",
  "take": "From player: the §0 'whole game on one card' list, the loop table with tap counts, the mobile UX sketch (money pill, year·era·lead chip, 4 thumb buttons, alert badges that open their overlay), the one-line Advisor, and bulk actions as minimum scope. From progression: the fantasy line 'your town outruns history / История догоняет' and the explicit 'what do I do in 30 s / 5 min / session / week' answers."
 },
 {
  "section": "2. Time",
  "from": "economist (+player)",
  "take": "From economist: the calendar FREEZES offline, with a capped Treasury Chest collect ritual and the server check Δgame ≤ Δwall×maxSpeed. From player: the atmosphere clock on real time (8-min day, 16-min season), with no economic effect and no season name on the HUD. Shared by all three: a year-only HUD with a fill ring and no month."
 },
 {
  "section": "3. Eras",
  "from": "progression (+player)",
  "take": "From progression: the one-new-verb-per-era table; gates built from the previous era's verb; a Town Hall build of 5–16 years; the live Lead meter (−1 per idle year, jumps per milestone, amber when history gains); medals with sim-derived pars; and the Golden Age. From player: a gate of at most 4 lines whose two signature buildings introduce the next transport system, the gradual-transition table (20-yr blend, re-dress on leaving home, income only via upgrades), Heritage after two eras, and the 'Spirit of the Age' catch-up discount."
 },
 {
  "section": "4. Currency",
  "from": "player",
  "take": "Faces Драхмы ₯ → Гроши ₰ → Флорины ƒ → Банкноты ₤ → Наличные ¤ → Карты ▣ → Кредиты ◈. No redenomination. A 1.2 s coin-flip at entry. The tooltip '1 ₰ = 1 ₯: the same treasury, a new coin'. 3-significant-digit K/M/B formatting, and the HUD pill never longer than 6 characters."
 },
 {
  "section": "5. Economy model",
  "from": "player (+economist, +progression)",
  "take": "From player as the base: 3 stocked goods plus an Energy gauge; fixed import/export prices shown on cards; one-tap auto-import of missing materials; trade capacity as the visible saturation; and payback-target balancing (T_home, T_prod), so every card can say 'repays in N min'. From economist: ledger lines on cards and the Treasury 'top 3 constraints by money lost per year'. From progression: the rule 'a level never costs a resource first produced in its own era'."
 },
 {
  "section": "6. Population and city",
  "from": "progression (+player)",
  "take": "From progression: the house-level need ladder (each level adds exactly one named need) and organic growth of 1.5%/yr for eligible houses. From player: 'services fill homes', H×(0.7+0.3×covered/unlocked), with the tooltip '34/48 residents: add Health for +7'; happiness doubling as land value; and the single Workforce line instead of RCI bars."
 },
 {
  "section": "7. Map and land",
  "from": "player (+economist)",
  "take": "From player: the 14 strips are priced by purchase count only (no era gate, no deadlock); the first two strips give a flavoured left/right choice (ore vein vs deep bay); the reserved, faintly drawn 'future airport' plot on the beach; and tunnel portals at the mountain foot. From economist: the sand as a second economic zone (villas, glassworks, solar, airport noise kept off homes) and differing deposits per side."
 },
 {
  "section": "8. Roads",
  "from": "player (+economist)",
  "take": "From player: two classes, Street and Avenue, with the card line 'Avenues move traffic. Streets make homes happy.'; 11 cross-sections, each fitting one 16 m tile; three procedural junction meshes; and the cached-BFS per-tile traffic model whose overlay badge reads 'Traffic: −6 happiness in 40 homes'. From economist: the tram boulevard (central tram track, catenary, planters) as the e1900–e2000 street step, with transit share built into the road."
 },
 {
  "section": "9. Transport",
  "from": "progression (+player, +economist)",
  "take": "From progression: harbour trade orders (Renaissance verb); airport flight routes by type (tourist/cargo/business); and the metro built as 'tap stations in order', with auto-routed tunnels, transfers and coloured lines in an X-ray view. From player: rail starts at mountain tunnel portals, a through-line between portals gives +50%, and the airport sits on its reserved beach plot. From economist: metro fares on the line card, and 'noise reaches 14 homes' shown as the reason a placement is invalid."
 },
 {
  "section": "10. Buildings roster",
  "from": "player",
  "take": "A trimmed roster of 33 buildings / 147 levels. district_hall, coal and oil, and the chemical, composites and data-centre plants are folded away for clarity. Costs and effects are formula-derived, and each card has one 'what this does for me' effects line. 13 new models, with a cut-first path to 11. Keep progression's idea of reusing the skyscraper model as a business tower if offices are wanted."
 },
 {
  "section": "11. Research, goals, achievements",
  "from": "player (+progression)",
  "take": "From player: 28 discoveries (4 per era, any 3 gate the era) on a 7-column timeline, each card naming one effect, and always 3 goals on screen (1 gold story goal that teaches the next system + 2 generated side goals). From progression: the gate checklist pinned as the main quest, showing the next 3 items."
 },
 {
  "section": "12. Score and leaderboard",
  "from": "player (+progression)",
  "take": "From player: a composite of peak population, building levels × happiness factor, Chronicle, achievements and Monument, so a good city counts and not only speed; and the 'This era' leaderboard tab so newcomers can rank. From progression: money worth 0 points, and server-side recomputation from the stored era-entry log (entry year ≥ 0.6×gold par, Δgame ≤ Δwall×5.5). Raise the Chronicle share above player's 13%."
 },
 {
  "section": "13. Random events",
  "from": "player",
  "take": "Events are deterministic and seeded by calendar year (the same caravan in year 214 for everyone). 50% are tap-to-collect gifts and 50% are choice cards that show the effect on each button. Values are sized as 'N min of income', and every hazard has counter-play shown."
 },
 {
  "section": "14. Pacing table",
  "from": "player (+progression)",
  "take": "From player: the per-era table with taps, strips and stars; every era longer than the previous one (27→105 min); the 20-min/day player table; and the list of soft-locks found by the sim and designed out. From progression: the 5-seed spread, as the way to report variance."
 },
 {
  "section": "15. Config sketch",
  "from": "player (+economist)",
  "take": "From player: the `scale` block (homePaybackMin, prodPaybackMin, jobsMult) as the single tuning surface, plus the explicit airportPlot, features and transition blocks. From economist: the content-file split (eras.json with money faces and requirements, roads.json with cross-section params, land.json with strips and deposits)."
 },
 {
  "section": "16. Risks, open questions, cut list",
  "from": "player (+progression)",
  "take": "From player: the ordered cut list and the 'Never cut' list (one currency, Town Hall gate, constant calendar + lead, services fill homes, materials auto-import, reserved airport plot), with bulk actions listed as a risk mitigation inside the minimum scope. From progression: 'upgrade all eligible on this block / in view' (one confirmation, summed cost) as a mobile must-have, and the risk note to re-derive medal pars from the sim after every balance change."
 }
]

### Must fix

"1. Offline must not move the calendar or cost lead. Adopt economist/progression: freeze the calendar offline and pay a capped collect-chest. The player concept's 0.1× offline advance makes the year jump by up to 115 on load, and it costs daily mobile players their stars (★ from the Renaissance on).\n2. No hidden instant changes at era entry. Prices must not be indexed by the current era (progression's PI_e makes exports, orders and imports jump ×1.6–1.7). Tie wages, taxes and prices to the building or home level's era, or keep them fixed.\n3. One rate unit everywhere in the UI. Player mixes /s, /min and years. Pick /год, matching the 25 s year ring, and format consistently.\n4. No toast every year. Economist's fiscal-year toast every 25 s (5 s at ×5) is spam. Put the yearly result in the money pill delta or the ring; toast only on notable events.\n5. Reserve the airport plot (player) in any synthesis. Progression and economist both let the beach fill. Keep economist's rule that the airport's noise must stay off the homes.\n6. Strips must never deadlock population gates. Prefer price-by-count strips (player), or prove with the sim that era-gated rings (economist) or strip-count gates (progression) cannot block.\n7. Keep the era gate to 4–5 lines readable on a 360 px phone, with one sink: the Town Hall upgrade plus its visible build time. Drop economist's separate fee on top of the TH level.\n8. Keep build cost lines short. Show money plus at most 1–2 material lines, with one-tap 'buy missing' showing the total. Progression's 6-resource recipes and economist's 7 goods plus fuel inputs must be collapsed or hidden behind a single 'materials' line on phones.\n9. Bulk actions in MVP scope: drag-paint, 'upgrade all eligible / in view', and 'upgrade this street'. All three concepts generate hundreds of upgrades, about 1,170 actions to the Near Future.\n10. Lead always on the HUD with an explanation. Economist hides it in the Chronicle. Progression's live lead needs a cause tooltip ('milestone: +42 years'). Frame the late-game shrink as 'История догоняет', not as failure.\n11. Every era needs a new verb. Player's Middle Ages and Renaissance lack one. Adopt progression's harbour trade orders and flight routes, keeping player's simpler economy.\n12. Seasons never affect the economy (drop progression's ±20% farm modifier). The visual clock must not strobe at ×5/×20/×50: use real time (player) or cap it at ×2 (economist).\n13. Fix player's star math. Only 6 era entries award stars, so the maximum is 18, not 21 ('Золотое столетие' is impossible). Re-derive the ★★★ thresholds for the first three eras so an expert can reach them, for example gold = optimised×1.05 as progression does.\n14. Rebalance the score so the 'ahead of history' race matters (player's Chronicle is only 13%) without ignoring city quality (progression's is almost pure speed). Keep money at 0 points, keep 10×levels from rewarding spam, and recompute on the server.\n15. Late-game upkeep shares of 33–46% (economist, progression) feel like money vanishing. Cap them around 25–30%, or show category bars with levers on the budget sheet.\n16. The city must feel big when the metro and airport arrive. Avoid economist's 13k residents at Near Future entry; tie metro and airport to real density.\n17. Currency glyphs. Use the player set. Avoid misused or rare glyphs (₯ only for Antiquity; avoid ǥ, ₳, Ȼ). Per the UI brief, draw each face as an inline SVG icon, not a font glyph.\n18. Rail should come out of the mountain tunnel portals (player/economist), not run as a fixed trunk along sand row 40 (progression), which cuts the land off from the beach.\n19. All three sims are aspatial. Budget ±20% retuning of service radii and road capacity, and log ρ and coverage per era in the first playable to compare with the sim traces."

## Judge 2

### economist — 7

**strengths:** Covers R1, R3, R5, R6 and R7 cleanly and is the strongest on R8.
- R6: the year is derived from time and never stored; the calendar freezes offline and a capped Treasury Chest replaces the 3600-tick catch-up, so the year never jumps on load and phones skip the catch-up cost. Wages follow the workplace level's era and goods demand follows the home level's era, and base prices are fixed (not era-indexed), so income rises street by street and nothing reprices when the era flips.
- Content reuse is best: all 36 v2 buildings and 148 levels plus the 7 road levels, with only 4 new building defs (port, rail station, metro station, airport).
- Cheapest robust traffic model: a summed-area-table 9x9 box sum over about 6000 cells, recomputed on structural change and once a year.
- Every income source saturates, with a written proof that income is bounded (about 5M/yr). Arrears, mothballing and loans mean no dead-ends, and the treasury never went negative in the sim.
- The map has real zoning: the mountain foot is the extraction belt and the sand is a second economic zone; the two sides carry different deposits.
- The 8 road classes are specified in metres per cross-section, with capacity, LV and happiness numbers.
- The most complete world.json config sketch.
- I re-ran the sim and it reproduces the doc's tables exactly.

**weaknesses:** - R9 is weak. There is no mobile UI design, the doc itself says "dense for mobile", and the player must handle a tax slider, saturation bars, sell thresholds, loans, mothballing and district policies.
- R2 (horizon, no floating slab) is not specified. This is true of all three concepts.
- Largest updateEconomy rewrite: 7 goods plus energy and knowledge, per-good depth and saturation, novelty, diffusion, crews, arrears, loans, Expos, and per-tile LV and congestion.
- Happiness per home includes city-wide terms (tax, unemployment), and occupancy is nonlinear, so P* needs O(homes) work per tick unless homes are bucketed into a histogram.
- Metro tunnels are drag-built tile by tile: a hard UX on mobile, and a second occupant layer.
- The tram boulevard adds tram vehicles and catenary on top of the road kit.
- The "port L1 reuses fishery L3 recoloured" claim is invalid: fishery is a 1x1 model and the port is 3x3, so the port needs 3 new models (12 new in total, not 11).
- The sim's player builds 13–21 ports, because ports are not unique and their trade capacity stacks. That is a degenerate stacking strategy.
- No reserved airport plot (12x4 on sand that villas, solar and glassworks can fill), and the airport L2 is an e2100 gate item.
- The rail station is 4x2 with its long side on the track, but the engine has no building rotation, so stations only work on east-west track.
- 44 techs is a large research UI for mobile.

**fatalFlaws:** 

### progression — 6

**strengths:** - Best spine for "ahead of history": a live Lead meter, Lead = E(t) − Y. It drops by 1 every idle year, jumps with each milestone and is always on the HUD. Medals come with sim-derived pars, and the doc tells a clear "history catches up" story.
- The gate checklist structure teaches each next era: every era's milestones use the previous era's new verb, and in most eras population is the last item the typical player completes.
- The Town Hall build time (5–16 yr) gives a CoC tension beat.
- One-table content tuning: a value V per level plus a per-era recipe. "A level never costs a resource first produced in its own era" removes chicken-and-egg builds.
- Two-phase production settlement and two-tier labour fix v2's order and starvation bugs.
- Organic house growth at 1.5%/yr stops a neglected city from freezing.
- Offline: the calendar freezes, with a capped 1-year dividend. Cheap on phones, fair to the race.
- Progress-first score: era base, lead, medals, 10·√pop, strips. Money counts 0, so the score is bounded and hoarding gains nothing.
- Honest content count: all 36 buildings and 155 levels reused; 11 new models, with the port counted as 3 new.
- Most robust pacing evidence: the sim was run over 5 seeds, and I reproduced its output.

**weaknesses:** - It needs the most new bespoke systems, each with its own state and UI: district charters, port trade orders with expiry, the national trunk line, flight-route slots and types, smart programs, a maglev, and the World Expo. Each one is a new screen on mobile.
- The national trunk railway is fixed along sand row 40 across the whole map, locked strips included. Every road to the beach then crosses it as a level crossing (−30% capacity), and it must be rendered and animated outside the owned land.
- Day/night runs on game time (240 s) and one day equals one season (9.6 years). So every day is a different season, and the scene flickers at ×5 and strobes at the ×20/×50 tester speeds.
- The winter farm multiplier (0.8) is an economic effect tied to that flickering clock.
- "Roads may cross 3 sea tiles as a bridge" makes sea tiles buildable, which adds scope.
- Upkeep reaches about 46% of gross at the finale, which BuildIt players will read as money vanishing.
- The medal pars must be re-derived after every balance change.
- The slow profile hoards up to 114M because its gates are population-bound, not money-bound.
- The aggregate sim needs 10–25% more service buildings on a real map.
- Same station-orientation and airport-space risks as the economist; R2 unspecified.

**fatalFlaws:** - Breaks R6 as written (fixable). Export, import and "buy missing" prices use the price index PI of the CURRENT era (1 → 1.6 → 2.6 → … → 18). Every price therefore jumps 1.6–1.7× the moment the Town Hall completes, which is exactly the "era change changes everything" the user wants gone. Index prices to the level or good, or keep base prices fixed (the economist's approach).

### player — 7.5

**strengths:** - Strongest on R9 and R7: a whole-game-on-one-card concept list, a concrete mobile HUD (money pill, year/era/lead chip, 4 thumb buttons, alert badges that open overlays), bulk actions (paint a row, "upgrade this street", "upgrade outdated homes in view") and a one-line Advisor.
- Only 3 stocked goods plus energy, and no knowledge resource: the fewest currencies and the least for the HUD to explain.
- Lowest engine risk:
  - one Uint8 coverage grid per service, stamped on build, upgrade or demolish, so zero per-tick cost and binary, readable coverage;
  - cached BFS reach sets for traffic, updated only for buildings whose reach changes;
  - it states outright that v2's O(B²) recalculate must not be ported.
- Payback-target balancing (home and producer payback in minutes per era) is one readable source of all numbers.
- Fixed prices; trade is limited by visible trade-capacity stats, not hidden price curves.
- The sim found five soft-locks and the design fixes each:
  - price-only strips with no era gate, so no land deadlock;
  - a reserved 16x5 airport plot that roads and parks can use until the airport goes in (refunded 100%);
  - a lower top population gate;
  - goods made from workers, not materials;
  - a flattened late-era jobs multiplier.
- Street vs Avenue is a real road decision ("avenues move traffic, streets make homes happy").
- Seasons and day/night run on real time (8-min days), so they never strobe and have no economic effect.
- Events are seeded by calendar year, so every player meets the same events, which keeps the board fair.
- Heritage gives a reason to keep old buildings.
- I re-ran the sim and it reproduces the doc's tables.

**weaknesses:** - R8 depth is the lowest: fixed prices, 3 goods, no land-value layer, no budget sheet. The user asked for "complex mathematical calculations".
- Drops 6 v2 buildings with existing models: district_hall (and with it district policies), chemical_plant, composites_plant, data_center, coal_mine and oil_well. Late-era variety thins, and it goes against "reuse wherever possible".
- 13 new models including a Monument.
- The "reuses" for port L1/L3 (1x1 fishery models in a 3x2 footprint) are really new work.
- 11 road cross-sections is the most renderer work of the three.
- Rail may cross an avenue only by overpass, which means new overpass geometry.
- The analytic offline integrator is a second economy implementation that must match the tick sim exactly.
- The 16x5 airport is the largest footprint in any of the designs.
- Mixed units: it reports per second and per minute while the calendar is in years.
- The ★★★ thresholds for the first three eras were reached by no simulated player.
- The station needs track along its long side, but there is no building rotation (same orientation issue as the others).
- R2 unspecified.

**fatalFlaws:** - Breaks the hard constraint "the year never jumps" (fixable). Offline time runs at 0.1× and advances the calendar, so on return the year lands up to 115 years later in one step ("the city lived 115 years while you were away").
- Because those offline years pass without decisions, a daily player loses lead and stars; the design admits daily players mostly earn ★.
- Fix: freeze the calendar offline and pay a capped chest, as the economist and progression designs do.

### Best per section

[
 {
  "section": "1. Vision and core loops",
  "from": "player",
  "take": "- The \"whole game on one card\" concept list (money, citizens, happiness, 4 services, 3–7 goods, energy, traffic, Town Hall, Chronicle) as the readability contract.\n- The §1.4 mobile UX sketch: bulk paint, \"upgrade this street\", \"upgrade outdated homes in view\", the one-line Advisor, and alert badges that open the matching overlay.\n- Pair it with the economist's fiscal-year toast as the automatic 25-s collect beat."
 },
 {
  "section": "2. Time",
  "from": "economist + player",
  "take": "- Economist: the year is derived from time and never stored; 25 s/yr; speed multiplies everything.\n- Economist: offline FROZEN, with a capped Treasury Chest (about 4 years of net, filled over 8 h, claims recorded on the server). This removes the 3600-tick catch-up and any year jump.\n- Player: the atmosphere clock on real time while unpaused (8-min day, 16-min season, weather 3–6 min), with no economic effect and no season name on the HUD.\n- Drop progression's day = season clock in game seconds."
 },
 {
  "section": "3. Eras",
  "from": "progression",
  "take": "- The live Lead meter, E(t) − Y, on the HUD year chip: green while growing, amber while history gains.\n- Medals at entry, with pars derived from the sim.\n- The Town Hall upgrade as the era transition, with a build time.\n- Gate items that use the current era's verb.\n- Trim each checklist to at most 4 lines (player): population, 2 signature buildings, 3 of 4 discoveries.\n- The economist's novelty fade on exports and tourism as the economic reward for advancing promptly, and its diffusion catch-up (or the player's Spirit of the Age).\n- The economist's/player's gradual-transition table: sky, NPC clothes and vehicle mix blend over 20 years; buildings and roads keep their look until upgraded; wages and tax follow building-level eras."
 },
 {
  "section": "4. Currency",
  "from": "player",
  "take": "- One `money` id with 7 faces (drachma → groats → florins → banknotes → cash → card → credits); no redenomination.\n- 3-significant-digit K/M/B formatting with a HUD pill of at most 6 characters.\n- Tooltip \"1 ₰ = 1 ₯\".\n- A 1.2 s coin-flip on entry; the old era's coin stays in old buildings' animations."
 },
 {
  "section": "5. Economy model",
  "from": "economist",
  "take": "- Fixed base prices, never era-indexed.\n- Saturating sources: export depth and decay, shop customers capped by residents, tourism and tax capped by happiness, population capped by land. Use the bounded-income proof as the design check.\n- Arrears, mothballing and loans for no dead-ends.\n- The priority job classes.\n- Generate every level's cost with progression's V × per-era recipe, keeping the rule \"never cost a resource first made in this era\".\n- Progression's two-phase settlement for inputs.\n- Cap the resource list at the 7-good short list. The player's 3 goods are the fallback if mobile playtests show overload."
 },
 {
  "section": "6. Population and city",
  "from": "player",
  "take": "- One Uint8 coverage grid per service, stamped with a radius diamond on structural change; binary coverage; zero per-tick cost.\n- Services fill homes: H = housing × (0.7 + 0.3 × covered share).\n- From progression: house-level service needs (BuildIt density gating) and organic growth at 1.5%/yr for eligible houses.\n- Split per-home happiness into a static part (recomputed on structural change) and city-wide terms (tax, unemployment, power), so the tick stays O(1)."
 },
 {
  "section": "7. Map and land",
  "from": "player",
  "take": "- Price-only strips (the k-th purchase costs the same on either side) with no era gate: provably no land deadlock.\n- The reserved airport plot on the beach, usable by roads and parks until the airport goes in (100% refund).\n- From the economist: the zone table (the mountain foot as the extraction belt, the sand as the tourism, energy, glass and airport zone) and side-specific deposits, so expansion order is a strategy that is the same for everyone."
 },
 {
  "section": "8. Roads",
  "from": "economist",
  "take": "- One tile = 16 m. Classes defined by cross-section in metres (lanes, sidewalks, kerbs, median or planters, lamps, zebras, bus shelters, traffic lights), with capacity, upkeep, LV and happiness per class.\n- The summed-area-table traffic model (9x9 box sum over about 6000 cells, on structural change plus once a year) feeding productivity, happiness and LV.\n- Present it with the player's two-family framing, Street (pleasant) vs Avenue (capacity), and cut to about 7–8 cross-sections in total to bound renderer work."
 },
 {
  "section": "9. Transport",
  "from": "economist",
  "take": "- One economic job per system: port = cheap bulk trade; rail from fixed mountain tunnel portals = trade, commuters, tourists; metro on an underground layer = congestion relief plus LV; airport on sand = the biggest tourism and high-value export lever.\n- Metro line building from the player/progression design: tap stations, tunnels auto-route on a Manhattan or L path, at most 4–6 lines.\n- Port and airport are unique per city.\n- Drop progression's national trunk line."
 },
 {
  "section": "10. Buildings roster",
  "from": "economist",
  "take": "- Reuse all 36 v2 buildings and 148 levels (plus the road levels), with lumber reworked as a forestry plantation.\n- Only 4 new building defs (port, rail station, metro station, airport).\n- The full roster generated by the sim, with the v2 model cited per level.\n- Correct the port to 3 new models instead of \"fishery L3 recoloured\"."
 },
 {
  "section": "11. Research, goals and achievements",
  "from": "player",
  "take": "- 28 discoveries (4 per era, any 3 of 4 gate the era), paid in money, one at a time; schools give research speed. This removes knowledge as a second pseudo-currency.\n- 3 goals on screen: 1 story goal that teaches the next system and 2 generated side goals.\n- Use progression's \"main quest = the gate checklist\" pinning."
 },
 {
  "section": "12. Score and leaderboard",
  "from": "progression",
  "take": "- Progress-first score: era base + max(0, lead) + medal points + 10·√peakPop + 100·strips + achievements; money counts 0.\n- Recompute it on the server from the stored era-entry log and buildings.\n- Plausibility checks: Δgame ≤ Δwall × maxSpeed, pop ≤ capacity, strips ≤ allowed; tester speeds take the save off the board."
 },
 {
  "section": "13. Random events",
  "from": "player",
  "take": "- Events chosen deterministically by hash(calendar year) over the era's list, so every player meets the same event in the same year.\n- A mix of gifts and choice cards, sized in \"N minutes/years of income\".\n- Skipped offline.\n- Add the economist's/progression's rule that every negative event names its counter-measure."
 },
 {
  "section": "14. Pacing table",
  "from": "progression",
  "take": "- The method: three profiles, a 5-seed spread, and medal pars derived from the sim (gold ≈ optimised × 1.05, silver ≈ typical × 1.05).\n- Add the player's daily-mobile-player table (20 min/day) and its action/tap count as acceptance metrics."
 },
 {
  "section": "15. Config sketch",
  "from": "economist",
  "take": "- The world.json shape: map (100 wide, 40 land rows, 20 sand rows, sea, start columns 35–64, town hall, portals); time (secondsPerYear, scene clock, offline frozen, chest); economy, population, LV, traffic, chronicle and land blocks; per-era currency faces in eras.json; roads.json with cross-section parameters; land.json for strips and deposits."
 },
 {
  "section": "16. Risks, open questions, cut list",
  "from": "player",
  "take": "- The soft-lock list found by the sim, with its fixes.\n- The performance list: O(1) tick, grid stamping, no port of v2's O(B²) recalculate, NPC caps.\n- Bulk actions as minimum scope.\n- Combine with the economist's \"never cut\" list (one currency with faces, the constant calendar with lead, strips with deposits, road cross-sections, saturating trade) and progression's cut order (bespoke verbs such as smart programs and flight-route types go first)."
 }
]

### Must fix

"These apply whichever concept wins. Items 1, 2, 4, 5, 6, 7, 8, 11, 13, 14, 15 and 16 come from the v2 code analysis in scratchpad\\understand.\n\n1. **R2 is unspecified in all three concepts.** The synthesis must spell out the renderer work:\n   - delete the terrain skirt;\n   - replace the map-sized water plane with an ocean of about 3000 units;\n   - add side land aprons in the locked tint, plus a separate, non-pickable mountain ridge mesh;\n   - replace the screen-space background with a world-space sky dome whose horizon colour matches the fog;\n   - fix the camera yaw at about 0 (±15°), MAX_DISTANCE about 70, and an aspect-aware FOV for portrait;\n   - pick with an exact ray–plane intersection at y = 0 instead of ray-marching.\n\n2. **Calendar never jumps, including offline.** Derive the year from time; freeze offline; pay a capped chest or dividend; delete the 3600-tick catch-up. Reject the player concept's 0.1× offline calendar.\n\n3. **Era change must not reprice the world.** No price index keyed to the current era (progression's PI). Income rises only through building-level eras.\n\n4. **Engine limits to lift:**\n   - building size cap 1..4 in BOTH validators (TS registry and PHP ContentValidator), for the 4x2 station and the 10–16 x 4–5 airport;\n   - the unique-role rule, replaced by `network: road | rail | metro`;\n   - a road|rail tile bitmask for level crossings;\n   - a second underground Int32 layer for the metro;\n   - no building rotation, so either add `rot` 0..3 or fix the station (long side east–west) and airport orientations explicitly.\n\n5. **Per-tick cost.** Never port v2's O(B²) recalculate or the per-tick O(goals×B) updateGoals. Coverage, LV, pollution and traffic recompute only on structural change, through grids or summed-area tables. Split happiness into static and city-wide parts so the tick is O(1); the economist's occupancy rule needs a histogram.\n\n6. **Rendering at scale.** About 900+ buildings means 1600–1800 draw calls and hundreds of MB of geometry with the v2 renderer. Plan BatchedMesh or instancing per bucket, LOD, tiered shadows and DPR, event-driven sync, and road meshes rebuilt per 16x16 chunk.\n\n7. **Persistence.** Stop saving tiles; the map is content. Save roads and rail as packed layers on the world row, not as one building row per tile. Add an era-entry log (for lead and score), unlocked strips, metro lines, and economy state (chest, loans, golden-age or novelty timers). Version the save format. Keep keepalive saves under 64 KB.\n\n8. **Leaderboard trust.** The score is recomputed on the server from the era-entry log plus buildings, with plausibility caps. Events are seeded by year so luck is equal for all players.\n\n9. **Soft-locks.** Reserve the airport plot. Strip pricing must not deadlock with population gates (price-only, or gates ahead of need). Bulk \\\"upgrade eligible in view\\\" is minimum scope (v2's upgradeAll exists).\n\n10. **Honest model count.** Port, station, metro and airport levels are new work; a 1x1 fishery model is not a 3x3 or 3x2 port. Make the port and airport unique (the economist's sim stacks 13–21 ports).\n\n11. **Gradual visuals.** Replace npcs.onEpochChanged (instant re-dress plus clearing all traffic), the per-era HUD theme, the sky palette swap and the white flash with blends over about 20 years.\n\n12. **Units.** Use per-year everywhere in UI and content; 1 tick = 1/25 of a year.\n\n13. **No map trees or rocks.**\n    - Remove the features system and the `near` bonuses.\n    - Replace them with the placement rule \\\"footprint touches land row 0\\\" for quarry and mine, plus per-column deposits.\n    - Wood needs a plantation building, or must be dropped.\n\n14. **Mobile input.**\n    - Tap-to-place with a draggable ghost and ✓/✗ buttons.\n    - The road and rail drag must not steal one-finger pan.\n    - The metro is built by tapping stations (auto-routed tunnels), not by dragging tunnels.\n\n15. **Road scale.**\n    - Use 16 m tiles.\n    - Shrink vehicles and take lane offsets from the road profile.\n    - Use right-hand traffic.\n    - Put pedestrians on sidewalks.\n\n16. **Module setup.** Keep the economy as pure TS with vitest. Follow the self-contained GuWorld/Sandbox template: own DB connection, migrations with new filenames, provider listed before GamesServiceProvider, own /summary and /leaderboard endpoints."

## Judge 3

### economist — 8

**strengths:** The strongest maths of the three. Every income source has an explicit bound: export revenue q·P/(1+q/depth) never exceeds P×depth, tourism has a hard ceiling, and tax, sales and commerce scale with population, which land caps. The doc derives the total ceiling (~5M/yr) and the sim agrees (opt ends at 4.16M). I stress-tested it: a sim copy that carpets the free sand with Antiquity amphitheatres from the Industrial era moved par's 2100-era entry only 356→345 min and opt's 265→262. Saturation holds. Upgrades are one step at 70% of the next level, so a chain never beats a direct build (c[n−1]+0.7c[n] > c[n]); there is no skip discount and no refund loop. Base prices are fixed. Jobs fill in priority classes (services → food → raw → industry → commerce), which fixes v2's global starvation. Running inputs, including fuel and energy for power, have an import fallback. Arrears instead of debt, mothballing and loans close the dead-ends. Money never went below 0 in any profile. The roster is generated by the script, all 36 v2 buildings and 155 levels are reused with only 11 new models, and the world.json config is the most complete. Traffic uses a summed-area table recomputed on structural change.

**weaknesses:** (1) Era entry still moves prices, against the doc's own 'nothing jumps' claim: tourism spend[city era] steps ×1.44–1.67, market depth eraDepth steps ×1.45–2, and novelty resets to +40% on exports and tourism. That is up to ~25% of income changing at once. (2) The Treasury chest fills on the wall clock (4 years of net per 8 real hours, ≈12 game-years of income per day) while the calendar is frozen. Spreading play over many real days therefore buys Chronicle lead. The 'under 2% of a 6-hour game' claim only holds if the whole game is played in one day. (3) Expansion barely features in the main arc: par owns 0 strips until Contemporary and 3 at the 2100-era entry; the rest are bought in the sandbox. (4) Happiness above 60 does nothing for occupancy, so 'raise tax until happiness ≈ 60' is a solved rule. (5) Wood has no consumer after about e1800, so forestry L4–L5 are export-only traps. (6) The score is dominated by population and Expos: the hoarding slow profile holds 8 Expos versus par's 3, so money converts to score. (7) The arrears path never ran in the sim (0 s in arrears), so the no-dead-end proof is untested. The basis of the demolition refund is not specified.

**fatalFlaws:** 

### progression — 6

**strengths:** The best progression spine: a live Lead meter E(t)−Y, medals against par years, a modest Golden Age, and gates that require the previous era's new activity. One value V per level plus a per-era recipe tunes every cost from one table. The rule 'a level never costs a resource first made in its own era' removes chicken-and-egg builds. Upgrades are one step, settlement runs in two phases, and labour fills in two tiers. Its offline rule is the safest: calendar frozen, dividend ≤1 year of net, at most once per 25 game-years. The score gives money zero points and is bounded (10·√peak population). It reports a 5-seed spread, and the density gating by services makes the player plan.

**weaknesses:** (1) Fuel for running power plants and industry has no import fallback; 'buy missing' covers construction only. I reproduced a death spiral with a sim copy that places up to 400 Antiquity markets on sand from the Industrial era. With no room left for oil wells, fuel ratio drops to 0 and power is 0 from year 350. Happiness falls to 23–50, population freezes at 10.2K, and upkeep reaches 91K of 97K gross while the AI keeps adding fuel-less plants (power upkeep 23K→61K). The optimised profile never leaves Modern in 3,600 years: 6,616 redevelopments, 130 years below zero. (2) Demolition refunds 50% of the current level's list money cost (sim lines 953/963), while houses climb levels for free at 1.5%/yr (about 1,900–3,200 free upgrades per run). Free value turns into cash. (3) The current era's price index sets exports, imports, port orders and tunnel cost (sim lines 463/726/781/492). That is a +57–67% step at every era entry, and an old-era level's missing materials cost up to 18× their own-era price. (4) Late population gates sit near the map ceiling: the finale needs 50K against the doc's own ~70K bound, and coverage is aspatial. (5) Medal pars are sim outputs and drift with any rebalance. (6) The slow profile hoards 114M, so money sinks never bind for passive players. Upkeep reaches 46–53% of gross at the finale. (7) Heritage tourism is linear and counts newly built old-era levels. The finale target of 2200 lies past the 2100 content horizon.

**fatalFlaws:** Game-breaking as written, though fixable: running fuel has no import, so power can fall to 0, and the resulting happiness/upkeep trap does not recover on its own (the stall above). Population gates near land capacity risk an unreachable finale for poor layouts. No hard requirement of the brief is broken.

### player — 6

**strengths:** The most elegant generator. Every home's price and every producer's output comes from cost and one per-era payback-minutes table (T_home 3→80, T_prod 4→62). This gives readable paybacks and pacing that grows from structure, not artificial walls. Prices are fixed, there are only 3 goods plus energy, and binary coverage grids keep it cheap and clear. The sim found five soft-locks and designed them out: era-gated strips (fixed by count-priced strips, which cannot deadlock), the beach filling before the airport (fixed by a reserved plot), an unreachable 75K gate, factories starved of materials, and late eras with no free workers. It is the only concept with a 32-point parameter sweep (264–306 min) and a daily mobile player simulation. Offline catch-up is analytic, O(completions). The median bank is 0.7 min of income, so there is no hoarding.

**weaknesses:** (1) Upgrades cost 70% of the target, may skip levels, and direct builds cost 100% (sim costOf/add/upgrade around lines 471–505). Placing an L1 hut (cost 7) and upgrading straight to L11 costs 98K against 140K direct: a universal 30% discount on all construction. (2) Tourism = attraction × 0.01 × M[current era] × (1+access) with no saturation, and Heritage depends on the level's era. A newly built Antiquity amphitheatre (~160) is therefore Heritage at once and in e2100 earns about 1,000/min (payback ≈10 s). A sim copy that places amphitheatres on the beach from the Industrial era cut typical Near Future entry 314→292 min, raised the tourism share in e1800 from 7% to 27%, and earned ★★★ in Modern and Contemporary. (3) The score term 10×Σ building levels has no cap. Carpeting the beach with park L5 (4.2K, 50 points each) adds about +75K, ~28% of a typical 272K. The happiness factor is read live, so it can be gamed at submission. (4) Offline time runs at 0.1× and counts against lead: daily players earn only ★ from the Renaissance on, and the year jumps by up to 115 on load. (5) The Treasury grant (5 min of gross, never repaid, once per era) can be farmed by briefly going net-negative. (6) Tourism steps ×1.8–3.7 at each era entry. (7) The 60K Near Future gate is close to the map ceiling (the 75K version soft-locked). (8) It drops 6 v2 buildings with existing models and needs 13 new models. Upkeep of 6–10% leaves little fiscal tension, and the Monument converts money into up to 50K score.

**fatalFlaws:** Nothing breaks a hard requirement outright. The offline catch-up advancing the year by up to 115 on load arguably conflicts with 'the year never jumps / always flows at the same rate'.

### Best per section

[
 {
  "section": "1. Vision and core loops",
  "from": "progression",
  "take": "The loop table with a number at every scale, and the rule that each era adds a new activity (districts → harbour orders → railways → metro/power → airport routes → smart programs). Add the economist's yearly close toast and the Treasury panel that ranks the top-3 bottlenecks by money lost per year."
 },
 {
  "section": "2. Time",
  "from": "progression",
  "take": "25 s per year, never jumping. Freeze the calendar offline and pay a welcome-back dividend of at most 1 year of net, at most once per 25 game-years. It is analytic and cannot be exploited. Combine it with the economist's scene clock (sceneTime += dt × min(speed, 2), cosmetic seasons) so ×5 never strobes."
 },
 {
  "section": "3. Eras",
  "from": "progression",
  "take": "A live Lead meter, medals at entry, a modest Golden Age, and gates that require the previous era's new activity, with 3 of 4 discoveries. Add the economist's 'gross revenue last year' gate item, which cannot be faked with one token building, and its diffusion catch-up for cities behind history."
 },
 {
  "section": "4. Currency",
  "from": "player",
  "take": "One money id with seven faces and no redenomination; 3-significant-digit K/M/B formatting with a HUD pill of at most 6 characters; the tooltip '1 ₰ = 1 ₯: the same treasury, a new coin'."
 },
 {
  "section": "5. Economy model",
  "from": "economist",
  "take": "Bounded, saturating income sources (export price p(1−D)/(1+S/depth) with decaying saturation; tourism capped). Fixed base prices. Import fallback for running inputs, fuel and energy included. Arrears instead of debt, plus mothball and loans. Use the player's payback-target formula only as the tool that generates content numbers."
 },
 {
  "section": "6. Population and city",
  "from": "progression",
  "take": "House levels gated by services, using the aggregate cap 'houses at ≥L ≤ N·min coverage', plus the 1.5%/yr organic climb so a neglected city never freezes, with the refund fixed to money actually paid. Add the economist's priority job classes and the happiness→occupancy curve."
 },
 {
  "section": "7. Map and land",
  "from": "player",
  "take": "Strip price depends only on how many strips are owned, with no era gate, so it cannot deadlock, and either side may be bought. The reserved airport plot on the beach. Add the economist's sand as a second economic zone and its asymmetric deposits (east metal early, west fuel later)."
 },
 {
  "section": "8. Roads",
  "from": "economist",
  "take": "8 one-tile classes, each with a capacity, LV and happiness value. Traffic ρ from a summed-area table over a 9×9 window, recomputed only on structural change and once a year. Tram and bus come with boulevard and avenue classes, which remove 15% and 8% of trips."
 },
 {
  "section": "9. Transport",
  "from": "economist",
  "take": "Each system gets one distinct, quantified economic job: port for cheap bulk trade, rail from fixed mountain portals for trade, commuters and tourists, metro on its own underground layer for congestion relief, LV and fares, and the airport on sand for tourism access and high-value exports, with its noise kept off the homes."
 },
 {
  "section": "10. Buildings roster",
  "from": "economist",
  "take": "The full script-generated roster: all 36 v2 buildings and 155 levels reused, only 11 new level models (rail ×3, metro ×3, airport ×3, port ×2), and port L1 reusing the recoloured fishery L3."
 },
 {
  "section": "11. Research, goals, achievements",
  "from": "progression",
  "take": "28 discoveries, 4 per era, with any 3 of 4 opening the gate, one lab slot, and a research-speed clamp of 0.6–1.25× by knowledge. Add the economist's measurable economic Chronicle tasks (e.g. 'net ≥ 40% of gross for 10 years') as side goals."
 },
 {
  "section": "12. Score and leaderboard",
  "from": "progression",
  "take": "Money is worth 0 points, population counts as 10·√peak and is bounded, plus lead and medals at each era entry, strips and achievements. Every component is bounded and speed-neutral. The server recomputes the score from the stored era-entry log."
 },
 {
  "section": "13. Random events",
  "from": "player",
  "take": "A deterministic schedule hash(year) that is the same for every player, gifts and choice cards sized in minutes of income, and none offline. Keep the economist's rule that every negative event names its counter-measure."
 },
 {
  "section": "14. Pacing table",
  "from": "player",
  "take": "The method: 3 profiles plus a 32-point parameter sweep, a simulated 20-min-a-day mobile player, the list of soft-locks the sim found, and the economy-health table (median bank, upkeep share, income mix per era). Add progression's multi-seed spread and a perturbation/exploit pass."
 },
 {
  "section": "15. Config sketch",
  "from": "economist",
  "take": "The complete world.json-level config: map, scene clock, offline, prices and depths, eraDepth, wages, tax elasticity, population, LV, traffic, chronicle, land rings and events, all with named constants."
 },
 {
  "section": "16. Risks and cut list",
  "from": "player",
  "take": "Soft-locks found by simulation and designed out, kept as a standing release test, plus the open question on daily players and lead. Use the economist's ordered cut list and its 'never cut' core."
 }
]

### Must fix

"1. Upgrade pricing: a skipping upgrade must never beat a direct build. Either allow 70% only for a single-step upgrade, or charge target cost − 0.7 × the value already paid. The player concept currently gives a 30% discount on all construction via 'build an L1 hut, then skip to L11'.\n2. Demolition refund must be 50% of money actually paid, never of the level's list cost. Progression refunds list cost on levels that houses gained for free through organic growth.\n3. Tourism must saturate, like the economist's X/(1+X/cap). It must scale with each attraction's own level era, not the current era's multiplier. Heritage must depend on time since construction (built ≥2 eras ago), not on the level's era, or cheap Antiquity amphitheatres become money printers. In the player sim this cut the time to the Near Future by 7% and shifted ★★→★★★.\n4. Running inputs need an auto-import fallback at a markup whenever money > 0: fuel for power plants and industry inputs. Without it the power→happiness→upkeep spiral can stall a city permanently. Progression stalled in Modern for over 3,000 years with upkeep at 94% of gross. Also, power plants without fuel must not keep charging full upkeep or be chosen by the Advisor.\n5. Nothing economic may step at era entry. Progression indexes exports, imports, port orders and tunnels by the current era's price index (+57–67% per era). The economist steps tourism spend and market depth. The player steps tourism by M[era] (×1.8–3.7). Ramp these over the 20-year transition or tie them to the producing building's level era.\n6. Offline: freeze the calendar and give one capped dividend tied to game time, as progression does (≤1 year of net, at most once per 25 game-years). The player concept's 0.1× offline costs daily players their stars and makes the year jump up to 115 on load. The economist's wall-clock chest (≈12 game-years of income per day, earned without spending game years) rewards spreading play over real days.\n7. Score: no cheap or unbounded terms. Drop the player's 10×Σ building levels (a beach of park L5 adds ~28% of score), read happiness as a peak or average rather than live, and cap money→score converters (Expo, Monument), or a hoarder out-scores an active player (economist slow 8 Expos vs par 3).\n8. Late-era population gates must leave a margin of at least 30–40% below realistic map capacity, checked by a spatial pass with coverage efficiency ≈0.75. Progression's finale needs 50K against a ~70K bound; the player concept's 60K gate came after a 75K version soft-locked. Give each late gate a density path (a tech or policy).\n9. Safety nets must not be farmable. The player's Treasury grant (5 min of gross, never repaid, once per era) should become a loan. The economist's arrears/mothball path needs an actual sim test: it never fired.\n10. No dead resource or trap level: wood has no consumer after about e1800 in the economist and progression concepts. Add late sinks or cut forestry L4–L5. Knowledge needs a use after all research is done.\n11. Expansion must be part of the main arc, not the sandbox. Economist par owns 0 strips before Contemporary, so its ring prices are too steep or its start strip too generous.\n12. Medal and star thresholds must live in data and be re-derived from a re-run sim after every balance change. Every sim needs a robustness pass, not only three tuned greedy profiles. Evidence (design files untouched): perturbation copies and outputs in C:\\Users\\ABDUKA~1\\AppData\\Local\\Temp\\claude\\D--www-P1\\442b7740-3163-4c2a-ba39-91e558e98b78\\scratchpad\\judge\\ (sim-player-exploit.mjs → exploit3.txt; sim-progression-exploit.mjs → pexploit3.txt, pexp_opt_flows.txt; sim-economist-exploit.mjs → eexploit3.txt)."
