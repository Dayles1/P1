# City Chronicle 3 (Летопись города 3): Player-first GDD

**Lens:** player-first, clarity, mobile-first.
**One-line pitch:** *one city, two thousand years.* You never restart at a new era. The same streets grow up, street by street, under one coin that changes its face.

**Files:**
- Simulation, the source of every number in this document: `C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\sim-player.mjs`
- Full raw output of `node sim-player.mjs --roster --trace typical`: `C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\sim-player-output.txt`
- Parameter sweep used to define the "optimised" player: `C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\_sweep_player.mjs`

All costs, outputs and pacing below come out of the sim's config. The roster, discovery, strip, road and pacing tables are pasted from its output unedited.

---

## 0. The whole game on one card (what a player must understand)

| Concept | What the player sees | Where |
|---|---|---|
| **Money** (Деньги) | One number, top-left. Its icon changes each era (drachma → … → digital credit). | HUD (the only resource there) |
| **Citizens** (Жители) | Population, and homes that fill up over about a minute. | HUD (small, under money) |
| **Happiness** (Довольство) | One face icon and one % value. Each home has its own colour in the Happiness overlay. | HUD chip + overlay |
| **4 services** | Water, Health, Education, Leisure. Coverage circles; a home is green when covered. | Overlays |
| **3 goods** | Food, Materials, Goods. Shown as storage bars. | "City" sheet (tap money) |
| **Energy** (Modern+) | One gauge, supply / demand. | "City" sheet + alert badge |
| **Traffic** | Road colour from green to red, and how many cars you see. | Traffic overlay |
| **Town Hall** | The one era gate: a checklist of no more than 4 lines, then "Upgrade". | Town Hall card |
| **Chronicle** (Летопись) | "+412 years ahead of history" and ★/★★/★★★ per era. | Era chip, Chronicle screen |

Nothing else is needed to play. Every number in the formulas below is surfaced at the point of decision (build card, home tooltip, overlay legend), so no manual is required.

---

## 1. Vision and core loops

### 1.1 What makes it fun
1. **Growth you can see.** A hut becomes an izba, then a half-timbered house, then a brick house, then a tower block, then an eco-tower, on the same tile, in the same street. Every era adds a visible layer instead of swapping the scenery.
2. **One decision at a time, each one clear.** Every build card answers "what does this do for me?" with one line, such as "+20 citizens, needs 2 services" or "+0.9 trade/s, repays in 14 min".
3. **A race against history.** The calendar never stops. Reaching the Middle Ages in year 65 instead of year 1000 is a lead the player can feel, and it earns stars, a Golden Age and leaderboard points.
4. **Satisfying returns.** You come back to an offline report ("the city lived 115 years while you were away"), collect it, spend it, and finish a goal.

### 1.2 Core loops (numbers from the sim, typical player at 1×)

| Loop | Length | What happens | Feedback |
|---|---|---|---|
| **30 s** | 1–3 taps | Place or upgrade a home, road or service. Residents walk in, and the money counter rolls. A year ticks every 25 s. | A "+N citizens" float, the coin counter rolling, the scaffold rising |
| **5 min** | 10–20 taps | Finish a story goal (reward). Start or finish a discovery. Close a coverage gap: the overlay turns red homes green. Upgrade one street class. | Goal fanfare, a discovery card flip, a happiness bump |
| **Session** (15–30 real min) | about 60–150 taps | Offline report → collect → 2–4 goals → a Town Hall checklist line or an expansion strip → leave a long build (Town Hall upgrades take 1–4 min) | Era banner, star award, Golden Age glow |
| **Long-term** | about 5 h at 1×, about 6 days for a 20-min-a-day player | 7 eras, 14 strips, 21 Chronicle stars, then the Monument and a full map | Leaderboard, Chronicle timeline |

The sim counts about **1,170 player actions** for a typical player from founding to the Near Future, roughly 3.7 per game minute. Bulk actions (§1.4) cut real taps by about 3×.

### 1.3 What I took from the references, and why

| Source | Taken | Not taken (and why) |
|---|---|---|
| **SimCity BuildIt** | One soft currency. Services with radius coverage that *fill* homes. Land bought as expansions. Road upgrades. Factories → goods → sale. | Item crafting chains and premium currency: they add micro-management and clutter, and the user asked for one currency. |
| **Clash of Clans** | Town Hall as the single readable progress gate with a short checklist. Satisfying return-and-collect. Stars as a rating per milestone. Compact mobile HUD. A long upgrade timer for anticipation, used only on the Town Hall. | Builder limits and timers on everything (too slow for a sim the player watches), and combat. |
| **Classic SimCity** | Jobs vs housing balance (RCI-lite). Traffic as network capacity. Land value folded into home happiness. A tax lever (3 positions). | Zoning tools and a budget spreadsheet: too much to read on a phone. |
| **City Chronicle 2** | The content: 36 buildings, 155 levels, the hand-made models, and the rule that a level keeps its own era's palette. Goals, discoveries and the event bus. | Era jumps of the calendar, 22 resources on the HUD, random maps, trees and rocks. |

### 1.4 Mobile UX sketch (only what the loops need)
- **HUD (portrait and landscape):** top-left money pill (era icon + compact value + "+/min"), with citizens and happiness under it. Top-centre: `1253 · Средневековье · +247` (year, era chip, lead). Top-right: speed (‖ ×1 ×2 ×5) and menu. Bottom: four thumb buttons, **Build**, **Upgrade**, **Goals**, **City**. Alerts appear as small red badges next to the money pill (food import, energy short, traffic, no workers); tapping a badge opens the overlay that explains it.
- **Bulk actions:** drag to paint a row of homes or roads. Tap a street to get "Upgrade this street (12 tiles)". The **Upgrade** button lists "outdated homes in view: 14 → Каменный дом, 1 300 ₰" as one tap.
- **Advisor (Советник):** one line above the Build button stating the single most useful next step, for example "Homes are full and need Health to grow: build a Знахарь". The sim shows a sloppy player soft-locking without it (see §14.5).

---

## 2. Time

### 2.1 Calendar
- `year = 1 + floor(t / 25)`, where `t` is game seconds since founding. One constant rate: **25 s per year at ×1**. It never jumps, never freezes and never depends on the era.
- **HUD shows the year only (no month).** A thin ring around the era icon fills once per year, so time visibly flows. A soft tick sounds at each new year (muted at ×5).
- **Speeds:** pause, ×1, ×2, ×5; testers also get ×20 and ×50. Speed multiplies game time, so it multiplies the calendar and the economy alike, and the lead over history does not depend on speed.
- At ×1, 2100 calendar years take 14.6 h. The typical player reaches the Near Future around **year 750** (§14), so history is a race you normally win. *By how much* is the score.
- After year 2100 the calendar simply continues. Content ends at the Near Future era, not at a date.

### 2.2 Seasons, day/night, weather: an "atmosphere clock"
A 25-second year cannot carry seasons (6 s of snow) or days. Atmosphere therefore runs on **real time while the game is unpaused, regardless of speed**:

| Cycle | Length (real time) | Notes |
|---|---|---|
| Day / night | 8 min (night 2 min, dawn and dusk 40 s each) | Windows light up and lamps glow. Never strobes at ×5. |
| Season | 16 min (2 days) | Snow, foliage tint, water colour |
| Atmosphere year | 64 min | A typical 20-min session sees one or two seasons |
| Weather | one state per 3–6 min (clear, cloud, rain, fog; snow in winter) | Visual and audio only |

**Seasons and weather have no economic effect** (v2's seasonal farm fertility is dropped). A player should never lose money because they played in "winter". The calendar year and the season are deliberately unrelated, and the HUD never shows a season name.

### 2.3 Offline progress: honest slow motion
- While the app is closed, the city lives at **0.1× speed**, capped at **8 real hours**: `offlineGameSeconds = min(awaySeconds, 28 800) × 0.1`, at most 2,880 game seconds, which is 48 game minutes or 115 calendar years.
- The calendar advances by those game seconds too. Nothing is free and nothing is frozen, so the leaderboard stays fair: offline time is just slow game time without your decisions.
- Constructions and research finish. Income, upkeep and growth accrue. Random events and any player decisions are skipped.
- **Analytic catch-up** (cheap on phones): the structure only changes when a construction or research completes. The catch-up therefore jumps from event to event and integrates each interval in closed form:
  - money changes linearly: `+ (tax + trade + tourism − upkeep) × Δt`, with rates computed once per interval;
  - population converges exponentially: `P(Δt) = H − (H − P₀)·e^(−kΔt)` with `k = 0.03·h/70`;
  - stocks are clamped to storage (overflow is exported, up to trade capacity).

  This costs O(number of completions) instead of 2,880 ticks.
- **Report screen:** "While you were away (8 h) the city lived 115 years: +1.2 M ₤, +3 400 citizens, 3 buildings finished." One button: **Collect**. The money was already credited; the button exists for the satisfying moment.

---

## 3. Eras

### 3.1 The seven eras and their gates
The Town Hall level *is* the era (CoC-style). L1–L2 are Antiquity; L3 to L8 open the next six eras. A Town Hall upgrade unlocks when its checklist is complete, then costs money plus materials and takes a visible build time.

| enter | TC level | population | buildings | discoveries | TC cost (money + mat) | build s |
|---|---|---:|---|---|---:|---:|
| (mid-Antiquity) | L2 Дом вождя | 30 | — | — | 150 + 9 | 20 |
| Middle Ages | L3 Ратуша | 80 | 1× Рынок L1+, 1× Школа L1+ | 3 of 4 (Antiquity) | 600 + 36 | 60 |
| Renaissance | L4 Дворец | 400 | 1× Храм L2+, 2× Мастерская L1+ | 3 of 4 (Middle Ages) | 4.00K + 240 | 90 |
| Industrial Age | L5 Городская управа | 1.80K | 1× Порт L2+, 1× Стекольный завод L1+ | 3 of 4 (Renaissance) | 30.0K + 1.80K | 120 |
| Modern Age | L6 Мэрия | 7.50K | 1× Вокзал L1+, 1× Сталелитейный завод L1+ | 3 of 4 (Industrial Age) | 300.0K + 18.0K | 150 |
| Contemporary | L7 Сити-холл | 22.0K | 2× Станция метро L1+, 1× Электростанция L1+ | 3 of 4 (Modern Age) | 2.50M + 150.0K | 180 |
| Near Future | L8 Цифровая мэрия | 60.0K | 1× Аэропорт L2+, 1× Завод электроники L1+ | 3 of 4 (Contemporary) | 14.00M + 840.0K | 240 |

**Why these requirements.** Each gate is a checklist of no more than 4 lines: population, two signature buildings and 3 of the era's 4 discoveries. The two buildings are always *the system the next era builds on*, so passing the gate teaches the next era:
- Market + School → trade and knowledge (Middle Ages adds goods and health)
- Church + 2 Workshops → crafts and goods (Renaissance is the merchant age)
- Harbour + Glassworks → sea trade and manufacture (Industrial adds rail and heavy industry)
- Railway station + Steel mill → rail freight (Modern adds electricity, metro and aviation)
- 2 connected metro stations + Power plant → mass transit and power (Contemporary is the dense city)
- Airport + Electronics plant → global hub (Near Future)

Population thresholds grow about 3–5× per era (80, 400, 1 800, 7 500, 22 000, 60 000). That ratio is what makes each era longer than the previous one (§14).

### 3.2 What each era unlocks (at the moment the Town Hall finishes)
| Era | New building levels (summary) | New systems |
|---|---|---|
| Античность (Antiquity) | hut, adobe house, field, fisher's hut, woodcutter, quarry, agora, granary, well, aqueduct, philosophers' school, sanctuary, amphitheatre (Town Hall L2), grove, pier | Food, Materials, coverage (water, education, leisure), Dirt path |
| Средневековье (Middle Ages) | izba, stone house, manor (villa), barn farm, wharf, sawmill, pit quarry, iron mine, brick kiln, forge, fair, warehouse, healer, monastery school, church | **Goods**, **Health**, Cobbled lane |
| Возрождение (Renaissance) | half-timbered house, palazzo, mill farm, shaft mine, workshop, glassworks, trading house, packing house, infirmary, university, cathedral, theatre, garden, windmill, harbour, architects' bureau | Paved street, Harbour (Navigation), the peak of merchant trade |
| Индустриальная эра (Industrial) | brick house, tenement, workers' barracks, mansion, steam sawmill, dynamite quarry, steam mine, brickworks, foundry, tool factory, glass factory, exchange, goods warehouse, water pump, hospital, academy, opera, park, steam port, fish port | **Railway**, **Avenues**, Gas-lit street |
| Модерн (Modern) | multi-storey house, income block, modern villa, mechanised farm, … | **Energy**, **Metro**, **Airfield**, Asphalt street, Avenue |
| Современность (Contemporary) | high-rise, skyscraper house, panel block, residential complex, art-deco tower, … | Container port, Boulevard, Tree-lined street |
| Ближнее будущее (Near Future) | eco-tower, modular block, glass tower, hydroponics, vertical farm, solar farm, … | Smart street and avenue, Aerohub, maglev |

Every level is listed with its era in §10.

### 3.3 The transition is gradual

| When | What changes |
|---|---|
| **At once** (Town Hall completes) | The era name in the HUD chip. A short non-blocking banner (2.5 s, no full-screen splash). The **money face flips** (1.2 s coin-flip animation). New build cards appear with a NEW badge. 4 new discovery cards. New story goals. Stars and Golden Age if earned. |
| **Over 20 calendar years** (500 s at ×1, about 8 min) | Sky, fog and light palette blend linearly from the old era to the new one. Ambience cross-fades over the first 10 years. The UI accent colour blends. **Residents change clothes when they next leave home** (about 5% per game-year, so most within 20 years). **Traffic mix:** share of new-era vehicles = `years since entry / 20`. |
| **Only when the player acts** | Every building keeps its level and its *own* era's look until upgraded. Roads keep their class and look until upgraded. Income rises only as homes are upgraded, because the tax multiplier comes from the *home's* level era (§5.3). The new era therefore arrives street by street. |
| **Never** | The map, the calendar rate, the money amount (the face changes, the value does not), and the player's layout. |

**Heritage (Наследие).** Two eras after its level's era, a temple, theatre, villa, market, school or park becomes Heritage: a gold plaque on its card and ×2 tourist attraction. This gives the player a real reason to keep the old cathedral instead of upgrading everything.

### 3.4 "Ahead of history" (Опередить историю): formulas
Let `Y_i = floor(year)` when era `i` begins (the Town Hall finishes) and `H_i` its historical year (1000, 1500, 1800, 1900, 2000, 2100).

- **Lead:** `lead_i = H_i − Y_i` in years. The HUD era chip shows `+lead` in gold, or `−N` in grey if history has overtaken you.
- **Chronicle stars per era:** ★ if `lead_i ≥ 0`; ★★ if `Y_i ≤ S2_i`; ★★★ if `Y_i ≤ S3_i`.

  | Era entered | ★ (beat history) | ★★ by year | ★★★ by year |
  |---|---:|---:|---:|
  | Middle Ages | ≤ 1000 | 75 | 62 |
  | Renaissance | ≤ 1500 | 150 | 130 |
  | Industrial | ≤ 1800 | 240 | 205 |
  | Modern | ≤ 1900 | 380 | 325 |
  | Contemporary | ≤ 2000 | 600 | 495 |
  | Near Future | ≤ 2100 | 850 | 700 |

  Calibration from the sim: a typical attentive player earns ★★, an expert earns ★★★ from the Modern Age on, and a slow player earns ★ from the Industrial Age on (§14). The ★★★ marks for the first three eras are stretch goals that no simulated player reached.
- **Golden Age (Золотой век):** on entry, `+20 %` taxes and trade for `4 × stars` calendar years (100 s each at ×1, so up to 12 years or 5 min). The city gets a warm light tint and gold confetti on the Town Hall. It is a short boost that rewards momentum without snowballing.
- **Chronicle points (score):** `1 000 + 1 000 × stars + 2 × max(0, lead_i)` per era, banked at entry and never lost.
- **Spirit of the Age (Дух времени):** a catch-up mechanic for players history has overtaken. When `year > H_next`, the next Town Hall upgrade and all discoveries cost `discount = min(30 %, 0.1 % × (year − H_next))` less. The card shows "History has moved on: −12%". Slow or idle players are never stranded, and leaders lose nothing.

---

## 4. Currency: one unit, a new face per era

The resource id is always `money`, and its value never changes. Only the presentation (name, icon, symbol, look) follows the Town Hall's era.

| Era | Name RU | Name EN | Symbol | Icon / visual idea |
|---|---|---|---|---|
| Античность | Драхмы | Drachmae | ₯ | Silver coin with an owl, stamped and slightly irregular |
| Средневековье | Гроши | Groats | ₰ | Small silver coins in a leather pouch with a drawstring |
| Возрождение | Флорины | Florins | ƒ | Gold florin with a lily, crisp milled edge |
| Индустриальная | Банкноты | Banknotes | ₤ | Engraved banknote with a guilloche pattern and a steam-engine vignette |
| Модерн | Наличные | Cash | ¤ | Folded bills with a coin on top, in Art-Deco typography |
| Современность | Карты | Card money | ▣ | Bank card with a chip and a contactless glyph |
| Ближнее будущее | Кредиты | Credits | ◈ | Glowing hexagonal token with a soft pulse, shown as a phone wallet |

**Rule tied to the change: none (no redenomination, no inflation).** Reasons:
1. The player's sense of "how much is a lot" carries across eras. A ÷10 reform would silently invalidate every comparison the player has learned.
2. Goals, the leaderboard, event texts and saved numbers stay comparable.
3. Large numbers are handled by formatting, not by the economy: three significant digits with K / M / B (`7.58K`, `1.39M`). The HUD pill never exceeds 6 characters.
4. The change still *feels* like history: the face flips on entry, the market and bank models show the era's money, and a one-line flavour text appears on the era card (e.g. "Флорины Медичи ходят по всей Европе").

The tooltip on the money pill reads "1 ₰ = 1 ₯: the same treasury, a new coin".

---

## 5. Economy model

### 5.1 Resources (the complete list)

| Resource | Role | Era face (icon changes, id doesn't) | Visible where |
|---|---|---|---|
| **Money** `money` | The only currency: build, upgrade, research, land | per era, §4 | HUD |
| **Food** `food` | Eaten by citizens; surplus is sold | grain → bread → canned → produce | City sheet; alert badge when importing |
| **Materials** `mat` | Construction input (a share of every cost); surplus is sold | timber & stone → bricks → steel → concrete → composites | Build cards ("+ 150 ▦"), City sheet |
| **Goods** `goods` | Factory output, sold through trade routes | tools → glass → machinery → electronics | City sheet; trade route cards |
| **Energy** (capacity, not stored) | Modern-era buildings need it; a shortage slows them and unsettles homes | electricity | City sheet gauge; badge when below 100% |

There is no knowledge, coal, oil or iron. Each of v2's 22 resources folds into one of these four, or into money.

### 5.2 Storage
- One cap per stocked resource, the same number for each: `cap = 300 + Σ storage(Town Hall, Storehouses)`. The Town Hall gives 300 → 120K; storehouses give 400 → 70K each.
- Overflow is first sold (§5.5, if trade capacity allows); the rest is wasted, and the City sheet shows "wasted: N/min" in red.

### 5.3 Money sources (per game second)
- **Taxes:** `tax = P × τ × M_tax × (0.5 + h/100) × (1 − 0.3·u) × policy × (1 + Σtax%) × (1 + golden)`
  - `τ = 0.01` money/s per citizen.
  - `M_tax` is the housing-weighted average of **taxMult by the era of each home's level**: 1, 1.6, 2.5, 4, 6, 9, 13. Villas ×3.
  - `h` is city happiness (0–100), and `u` is the unemployment rate.
  - `policy`: Low ×0.8 (+8 happiness), Normal ×1, High ×1.2 (−10 happiness). A three-position switch on the Town Hall card.
- **Trade (exports):** each second, up to `K = Σ trade capacity × (1 + Σtrade%)` units leave through the city's trade routes, in priority order: goods (always sold) → food above 90% of cap → materials above 90% of cap. Prices are fixed (§5.5). The airport adds +15% / +25% to goods.
- **Tourism:** `tour = A × 0.01 × M_era × (1 + access)`, where `A` is the sum of attraction (Heritage ×2, beach villas ×1.5) and `access` is the best port, rail station and airport bonus combined (+0.1 to +1.45).
- **Goal rewards and event gifts:** about 1–3 minutes of income each.

### 5.4 Money sinks
- **Construction and upgrades.** `cost(level) = money + materials`; the materials share is about 5–8% of the money cost, measured in units of `mat`. **An upgrade costs 70% of the target level's price and can skip levels** ("Upgrade to Brick house"). Demolishing refunds 50% of the current level's price.
- **Road tiles** (bought with every building: 0.4 road tile per building tile in the sim) and road upgrades (70% of the new class price per tile).
- **Upkeep (money/min):** `cost × u_cat`, with `u_cat` = food 0.5%, materials, goods and trade 0.7%, services and parks 1.2%, energy 0.8%, power plants 2.0%, transport 1.0%, culture 0.6%; **homes and the Town Hall pay 0**. Roads cost 0 to 6 per tile per minute; rail track 0.3% of its cost per minute.
- **Town Hall upgrades** (the era gates), **discoveries**, **expansion strips**, and **imports** (food when short at 1.0, missing materials at 4.0).
- **The Monument** (Монумент славы, post-content, 10 steps on the Town Hall square): `20 M × 1.6^k` money for step k, +5 000 score and +1 happiness each, 3.6 B in total.

### 5.5 Prices: fixed, never dynamic (shown on every card)
| | Import (bought automatically when short) | Export (sold through trade capacity) |
|---|---:|---:|
| Food | 1.0 | 0.4 |
| Materials | 4.0 | 1.5 |
| Goods | — | 6.0 (+15/25% via airport) |

*Why fixed:* the player can plan with them, read paybacks off the build card, and never gets punished by a hidden market. Saturation comes from **trade capacity**, which is a visible building stat, not from price curves.

### 5.6 Production chains (each one line long)
1. **Farms and fisheries → Food → citizens** (each citizen eats 0.004 food/s). A shortfall is imported automatically at 1.0, and the badge shows "−36 ₯/min food import".
2. **Quarry, Mine, Lumber yard, Brickworks, Steel mill, Cement plant → Materials → construction.** Missing materials are bought automatically at 4.0 when you build, and the card shows "includes 120 ▦ imported: +480". Producing your own is the cheaper path. Surplus sells at 1.5.
3. **Workshops, Glassworks, Electronics → Goods → trade routes (Town Hall, Market, Port, Rail, Airport) → money.** Factories need workers and trade capacity, not materials. This is deliberate: the sim showed that when factories competed with construction for materials, nobody built them.

**Output formula (single source of balance).** Every producer level is derived from its cost and its era's payback target `T_prod` = 4, 7, 14, 25, 37, 52, 62 min:
`value/s = (money + 2.5·mat) / (60·T_prod) × k_building`, then `food = value/1.0`, `mat = value/2.5`, `goods = value/6`, `trade = value/3`.
Building efficiencies `k`: quarry 1.2, mine 1.15 (×1.5 on an ore vein), lumber 0.75, brickworks 0.95, steel and cement 1.15, farm 1.0, fishery 1.15, vertical farm 1.1, workshop 1.8, glassworks 1.9, electronics 2.1, market 0.8, port 1.15 (×1.5 in a deep bay), station 1.0, airport 0.5. The trade-off: mountain extractors are efficient but location-bound; plants work anywhere but pollute and use energy.

**Era scaling (derived):**

| era | M (cost ×) | cost per citizen (home) | tax mult (home era) | home payback min | producer payback min | jobs × |
|---|---:|---:|---:|---:|---:|---:|
| e0 | 1 | 1.8 | 1 | 3 | 4 | 1 |
| e1000 | 3.2 | 5.8 | 1.6 | 6 | 7 | 2 |
| e1500 | 11.7 | 21.0 | 2.5 | 14 | 14 | 4 |
| e1800 | 36 | 64.8 | 4 | 27 | 25 | 8 |
| e1900 | 84 | 151.2 | 6 | 42 | 37 | 15 |
| e2000 | 192 | 345.6 | 9 | 64 | 52 | 26 |
| e2100 | 346.7 | 624.0 | 13 | 80 | 62 | 40 |

**Production per building per second:** `out × staffing × congestionEff × (0.6 + 0.4·powerRatio if it uses power) × (1 + Σprod%) × (1 + Σresource%)`.

### 5.7 Demand without meters
There are no RCI bars. The City sheet has one **Workforce** line with three states that tell the player what to build:
- *Short of workers* (`staffing < 0.95`) → build homes;
- *Balanced*;
- *Unemployed* (`u > 0.05`) → build workplaces. Each unemployed citizen pays 30% less tax, and the line shows the loss in money per minute.

### 5.8 Proof that money neither explodes nor dead-ends (sim)
| profile | median money banked (min of income) | 90th pct banked | upkeep / gross income (median) | income mix by era: tax / trade / tourism, upkeep share |
|---|---:|---:|---:|---|
| slow | 5.0 | 18.5 | 10.0% | e0: 94/3/3, 12% · e1000: 68/31/1, 6% · e1500: 65/31/4, 5% · e1800: 72/23/5, 7% · e1900: 80/12/9, 12% · e2000: 86/6/9, 11% · e2100: 88/6/6, 10% |
| typical | 0.7 | 5.1 | 8.9% | e0: 92/8/0, 10% · e1000: 64/34/1, 6% · e1500: 53/44/3, 5% · e1800: 66/27/7, 7% · e1900: 73/18/10, 9% · e2000: 80/12/8, 12% · e2100: 79/9/12, 9% |
| optimised | 0.3 | 5.0 | 6.2% | e0: 92/7/1, 10% · e1000: 53/46/1, 5% · e1500: 54/43/4, 5% · e1800: 59/34/7, 6% · e1900: 66/19/15, 8% · e2000: 65/16/19, 8% · e2100: 74/10/15, 6% |

- **No explosion during the eras.** The typical player's median bank is **0.7 minutes of income**. Even a slow player's 90th percentile is under 20 minutes. Every era has sinks that scale with it: Town Hall cost is about 10–20 minutes of income at the gate, home payback grows from 3 to 80 minutes, and strip prices rise roughly 2.2× per strip.
- **Income mix tells history:** tax dominates Antiquity (92%), trade carries the Middle Ages and Renaissance (30–45%, the merchant towns), industry still matters in the Industrial Age (27%), and tourism rises to about 12% by the Near Future.
- **No dead-end:**
  - homes and the Town Hall have no upkeep, so a city of homes always earns;
  - money is floored at 0;
  - imports are always available;
  - when money is 0 and net income is negative, buildings with upkeep switch to "unpaid" (no effect, an orange badge) instead of debt;
  - once per era, the **Treasury grant** (Казённая ссуда, no repayment) pays 5 minutes of gross income if money stays under 1 minute of income with negative net for 2 minutes;
  - the Advisor points at the bottleneck;
  - Spirit of the Age discounts the next gate if history overtakes you.
- **After the content.** All strips cost 41.8 M in total, and the Monument absorbs 3.6 B, about 15 h of Near Future income. Beyond that, money is just score-neutral savings, because the leaderboard never counts money.

---

## 6. Population and city

### 6.1 Housing
- Homes: House 1×1 (11 levels), Villa 2×2 (land or beach; residents pay ×3 tax, attraction, happiness aura), Apartment block 2×2 (Industrial+), Tower 2×2 (Contemporary+, also 150–220 jobs).
- **Home price** comes from the era's cost per citizen: `cost = housing × cpc[era] × typeMult`, with `cpc = T_home × τ × 60 × taxMult`. That gives 1.8, 5.8, 21, 65, 151, 346, 624, with `T_home` = 3, 6, 14, 27, 42, 64, 80 min and typeMult house 1, block 0.85, tower 1.05, villa 3.5. *Meaning: a home repays its own price in taxes in `T_home` minutes.* That number grows with the era, so later eras last longer without any artificial slowdown.
- **Comfort gate (from BuildIt).** A home level needs N services covering its tile: L1–2 need 0, L3–4 need 1, L5–7 need 2, L8–10 need 3, L11 needs 4. The upgrade button says exactly which one is missing.
- **Effective housing:** `H_home = housing × (0.7 + 0.3 × covered/unlocked services)`. Services literally fill homes, and the tooltip shows "34/48 residents: add Health for +7".

### 6.2 Services and coverage
Four services: **Water** (well → aqueduct → pump → waterworks → treatment), **Health** (from the Middle Ages: healer → … → medical centre), **Education** (school → … → future lab; also research speed), **Leisure** (temple / theatre). Coverage is binary per home and uses a **Manhattan radius** `r` (3–10 by level). The overlay draws the diamond.
- Implementation: one Uint8 grid per service. Each provider stamps its diamond on build, upgrade or demolish. A home is covered if any tile of its footprint is > 0. Cost: O(Σ diamond areas) per structural change and zero per tick.
- Parks and villas add a **happiness aura** (`+a` within `r`; the sum over a home is capped at +15).

### 6.3 Happiness (one number per home; it is also the land value)
```
h_home = 35
       + 30 × servicesCovered / servicesUnlocked   (0…30; 3 services in Antiquity, 4 from the Middle Ages)
       + min(15, Σ park/villa/market auras)
       + TownHallAura (+6…+14 within r4…r8)
       + metro (+6/+7/+8 within station radius)
       + street appeal (street +0…+5, avenue −3…0, adjacent tile)
       + discoveries (+3 Public education, +5 Smart city) + Monument steps
       + tax policy (+8 / 0 / −10)
       − min(30, Σ pollution in range)
       − min(15, 15 × max(0, ρ_access − 1))      (traffic at the home's road)
       − 25 if starving − 15 × (1 − powerRatio)
city h = housing-weighted average, clamped 0…100
```
Overlay colours: < 40 red, 40–60 yellow, > 60 green. Taxes use `0.5 + h/100`, so a happy city pays up to 1.5× (the "land value" effect without a separate concept).

### 6.4 Jobs and growth
- `workers = 0.5 × P`, `staffing = min(1, workers / jobs)`, `u = max(0, workers − jobs) / workers`.
- **Growth per second:**
  - if `P > H`: `P −= max(0.2, 0.05·(P − H))` (moving out);
  - if starving or `h < 25`: `P × (1 − 0.004)`;
  - if `h ≥ 40`: `P += (H − P) × 0.03 × h/70 + 0.2`, capped at `H`;
  - between 25 and 40: stagnation, with the tooltip "people won't move in: happiness < 40".

### 6.5 Pollution
Industry and power plants have `pollution = amount within r` (3–15, r1–r4). The pollution grid is stamped like coverage. The overlay shows it in brown. Placing industry against the mountain, away from homes, is the obvious readable strategy.

---

## 7. Map and land

### 7.1 The grid (same for every player)
```
north  ▲  mountain range (backdrop, not buildable; its foot touches land row 0)
          ── tunnel portals at x 46–47 (start) and in strips L7 / R7
          land rows 0–39 (40 rows)    rows 0–1 = "mountain foot" (quarries, mines)
          beach rows B0–B19 (20 rows of sand)
          B19 = sea edge (fishery, port piers reach into the sea)
south  ▼  sea (≈30 rows visible), horizon beyond, ships and planes
          x = 0 … 99; start owned: x 35–64 (all land and beach rows); Town Hall 2×2 at x 49–50, rows 19–20
```

### 7.2 What can be built where
| Zone | Allowed | Not allowed | Why |
|---|---|---|---|
| Mountain foot (land rows 0–1) | Quarry, Mine (the 2×2 must include row 0), plus anything else | — | The user's requirement: quarries and mines against the mountain |
| Land rows 0–39 | Everything except coast-only buildings and the airport | Airport, port, fishery | — |
| Beach B0–B18 | Roads, parks, villas, theatres, windmills, solar farms, rail track, **the airport** | Homes (except villas), blocks, towers, farms, industry, most services | The beach stays the leisure, transport and energy coast: a clear zoning story without zoning tools |
| Sea edge B19 | Fishery (1×1), Port (3×2 on B18–B19 with a pier into the sea) | — | — |
| Sea | Nothing (piers are part of the models) | — | — |

**Airport plot (Будущий аэропорт).** A 16×5 outline on B8–B12, x 42–57, inside the start strip, is drawn faintly from day one: "the future". Roads and parks may sit on it and are refunded at 100% when the airport is placed. The sim showed an optimising player filling the whole beach and soft-locking the Near Future gate; the reserved plot prevents that and doubles as a teaser.

### 7.3 Map features (authored, identical for everyone)
| Feature | Where | Effect |
|---|---|---|
| Ore vein (рудная жила), glittering streaks on the mountain foot | start x 56–59; strips L1, R3, L5 | Mines on it ×1.5 output (2 mine slots per vein) |
| Deep bay (глубокая бухта), darker water with a buoy | strips R1, L3, R5 | Port there ×1.5 trade capacity |
| Tunnel portal (тоннель), arched portal in the cliff | start x 46–47; strips L7, R7 | The railway must start at a portal; connecting two portals makes a through-line (+50% rail trade) |

### 7.4 Expansion strips
14 strips of 5 columns (7 per side), each covering all 40 land rows and 20 beach rows (200 land + 100 beach tiles). **The price depends only on how many strips you already own, and you may buy on either side.** There is no era gate (§7.5).

| # bought | price | left strip k → feature | right strip k → feature |
|---:|---:|---|---|
| 1 | 500 | L1: vein |  |
| 2 | 1.10K |  | R1: bay |
| 3 | 2.40K | L2: — |  |
| 4 | 5.30K |  | R2: — |
| 5 | 12.0K | L3: bay |  |
| 6 | 26.0K |  | R3: vein |
| 7 | 57.0K | L4: — |  |
| 8 | 125.0K |  | R4: — |
| 9 | 300.0K | L5: vein |  |
| 10 | 700.0K |  | R5: bay |
| 11 | 1.60M | L6: — |  |
| 12 | 4.00M |  | R6: — |
| 13 | 10.00M | L7: portal |  |
| 14 | 25.00M |  | R7: portal |

| Strip | Columns | Feature |
|---|---|---|
| L1 | x 30–34 | ore vein |
| L2 | x 25–29 | — |
| L3 | x 20–24 | deep bay |
| L4 | x 15–19 | — |
| L5 | x 10–14 | ore vein |
| L6 | x 5–9 | — |
| L7 | x 0–4 | tunnel portal |
| R1 | x 65–69 | deep bay |
| R2 | x 70–74 | — |
| R3 | x 75–79 | ore vein |
| R4 | x 80–84 | — |
| R5 | x 85–89 | deep bay |
| R6 | x 90–94 | — |
| R7 | x 95–99 | tunnel portal |

### 7.5 Reasoning
- **The first two strips are cheap (500 and 1.1K) and *flavoured*.** The first meaningful choice in the game is left (ore, so better mines from the Middle Ages) or right (a deep bay, so better port trade from Antiquity).
- **Middle strips are needed when the 30-wide start fills up** (Industrial to Modern in the sim; the typical player owns 2 strips at Industrial, 6 at Modern and 10 at the Near Future).
- **The last strips (10 M and 25 M) are post-content goals.**
- **No era gate.** The first sim version gated strips by era and deadlocked: the next era needed population, the population needed land, and the land needed the next era. A price-only curve can never deadlock, and its 2.2× growth tracks income growth (each strip costs about 1–8 minutes of income when it is typically bought).

---

## 8. Roads

A road is drawn one per tile (tile = 16 m). There are two classes, each upgradable through the eras, and they differ in **cross-section**, not colour:
- **Street (Улица):** quiet, raises happiness of adjacent homes, lower capacity.
- **Avenue (Проспект):** from the Industrial Age; high capacity, slightly lowers adjacent homes' happiness, carries buses.

The build card says: "Avenues move traffic. Streets make homes happy."

### 8.1 Cross-sections (each fits one 16 m tile)
| Class / level | Era | Carriageway | Sidewalks | Median / verge | Markings & crossings | Decor |
|---|---|---|---|---|---|---|
| S1 Тропа (Dirt path) | e0 | 1 track, 4 m packed earth | — | 6 m grass each side | none | none |
| S2 Мостовая (Cobbled lane) | e1000 | 6 m cobbles, crowned | — | 1 m stone gutters + 4 m verges | none | wooden lantern post every 3rd tile, hitching posts |
| S3 Мощёная улица (Paved street) | e1500 | 7 m flagstones, central drain channel | 2 × 2.5 m flagged, kerbs | — | none | oil lanterns on wall brackets every 2nd tile |
| S4 Улица с газовыми фонарями (Gas-lit street) | e1800 | 7 m granite setts (2 lanes, unpainted) | 2 × 3 m, granite kerbs | — | cobbled crossing strip at junctions | cast-iron gas lamp every tile (alternating sides), bollards |
| S5 Асфальтовая улица (Asphalt street) | e1900 | 2 × 3.5 m asphalt | 2 × 3 m concrete | — | dashed white centre line, zebra crossings and stop lines at junctions | electric lamp every tile, kerb drains |
| S6 Зелёная улица (Tree-lined street) | e2000 | 2 × 3.25 m | 2 × 2.75 m | 2 × 2.0 m tree-planter / parking strip | centre line, raised zebra crossings, bike symbols | tree in a planter every tile, bench every 2nd tile, LED lamps |
| S7 Смарт-улица (Smart street) | e2100 | 2 × 3.0 m autonomous lanes (LED lane studs, no paint) | 2 × 2.5 m with planters | 2 × 1.5 m protected bike lanes | crossings that light up when a pedestrian waits | smart poles (lamp, sensor, charger) every tile, benches, planters |
| A1 Тракт (Macadam road) | e1800 | 2 × 4.5 m macadam | 2 × 2.5 m packed footpaths | 2 × 1 m gravel shoulders | none | mile posts, telegraph poles |
| A2 Проспект (Avenue) | e1900 | 4 × 3.0 m asphalt | 2 × 2 m | — | double solid centre line, lane dashes, **traffic lights** at avenue × avenue junctions, zebra crossings | double-arm lamps, **bus shelter every 4th tile** |
| A3 Бульвар (Boulevard) | e2000 | 4 × 2.75 m | 2 × 2 m | **1 m planted median** with trees | signalled crossings with pedestrian islands | trees on the median, bus shelters, lamps on the median |
| A4 Смарт-проспект (Smart avenue) | e2100 | 4 × 2.75 m autonomous (dynamic lane LEDs) | 2 × 2 m with tree pits | 1 m green median with smart poles | adaptive signals | smart poles, e-bus stops, tree pits |

Junction rendering: crossings and stop lines on every arm; traffic lights only where two avenues meet; a street meeting an avenue gets a stop line on the street. Each class has three junction meshes (T, X, corner), generated procedurally from the cross-section.

### 8.2 Gameplay numbers per tile
| class | L | era | name | cost money + mat | capacity trips/tile | upkeep/min | happiness next to it |
|---|---|---|---|---:|---:|---:|---:|
| street | 1 | e0 | Тропа (Dirt path) | 2 + 0.5 | 45 | 0 | +0 |
| street | 2 | e1000 | Мостовая (Cobbled lane) | 6 + 1.5 | 65 | 0.02 | +1 |
| street | 3 | e1500 | Мощёная улица (Paved street) | 25 + 6.3 | 85 | 0.05 | +2 |
| street | 4 | e1800 | Улица с газовыми фонарями (Gas-lit street) | 80 + 20 | 105 | 0.12 | +2 |
| street | 5 | e1900 | Асфальтовая улица (Asphalt street) | 250 + 63 | 150 | 0.3 | +2 |
| street | 6 | e2000 | Зелёная улица (Tree-lined street) | 700 + 180 | 180 | 0.7 | +4 |
| street | 7 | e2100 | Смарт-улица (Smart street) | 1800 + 450 | 220 | 1.6 | +5 |
| avenue | 1 | e1800 | Тракт (Macadam road) | 250 + 63 | 260 | 0.3 | -2 |
| avenue | 2 | e1900 | Проспект (Avenue) | 700 + 180 | 450 | 0.9 | -3 |
| avenue | 3 | e2000 | Бульвар (Boulevard) | 2000 + 500 | 540 | 2 | -1 |
| avenue | 4 | e2100 | Смарт-проспект (Smart avenue) | 5000 + 1300 | 720 | 4.5 | +0 |

Visual speed of vehicles (cosmetic, in tiles/s): path 0.5, cobbles 0.7, paved 0.8, gas-lit 1.0, asphalt 1.6, tree-lined 1.6, smart 1.8; macadam 1.2, avenue 1.9, boulevard 1.9, smart avenue 2.2. Vehicles slow by `1/(1+ρ²)`.

### 8.3 Traffic model (cheap, spatial, readable)
- **Trips deposited at a building's access tile:**
  - homes: `T = residents × 0.5 × (1 − transitShare)`;
  - workplaces: `T = jobs × staffing × 0.3`;
  - attractions: `T = attraction × 5`.
  - `transitShare` = 0.35/0.40/0.45 inside metro coverage, plus 0.05 (0.08 smart) next to avenues with bus stops.
- **Spreading:** each building spreads its trips over the road tiles within **6 steps** of its access tile along the network (a BFS capped at 85 tiles, cached per building): `load(t) = Σ_b T_b × 10 / N_b`, where 10 is the average trip length in tiles and `N_b` the size of the reach set. The result is recomputed only for buildings whose reach changes. On structural change the cost is O(changed buildings × 85); per tick it is zero.
- **Congestion:** `ρ(t) = load(t) / cap(t)`.
- **Effects:**
  - homes: happiness `− min(15, 15·max(0, ρ − 1))` at their access tile;
  - workplaces: efficiency `× 1/(1 + 0.4·max(0, ρ − 1))`;
  - Smart city discovery: all loads −15%.
- **What the player sees:**
  - the Traffic overlay colours roads green (ρ < 0.7), yellow (to 1.0) or red (> 1.0);
  - cars per tile = `round(min(1.5, ρ) × lanes × 1.2)`, so jams are visibly dense and slow;
  - the badge "Traffic: −6 happiness in 40 homes" opens the overlay.
- **How it matters (sim):** congestion climbs toward ρ ≈ 1.4 before each era's street upgrade and drops back to about 1.0 after it, so upgrading streets each era is a felt need. From the Contemporary era, density outgrows streets, and avenues plus metro become necessary.

---

## 9. Transport

### 9.1 Port (Порт): Antiquity →
- **Placement:** 3×2 on beach rows B18–B19 with a pier into the sea; not on the airport plot. In a deep bay it gets ×1.5 trade.
- **Levels:** Пристань (pier, e0) → Гавань (harbour, e1500, needs Navigation) → Паровой порт (steam port, e1800) → Контейнерный терминал (container terminal, e2000).
- **Effects:** trade capacity 0.27 → 4/s (×1.5 in a bay), tourist access +0.1/+0.15, attraction 0.5–1. The Harbour is part of the Industrial gate.
- **Visuals:** rowing boats → sailing cogs → steamers with smoke → container ships that dock every few game-years and leave toward the horizon.

### 9.2 Railway (Железная дорога): Industrial →
- **Track:** 1 tile wide (double track, 1 435 mm gauge, ~10 m with ballast).
  - It must connect to a **tunnel portal** at the mountain foot (the central portal x 46–47 is in the start strip).
  - Drawn like roads (drag). It may cross a **street** as a level crossing (gates and bells; the street tile's capacity ×0.8). It crosses an **avenue** only by overpass (that track tile costs ×3).
  - Track price per tile: 1.5K (steam), 4K (electrified), 10K (high-speed), 25K (maglev); upgrading converts the whole line. Upkeep is 0.3% of the price per minute.
- **Station (Вокзал):** 4×2, placed along a straight track section (the track passes along its long side).
  - Levels: Вокзал (e1800) → Центральный вокзал (e1900) → Скоростной терминал (e2000) → Маглев-терминал (e2100).
  - Trade capacity 6.3 → 24/s. Up to 3 stations count. A through-line between two portals gives +50%.
  - Tourist access: the best station's bonus, +0.3 to +0.4.
  - Freight bonus: factories within 8 tiles of a station sell goods at +10%.
- **Gameplay role:** the bulk export route for the Industrial and Modern eras, and part of the Modern gate.
- **Visuals:** a passenger train and a freight train per station every 2 game-years, emerging from the tunnel mouth with a whistle. They are 4 cars (steam) to 8 cars (maglev), and the locomotive model changes with track level.
- **UX:** Build → Transport → Rail. Valid portals pulse. Drag the track; the station card snaps to straight segments. The line glows green when connected.

### 9.3 Metro (Метро): Modern →
- **Station:** 1×1 entrance pavilion on a land tile next to a road (Art-Nouveau kiosk → glass entrance → smart hub). The tunnels are underground on a **separate layer** (a second Int32 occupancy grid), so they never conflict with surface buildings.
- **Lines:** in Metro mode (an underground x-ray view), tap station A, then station B. The tunnel is the Manhattan path between them and is priced per tile: 3K (e1900), 7K (e2000), 15K (e2100). There are up to 4 coloured lines. A station works only on a line with ≥ 2 stations.
- **Effects:**
  - homes within r5/r6/r7 (Manhattan) of a working station: car trips × (1 − 0.35/0.40/0.45), happiness +6/+7/+8;
  - capacity is 4 000 riders per station; beyond that, the effect scales by `4000 / riders`.
- **Gameplay role:** the answer to density traffic from the Contemporary era (the typical sim player has 16 stations on entering the Near Future and 23 two hours later), and part of the Contemporary gate (2 connected stations).
- **Visuals:** ventilation grilles and entrances above ground. In Metro mode, lines are bright colours and trains are moving light capsules.

### 9.4 Airport (Аэропорт): Modern →
- **Placement:** unique, 16×5, on the reserved beach plot (B8–B12, x 42–57). The runway runs parallel to the coast, and approaches are over the sea.
- **Levels:**
  - Аэродром (e1900, Aviation): grass strip, hangar, windsock, biplanes;
  - Аэропорт (e2000): asphalt runway, terminal, tower, jets;
  - Аэрохаб (e2100): second terminal and eVTOL pads.
- **Effects:**
  - trade capacity 18 / 29 / 44 per s;
  - **all goods exports +15% / +25%**;
  - tourist access +0.4 / +0.6 / +0.9;
  - noise: homes within 4 tiles −8 happiness (the reason it sits on the beach).
- **Gameplay role:** the late-game export engine; electronics (21–33 goods/s) need it. It is part of the Near Future gate.
- **Visuals:** a landing or take-off every 6 game-years (L1) down to every 1 year (L3), and contrails at the horizon.

### 9.5 Buses (implicit)
Avenue L2+ tiles show a bus shelter every 4th tile and give homes next to them a transit share of −5% (−8% on smart avenues). There is no line drawing; buses are part of the avenue cross-section and appear as traffic vehicles.

---

## 10. Buildings roster

**33 buildings in v3** (29 reuse v2 models, 4 are new: port, railway station, metro station, airport) with **147 levels**, plus two networks: roads (11 levels) and rail track (4 levels). v2 buildings dropped:
- district_hall (districts and policies cut for clarity);
- chemical_plant, composites_plant, data_center (folded into the other goods and materials buildings);
- coal_mine, oil_well (fuel is no longer a resource; it is part of power-plant upkeep);
- everything after 2100 (ai_foundry, antimatter_collider, electrolyzer, fusion_reactor, nanofab, spaceport).

v2's `road` building becomes the street and avenue networks (§8).

Money costs are formula-driven (§5.6, §6.1). The **effects** column is what the build card shows.

#### town_center — Ратуша (Town Hall) · civic · 2×2 · land · unique

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Шатёр вождя | 0 + 0 | 0 | 0.0 | housing 8, trade 0.06/s, storage 300, happiness +6 r4 | town_center L1 |
| 2 | e0 | Дом вождя | 150 + 9 | 20 | 0.0 | housing 12, trade 0.1/s, storage 500, happiness +7 r5 | town_center L2 |
| 3 | e1000 | Ратуша | 600 + 36 | 60 | 0.0 | housing 18, trade 0.25/s, storage 1.20K, happiness +8 r5 | town_center L3 |
| 4 | e1500 | Дворец | 4.00K + 240 | 90 | 0.0 | housing 25, trade 0.8/s, storage 3.00K, attraction 2, happiness +10 r6 | town_center L4 |
| 5 | e1800 | Городская управа | 30.0K + 1.80K | 120 | 0.0 | housing 35, trade 2.5/s, storage 8.00K, attraction 3, happiness +10 r6 | town_center L5 |
| 6 | e1900 | Мэрия | 300.0K + 18.0K | 150 | 0.0 | housing 50, trade 6/s, storage 20.0K, attraction 4, happiness +12 r7, uses 5 power | town_center L6 |
| 7 | e2000 | Сити-холл | 2.50M + 150.0K | 180 | 0.0 | housing 70, trade 14/s, storage 50.0K, attraction 6, happiness +12 r7, uses 10 power | town_center L7 |
| 8 | e2100 | Цифровая мэрия | 14.00M + 840.0K | 240 | 0.0 | housing 100, trade 30/s, storage 120.0K, attraction 8, happiness +14 r8, uses 15 power | town_center L8 |

#### house — Жилой дом (House) · housing · 1×1 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Шалаш | 7 + 1 | 5 | 0.0 | housing 4 | house L1 |
| 2 | e0 | Глинобитный дом | 12 + 1 | 7 | 0.0 | housing 6, discovery: Masonry | house L2 |
| 3 | e1000 | Изба | 58 + 5 | 9 | 0.0 | housing 10, needs 1 service | house L3 |
| 4 | e1000 | Каменный дом | 93 + 7 | 12 | 0.0 | housing 14, needs 1 service, discovery: Brickmaking | house L4 |
| 5 | e1500 | Фахверковый дом | 420 + 34 | 15 | 0.0 | housing 20, needs 2 services | house L5 |
| 6 | e1800 | Кирпичный дом | 1.90K + 150 | 20 | 0.0 | housing 30, needs 2 services | house L6 |
| 7 | e1800 | Доходный дом | 3.10K + 250 | 25 | 0.0 | housing 42, needs 2 services | house L7 |
| 8 | e1900 | Многоэтажка | 11.0K + 880 | 30 | 0.0 | housing 70, uses 1.5 power, needs 3 services, discovery: Reinforced concrete | house L8 |
| 9 | e2000 | Высотка | 38.0K + 3.00K | 40 | 0.0 | housing 110, uses 2.5 power, needs 3 services | house L9 |
| 10 | e2000 | Небоскрёб | 64.0K + 5.10K | 50 | 0.0 | housing 160, uses 3.5 power, needs 3 services, discovery: High-rise engineering | house L10 |
| 11 | e2100 | Эко-башня | 140.0K + 11.0K | 55 | 0.0 | housing 230, happiness +3 r1, uses 4 power, needs 4 services | house L11 |

#### block — Жилой квартал (Apartment block) · housing · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1800 | Рабочие бараки | 6.10K + 490 | 20 | 0.0 | housing 110, happiness -3 r1, needs 2 services | block L1 |
| 2 | e1900 | Доходный квартал | 30.0K + 2.40K | 30 | 0.0 | housing 230, uses 3 power, needs 3 services, discovery: Reinforced concrete | block L2 |
| 3 | e2000 | Панельный дом | 110.0K + 8.80K | 35 | 0.0 | housing 380, happiness -2 r1, uses 6 power, needs 3 services | block L3 |
| 4 | e2000 | Жилой комплекс | 180.0K + 14.0K | 45 | 0.0 | housing 540, happiness +3 r2, uses 9 power, needs 3 services, discovery: High-rise engineering | block L4 |
| 5 | e2100 | Модульный квартал | 400.0K + 32.0K | 50 | 0.0 | housing 760, uses 12 power, needs 4 services | block L5 |

#### tower — Башня (Tower) · housing · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e2000 | Башня арт-деко | 330.0K + 26.0K | 60 | 0.0 | housing 900, jobs 150, happiness +2 r2, uses 16 power, needs 3 services, discovery: High-rise engineering | skyscraper L1 |
| 2 | e2100 | Стеклянная башня | 850.0K + 68.0K | 70 | 0.0 | housing 1300, jobs 220, happiness +3 r2, uses 22 power, needs 4 services | skyscraper L2 |

#### villa — Усадьба (Villa) · housing · 2×2 · landOrBeach

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1000 | Усадьба | 200 + 16 | 15 | 0.0 | housing 10 (tax ×3), attraction 0.5, happiness +6 r3, needs 1 service | manor L1 |
| 2 | e1500 | Палаццо | 1.20K + 96 | 20 | 0.0 | housing 16 (tax ×3), attraction 1, happiness +8 r4, needs 2 services | manor L2 |
| 3 | e1800 | Особняк | 5.40K + 430 | 25 | 0.0 | housing 24 (tax ×3), attraction 1, happiness +10 r4, needs 2 services | manor L3 |
| 4 | e1900 | Вилла модерн | 17.0K + 1.40K | 30 | 0.0 | housing 32 (tax ×3), attraction 1.5, happiness +12 r5, uses 2 power, needs 3 services | manor L4 |
| 5 | e2000 | Пентхаус-комплекс | 58.0K + 4.60K | 40 | 0.0 | housing 48 (tax ×3), attraction 1.5, happiness +14 r5, uses 4 power, needs 3 services | manor L5 |
| 6 | e2100 | Эко-поместье | 140.0K + 11.0K | 45 | 0.0 | housing 64 (tax ×3), attraction 2, happiness +16 r6, uses 5 power, needs 4 services | manor L6 |

#### farm — Ферма (Farm) · food · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Поле | 60 + 3 | 6 | 0.3 | jobs 4, food 0.28/s | farm L1 |
| 2 | e1000 | Ферма с амбаром | 190 + 10 | 10 | 1.0 | jobs 8, food 0.51/s | farm L2 |
| 3 | e1500 | Мельничная ферма | 700 + 35 | 14 | 3.5 | jobs 16, food 0.94/s | farm L3 |
| 4 | e1900 | Механизированная ферма | 5.00K + 250 | 25 | 25.0 | jobs 60, food 2.5/s, uses 2 power | farm L4 |
| 5 | e2000 | Агрохолдинг | 12.0K + 600 | 35 | 60.0 | jobs 104, food 4.3/s, uses 4 power | farm L5 |
| 6 | e2100 | Гидропоника | 21.0K + 1.10K | 40 | 105.0 | jobs 160, food 6.4/s, uses 8 power, discovery: Hydroponics | farm L6 |

#### fishery — Рыбный промысел (Fishery) · food · 1×1 · coast

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Хижина рыбака | 30 + 2 | 5 | 0.1 | jobs 2, food 0.16/s | fishery L1 |
| 2 | e1000 | Причал | 96 + 5 | 8 | 0.5 | jobs 4, food 0.3/s | fishery L2 |
| 3 | e1800 | Рыбный порт | 1.10K + 55 | 20 | 5.5 | jobs 16, food 0.95/s, pollution 2 r1 | fishery L3 |
| 4 | e2100 | Акваферма | 10.0K + 500 | 40 | 50.0 | jobs 80, food 3.5/s, uses 4 power | fishery L4 |

#### vertical_farm — Вертикальная ферма (Vertical farm) · food · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e2100 | Вертикальная ферма | 42.0K + 2.10K | 50 | 210.0 | jobs 160, food 14/s, uses 15 power, discovery: Hydroponics | vertical_farm L1 |

#### lumber — Лесопилка (Lumber yard) · materials · 1×1 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Лесоруб | 25 + 1 | 5 | 0.2 | jobs 3, mat 0.034/s | lumber L1 |
| 2 | e1000 | Лесопилка | 80 + 3 | 8 | 0.6 | jobs 6, mat 0.063/s | lumber L2 |
| 3 | e1800 | Паровая лесопилка | 900 + 36 | 18 | 6.3 | jobs 24, mat 0.2/s, pollution 3 r2 | lumber L3 |
| 4 | e1900 | Деревокомбинат | 2.10K + 84 | 25 | 14.7 | jobs 45, mat 0.31/s, uses 3 power, pollution 4 r2 | lumber L4 |
| 5 | e2100 | Лесная ферма | 8.70K + 350 | 40 | 60.9 | jobs 120, mat 0.77/s, happiness +2 r2, uses 5 power | lumber L5 |

#### quarry — Каменоломня (Quarry) · materials · 2×2 · mountain

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Каменоломня | 50 + 2 | 8 | 0.4 | jobs 4, mat 0.11/s | quarry L1 |
| 2 | e1000 | Карьер | 160 + 6 | 12 | 1.1 | jobs 8, mat 0.2/s | quarry L2 |
| 3 | e1800 | Динамитный карьер | 1.80K + 72 | 20 | 12.6 | jobs 32, mat 0.63/s, pollution 6 r3 | quarry L3 |
| 4 | e1900 | Экскаваторный карьер | 4.20K + 170 | 30 | 29.4 | jobs 60, mat 1/s, uses 3 power, pollution 8 r3 | quarry L4 |
| 5 | e2100 | Роботизированный карьер | 17.0K + 680 | 45 | 119.0 | jobs 160, mat 2.4/s, uses 8 power, pollution 4 r2 | quarry L5 |

#### mine — Рудник (Mine) · materials · 2×2 · mountain

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1000 | Железный рудник | 290 + 12 | 12 | 2.0 | jobs 12, mat 0.35/s (×1.5 on ore vein), discovery: Metallurgy | mine L1 |
| 2 | e1500 | Шахта | 1.10K + 44 | 15 | 7.7 | jobs 24, mat 0.66/s (×1.5 on ore vein) | mine L2 |
| 3 | e1800 | Паровая шахта | 3.20K + 130 | 20 | 22.4 | jobs 48, mat 1.1/s (×1.5 on ore vein), pollution 6 r3 | mine L3 |
| 4 | e1900 | Глубокая шахта | 7.60K + 300 | 30 | 53.2 | jobs 90, mat 1.7/s (×1.5 on ore vein), uses 4 power, pollution 7 r3 | mine L4 |
| 5 | e2100 | Автошахта | 31.0K + 1.20K | 45 | 217.0 | jobs 240, mat 4.2/s (×1.5 on ore vein), uses 10 power, pollution 4 r2 | mine L5 |

#### kiln — Кирпичный завод (Brickworks) · materials · 1×1 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1000 | Печь обжига | 190 + 8 | 10 | 1.3 | jobs 8, mat 0.19/s, pollution 3 r1, discovery: Brickmaking | kiln L1 |
| 2 | e1800 | Кирпичный завод | 2.20K + 88 | 18 | 15.4 | jobs 32, mat 0.61/s, pollution 6 r2 | kiln L2 |
| 3 | e1900 | Керамический комбинат | 5.00K + 200 | 28 | 35.0 | jobs 60, mat 0.94/s, uses 5 power, pollution 5 r2 | kiln L3 |

#### steel_mill — Сталелитейный завод (Steel mill) · materials · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1800 | Литейная | 9.00K + 360 | 20 | 63.0 | jobs 64, mat 3/s, pollution 10 r3, discovery: Steelmaking | steel_mill L1 |
| 2 | e1900 | Мартеновский завод | 21.0K + 840 | 30 | 147.0 | jobs 120, mat 4.8/s, uses 4 power, pollution 12 r3 | steel_mill L2 |
| 3 | e2000 | Электросталь | 48.0K + 1.90K | 40 | 336.0 | jobs 208, mat 7.8/s, uses 20 power, pollution 8 r3 | steel_mill L3 |
| 4 | e2100 | Фабрика сплавов | 87.0K + 3.50K | 50 | 609.0 | jobs 320, mat 12/s, uses 30 power, pollution 4 r2 | steel_mill L4 |

#### cement_plant — Цементный завод (Cement plant) · materials · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1900 | Цементный завод | 25.0K + 1.00K | 28 | 175.0 | jobs 120, mat 5.7/s, pollution 10 r3, discovery: Reinforced concrete | cement_plant L1 |
| 2 | e2000 | Бетонный комбинат | 58.0K + 2.30K | 38 | 406.0 | jobs 208, mat 9.4/s, uses 8 power, pollution 10 r3 | cement_plant L2 |
| 3 | e2100 | Геополимерный завод | 100.0K + 4.00K | 45 | 700.0 | jobs 320, mat 14/s, uses 14 power, pollution 4 r2 | cement_plant L3 |

#### workshop — Мастерская (Workshop) · goods · 1×1 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1000 | Кузница | 260 + 13 | 10 | 1.8 | jobs 10, goods 0.21/s, pollution 2 r1, discovery: Metallurgy | smithy L1 |
| 2 | e1500 | Мастерская | 940 + 47 | 14 | 6.6 | jobs 20, goods 0.38/s, pollution 3 r1 | smithy L2 |
| 3 | e1800 | Инструментальный завод | 2.90K + 150 | 20 | 20.3 | jobs 40, goods 0.65/s, pollution 6 r2 | smithy L3 |
| 4 | e1900 | Машзавод | 6.70K + 340 | 30 | 46.9 | jobs 75, goods 1/s, uses 6 power, pollution 6 r2 | smithy L4 |
| 5 | e2100 | Робофабрика | 28.0K + 1.40K | 45 | 196.0 | jobs 200, goods 2.5/s, uses 12 power, pollution 2 r1 | smithy L5 |

#### glassworks — Стекольный завод (Glassworks) · goods · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1500 | Стеклодувня | 2.60K + 130 | 14 | 18.2 | jobs 40, goods 1.1/s, pollution 3 r1, discovery: Glassblowing | glassworks L1 |
| 2 | e1800 | Стекольный завод | 7.90K + 400 | 20 | 55.3 | jobs 80, goods 1.9/s, pollution 5 r2 | glassworks L2 |
| 3 | e1900 | Флоат-завод | 18.0K + 900 | 30 | 126.0 | jobs 150, goods 2.9/s, uses 6 power, pollution 5 r2 | glassworks L3 |
| 4 | e2100 | Завод умного стекла | 76.0K + 3.80K | 45 | 532.0 | jobs 400, goods 7.3/s, uses 14 power | glassworks L4 |

#### electronics_fab — Завод электроники (Electronics plant) · goods · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e2000 | Завод электроники | 170.0K + 8.50K | 45 | 1190.0 | jobs 312, goods 21/s, uses 15 power, discovery: Semiconductors | electronics_fab L1 |
| 2 | e2100 | Чиповая фабрика | 310.0K + 16.0K | 50 | 2170.0 | jobs 480, goods 33/s, uses 30 power | electronics_fab L2 |

#### market — Рынок (Market) · trade · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Агора | 80 + 4 | 10 | 0.6 | jobs 4, trade 0.1/s, happiness +4 r3 | market L1 |
| 2 | e1000 | Ярмарка | 260 + 13 | 14 | 1.8 | jobs 8, trade 0.19/s, attraction 0.5, happiness +5 r4 | market L2 |
| 3 | e1500 | Торговый дом | 940 + 47 | 18 | 6.6 | jobs 16, trade 0.34/s, attraction 1, happiness +6 r4 | market L3 |
| 4 | e1800 | Биржа | 2.90K + 150 | 25 | 20.3 | jobs 32, trade 0.58/s, attraction 1, happiness +6 r4 | market L4 |
| 5 | e1900 | Универмаг | 6.70K + 340 | 30 | 46.9 | jobs 60, trade 0.91/s, attraction 2, happiness +8 r5, uses 4 power | market L5 |
| 6 | e2000 | Торговый центр | 15.0K + 750 | 40 | 105.0 | jobs 104, trade 1.4/s, attraction 3, happiness +10 r5, uses 10 power | market L6 |
| 7 | e2100 | Голо-молл | 28.0K + 1.40K | 50 | 196.0 | jobs 160, trade 2.3/s, attraction 4, happiness +12 r6, uses 18 power | market L7 |

#### port — Порт (Port) · trade · 3×2 · coast

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Пристань | 150 + 8 | 12 | 1.1 | jobs 6, trade 0.27/s (×1.5 deep bay), attraction 0.5, tourist access +0.1 | fishery L2 model (pier) widened to 3x2 |
| 2 | e1500 | Гавань | 1.80K + 90 | 25 | 12.6 | jobs 24, trade 0.92/s (×1.5 deep bay), attraction 1, tourist access +0.15, discovery: Navigation | NEW |
| 3 | e1800 | Паровой порт | 5.40K + 270 | 35 | 37.8 | jobs 48, trade 1.6/s (×1.5 deep bay), attraction 1, tourist access +0.15, pollution 4 r2 | fishery L3 model + cranes |
| 4 | e2000 | Контейнерный терминал | 29.0K + 1.50K | 50 | 203.0 | jobs 156, trade 4/s (×1.5 deep bay), tourist access +0.15, uses 10 power, pollution 4 r2 | NEW |

#### storehouse — Склад (Storehouse) · trade · 1×1 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Амбар | 40 + 2 | 6 | 0.3 | jobs 1, storage 400 | storehouse L1 |
| 2 | e1000 | Склад | 130 + 7 | 9 | 0.9 | jobs 2, storage 1.20K | storehouse L2 |
| 3 | e1500 | Пакгауз | 470 + 24 | 12 | 3.3 | jobs 4, storage 3.00K | storehouse L3 |
| 4 | e1800 | Товарный склад | 1.40K + 70 | 18 | 9.8 | jobs 8, storage 8.00K | storehouse L4 |
| 5 | e2000 | Логистический центр | 7.70K + 390 | 30 | 53.9 | jobs 26, storage 30.0K, uses 3 power, discovery: Logistics | storehouse L5 |
| 6 | e2100 | Автосклад | 14.0K + 700 | 40 | 98.0 | jobs 40, storage 70.0K, uses 6 power | storehouse L6 |

#### well — Колодец (Well) · service · 1×1 · land · covers water

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Колодец | 30 + 2 | 5 | 0.4 | water r3 | well L1 |
| 2 | e0 | Акведук | 90 + 5 | 10 | 1.1 | jobs 1, water r4, discovery: Masonry | well L2 |
| 3 | e1800 | Водокачка | 1.10K + 55 | 15 | 13.2 | jobs 8, water r6 | well L3 |
| 4 | e1900 | Водопровод | 2.50K + 130 | 20 | 30.0 | jobs 15, water r8, uses 2 power | well L4 |
| 5 | e2000 | Водоочистная станция | 5.80K + 290 | 30 | 69.6 | jobs 26, water r10, uses 6 power | well L5 |

#### clinic — Лечебница (Clinic) · service · 1×1 · land · covers health

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1000 | Знахарь | 130 + 7 | 8 | 1.6 | jobs 4, health r3 | clinic L1 |
| 2 | e1500 | Лазарет | 470 + 24 | 14 | 5.6 | jobs 8, health r4 | clinic L2 |
| 3 | e1800 | Больница | 1.40K + 70 | 20 | 16.8 | jobs 16, health r6 | clinic L3 |
| 4 | e1900 | Поликлиника | 3.40K + 170 | 26 | 40.8 | jobs 30, health r7, uses 3 power | clinic L4 |
| 5 | e2000 | Медцентр | 7.70K + 390 | 36 | 92.4 | jobs 52, health r9, uses 8 power | clinic L5 |

#### school — Школа (School) · service · 2×2 · land · covers education

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Школа философов | 120 + 6 | 12 | 1.4 | jobs 3, education r4, research +15%, discovery: Writing | school L1 |
| 2 | e1000 | Монастырская школа | 380 + 19 | 16 | 4.6 | jobs 6, education r5, research +20% | school L2 |
| 3 | e1500 | Университет | 1.40K + 70 | 22 | 16.8 | jobs 12, education r6, research +30%, attraction 1, discovery: Printing press | school L3 |
| 4 | e1800 | Академия наук | 4.30K + 220 | 28 | 51.6 | jobs 24, education r7, research +40%, attraction 1, discovery: Public education | school L4 |
| 5 | e1900 | НИИ | 10.0K + 500 | 32 | 120.0 | jobs 45, education r8, research +55%, uses 5 power | school L5 |
| 6 | e2000 | Технопарк | 23.0K + 1.20K | 42 | 276.0 | jobs 78, education r9, research +70%, uses 12 power, discovery: Computers | school L6 |
| 7 | e2100 | Лаборатория будущего | 42.0K + 2.10K | 50 | 504.0 | jobs 120, education r10, research +90%, uses 18 power | school L7 |

#### temple — Храм (Temple) · service · 2×2 · land · covers leisure

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Святилище | 90 + 5 | 10 | 1.1 | jobs 2, leisure r4, attraction 1 | temple L1 |
| 2 | e1000 | Церковь | 290 + 15 | 16 | 3.5 | jobs 4, leisure r5, attraction 2 | temple L2 |
| 3 | e1500 | Собор | 1.60K + 80 | 30 | 19.2 | jobs 8, leisure r7, attraction 5 | temple L3 |

#### theater — Театр (Theatre) · service · 2×2 · landOrBeach · covers leisure

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Амфитеатр | 150 + 8 | 14 | 1.8 | jobs 3, leisure r4, attraction 1, Town Hall L2 | theater L1 |
| 2 | e1500 | Театр | 1.80K + 90 | 18 | 21.6 | jobs 12, leisure r5, attraction 2 | theater L2 |
| 3 | e1800 | Опера | 5.40K + 270 | 25 | 64.8 | jobs 24, leisure r6, attraction 4 | theater L3 |
| 4 | e1900 | Кинотеатр | 13.0K + 650 | 28 | 156.0 | jobs 45, leisure r6, attraction 4, uses 4 power | theater L4 |
| 5 | e2000 | Мультиплекс | 29.0K + 1.50K | 38 | 348.0 | jobs 78, leisure r7, attraction 6, uses 10 power | theater L5 |
| 6 | e2100 | Голотеатр | 52.0K + 2.60K | 45 | 624.0 | jobs 120, leisure r8, attraction 8, uses 16 power | theater L6 |

#### park — Парк (Park) · park · 1×1 · landOrBeach

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e0 | Роща | 12 + 1 | 4 | 0.1 | happiness +4 r2 | park L1 |
| 2 | e1500 | Сад | 140 + 7 | 8 | 1.7 | happiness +6 r3 | park L2 |
| 3 | e1800 | Парк | 430 + 22 | 10 | 5.2 | attraction 0.3, happiness +8 r3 | park L3 |
| 4 | e1900 | Сквер с фонтаном | 1.00K + 50 | 14 | 12.0 | attraction 0.5, happiness +10 r4, uses 1 power | park L4 |
| 5 | e2100 | Эко-парк | 4.20K + 210 | 25 | 50.4 | attraction 1, happiness +12 r5, uses 2 power | park L5 |

#### windmill — Ветряк (Windmill) · energy · 1×1 · landOrBeach

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1500 | Ветряная мельница | 700 + 35 | 12 | 5.6 | jobs 4, farms +25% r3 | windmill L1 |
| 2 | e1900 | Ветрогенератор | 5.00K + 250 | 20 | 40.0 | jobs 15, power +12, discovery: Electricity | windmill L2 |
| 3 | e2100 | Ветропарк | 21.0K + 1.10K | 30 | 168.0 | jobs 40, power +40, discovery: Solar power | windmill L3 |

#### power_plant — Электростанция (Power plant) · power · 2×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1900 | Угольная электростанция | 50.0K + 2.50K | 35 | 1000.0 | jobs 90, power +80, pollution 15 r4, discovery: Electricity | power_plant L1 |
| 2 | e2000 | ТЭЦ | 120.0K + 6.00K | 45 | 2400.0 | jobs 156, power +200, pollution 12 r4 | power_plant L2 |
| 3 | e2100 | Газотурбинная | 210.0K + 11.0K | 50 | 4200.0 | jobs 240, power +400, pollution 8 r3 | power_plant L3 |

#### solar_farm — Солнечная ферма (Solar farm) · energy · 2×2 · landOrBeach

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e2100 | Солнечная ферма | 160.0K + 8.00K | 40 | 1280.0 | jobs 40, power +150, discovery: Solar power | solar_farm L1 |

#### rail_station — Вокзал (Railway station) · transport · 4×2 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1800 | Вокзал | 25.0K + 1.30K | 40 | 250.0 | jobs 80, trade 6.3/s, tourist access +0.3, discovery: Railways | NEW |
| 2 | e1900 | Центральный вокзал | 59.0K + 3.00K | 50 | 590.0 | jobs 150, trade 10/s, tourist access +0.3, uses 6 power | NEW |
| 3 | e2000 | Скоростной терминал | 130.0K + 6.50K | 60 | 1300.0 | jobs 260, trade 16/s, tourist access +0.35, uses 12 power | NEW |
| 4 | e2100 | Маглев-терминал | 240.0K + 12.0K | 70 | 2400.0 | jobs 400, trade 24/s, tourist access +0.4, uses 20 power | NEW |

#### metro_station — Станция метро (Metro station) · transport · 1×1 · land

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1900 | Станция метро | 38.0K + 1.90K | 30 | 380.0 | jobs 30, metro r5: −35% car trips, happiness +6, uses 3 power, discovery: Underground railway | NEW |
| 2 | e2000 | Станция-пересадка | 86.0K + 4.30K | 35 | 860.0 | jobs 52, metro r6: −40% car trips, happiness +7, uses 5 power | NEW |
| 3 | e2100 | Смарт-хаб | 160.0K + 8.00K | 40 | 1600.0 | jobs 80, metro r7: −45% car trips, happiness +8, uses 8 power | NEW |

#### airport — Аэропорт (Airport) · transport · 16×5 · beach · unique

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1900 | Аэродром | 210.0K + 11.0K | 60 | 2100.0 | jobs 300, trade 18/s, tourist access +0.4, uses 6 power, discovery: Aviation | NEW |
| 2 | e2000 | Аэропорт | 480.0K + 24.0K | 90 | 4800.0 | jobs 520, trade 29/s, tourist access +0.6, goods price +15%, uses 20 power | NEW |
| 3 | e2100 | Аэрохаб | 870.0K + 44.0K | 120 | 8700.0 | jobs 800, trade 44/s, tourist access +0.9, goods price +25%, uses 35 power | NEW |

#### architect_bureau — Бюро архитекторов (Architects’ bureau) · culture · 2×2 · land · unique

| L | era | name | cost (money + mat) | build s | upkeep/min | effects | v2 model reuse |
|---|---|---|---:|---:|---:|---|---|
| 1 | e1500 | Мастерская зодчего | 2.30K + 120 | 20 | 13.8 | jobs 8, attraction 1 | architect_bureau L1 |
| 2 | e1900 | Архитектурное бюро | 17.0K + 850 | 30 | 102.0 | jobs 30, attraction 2, uses 2 power | architect_bureau L2 |
| 3 | e2100 | 3D-студия | 69.0K + 3.50K | 45 | 414.0 | jobs 80, attraction 3, uses 8 power | architect_bureau L3 |

### 10.1 New 3D models needed (the focused list)
| # | Model | Footprint | Notes |
|---|---|---|---|
| 1 | Port L2 Гавань | 3×2 + pier | stone quay, sailing ship moored |
| 2 | Port L4 Контейнерный терминал | 3×2 + pier | gantry cranes, container stacks (L1 and L3 reuse fishery L2/L3 models) |
| 3–6 | Railway station L1–L4 | 4×2 | brick station with clock → central station → high-speed terminal → maglev terminal |
| 7–9 | Metro entrance L1–L3 | 1×1 | Art-Nouveau kiosk → glass pavilion → smart hub |
| 10–12 | Airport L1–L3 | 16×5 | aerodrome → airport → aerohub |
| 13 | Monument of Glory | 2×2 (Town Hall square) | one parametric obelisk/statue that grows over 10 steps |

**13 hand-made models.** Everything else is procedural and lives in the renderer: 11 road cross-sections (7 street and 4 avenue levels) with junction variants, 4 track looks with level crossing and overpass, the tunnel portal decor, mountain backdrop, beach and sea. **Cut-first** candidates are station L4 (reuse L3 with glow) and metro L3, which bring the count to 11.

---

## 11. Discoveries, goals, achievements

### 11.1 Discoveries (Открытия): replacing v2's 56 knowledge techs
- **28 discoveries, 4 per era, paid in money (there is no knowledge resource).** One at a time. Time is divided by research speed: `1 + Σ school research% + Σ discovery research%`; each school level adds +15% to +90%.
- **The era gate asks for any 3 of the era's 4.** That gives a real choice of what to skip for now, while the gate buildings imply their own discovery.
- **UI:** a horizontal timeline with 7 columns of 4 cards. Each card states one effect and the levels it unlocks.

| era | id | name | cost | time s (÷ research speed) | effect | unlocks |
|---|---|---|---:|---:|---|---|
| e0 | agriculture | Земледелие (Agriculture) | 48 | 32 | food +25% | — |
| e0 | masonry | Каменная кладка (Masonry) | 60 | 40 | mat +20% | house:2, well:2 |
| e0 | writing | Письменность (Writing) | 72 | 44 | research +10% | school:1 |
| e0 | coinage | Чеканка монет (Coinage) | 84 | 52 | tax +10%, trade +20% | — |
| e1000 | three_field | Трёхполье (Three-field system) | 240 | 56 | food +25% | — |
| e1000 | metallurgy | Металлургия (Metallurgy) | 300 | 70 | — | mine:1, workshop:1 |
| e1000 | guilds | Гильдии (Guilds) | 360 | 77 | goods +20%, tax +5% | — |
| e1000 | brickmaking | Обжиг кирпича (Brickmaking) | 420 | 91 | — | kiln:1, house:4 |
| e1500 | printing | Книгопечатание (Printing press) | 1.40K | 80 | research +25% | school:3 |
| e1500 | navigation | Мореплавание (Navigation) | 1.80K | 100 | trade +25% | port:2 |
| e1500 | banking | Банковское дело (Banking) | 2.20K | 110 | tax +10% | — |
| e1500 | glassblowing | Стеклоделие (Glassblowing) | 2.50K | 130 | — | glassworks:1 |
| e1800 | steam_engine | Паровая машина (Steam engine) | 9.60K | 104 | prod +10% | — |
| e1800 | steelmaking | Сталеварение (Steelmaking) | 12.0K | 130 | — | steel_mill:1, avenue:1 |
| e1800 | railways | Железные дороги (Railways) | 14.0K | 143 | — | rail_station:1 |
| e1800 | public_education | Всеобщее образование (Public education) | 17.0K | 169 | research +15%, happy +3 | school:4 |
| e1900 | electricity | Электричество (Electricity) | 56.0K | 128 | — | power_plant:1, windmill:2 |
| e1900 | reinforced_concrete | Железобетон (Reinforced concrete) | 70.0K | 160 | — | cement_plant:1, house:8, block:2 |
| e1900 | subway | Метрополитен (Underground railway) | 84.0K | 176 | — | metro_station:1 |
| e1900 | aviation | Авиация (Aviation) | 98.0K | 208 | — | airport:1 |
| e2000 | computers | Компьютеры (Computers) | 280.0K | 152 | research +25% | school:6 |
| e2000 | highrise | Высотное строительство (High-rise engineering) | 350.0K | 190 | housing +5% | tower:1, house:10, block:4 |
| e2000 | semiconductors | Полупроводники (Semiconductors) | 420.0K | 209 | — | electronics_fab:1 |
| e2000 | logistics | Логистика (Logistics) | 490.0K | 247 | trade +30% | storehouse:5 |
| e2100 | robotics | Робототехника (Robotics) | 1.20M | 176 | prod +20% | — |
| e2100 | solar_power | Солнечная энергетика (Solar power) | 1.50M | 220 | — | solar_farm:1, windmill:3 |
| e2100 | smart_city | Умный город (Smart city) | 1.80M | 242 | happy +5, congestion +15% | — |
| e2100 | hydroponics | Гидропоника (Hydroponics) | 2.10M | 286 | — | vertical_farm:1, farm:6 |

### 11.2 Goals (Задачи): onboarding through goals
- **Always 3 goals on screen:** 1 **story goal** (gold, from the chain below; it teaches the next system) and 2 **side goals** generated from the city's state, for example "Cover 90% of homes with Water", "Upgrade 5 homes to Каменный дом" or "Sell 200 goods".
- **Rewards:** about 1–3 minutes of income, plus the fanfare. Side goals refresh every 10 game-years.
- **Story chain (as simulated, rewards in money):**
  - Antiquity: 3 houses (40), a field (40), a quarry (40), 20 citizens (60), the agora (60), writing (60), the chief's house (100), water for every home (80)
  - Middle Ages: entering the era (300), forge (200), 200 citizens (300), healer (150), mine (200)
  - Renaissance: entering (1.5K), harbour (1.5K), university (1.2K), 1 000 citizens (1.5K)
  - Industrial: entering (7K), 6 factories (5K), first station (8K), 4 000 citizens (7K)
  - Modern: entering (30K), "Да будет свет" (power, 25K), first metro line (30K), 12 000 citizens (30K)
  - Contemporary: entering (120K), airport (150K), 35 000 citizens (120K)
  - Near Future: entering (400K)
  - The final game adds about 3 more story goals per era for road upgrades, overlays and heritage.

### 11.3 Achievements (Достижения): long-term, +250 score each
"Город-сад" (happiness 90 for 10 years) · "Опередить историю" (★★★ in any era) · "Золотое столетие" (21 stars) · "Летописец" (all 28 discoveries) · "Наследие" (10 Heritage buildings) · "Порт мира" (3 ports in deep bays) · "Стальной путь" (through-line between two portals) · "Подземка" (4 metro lines) · "Окно в мир" (Aerohub) · "Весь берег" (all 14 strips) · "Мегаполис" (100 000 citizens) · "Без пробок" (whole network ρ < 0.8 at 50 000 citizens) · "Чистое небо" (no polluted home at 50 000 citizens) · "Самодостаточный" (no imports for 20 years in the Near Future) · "Монумент" (all 10 steps) · "Век за веком" (play across 1 000 calendar years).

---

## 12. Score and leaderboard

```
Score = (peakPopulation + 10 × Σ building levels (excl. Town Hall)) × (0.8 + 0.4 × h/100)
      + Chronicle                       (Σ over eras entered: 1000 + 1000 × stars + 2 × max(0, lead))
      + 250 × achievements
      + 5000 × Monument steps
```
- **Fair on a shared map:** every player has the same map, features, start, prices and **event schedule**. Events are seeded by calendar year, not by player, so everyone meets the same caravan in year 214 (§13). Choices differ; luck does not.
- **Monotonic and banked:** peak population, Chronicle points banked at entry, and achievements. Demolishing to rebuild never costs score, except the happiness factor while the city is unhappy.
- **Speed-neutral:** everything is measured in game time, so ×5 does not change your lead. Offline time counts honestly at 0.1×.
- **"Ahead of history" share:** Chronicle is about 13% of a finished typical city's score (34.6K of 272K) and about 12% of an optimised one (37.9K of 325K). That is enough to separate players of equal size without making speed the only skill.
- **Tabs:** Overall · Chronicle (stars, then lead) · This era (score among players currently in the same era, so newcomers can rank too).

Sim end states (2 h after entering the Near Future): slow **177K**, typical **272K**, optimised **325K** (details in §14).

---

## 13. Random events (by era)

- **Frequency:** one every 8 ± 2 calendar years (about 200 s at ×1).
- **Kinds:** 50% gifts (tap to collect) and 50% choice cards (two buttons; the effect is shown on each).
- **Values** scale with the city: "N min of income".
- **Deterministic:** the event at year Y is `hash(Y)` over the era's list (the same for every player).
- **Offline:** skipped. Expected net value is about +1% of income.

| Era | Gift | Choice | Hazard (with counterplay) |
|---|---|---|---|
| Античность | Урожайный год: +60 s of food production | Караван: buy 40 materials at half the import price? | Летний праздник: +10 happiness for 4 years (pure gift) |
| Средневековье | Ярмарка: +2 min of trade | Монахи-переписчики: −30% time on the current discovery for 1 min of income? | Поветрие: −15 happiness for 4 years (−5 if Health coverage ≥ 80%) |
| Возрождение | Меценат: one free temple or theatre upgrade | Торговый флот: +50% trade capacity for 4 years for 2 min of income? | Пожар: one wooden house (L1–L5) loses a level unless Water-covered |
| Индустриальная | Золотая лихорадка: +3 min of tax | Забастовка: pay 2 min of income, or factories −30% for 2 years | Смог: −8 happiness for 4 years in homes within r4 of industry |
| Модерн | Радиошоу о городе: tourism +50% for 4 years | Биржевой крах: bail out (3 min of income) or trade −30% for 4 years | Нефтяной бум: +5 min of materials production |
| Современность | Стартап выстрелил: goods +30% for 4 years | Фестиваль: closes 10 road tiles for 1 year, +12 happiness | Жара: energy demand +20% for 2 years |
| Ближнее будущее | Испытание дронов-доставщиков: traffic loads −20% for 4 years | Хакеры: pay 2 min of income, or −10 happiness for 2 years | Климатический саммит: tourism +40% for 4 years |

---

## 14. Pacing table (simulation)

### 14.1 Method
`sim-player.mjs` encodes every formula and constant of this document: buildings and levels, roads, discoveries, strips, gates, stars, Golden Age, Spirit of the Age, upkeep, imports, trade, tourism, traffic, coverage and happiness. It simulates 1-second ticks with greedy heuristic players.
- **Aspatial approximations:** coverage = Σ diamond areas × 0.45 ÷ home tiles; roads = 0.4 tile per building tile; traffic = trips × 10 × 1.3 hotspot ÷ (road tiles × capacity); pollution exposure is set by the player profile (0.12–0.45).
- **Profiles:**
  - **typical** acts every 15 game-s with sensible priorities;
  - **slow** acts every 40 game-s (e.g. plays at ×5 and glances in), keeps idle cash, builds new instead of upgrading, zones carelessly, reacts late to traffic and research;
  - **optimised** acts every 3 game-s, spends to zero and uses the tax lever. Its settings are the best of a 32-point parameter sweep (`_sweep_player.mjs`); the whole sweep spans 264–306 min to the Near Future.
  - All profiles follow the Advisor hint when stuck.
- Run: `node sim-player.mjs --roster --trace typical` (about 10 s).

### 14.2 Pacing (real minutes at ×1 = game minutes)
| profile | era entered | min @1x | h:mm | year | lead (yrs) | stars | pop | income/min | net/min | strips | buildings | taps |
|---|---|---:|---:|---:|---:|:---:|---:|---:|---:|---:|---:|---:|
| slow | Middle Ages | 30 | 0:30 | 72 | 928 | ★★ | 96 | 84 | 76 | 0 | 38 | 42 |
| slow | Renaissance | 58 | 0:58 | 139 | 1361 | ★★ | 433 | 858 | 812 | 0 | 96 | 110 |
| slow | Industrial Age | 119 | 1:59 | 287 | 1513 | ★ | 1.84K | 4.71K | 4.45K | 0 | 264 | 293 |
| slow | Modern Age | 196 | 3:16 | 471 | 1429 | ★ | 7.66K | 28.4K | 26.3K | 9 | 432 | 495 |
| slow | Contemporary | 323 | 5:23 | 776 | 1224 | ★ | 23.0K | 110.0K | 97.5K | 11 | 516 | 847 |
| slow | Near Future | 475 | 7:55 | 1140 | 960 | ★ | 61.7K | 393.4K | 356.9K | 12 | 586 | 1133 |
| typical | Middle Ages | 27 | 0:27 | 65 | 935 | ★★ | 107 | 97 | 89 | 0 | 42 | 47 |
| typical | Renaissance | 55 | 0:55 | 131 | 1368 | ★★ | 448 | 900 | 853 | 0 | 98 | 114 |
| typical | Industrial Age | 86 | 1:26 | 206 | 1594 | ★★ | 2.00K | 7.37K | 6.92K | 2 | 218 | 283 |
| typical | Modern Age | 140 | 2:20 | 335 | 1564 | ★★ | 8.15K | 33.5K | 30.7K | 6 | 390 | 493 |
| typical | Contemporary | 209 | 3:29 | 503 | 1497 | ★★ | 23.7K | 141.5K | 128.8K | 8 | 516 | 847 |
| typical | Near Future | 314 | 5:14 | 754 | 1346 | ★★ | 64.0K | 587.6K | 520.1K | 10 | 623 | 1173 |
| optimised | Middle Ages | 30 | 0:30 | 72 | 928 | ★★ | 109 | 106 | 98 | 0 | 45 | 50 |
| optimised | Renaissance | 57 | 0:57 | 138 | 1362 | ★★ | 498 | 1.25K | 1.20K | 0 | 116 | 131 |
| optimised | Industrial Age | 85 | 1:25 | 206 | 1594 | ★★ | 2.02K | 6.41K | 6.03K | 1 | 253 | 293 |
| optimised | Modern Age | 135 | 2:15 | 323 | 1576 | ★★★ | 8.50K | 45.1K | 42.2K | 4 | 402 | 508 |
| optimised | Contemporary | 193 | 3:13 | 463 | 1537 | ★★★ | 23.9K | 195.9K | 178.9K | 7 | 632 | 963 |
| optimised | Near Future | 264 | 4:24 | 633 | 1466 | ★★★ | 65.2K | 906.1K | 841.7K | 9 | 890 | 1464 |

| Era | Typical length | Slow | Optimised |
|---|---:|---:|---:|
| Antiquity | 27 min | 30 | 30 |
| Middle Ages | 28 | 28 | 27 |
| Renaissance | 31 | 61 | 28 |
| Industrial | 54 | 77 | 50 |
| Modern | 69 | 127 | 58 |
| Contemporary | 105 | 152 | 71 |
| **Total to the Near Future** | **5 h 14 min** | **7 h 55 min** | **4 h 24 min** |

For the typical player every era is longer than the previous one (27 → 28 → 31 → 54 → 69 → 105 min), and the slow player takes about 1.5× as long. The sweep shows that layout and priority choices move the result by only about ±7% (264–306 min). In this design the pace comes from structure (paybacks, gates), not from finding exploits. What separates players is how attentively they act, which is what a fair leaderboard should reward.

### 14.3 End state, money flows, daily player
**End state (2 h of play after entering the Near Future):**

| profile | game h | year | pop | happiness | income/min | upkeep/min | money | strips | buildings | score | score parts (peak pop / 10×levels / happiness factor / chronicle / achievements / monument) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| slow | 9.9 | 1428 | 88.3K | 81 | 976.9K | 94.3K | 7.07M | 14 | 733 | 176.6K | 88.3K / 36.7K / ×1.12 / 28.8K / 7.25K / 0 (0 steps) |
| typical | 7.2 | 1042 | 135.6K | 98 | 3.21M | 265.2K | 25.99M | 14 | 1073 | 272.1K | 135.6K / 57.3K / ×1.19 / 34.6K / 7.25K / 0 (0 steps) |
| optimised | 6.4 | 921 | 165.7K | 83 | 3.94M | 242.3K | 23.77M | 14 | 1392 | 325.4K | 165.7K / 68.3K / ×1.13 / 37.9K / 7.25K / 15.0K (3 steps) |

**Where the money went (whole run):**

| profile | tax | trade | tourism | goals | upkeep | build | upgrade | Town Hall | research | strips | roads+rail+metro | imports |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| slow | 112.79M | 8.40M | 9.33M | 939.3K | 13.67M | 13.20M | 24.80M | 11.78M | 8.51M | 41.83M | 3.61M | 6.99M |
| typical | 205.84M | 25.64M | 29.01M | 939.3K | 23.68M | 60.76M | 61.77M | 11.78M | 8.51M | 41.83M | 6.35M | 20.75M |
| optimised | 282.24M | 43.14M | 60.21M | 939.3K | 23.38M | 67.45M | 64.48M | 11.78M | 8.51M | 41.83M | 5.51M | 36.62M |

**Daily mobile player (20 real min/day at ×2, then away; offline at 0.1×, capped at 8 h):**

| era | reached on day | calendar year | lead | stars |
|---|---:|---:|---:|:---:|
| Middle Ages | 1 | 65 | 935 | ★★ |
| Renaissance | 2 | 230 | 1270 | ★ |
| Industrial Age | 2 | 296 | 1503 | ★ |
| Modern Age | 3 | 488 | 1411 | ★ |
| Contemporary | 5 | 853 | 1147 | ★ |
| Near Future | 6 | 1149 | 951 | ★ |

At 20 real minutes a day the Near Future arrives on **day 6**. Offline catch-up at 0.1× adds about 48 game minutes per day without making idling dominant.

### 14.4 Typical player trace (every 30 game minutes)
| min | year | era | pop | happy | money | income/min | net/min | tax | trade | tourism | upkeep | strips | buildings | unemployed | ρ (traffic) | coverage W/H/E/L | avenue share | metro stations |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1 | 0 | 6 | 41 | 164 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 1.00 | 0.11 | 0.0/-/0.0/0.0 | 0.00 | 0 |
| 30 | 73 | 1 | 135 | 77 | 118 | 146 | 133 | 142 | 1 | 4 | 13 | 0 | 48 | 0.11 | 0.75 | 1.0/0.9/0.8/1.0 | 0.00 | 0 |
| 60 | 145 | 2 | 615 | 74 | 2.72K | 1.78K | 1.71K | 936 | 772 | 73 | 72 | 0 | 111 | 0.03 | 1.12 | 1.0/1.0/1.0/1.0 | 0.00 | 0 |
| 90 | 217 | 3 | 2116 | 72 | 7.58K | 9.84K | 9.35K | 4.83K | 4.23K | 789 | 492 | 2 | 220 | 0.00 | 1.10 | 1.0/0.9/1.0/1.0 | 0.10 | 0 |
| 120 | 289 | 3 | 5791 | 65 | 13.1K | 24.1K | 22.2K | 16.5K | 5.94K | 1.71K | 1.98K | 3 | 308 | 0.01 | 1.06 | 1.0/0.9/1.0/1.0 | 0.40 | 0 |
| 150 | 361 | 4 | 9486 | 70 | 10.8K | 47.0K | 43.7K | 30.3K | 7.58K | 9.17K | 3.31K | 7 | 409 | 0.08 | 0.97 | 0.9/1.0/0.9/1.0 | 0.40 | 0 |
| 180 | 433 | 4 | 18205 | 72 | 54.6K | 112.8K | 102.9K | 82.3K | 21.2K | 9.32K | 9.93K | 8 | 475 | 0.01 | 1.11 | 1.0/1.0/1.0/1.0 | 0.40 | 2 |
| 210 | 505 | 5 | 23822 | 67 | 359.6K | 163.9K | 151.0K | 125.6K | 22.5K | 15.9K | 12.9K | 8 | 516 | 0.00 | 1.21 | 1.0/0.9/1.0/0.9 | 0.50 | 2 |
| 240 | 577 | 5 | 30589 | 73 | 158.5K | 240.7K | 207.1K | 176.1K | 33.9K | 30.6K | 33.5K | 9 | 550 | 0.00 | 1.12 | 1.0/0.9/1.0/0.9 | 0.50 | 9 |
| 270 | 649 | 5 | 47619 | 80 | 157.7K | 430.3K | 379.7K | 351.1K | 47.6K | 31.5K | 50.6K | 10 | 595 | 0.05 | 1.11 | 1.0/0.9/1.0/0.9 | 0.50 | 15 |
| 300 | 721 | 5 | 61223 | 81 | 7.03M | 573.0K | 505.4K | 483.6K | 56.4K | 32.9K | 67.5K | 10 | 623 | 0.16 | 1.19 | 1.0/0.9/1.0/0.9 | 0.50 | 16 |
| 330 | 793 | 6 | 69949 | 87 | 250.4K | 798.6K | 707.5K | 646.5K | 87.7K | 64.4K | 91.1K | 10 | 629 | 0.00 | 1.05 | 1.0/0.9/1.0/0.9 | 0.50 | 16 |
| 360 | 865 | 6 | 93960 | 94 | 598.2K | 1.39M | 1.26M | 1.13M | 161.9K | 92.5K | 126.7K | 11 | 684 | 0.00 | 1.15 | 0.9/0.9/1.0/1.0 | 0.50 | 16 |
| 390 | 937 | 6 | 115382 | 97 | 2.96M | 2.10M | 1.94M | 1.74M | 176.4K | 181.4K | 156.5K | 12 | 780 | 0.00 | 1.08 | 1.0/1.0/1.0/1.0 | 0.50 | 23 |
| 420 | 1009 | 6 | 127334 | 84 | 21.81M | 2.72M | 2.49M | 2.05M | 219.7K | 456.6K | 229.1K | 13 | 1019 | 0.00 | 1.55 | 1.0/1.0/1.0/0.6 | 0.50 | 23 |

### 14.5 Soft-locks found by the sim and designed out
1. **Era-gated strips** caused a land deadlock (the Contemporary population needed land that needed Contemporary). Fix: price-only strips (§7.5).
2. **The beach filled by villas** left no room for the airport. Fix: the reserved airport plot (§7.2).
3. **A sloppy full map capped population below a 75K gate.** Fixes: the Near Future gate lowered to 60K, plus the Advisor's "homes need services to grow" hint (§1.4). With the hint the slow player recovers.
4. **Factories competing with construction for materials** meant nobody built them. Fix: goods need workers and trade capacity, not materials (§5.6).
5. **Late-era services employed every worker,** so trade disappeared. Fix: the jobs multiplier flattens late (automation: 1, 2, 4, 8, 15, 26, 40).

---

## 15. Config sketch (world.json-level constants)

```jsonc
{
  "calendar": { "secondsPerYear": 25, "startYear": 1, "speeds": [0, 1, 2, 5], "testerSpeeds": [20, 50] },
  "atmosphere": { "dayRealSeconds": 480, "nightShare": 0.25, "seasonRealSeconds": 960, "weatherRealSeconds": [180, 360] },
  "offline": { "rate": 0.1, "capRealHours": 8, "analytic": true },
  "map": { "width": 100, "landRows": 40, "beachRows": 20, "seaRowsVisible": 30, "tileMeters": 16,
           "start": { "minX": 35, "maxX": 64 }, "townHall": { "x": 49, "y": 19 },
           "airportPlot": { "x": 42, "beachRow": 8, "w": 16, "h": 5 },
           "features": { "vein": [[56,59],[30,34],[75,79],[10,14]], "bay": [[65,69],[20,24],[85,89]], "portal": [[46,47],[0,4],[95,99]] },
           "veinMult": 1.5, "bayMult": 1.5, "throughLineMult": 1.5 },
  "strips": { "width": 5, "perSide": 7,
              "price": [500,1100,2400,5300,12000,26000,57000,125000,300000,700000,1600000,4000000,10000000,25000000] },
  "start": { "money": 300, "food": 40, "mat": 40, "population": 6, "buildings": [{ "type": "town_center", "level": 1 }] },
  "economy": {
    "currency": "money", "taxPerCitizen": 0.01, "taxMultByHomeEra": [1,1.6,2.5,4,6,9,13], "villaTaxMult": 3,
    "taxPolicy": { "low": [0.8, 8], "normal": [1, 0], "high": [1.2, -10] },
    "workforceShare": 0.5, "unemploymentTaxLoss": 0.3, "foodPerCitizen": 0.004,
    "prices": { "foodImport": 1.0, "foodExport": 0.4, "matImport": 4, "matExport": 1.5, "goodsExport": 6 },
    "exportAbove": 0.9, "storageBase": 300, "upgradeShare": 0.7, "refundShare": 0.5,
    "matRatio": { "housing": 0.08, "civic": 0.06, "default": 0.05, "materials": 0.04, "roads": 0.25 },
    "upkeepPerMin": { "housing": 0, "civic": 0, "food": 0.005, "materials": 0.007, "goods": 0.007, "trade": 0.007,
                      "service": 0.012, "park": 0.012, "energy": 0.008, "power": 0.02, "transport": 0.01, "culture": 0.006 },
    "tourismPerPoint": 0.01, "heritageMult": 2, "heritageEraGap": 2, "beachVillaMult": 1.5,
    "treasuryGrant": { "minutesOfIncome": 5, "oncePerEra": true },
    "monument": { "base": 20000000, "growth": 1.6, "steps": 10, "score": 5000, "happiness": 1 }
  },
  "scale": {
    "homePaybackMin": [3,6,14,27,42,64,80], "prodPaybackMin": [4,7,14,25,37,52,62],
    "jobsMult": [1,2,4,8,15,26,40],
    "costMult": "derived: cpc[e]/cpc[0] = [1, 3.2, 11.7, 36, 84, 192, 347]",
    "refValues": { "food": 1.0, "mat": 2.5, "goods": 6, "trade": 3, "matInCost": 2.5 }
  },
  "population": { "growthRate": 0.03, "growthFlat": 0.2, "decline": 0.004, "moveOutShare": 0.05,
                  "growMinHappiness": 40, "declineBelowHappiness": 25, "comfortFill": [0.7, 0.3] },
  "happiness": { "base": 35, "perService": 7.5, "parkCap": 15, "pollutionCap": 30, "starving": 25, "noPower": 15 },
  "traffic": { "tripsPerResident": 0.5, "tripsPerJob": 0.3, "tripsPerAttraction": 5, "tripLengthTiles": 10,
               "reachSteps": 6, "reachCap": 85, "happyPerUnit": 15, "happyCap": 15, "effSlope": 0.4,
               "levelCrossingCapMult": 0.8, "overpassCostMult": 3 },
  "transport": { "railTrackPrice": [1500,4000,10000,25000], "metroTunnelPrice": { "e1900": 3000, "e2000": 7000, "e2100": 15000 },
                 "metroRidersPerStation": 4000, "maxCountedStations": 3, "freightBonusRadius": 8, "freightBonus": 0.1,
                 "airportNoise": { "r": 4, "happiness": -8 }, "busTransit": { "avenue": 0.05, "smartAvenue": 0.08 } },
  "eras": [
    { "id": "e0", "hist": 0 },
    { "id": "e1000", "hist": 1000, "gate": { "pop": 80, "need": [["market",1,1],["school",1,1]], "disc": 3 }, "stars": [75, 62] },
    { "id": "e1500", "hist": 1500, "gate": { "pop": 400, "need": [["temple",2,1],["workshop",1,2]], "disc": 3 }, "stars": [150, 130] },
    { "id": "e1800", "hist": 1800, "gate": { "pop": 1800, "need": [["port",2,1],["glassworks",1,1]], "disc": 3 }, "stars": [240, 205] },
    { "id": "e1900", "hist": 1900, "gate": { "pop": 7500, "need": [["rail_station",1,1],["steel_mill",1,1]], "disc": 3 }, "stars": [380, 325] },
    { "id": "e2000", "hist": 2000, "gate": { "pop": 22000, "need": [["metro_station",1,2],["power_plant",1,1]], "disc": 3 }, "stars": [600, 495] },
    { "id": "e2100", "hist": 2100, "gate": { "pop": 60000, "need": [["airport",2,1],["electronics_fab",1,1]], "disc": 3 }, "stars": [850, 700] }
  ],
  "chronicle": { "goldenAgeYearsPerStar": 4, "goldenAgeBonus": 0.2, "pointsPerEra": 1000, "pointsPerStar": 1000, "pointsPerLeadYear": 2,
                 "spiritOfAge": { "perYear": 0.001, "cap": 0.3 } },
  "transition": { "blendYears": 20, "ambienceYears": 10, "residentRedressPerYear": 0.05 },
  "events": { "everyYears": [6, 10], "seededByYear": true, "giftShare": 0.5 },
  "score": { "levelPoints": 10, "happinessFactor": [0.8, 0.4], "achievement": 250 }
}
```
Per-era money faces live in `epochs.json` as `currency: { name, nameEn, symbol, icon }` (§4). Per-level fields add `comfort`, `r` (service radius), `transit`, `access`, `goodsPremium` and `noise` to v2's `Effects`.

---

## 16. Risks, open questions, cut list

### 16.1 Risks
1. **The sim is aspatial.** Coverage, traffic and pollution are approximated. A real layout may need ±20% retuning of radii and road capacity. Mitigation: the spatial formulas in §6–§8 are already per-tile and indexed; the first playable should log ρ and coverage per era and compare them with the sim's trace (§14.4).
2. **Late-game action count** (about 1,170 to the Near Future, plus upgrades afterwards) is high for phones. Mitigation: the bulk actions in §1.4 are part of the minimum scope, not polish.
3. **Upgrade-cascade fatigue:** dozens of outdated homes per era. Mitigation: the "Upgrade in view" button and the Advisor; Heritage gives a positive reason to skip some.
4. **Big numbers** (B-scale money late) on small screens. Mitigation: 3-significant-digit formatting everywhere and a 6-character HUD pill.
5. **Performance:**
   - per-tick work is O(1) aggregates;
   - structural recompute is O(changed area): grids for coverage, aura, pollution and metro, plus cached BFS reach sets for traffic. This replaces v2's O(B²) recalculate, which must not be ported;
   - offline catch-up is analytic (O(completions));
   - NPC and vehicle counts are capped by ρ and population, not linear.
6. **Model budget:** 13 new models, of which the airport is the largest (16×5). The airport L1 can ship as a simple grass strip first.

### 16.2 Open questions
- Should Heritage also apply to houses in a contiguous "old town" of 6 or more same-era homes? It is charming but adds a rule. Currently it applies to landmark types only.
- Day length of 8 real minutes versus a typical 20-minute session: is two to three day/night cycles per session right? Playtest.
- Should the tax lever be locked until the Middle Ages to keep Antiquity minimal? Probably yes.
- **Daily mobile players earn mostly ★** (the sim's 20-min-a-day player gets ★ from the Renaissance on), because offline years count at 0.1× without decisions. Option: keep the displayed calendar honest, but compute stars and lead from *active years* (calendar years minus offline years) and show the offline years separately in the Chronicle ("the city lived 340 years on its own"). This is recommended if retention data shows star frustration.
- Hard cap on metro lines (4) versus free lines: 4 keeps the overlay readable.
- Server validation: the client stays authoritative. Should the leaderboard sanity-check score against `year` (e.g. Chronicle points impossible for the elapsed game time)? Recommended.

### 16.3 What to cut first if scope must shrink (in order)
1. Architects' bureau and blueprints (cosmetic).
2. Random-event choice cards (keep gifts only).
3. Monument (keep strips as the post-content sink).
4. Through-line portals L7/R7 (keep the central portal).
5. Metro L3 and station L4 models (reuse lower levels with a glow pass).
6. Avenue class (keep 7 street levels; give streets the capacity curve 45→720 instead). Saves 4 cross-sections, but loses the "avenues vs streets" decision.
7. Villas on the beach (land only).
8. Food as a stocked resource (citizens simply cost upkeep). This is the last cut before the core changes.

**Never cut:** one currency with era faces, the Town Hall gate, the constant calendar with the Chronicle lead, services that fill homes, the materials auto-import, and the reserved airport plot.
