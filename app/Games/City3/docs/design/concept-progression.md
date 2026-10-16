# City Chronicle 3 (Летопись города 3): GDD from the progression and pacing lens

> Author lens: **progression and pacing designer** (Clash of Clans / SimCity BuildIt school).
> The spine of this design is the long-term race **"ahead of history" (Опередить историю)**. The question it answers is
> "what do I do in the next 30 seconds, the next 5 minutes, the next session, and the next week?", and each answer
> has a number.
> Every formula below is implemented in the simulation `sim-progression.mjs`, which sits next to this file, and the pacing table in §14 is its
> real output. Where the real engine needs a *spatial* version of a formula (radius coverage, chunk traffic), I give
> both. The sim uses the aggregate one and says so.

---

## 0. One-page summary

| Topic | Decision |
|---|---|
| Arc | 7 eras + a finale (World Expo, Всемирная выставка). Typical player: **finale at calendar year ≈ 700–780, ≈ 5 h of play at 1×** (≈ 2–3 h of real time with ×2/×5). Optimised: year ≈ 590–690. Slow: year ≈ 1 560–1 760. |
| Calendar | 1 year = 25 s at 1×, always. Year = `floor(time/25)`. Never jumps. Eras open on achievements. |
| Spine | **Lead (Опережение) = equivalent historical year − calendar year**. A live meter. Medals at each era entry (gold/silver/bronze), Golden Age buff, leaderboard score. |
| Era gate | CoC-style **Town Hall upgrade** = era transition. To *start* it you need: a population target, 3–6 milestones that teach the current era's verb, 3 of 4 discoveries, the strip count, and money + materials. It then builds for 5–16 years. |
| New verb per era | Build/feed → Districts and charters → Harbour trade orders → Railways → Metro and power grid → Airport and flight routes → Smart programs and the Expo. |
| Currency | One id `money`, seven faces: Coins ₯ → Groats ₰ → Florins ƒ → Banknotes ₤ → Cash ¤ → Cards Ȼ → Digital credits ◈. **No redenomination** (§4). |
| Resources | 7 goods + knowledge: food, wood, stone, metal, fuel, materials, goods, knowledge. Power is a flow, not a stock. Only money is on the HUD. |
| Economy | Taxes (by house level), commerce (goods-dependent), business tax (offices), tourism, exports and port orders vs construction, upkeep (utilisation-scaled), land, research, Town Hall, imports. Upkeep share climbs from 5 % to ≈ 45 %. No profile ever dead-ended in the sim (§5.9). |
| Density | Houses climb levels only when **service needs** are met (BuildIt). Eligible houses also grow by themselves at 1.5 %/yr (classic SimCity), so a passive city never freezes. |
| Map | 100 × 40 land + 20 sand rows, mountain to the north, sea to the south. Start 30 columns. 14 strips of 5 columns (7 per side), each with a fixed **deposit** (stone vein, coal seam, harbour, oil field, fertile valley, cape…), cost 250 → 14 M, era-gated. |
| Roads | 7 classes, each a different 16 m cross-section (trail → cobbles → paved → boulevard → 4-lane avenue → signalised arterial → smart street). Capacity 1 → 12. Congestion per 10×10 chunk hurts production and happiness. |
| Transport | Port (1500), railway on a national trunk line (1800), metro lines (1900), airport with routes (2000), maglev (2100). |
| Content | Reuses **all 36 v2 buildings / 155 levels ≤ 2100**. NEW hand-made models: **port (3 levels), station (3), metro pavilion (3), airport (2) = 11 level models**, plus procedural rail track and the road-decor kit. |
| Research | 56 techs → **28 discoveries** (4 per era), one lab slot, 2–40 yr timers. Knowledge output speeds them up to 1.25×. |
| Builders | **Crews (Бригады)** 2 → 9 work the public construction queue FIFO. Private housing builds in parallel. |
| Offline | Calendar pauses. A capped "welcome back" dividend (§2.5). |

---

## 1. Vision and core loops

**Fantasy.** *"Your town outruns history."* Each era you reach early is a line in your chronicle: "Middle Ages, year 48: 952 years ahead of history." In the late game history speeds up (eras 100 years apart), your lead starts to shrink, and the game says so: *"History is catching up" (История догоняет)*. You then defend your lead into the finale.

### 1.1 Loops

| Loop | Length | What the player does | What makes it satisfying |
|---|---|---|---|
| **30 seconds** | 1–2 game years | Place or upgrade one thing. Watch the money pill tick (it grows every 2 s). Tap a coin bubble or deliver a port order. | There is always something affordable *now*. The sim's typical player makes a decision every 6 s and is rarely blocked for long. |
| **5 minutes** | ≈ 12 years | Close one **need**: e.g. "houses can't reach L5 because 18 % lack culture → build a theatre". Finish a milestone. Start the next discovery (2–40 yr timer). | The checklist ticks and the **Lead** meter jumps (each milestone adds ≈ 1/12 of an era's history span, §3.4). |
| **Session** (20–60 min) | 50–150 years | Clear one **era gate**: the population target plus milestones, then the Town Hall upgrade (5–16 yr build). Usually one land strip too. | A big visible change: new money face, new verb, new building levels, medal and Golden Age. |
| **Long term** | 5–12 h per chronicle | 7 eras and the Expo. Medals per era, final lead, leaderboard. **New Chronicle** (restart) keeps your best score. | A speed-run meta: the second run is faster because you know the gates. Records sit on a shared, identical map. |

### 1.2 What I took, and why

| Source | Taken | Why |
|---|---|---|
| **Clash of Clans** | Town Hall = tier gate, with a checklist you must finish *before* the upgrade. Builder-like **crews** limit parallel public projects. A **laboratory** (one research slot with a timer). Clear "what this tier unlocks" screens. Collect bubbles. | Clear medium-term goals and readable progress. CoC's best idea is that the next tier is always visible and always slightly out of reach. |
| **SimCity BuildIt** | One soft currency. Materials used in construction, with **"buy missing"** at a premium. **Services gate residential density**. Expansions bought as milestone purchases. Port/airport "cargo orders". | BuildIt shows that density gated by services makes the player plan a city instead of spamming houses, and that buy-missing removes dead-ends. |
| **Classic SimCity** | Taxes with a policy lever. Land value. Traffic as a capacity problem fixed by road hierarchy and transit. Zones that **grow by themselves** when attractive. | It gives the late game depth, and organic growth keeps a neglected city from freezing. |
| **Rejected** | Real-time timers, premium currency, hard money caps, per-car traffic simulation, a separate research currency on the HUD. | They conflict with a game-time race, with mobile performance, or with the one-currency rule. |

---

## 2. Time

### 2.1 Calendar

* `secondsPerYear = 25` at 1×, so 2.4 years per real minute. Speeds: pause, ×1, ×2, ×5 (testers ×20, ×50). Speed multiplies **everything** (production, timers, calendar). A year at ×5 therefore produces exactly what it produces at ×1.
* **The race is speed-neutral.** Lead is measured in game years, so ×5 only saves wall time. ×1 and pause give more decisions per year. Pause is free planning time, and everyone has it.
* `year = floor(state.time / 25)`. It is stored only as a denormalised field for the server and leaderboard. It never jumps, never clamps and never resets.

### 2.2 What the HUD shows

* **Top-left chip:** era icon + **year** (`1043`), with a thin ring that fills every 25 s (the year tick). A second line shows the Lead: `+956 лет` in green while the lead is growing and in amber while history is gaining on you.
* **Top-right pill:** money in the era's face (`₰ 12.4K`). This is the only resource on the HUD. Population and happiness live on the City button badge.
* **No month.** A month (2.08 s) is too fast to read and would clash with the visual seasons (§2.3). Economy panels show rates **per year** (`+1 240 ₰/год`); the pacing table also gives per-month values (= /12).

### 2.3 Seasons and day/night (reconciled)

The scene runs on a **time-lapse clock** that is honest about being one:

| Visual unit | Game seconds at 1× | Calendar years |
|---|---|---|
| Day/night cycle | 240 s | 9.6 years |
| Season | 1 day = 240 s | 9.6 years |
| Full 4-season cycle | 960 s | 38.4 years |

* The season tooltip names a span of years, not a month: *"Зима · 1041–1050"*. The metaphor: the chronicle is filmed in time-lapse, so one season stands for about a decade.
* Gameplay effect is mild and averages out: farm output × {spring 1.00, summer 1.15, autumn 1.05, winter 0.80}, mean 1.00. Snow, lamps and lit windows are cosmetic. (The sim uses the mean, 1.0.)

### 2.4 Speeds and timers

All timers (construction, discoveries, Town Hall, events) are in game years, so they scale with speed. Typical durations: house 0.2–2.5 yr (5–63 s at 1×); public building 0.3–5 yr; Town Hall 2–16 yr; discovery 2–40 yr.

### 2.5 Offline progress

**The calendar pauses while you are away.** Advancing it offline would destroy the lead race: one night at 1× is about 1 150 years.

* **Welcome-back dividend (Казна, пока вас не было):** `dividend = min(hoursAway/8, 1) × max(0, netIncomePerYear)`. That is up to **1 year of net income** after an absence of 8 h or more, claimable **at most once per 25 game years** (≈ 10 min of play). In the worst case it adds ≈ 4 % income. That makes it a gift to returning players and useless to exploit.
* No construction, research or events progress offline. The analytic catch-up replaces v2's 3 600 quiet ticks with one multiplication, which is cheap on phones.
* Server plausibility: Δgame time ≤ Δwall time × 5.5 for normal players. Tester speeds mark the save off-board.

---

## 3. Eras

### 3.1 The seven eras plus the finale

| # | Era (RU / EN) | Historical year = target | Money face | **New verb** (what you newly *do*) | Key unlocks |
|---|---|---:|---|---|---|
| 0 | Античность / Antiquity | 0 | Coins ₯ | **Build, connect, feed.** Roads, huts, fields, wells; tap coin bubbles. | Houses L1–2, farm, fishery, quarry, lumber camp, well, temple, market, school, theatre, storehouse. |
| 1 | Средневековье / Middle Ages | 1000 | Groats ₰ | **Found districts and pick charters** (Слободы и грамоты). First **production chains** (ore→goods, stone+wood→materials). | District hall, mine, smithy, kiln, clinic, manor; houses L3–4. |
| 2 | Возрождение / Renaissance | 1500 | Florins ƒ | **Harbour trade orders** (Торговые заказы): pick which orders to fill. **Architectural styles** and heritage tourism. | Port (NEW), architect bureau + blueprints, glassworks, university, windmill (farm boost), house L5. |
| 3 | Индустриальная эра / Industrial | 1800 | Banknotes ₤ | **Railways**: draw track to the national trunk line, place stations, run freight. **Redevelop** old quarters into blocks. | Station (NEW), track, coal mine, steel mill, blocks, boulevard road, houses L6–7, L3 of most buildings. |
| 4 | Модерн / Modern | 1900 | Cash ¤ | **Metro lines** (underground tracing). **Power grid**. **Road hierarchy vs traffic** (4-lane avenues). | Metro (NEW), power plant, oil well, cement plant, avenue, house L8 (needs power). |
| 5 | Современность / Contemporary | 2000 | Cards Ȼ | **Airport and flight routes** (tourist / cargo / business). Business towers. | Airport (NEW), business tower, electronics fab, chemical plant, arterial road, houses L9–10. |
| 6 | Ближнее будущее / Near Future | 2100 | Digital credits ◈ | **Smart programs** (city-wide toggles paid in knowledge). Maglev. **World Expo** finale. | Data center, solar farm, vertical farm, composites plant, smart street, house L11, maglev station. |
| ★ | Летопись завершена / Chronicle complete | par 2200 | — | World Expo (5-year festival) | Endless mode, records, New Chronicle. |

### 3.2 Gates: what you need to *start* the Town Hall upgrade into each era

Costs are generated from the level value V (§5.6). Money is given in that era's face.

| Into | Population | Milestones (teach the current era's verb) | Disc. | Strips | Town Hall upgrade (money + materials, build time) |
|---|---:|---|:-:|:-:|---|
| **1000** Middle Ages | 150 | Town Hall L2 "Chief's house" built · 6 houses at L2+ · 3 farms · 1 market · 1 temple *or* school | 3/4 | — | **Ратуша** V 3 800 → 1 710 ₯ + 891 wood + 594 stone · **5 yr** |
| **1500** Renaissance | 1 000 | 2 district halls (with charters) · 1 mine · 2 smithies · 1 kiln · 1 clinic | 3/4 | 1 | **Дворец** V 26 000 → 11 700 ₰ + 1 250 wood + 1 000 stone + 667 mat + 200 metal + 167 goods · **7 yr** |
| **1800** Industrial | 3 000 | Port · architect bureau · a university (school L3) · **6 trade orders delivered** | 3/4 | 2 | **Городская управа** V 150 K → 67.5 K ƒ + 3 571 mat + 2 143 metal + 595 goods · **10 yr** |
| **1900** Modern | 7 500 | **2 stations on the trunk network** · coal mine · steel mill · 2 blocks | 3/4 | 4 | **Мэрия** V 900 K → 405 K ₤ + 12.9 K mat + 7.7 K metal + 3.2 K fuel + 1.1 K goods · **12 yr** |
| **2000** Contemporary | 17 000 | **3 metro stations on a line** · 2 power plants · power ≥ 95 % · 40 tiles of avenue or better | 3/4 | 6 | **Сити-холл** V 4 M → 1.8 M ¤ + 30.3 K mat + 21.8 K metal + 9.1 K goods · **14 yr** |
| **2100** Near Future | 32 000 | **Airport + 3 flight routes** · 2 business towers · electronics fab | 3/4 | 8 | **Цифровая мэрия** V 16 M → 7.2 M Ȼ + 88.9 K mat + 17.8 K metal + 29.6 K goods · **16 yr** |
| **★ Finale** | 50 000 | Data center · **maglev station** (station L3) · 2 solar farms · **3 smart programs** · happiness ≥ 70 | 4/4 | 11 | **World Expo**: 15 M ◈ · **5 yr** |

**Why these requirements?**
* Each era's milestones are the **previous era's new verb**. You cannot leave the Middle Ages without having founded districts and run a production chain. You cannot leave the Renaissance without having delivered port orders. Gates *teach* and are never arbitrary.
* **Population** is the growth check and the main pacing driver. In the sim it is the **last item the typical city completes** in most eras: it reaches the population target 0–16 years before it can start the Town Hall upgrade (e.g. Renaissance → Industrial: population met in year 150, hall started in year 150).
* **Strips** in the gate (1 → 11) make expansion a milestone without forcing it early, and every strip pays back through its deposit (§7).
* **Discoveries 3 of 4** give a choice about the last one (e.g. skip banking and rush navigation).
* **Town Hall cost** is the era's big savings goal: 4–25 years of net income at gate time. The sim's typical player starts saving the moment the checklist is green. Its **build time** (5 → 16 yr) is a CoC-style tension beat: "the hall is under scaffolding and the new era is coming".

### 3.3 The transition is gradual

| Changes **at once** (when the Town Hall upgrade completes) | Changes **over time** | **Never** changes |
|---|---|---|
| Money face. The pill morphs over 1 year with a "new coin minted" toast. | Sky palette lerps over **20 years**. | **The calendar rate.** No year count-up animation. |
| Build menu shows the new levels and buildings, each marked "new". | HUD accent colour lerps over **10 years**. | Existing buildings and roads. Each keeps its level's look; heritage is the point. |
| 4 new discoveries become available. | NPC wardrobes: a resident re-dresses on returning home (≈ 10 %/yr, 95 % after ≈ 30 yr). | Land owned, stocks, money value (no conversion). |
| +1 construction crew. | Traffic mix (carts → cars → buses → shuttles) lerps over **30 years**. | Score already earned and medals. |
| Medal + **Golden Age** (§3.4). | Ambience crossfades over 10 years. | Research already done. |
| The new events table and the era's verb tutorial goal. | Industrial era: the national trunk railway is "built" across the map over 10 years (cosmetic; usable at once in your columns). | |

### 3.4 "Ahead of history": formulas

Let `H_e` be the historical year of era *e* (0, 1000, 1500, 1800, 1900, 2000, 2100; finale `H_7 = 2200`) and `Y` the calendar year.

* **Gate progress** while in era *e*: `g = 0.5 · min(1, pop / popGate) + 0.5 · (items done / items total)`. Items are the milestones, discoveries, strips and special checks; population is counted separately.
* **Equivalent historical year:** `E(t) = H_e + (busyTH ? 0.98 : 0.95 · g) · (H_{e+1} − H_e)`.
* **Lead (Опережение):** `L(t) = E(t) − Y(t)`. It drops by 1 every year you dawdle and jumps when you tick a milestone.
* **At era entry** (Town Hall completes at year `Y_e`): `lead_e = H_e − Y_e`. This is recorded in the **Chronicle** (Летопись), a timeline screen with one line per era.
* **Medal at entry:** gold if `Y_e ≤ gold par`, silver if `Y_e ≤ silver par`, bronze if `Y_e ≤ H_e`, none otherwise. Pars come from the sim (gold ≈ optimised × 1.05, silver ≈ typical × 1.05):

| Era | 1000 | 1500 | 1800 | 1900 | 2000 | 2100 | ★ |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gold par (year) | 46 | 80 | 130 | 210 | 350 | 515 | 660 |
| Silver par | 55 | 100 | 160 | 245 | 390 | 565 | 825 |
| Bronze = history | 1000 | 1500 | 1800 | 1900 | 2000 | 2100 | 2200 |

* **Golden Age (Золотой век)** after a medal: gold +15 % for 20 yr, silver +10 % for 15 yr, bronze +5 % for 10 yr, applied to tax and production. Every medal also gives +5 happiness and +5 land value. It is a modest snowball for skill.
* **Narrative curve (typical, from the sim):** lead at entry is +952 → +1 405 → +1 640 → +1 658 → +1 590 → +1 560 → +1 422. It peaks in the Industrial era, then **history catches up** (the same history spans of 100 years cost ever more game years). The late game is about *defending* the lead. The slow profile falls to +541 at the finale. A city 1.5× slower than slow would end behind history.

---

## 4. Currency: one `money`, seven faces

| Era | RU / EN name | Symbol | Icon / visual idea |
|---|---|:-:|---|
| 0 | Монеты / Coins | **₯** | Silver drachma with an owl; HUD pill in worn silver. |
| 1 | Гроши / Groats | **₰** | Hammered silver penny with a cross, irregular edge. |
| 2 | Флорины / Florins | **ƒ** | Gold florin with a lily; warm gold pill. |
| 3 | Банкноты / Banknotes | **₤** | Folded engraved note with a guilloche border; paper-cream pill. |
| 4 | Наличные / Cash | **¤** | Banknote roll with a coin; green-grey pill. |
| 5 | Карты / Cards | **Ȼ** | Plastic card with a chip; glossy dark pill. |
| 6 | Цифровые кредиты / Digital credits | **◈** | Glowing hex token; animated gradient pill. |

**Rule: no redenomination, no inflation conversion.** The id is `money` and the number never changes when the face changes.
* *Why.* A conversion (e.g. ÷10 at each era) would (a) make the transition an instant "everything changes" moment, which the user wants removed; (b) break mental anchors ("a hall cost ~400 K") and every saved cost and refund; (c) muddle score comparisons. Growth is instead handled by **compact formatting** (`12.4K`, `3.1M`, `1.2B`), which BuildIt players already know.
* *Flavour without mechanics.* For 10 years after a face change, tooltips show both glyphs ("₰ = ₯"), and old-era buildings that "produce money" (manor, market) keep their era's coin in their animation.

---

## 5. Economy model

All rates are **per game year** (engine: ÷25 per 1 s tick). Era index *e* = 0…6. `τ_e` = tax per resident-year by the **house level's** era: `τ = [1, 1.8, 3, 5, 8.5, 14, 22]`.

### 5.1 Resources (short list)

| Resource | Role | First produced by | Main consumers | Where visible |
|---|---|---|---|---|
| **money** | Currency | Taxes, commerce, offices, tourism, exports, orders | Everything | HUD pill |
| **food** (еда) | 1.0 per resident-year | Farm, fishery, (TH), vertical farm | Population; chemical plant L2 | City panel (balance), warehouse |
| **wood** (дерево) | Early construction | Lumber camp (tree plantation; no map trees) | Construction e0–e2, kiln L1, smithy L1–2, glassworks L1 | Warehouse, cost tooltips |
| **stone** (камень) | Construction, materials input | Quarry (**against the mountain**) | Construction e0–e2; kiln, glassworks, cement | Warehouse |
| **metal** (металл) | Construction e2+, goods input | Mine (mountain), steel mill (from fuel) | Construction, smithy, electronics, composites | Warehouse |
| **fuel** (топливо) | Industry and power input | Coal mine (mountain), oil well (**sand**) | Power plants, kiln L2, glassworks, cement, farm L4–5, steel mill | Warehouse |
| **materials** (стройматериалы: brick → concrete → composite) | Main construction material e2+ | Kiln, glassworks, cement plant, composites plant | Construction | Warehouse |
| **goods** (товары: tools → appliances → electronics) | Retail demand, construction | Smithy, chemical plant, electronics fab | Markets (residents buy), construction | Warehouse |
| **knowledge** (знания) | Discoveries, smart programs | TH, temple, school, architect bureau, data center | Research, programs | Research panel only |
| *power* | Flow (supply/demand ratio), not stored | Windmill L2+, power plant, solar | Houses L8+, industry, services | Power overlay |

The names "materials" and "goods" show their current face in tooltips (e.g. "Стройматериалы (кирпич)"), the same idea as money.

### 5.2 Storage

`cap_r = (300 + TH.store + Σ storehouse.store) · (1 + storageBonus)`, one shared value applied to each good. Money and knowledge have no cap. TH store by level: 300 / 600 / 1.5 K / 3.5 K / 8 K / 18 K / 40 K / 80 K. Storehouse: 400 / 1 K / 2.5 K / 5 K / 15 K / 30 K.

### 5.3 Production and labour

* **Labour:** `workers = 0.6 · pop`. Two tiers, so essentials never starve: **tier A** (food, services, power, transport, infrastructure) fills first; **tier B** (resources, industry, trade, offices) shares the rest.
  `fillA = min(1, workers / jobsA)`, `fillB = min(1, (workers − jobsA·fillA) / jobsB)`, `unemployment u = max(0, workers − filled) / workers`.
* **Output** of a building group: `out = P · n · eff · inputFactor · (1 + techProd + golden + deposit + freight + craftCharter + techR)`, where `eff = fill_tier · (powerUse ? powerRatio : 1) · (tierB ? trafficFactor : 1)`.
* **Two-phase settlement** fixes v2's order bug: (1) sum every consumer's need per resource; (2) `ratio_r = min(1, stock_r / need_r)`; (3) each building's `inputFactor = min over its inputs of ratio_r`.
* **Power:** `powerRatio = min(1, Σ supply · fillA · fuelRatio / Σ use)`.
* **Chains:** wood + stone → materials (kiln L1); stone + fuel → materials (kiln L2, glassworks, cement); fuel + metal → materials (composites); metal (+wood/fuel) → goods (smithy); fuel → goods (chemical L1); food → goods (chemical L2); metal + materials → goods (electronics); fuel → metal (steel mill L1–3).

### 5.4 Money sources

| Source | Formula (per year) |
|---|---|
| **Tax** | `Σ_houses residents_h · τ(levelEra_h) · rich_h · (0.5 + hap/100) · (0.8 + 0.4·LV/100) · policy · (1 + techTax + golden + 0.5·marketCharter)`. Residents are split across houses proportionally to capacity. `rich` = 2.5 for manors. |
| **Commerce** | `covered · 0.3 · τ̄ · (0.4 + 0.6·gs) · (1 + marketCharter)`. `covered = min(pop, Σ market capacity)`, `τ̄` = population-weighted tax, `gs` = goods satisfaction = `min(1, goods stock / goodsDemand)`, `goodsDemand = covered · γ_e`, `γ = [0, .03, .05, .08, .10, .12, .14]`. |
| **Business tax** (business towers) | `Σ officeJobs · fillB · 0.8 · τ(towerEra) · (1 + 0.1 if a business route exists)`. |
| **Tourism** | `A · M · τ_e · 1.2 · min(1.2, hap/70) · (1 + 2·heritageCharter)`. Attraction `A = Σ tour points + 0.5 · heritage buildings` (2×2 non-industrial buildings whose level era ≤ era − 2). Multiplier `M = 1 + 0.25 (port) + min(0.6, Σ station bonus) + airport (0.8 / 1.5) + 0.3 (≥ 1 tourist route)`. |
| **Fares** | `transitCoveredResidents · 0.04 · τ̄`. |
| **Building income** | Town Hall and theatre `P.money` (e.g. TH L8 26 K/yr, holo-theatre 1.2 K/yr). |
| **Exports** | Auto-sell the surplus above 75 % of cap, limited by **trade capacity** (market 20 → 2 000, port 500 / 1 500 / 5 000, station 600 / 1 500 / 3 000 units/yr). Price `= p_r · PI_e · 0.6 · sat_r`, with `sat_r = 1 − 0.5·min(1, soldThisYear_r / (0.5·tradeCap))`. *(Sim: fixed 0.6, no saturation.)* |
| **Port orders** | An order appears every `5 / slots` years. `qty = orderQty_e · U(0.6, 1.4) · √(p_goods/p_r)`, `orderQty = [–, –, 40, 90, 200, 400, 700]`. Reward `= qty · p_r · PI_e · 1.6`. Expires in 20 years. Only goods you actually produce are asked for. |

Prices: base `p = {food 0.5, wood 0.8, stone 1, metal 2.5, fuel 2, materials 3, goods 6}` × **price index** `PI = [1, 1.6, 2.6, 4.2, 7, 11, 18]` of the *current* era. These are fixed list prices with per-player sale saturation. There is no global market: single player, fair leaderboard.

### 5.5 Money sinks

| Sink | Formula |
|---|---|
| **Construction** | `cost(level) = recipe(V · costMul[levelEra])` (§5.6). Upgrade = 70 % of the target level's cost. Demolish refund = 50 % of the money part. |
| **"Buy missing" (import)** | Any missing material is auto-bought at `p_r · PI_e · 1.5`. Always available, so there are no dead-ends. |
| **Upkeep** | `Σ V · rate[category]`. Rates per year: housing 0 · center 0 · food 0.8 % · resources 0.8 % · storage 0.8 % · industry 1 % · trade 1 % · infrastructure 1.5 % · power 1.5 % · transport 2 % · roads 1.5 % of tile value · **services 2 % × (0.5 + 0.5 · utilisation)**, where `utilisation = min(1, pop / capacity)` per service type (overbuilding is half price). Flight routes 25 K/yr (e5) or 60 K/yr (e6). Smart programs 120 knowledge/yr each. |
| **Land** | Strips 250 → 14 M (§7). |
| **Research** | 20 → 850 K money + knowledge (§11). |
| **Town Hall** | The era gate (§3.2). |
| **Finale** | World Expo 15 M. |
| *(Post-finale)* | *Monuments of the eras (Памятники эпох): 7 cosmetic wonders, each 2× the previous (from 20 M), achievements only, no score per money. This keeps endless-mode money useful without paying for idling.* |

### 5.6 Cost generation (one table to tune everything)

Every level has one number, **V** (its value in money at its era's prices). `costMul = [1, 1.4, 2.0, 2.6, 3.2, 3.6, 4.0]` by level era, applied to cost but not to upkeep (the Town Hall uses V directly). The result is split by a **recipe** (share of value per resource). The material quantity is `share · V · costMul / (p_r · PI_levelEra)`.

| Level era | money | wood | stone | metal | fuel | materials | goods |
|---|---:|---:|---:|---:|---:|---:|---:|
| e0 | .40 | .35 | .25 | | | | |
| e1 | .45 | .30 | .25 | | | | |
| e2 | .45 | .10 | .10 | .05 | | .20 | .10 |
| e3 | .45 | | | .15 | | .30 | .10 |
| e4 | .45 | | | .15 | .05 | .30 | .05 |
| e5 | .45 | | | .15 | | .25 | .15 |
| e6 | .45 | | | .05 | | .30 | .20 |

*Rule: a level never costs a resource that is first produced in its own era.* This prevents chicken-and-egg builds and means *producing* bricks in the Middle Ages is what pays off in the Renaissance. Per-building override: house, farm and fishery L1–2 are 40 % money and 60 % wood; the e0 lumber camp is 100 % money. `node sim-progression.mjs --costs` prints the full generated table (money, materials, upkeep) for all 155 levels.

### 5.7 Demand

* Food demand is `pop · 1.0`. When stock runs out the city is starving: −25 happiness and −7.5 % pop/yr.
* Goods demand is `covered · γ_e`. Unmet goods cut commerce income by up to 60 %. Goods matter from e1 and grow with the era.
* "Housing demand" is implicit. A population at ≥ 93 % of capacity with jobs filled signals "build or upgrade housing", and unemployment > 8 % signals "build jobs" (the RCI read-out in the City panel).

### 5.8 Policy lever: tax rate

| Policy | Tax × | Happiness |
|---|---:|---:|
| Low (Низкие) | 0.85 | +4 |
| Normal | 1.00 | 0 |
| High (Высокие) | 1.20 | −6 |
| Very high (Грабительские) | 1.40 | −15 |

The optimised sim profile raises taxes while happiness stays ≥ max(62, gate requirement + 3).

### 5.9 Money neither explodes nor dead-ends (evidence from the sim)

* **No dead-end:** houses have **zero upkeep** and grow organically; "buy missing" never blocks; demolition refunds 50 %; the tax lever; plus an *Emergency loan (Ссуда казны)* of up to 3 years of gross income at 8 %/yr, auto-repaid from 20 % of net (a safety valve the sim never needed). Sim result: **lowest balance before the finale = 0 (slow, typical) and −4.4 K for 0.1 year (optimised). Austerity demolitions: 0 in all profiles.**
* **No explosion:** the upkeep share of gross rises steadily (typical 5 % → 8 % → 11 % → 17 % → 23 % → 36 % → 46 % at the finale). Level values V grow ×7 000 from house L1 to L11, and `costMul` adds up to ×4 on top. Bank balances stay bounded for active players. Savings pile up while the player waits for the big lumps (Town Hall, strips) and are then spent. At era entries the typical bank is 0.2–17 years of gross (the peak, 17 years, is in the Industrial era: one strip plus the next hall), optimised 0.03–9. At the finale both hold ≈ 0.1 year of gross, so nothing compounds. **Score ignores money**, so hoarding (the slow profile reaches 114 M) is a lack of action, not an exploit.

---

## 6. Population and city

### 6.1 Housing

| Level (house 1×1) | Era | Residents | V | Needs (all of the previous level's, plus…) | Power use |
|---|---|---:|---:|---|---:|
| L1 Шалаш (hut) | 0 | 3 | 18 | — | |
| L2 Глинобитный дом (mud-brick) | 0 | 5 | 35 | water | |
| L3 Изба (log house) | 1 | 7 | 100 | + commerce | |
| L4 Каменный дом (stone house) | 1 | 9 | 190 | + health | |
| L5 Фахверк (half-timber) | 2 | 12 | 600 | + culture | |
| L6 Кирпичный дом (brick) | 3 | 16 | 2 300 | + education | |
| L7 Доходный дом (tenement) | 3 | 20 | 3 600 | + leisure | |
| L8 Многоэтажка (apartment block) | 4 | 28 | 10 500 | + power ≥ 95 % | 2 |
| L9 Высотка (high-rise) | 5 | 38 | 32 000 | + transit | 3 |
| L10 Небоскрёб (tower) | 5 | 48 | 56 000 | + land value ≥ 60 | 5 |
| L11 Эко-башня (eco-tower) | 6 | 60 | 125 000 | + data | 6 |

* **Manor (Усадьба)** 2×2: 8 / 12 / 18 / 26 / 36 / 48 residents (e1–e6), each paying **2.5× tax**; needs from L5 (culture) upward. **Block (Жилой квартал)** 2×2: 64 / 110 / 160 / 210 / 280 (e3–e6), with the needs of house L6 / L8 / L9 / L10 / L11.
* **Rule:** a house may be at level L only if every need of L is covered at its tile. Spatial: a house is covered by service *k* when a building of *k* with free capacity is within radius. Aggregate (sim): the number of houses at ≥ L must not exceed `N · min_k cov_k`.
* **Paid upgrade** (70 % of the level cost, private construction, needs no crew) or **organic growth**: each eligible house climbs one level by itself with `p = 1.5 %/yr × needShare`, for free. In the sim the typical city got ≈ 1 900 organic house upgrades against ≈ 2 600 paid upgrades (all building types).

### 6.2 Growth

```
H = Σ residents capacity · (1 + housingBonus)
if pop > H:          pop = max(H, pop − max(0.2, 0.1·(pop − H)) per tick)
elif starving:       pop ·= 1 − 0.075/yr
elif hap < 25:       pop ·= 1 − 0.05/yr
elif hap ≥ 40:       pop += ((H − pop) · 0.75 · hap/70 + 2.5) per year
```

### 6.3 Services and coverage

| Service | Buildings (capacity by level) | Radius (spatial) | Happiness when covered |
|---|---|---:|---:|
| water (вода) | well 60 / 150 / 500 / 1 200 / 2 600 | 5 | +10 |
| health (здоровье) | clinic 80 / 200 / 600 / 1 400 / 3 000 | 7 | +10 |
| education (образование) | school 60 / 150 / 400 / 900 / 2 000 / 4 000 / 8 000 | 8 | +8 |
| culture (культура) | temple 80 / 200 / 600; theatre 100 / 300 / 800 / 1 500 / 3 000 / 6 000 | 9 | +8 |
| commerce (торговля) | market 80 / 200 / 450 / 1 000 / 2 000 / 4 000 / 8 000 | 7 | +6 |
| leisure (отдых) | park 40 / 100 / 250 / 500 / 1 000 | 4 | +6 |
| transit (транспорт) | station 700 / 1 500 / 3 000; metro 1 500 / 2 600 / 4 000; avenue bus stops 10 / 14 / 20 per road tile | 8 / 6 / 2 | +4 |
| data (данные) | data center 6 000; district hall L5 1 500 | 12 | — (L11 need) |

Service V is set so that covering one resident costs ≈ `[0.5, 0.8, 1.2, 1.5, 1.6, 1.7, 1.8]` years of that era's tax (e.g. a clinic L5 costs V 71 000 for 3 000 residents).

### 6.4 Happiness (per house spatially, city average in the sim)

```
hap = 40 + 10·water + 10·health + 8·edu + 8·culture + 6·commerce + 6·leisure      (coverage 0..1 each)
    + 4·transit + 0.6·clamp(roadLV, −3, 6) + techHappy + taxPolicy + (golden ? 5 : 0)
    − 25·max(0, u − 0.03) − (starving ? 25 : 0) − 15·(1 − powerRatio)·[city uses power]
    − pollution(≤ 20) − traffic(≤ 15)                        → clamp 0..100
```
* **Pollution, spatial:** a house gets `P_h = Σ_i pol_i·(1 + 0.25·L_i)·max(0, 1 − d/r_i)` with `r_i = 4 + L_i`, and a penalty of `min(20, P_h/3)`. The green charter halves it. Pollution points: quarry 6, mine 8, kiln 8, glassworks 10, smithy 6, coal mine 20, cement 25, steel mill 30, chemical plant 30, power plant 40. *Sim aggregate:* `min(20, exposure · Σpol / (landUsed/100) / 2)`, with exposure 0.25 / 0.45 / 0.65 for optimised / typical / slow layouts.
* **Traffic:** `min(15, 12·max(0, ρ − 1))` (§8.3).

### 6.5 Land value (0–100, per tile)

`LV = 20 + 35·avg(cov water, health, edu, culture, leisure, commerce) + 15·cov transit + 1.5·roadAura + 2·min(5, charters) − 0.8·pollution + (golden ? 5 : 0)`, plus **+8 within 5 tiles of the sea** (spatial only). LV multiplies tax by `0.8 + 0.4·LV/100` and gates house L10 and business towers (LV ≥ 60).

---

## 7. Map and land

### 7.1 Grid (north to south)

| Band | Rows | What may be built |
|---|---|---|
| Mountain backdrop | outside play (its foot touches land row 0) | Nothing. **Mountain-face buildings** (quarry, mine, coal mine; 2×2) must include land row 0. The mountain is 2 slots per 4 columns, so the start area has **15 mountain slots**. |
| **Land** | rows 0–39 | Everything, except buildings that require sand or coast. Farms only here (fertility 1.0). |
| **Sand / beach** | rows 40–59 | Roads, rail (the **national trunk line runs along row 40**), port and fisheries (must touch row 59 = coast), oil wells, airport (10×4), and everything with zone "either": market, park, storehouse, windmill, solar farm, vertical farm, data center. **Not allowed:** farms, houses, manors, blocks, heavy industry. This keeps the beach as a trade, energy and tourism coast. |
| Sea | row 60+ (≈ 30 rows visible, horizon beyond) | Port piers and offshore oil (L3 visual) extend 1–2 rows into it. Roads may cross at most 3 sea tiles as a bridge. |

Start: columns 35–64 (30 wide) × full depth = 1 200 land + 600 sand tiles. The Town Hall stands at x 49–50, rows 19–20. The world continues to the horizon: mountains to the north, sea to the south, grassland extending east and west outside play.

### 7.2 Expansion strips: 14 strips × 5 columns (7 west, 7 east)

**Cost depends on how many you own (k), not on which side.** You pick the side, so the deposits make the choice strategic. The deposits are fixed and the same for every player.

| k (purchase #) | Cost | Era gate |
|---:|---:|---|
| 1 | 250 | Antiquity |
| 2 | 1 500 | Middle Ages |
| 3 | 5 000 | Middle Ages |
| 4 | 16 000 | Renaissance |
| 5 | 40 000 | Renaissance |
| 6 | 110 000 | Industrial |
| 7 | 260 000 | Industrial |
| 8 | 600 000 | Modern |
| 9 | 1 200 000 | Modern |
| 10 | 2 400 000 | Contemporary |
| 11 | 4 200 000 | Contemporary |
| 12 | 7 000 000 | Near Future |
| 13 | 10 000 000 | Near Future |
| 14 | 14 000 000 | Near Future |

| Strip (columns) | Deposit (+50 % output for the first N matching buildings on it) |
|---|---|
| W1 (30–34) | **Stone vein** (Каменная жила): 2 quarries |
| W2 (25–29) | **Iron slope** (Железный склон): 2 mines |
| W3 (20–24) | **Quiet bay** (Тихая бухта): 2 fisheries |
| W4 (15–19) | **Coal seam** (Угольный пласт): 2 coal mines |
| W5 (10–14) | **Dunes** (Дюны): beach parks +3 attraction each |
| W6 (5–9) | **Ore mountain** (Рудная гора): 2 mines |
| W7 (0–4) | **Lighthouse cape** (Мыс маяка): +10 attraction |
| E1 (65–69) | **Fertile valley** (Плодородная долина): 4 farms |
| E2 (70–74) | **Coal seam**: 2 coal mines |
| E3 (75–79) | **Deep harbour** (Глубокая гавань): 2 fisheries |
| E4 (80–84) | **Marble quarry** (Мраморный карьер): 2 quarries |
| E5 (85–89) | **Oil field** (Нефтяное поле): 2 oil wells |
| E6 (90–94) | **Fertile valley 2**: 4 farms |
| E7 (95–99) | **Rocky headland** (Скалистый мыс): +10 attraction |

**Reasoning.** Each strip adds 200 land + 100 sand tiles, **2.5 mountain slots** (the scarce resource) and 5 coast tiles. The first strip is a 250-coin tutorial ("expand your land!"). Strips 2–7 are bought in the Middle Ages and Renaissance for **mountain frontage** (stone, then metal, then coal compete for the 15 start slots). Strips 8–14 are bought for **space and density** in the 20th–21st centuries. In the sim the typical city reaches 3 strips in the Renaissance, 5 at Industrial, 9 at Contemporary and 13 at the finale. The cost curve keeps each purchase at roughly 1–10 years of net income at the time it is bought, so every strip is a saving goal and never a wall. Gates in §3.2 require 1 / 2 / 4 / 6 / 8 / 11.

---

## 8. Roads

### 8.1 Seven classes, one tile (16 m) each, different cross-sections

Widths are in metres across the 16 m tile.

| # | Class (RU) | Era / unlock | Cross-section | Markings and crossings | Decor | Capacity / tile | Speed | V / tile | LV aura |
|---|---|---|---|---|---|---:|---:|---:|---:|
| 1 | **Тропа** / Trail | e0 | One shared 5 m dirt track; 5.5 m grass verges | none; wheel ruts decal | none | 1 | 0.5 | 1 | 0 |
| 2 | **Мостовая** / Cobbled lane | e1 | 2 × 2.75 m cobbles + 2 × 1.5 m raised stone footpaths + gutters | stone gutters; flat cobble crossings | hitching posts, torches at junctions | 1.5 | 0.7 | 6 | 0 |
| 3 | **Мощёная улица** / Paved street | e2 | 2 × 3 m flagstones + 2 × 2.5 m sidewalks with curbs | carriage-stone crossings at junctions | oil lanterns every 2nd tile, corner bollards | 2.2 | 0.9 | 20 | +1 |
| 4 | **Бульвар** / Boulevard | e3 | 2 × 3.25 m macadam + **2 m tree median** + 2 × 2.25 m sidewalks + 2 × 1.5 m verges | cobbled crossings; tram rails in one lane | gas lamps in the median, plane trees, benches | 3.2 | 1.0 | 70 | +3 |
| 5 | **Проспект** / Avenue | e4, combustion | **4 × 3 m asphalt** + 2 × 2 m sidewalks | dashed lane lines, double centre line, **zebra crossings** on junction arms | electric lamps on both sides every tile, **bus shelter every 4th tile** | 6 | 1.6 | 260 | −1 (noise) |
| 6 | **Магистраль** / Arterial | e5, plastics | 4 × 3 m + **0.8 m planter median** + 2 × 1.6 m sidewalks | stop lines, turn arrows, **traffic lights** and pedestrian signals at junctions | LED lamps, trees in planters, bus shelters | 9 | 1.8 | 800 | 0 |
| 7 | **Смарт-улица** / Smart street | e6, composites | 2 × 3.25 m autonomous lanes + **2 × 1.75 m green bike lanes** + 2 × 2.75 m sidewalks | **glowing lane lines**, light-strip crossings | smart poles (sensor + lamp + charger), benches, planters, shuttle stops | 12 | 1.6 | 2 000 | +6 (+2 happiness nearby) |

* Junctions are classified from the NESW neighbour mask (end / straight / corner / T / cross). Crossings and stop lines appear only on arms next to a junction (≥ 3 links). Mixed classes meet with a transition piece.
* **Upgrade** = lay a better class over an old road (v2 `relevel`), costing `V_new · (1 + 0.15·class)`. **Upkeep** = 1.5 % of V per tile per year.
* Bus coverage: avenue / arterial / smart tiles give 10 / 14 / 20 residents of transit coverage each. This is the "bus/tram" optional extra, folded into the road itself (no new buildings).

### 8.2 Why roads matter

Roads matter in three ways. They carry **capacity** (traffic → production and happiness). They give **land value** and happiness auras: boulevards and smart streets are pleasant, avenues are noisy. And they are a **transit layer** through bus stops. Late-game density (house L9 needs transit) is reachable through avenues as well as metro.

### 8.3 Traffic model (cheap, per chunk)

* Chunks are 10×10 tiles (60 chunks on the full map). They are recomputed on structural change (O(B)) plus once per year.
* `D_j = trips_e · (residents_j + 0.5·jobs_j) · (1 − 0.5·transitCoverage_j) · (1 − 0.25·autonomousProgram)`, with `trips = [0.08, 0.10, 0.12, 0.20, 0.45, 0.90, 1.00]` per era.
* `C_j = Σ_road tiles in chunk cap_class`. `ρ_j = D_j / C_j`, smoothed over the 3×3 neighbourhood.
* Effects in chunk *j*: tier-B production × `1 / (1 + 0.6·max(0, ρ − 1))`; happiness −`min(15, 12·max(0, ρ − 1))`.
* Visual: vehicle density on a tile is proportional to ρ (capped by the NPC budget); a heat overlay shows the roads.
* Sim (aggregate ρ over the whole city): the typical city reaches ρ 1.26–1.46 in the Modern and Contemporary eras before upgrading roads and adding metro. Traffic is a real mid-game problem that players have to solve.

---

## 9. Transport

### 9.1 Port (Порт): NEW, Renaissance

* 3×2 on sand, touching the coast row. One per city. L1 e2 "Гавань" (wooden piers, a crane) → L2 e3 "Паровой порт" (steamers, brick warehouses) → L3 e5 "Контейнерный терминал" (gantry cranes, containers). V 6 K / 40 K / 400 K.
* Trade capacity 500 / 1 500 / 5 000 units/yr. **Order slots 3 / 4 / 5** (§5.4). Attraction +8 / 12 / 20. Tourism multiplier +0.25.
* What you see: ships of the era arriving and leaving every ≈ 20 s, and order cards with the requested goods icon and a countdown.

### 9.2 Railway (Железная дорога): Industrial

* **National trunk line (Магистральная линия):** a fixed double track along sand row 40 across the whole map. It is the same for everyone and is "built by the state" when you research *Railways* (a 10-year construction animation from the map edges inwards; usable at once in your columns). The world's trains run on it toward the edges, giving the "connection to the outside world".
* **Player track:** dragged like roads, one tile per segment, 90° curves, **level crossings** where it crosses a road (road capacity −30 % on that tile). V 60 per tile, upkeep 1.5 %/yr. It needs its own surface layer (network bitmask road|rail).
* **Station (Вокзал), NEW, 4×2.** Its long side must lie on a track connected to the trunk. L1 e3 brick station (steam trains) → L2 e4 electric terminal → L3 e6 **maglev station** (finale requirement). V 30 K / 120 K / 600 K. Effects:
  * **Freight:** industry and resources output +15 / 25 / 35 % (sim: city-wide; spatial: within 10 tiles of a station connected by track, which favours branch lines to the mountain face).
  * **Transit coverage:** 700 / 1 500 / 3 000 residents within radius 8.
  * **Exports:** trade capacity +600 / 1 500 / 3 000 units/yr.
  * **Tourism:** multiplier +0.2 per station (cap +0.6).
* What you see: a steam loco with 4 cars, then electric units, then a sleek maglev, running trunk ↔ branch ↔ station. They stop for 3 s and light up at night.

### 9.3 Metro (Метро): Modern

* **Station pavilion (Станция метро), NEW, 1×1**, needs road access. L1 e4 art-nouveau entrance → L2 e5 modern glass box → L3 e6 lit canopy. V 24 K / 74 K / 190 K.
* **Building a line (UX):** tap "New line", pick a colour (up to 6 lines), then tap stations in order. Tunnels auto-route (L-shaped, underground layer, ignore surface occupants), and the cost preview shows tunnel tiles × V 1 500 (e4 prices) per tile. A line works with ≥ 2 stations. Stations may sit on several lines (transfer).
* Coverage 1 500 / 2 600 / 4 000 residents within radius 6. Effects: covered residents' trips −50 % (traffic), +15 LV (via transit coverage), fares, and the **house L9 need** (transit).
* What you see: escalator glow at the pavilion and commuters walking in. The **x-ray / underground view** shows coloured tunnels and trains moving between stations.

### 9.4 Airport (Аэропорт): NEW, Contemporary

* **10×4 on sand** (runway along x plus terminal), needs a road connection. One per city. L1 e5 "Аэропорт" → L2 e6 "Международный аэропорт" (second terminal, jet bridges). V 1.5 M / 4.5 M. Noise: −LV within 6 tiles.
* **Flight routes (Авиарейсы)**, the e5 verb: 3 (L1) or 5 (L2) slots. Opening a route costs 150 K (e5) or 400 K (e6), plus 25 K or 60 K upkeep per year. Pick a type:
  * **Tourist:** tourism multiplier +0.3.
  * **Cargo:** goods export +1 500 units/yr at 1.3× price.
  * **Business:** business tax +10 %.
  * *(Sim: only the route count, the tourist +0.3 and the business +10 % are modelled.)*
* Airport tourism multiplier +0.8 / +1.5. What you see: a plane every ≈ 30 s (takeoff and landing arcs over the sea), with the airliner shape changing at L2.

### 9.5 Optional extras

| Extra | Decision | Why |
|---|---|---|
| Bus / tram | **Kept**, folded into roads: avenue bus stops and boulevard tram rails as visuals plus coverage | No new buildings needed. |
| Ferry | **Cut** | It would duplicate the port. |

---

## 10. Buildings roster

Notation: per level `era·V·effect`. Rates are per year. Upkeep is `V × category rate` (§5.5). "Reuse" names the v2 building whose level models are used **as is** (the v2 level number equals the v3 level number unless stated).

### 10.1 Infrastructure, housing, offices

| id (RU) | Cat / size / zone | Levels: era · V · key effect | Reuse (v2) |
|---|---|---|---|
| `town_hall` Ратуша | center · 2×2 · land · unique · start | L1 e0·0·H8, +12 ₥, food 15, wood 8, know 2, store 300, **crews 2** · L2 e0·450·H12, +20 ₥, crews 3 · L3 e1·3.8K·H16, +60, crews 4 · L4 e2·26K·H22, +220, crews 5 · L5 e3·150K·H32, +800, crews 6 · L6 e4·900K·H45, +2.8K, crews 7 · L7 e5·4M·H60, +9K, crews 8 · L8 e6·16M·H80, +26K, know 150, crews 9 | town_center L1–8 |
| `road` Дорога | network · 1×1 | 7 classes (§8) | road L1–7 levels, **new cross-section renderer** |
| `district_hall` Управа района | infra · 1×1 | e1·300 · e2·1.5K · e4·25K · e5·100K · e6·300K (+data 1 500). Each hall = 1 charter, radius 7 (Craft +10 % production · Market +10 % commerce and +5 % tax · Green −50 % pollution, +3 happiness · Heritage, from e2: heritage tourism ×3) | district_hall L1–5 |
| `architect_bureau` Бюро архитекторов | infra · 2×2 · unique | e2·2K (know 4, attraction 8, blueprints) · e4·40K (15, 15) · e6·400K (40, 25) | architect_bureau L1–3 |
| `storehouse` Склад | storage · 1×1 · either | store 400 / 1K / 2.5K / 5K / 15K / 30K; V 40 / 200 / 1K / 6K / 60K / 200K (e0, e1, e2, e3, e5, e6) | storehouse L1–6 |
| `house` Жилой дом | housing · 1×1 · land | §6.1 (11 levels) | house L1–11 |
| `manor` Усадьба | housing · 2×2 · land · rich ×2.5 | e1·450·H8 · e2·1.9K·H12 · e3·7K·H18 · e4·25K·H26 · e5·85K·H36 · e6·230K·H48 | manor L1–6 |
| `block` Жилой квартал | housing · 2×2 · land | e3·9.5K·H64 · e4·42K·H110 · e5·140K·H160 · e5·230K·H210 · e6·520K·H280 | block L1–5 |
| `skyscraper` → **Бизнес-башня** (business tower) | trade (office) · 2×2 · land | e5·420K·J240, H40, power −20 · e6·1.15M·J400, H70, power −30; needs transit + LV ≥ 60 + power | skyscraper L1–2 (function changed: offices) |

### 10.2 Food and resources

| id | Cat / size / zone | Levels (era·V·output; jobs) | Reuse |
|---|---|---|---|
| `farm` Ферма | food · 2×2 · land | e0·60·food 45; J4 · e1·230·85; J6 · e2·950·140; J8 · e4·15K·380, fuel −8; J10 · e5·52K·650, fuel −12; J14 · e6·185K·1 000, power −6; J16 | farm L1–6 |
| `fishery` Рыбный промысел | food · 1×1 · coast | e0·30·25 · e1·110·45 · e3·2.6K·140 · e6·95K·500 | fishery L1–4 |
| `vertical_farm` Вертикальная ферма | food · 2×2 · either | e6·320K·1 600, power −10; J20 | vertical_farm L1 |
| `lumber` → **Лесхоз** (tree plantation) | resources · 1×1 · land | e0·15·wood 18 · e1·90·40 · e3·2.6K·120, fuel −4 · e4·10K·220 · e6·80K·450 | lumber L1–5 (trees are model parts) |
| `quarry` Каменоломня | resources · 2×2 · **mountain** | e0·40·stone 16 · e1·180·40 · e3·4K·130 · e4·18K·260, fuel −6 · e6·140K·550 | quarry L1–5 |
| `mine` Рудник | resources · 2×2 · **mountain** | e1·230·metal 12 · e2·1K·28 · e3·6K·80, fuel −8 · e4·30K·160 · e6·160K·340 | mine L1–5 |
| `coal_mine` Угольная шахта | resources · 2×2 · **mountain** | e3·4K·fuel 60 · e4·22K·140 · e5·80K·280 | coal_mine L1–3 |
| `oil_well` Нефтяная вышка | resources · 1×1 · **sand** | e4·12K·fuel 50 · e5·45K·110 · e6·150K·220 (offshore look) | oil_well L1–3 |

### 10.3 Industry and power

| id | Levels (era·V·output ← inputs; jobs) | Reuse |
|---|---|---|
| `kiln` Обжиговая печь 1×1 | e1·120·mat 10 ← stone 8, wood 5 · e3·5K·60 ← stone 30, fuel 10 · e4·22K·130 ← stone 60 | kiln L1–3 |
| `glassworks` Стекольный завод 2×2 | e2·900·mat 20 ← stone 8, wood 8 · e3·7K·70 · e4·35K·160 · e6·220K·380 | glassworks L1–4 |
| `cement_plant` Цементный завод 2×2 | e4·30K·mat 180 ← stone 60, fuel 15 · e5·110K·420 · e6·280K·800 | cement_plant L1–3 |
| `composites_plant` Завод композитов 2×2 | e6·400K·mat 1 100 ← fuel 40, metal 30 | composites_plant L1 |
| `smithy` Кузница 1×1 | e1·150·goods 6 ← metal 6, wood 3 · e2·1K·15 · e3·6.5K·45 ← metal 30, fuel 10 · e4·30K·100 · e6·200K·230 | smithy L1–5 |
| `steel_mill` → **Металлургический завод** | e3·7K·metal 55 ← fuel 25 · e4·32K·130 ← fuel 45 · e5·120K·260 · e6·300K·480 | steel_mill L1–4 (no ore input now) |
| `chemical_plant` Химический завод 2×2 | e5·90K·goods 160 ← fuel 50 · e6·280K·330 ← food 80 | chemical_plant L1–2 |
| `electronics_fab` Завод электроники 2×2 | e5·160K·goods 280 ← metal 30, mat 30 · e6·500K·650 | electronics_fab L1–2 |
| `windmill` Ветряк 1×1 either | e2·300·farm +20 % (4 farms, radius 3) · e4·12K·power 8 · e6·60K·power 45 | windmill L1–3 |
| `power_plant` Электростанция 2×2 | e4·40K·power 90 ← fuel 30 · e5·130K·220 ← fuel 50 · e6·350K·420 ← fuel 60 | power_plant L1–3 |
| `solar_farm` Солнечная ферма 2×2 either | e6·250K·power 160 | solar_farm L1 |

### 10.4 Services, commerce, science

| id | Levels (era·V·capacity) | Reuse |
|---|---|---|
| `well` Колодец 1×1 | e0·30·water 60 · e0·75·150 · e3·3.75K·500 · e4·16.3K·1 200 · e5·62K·2 600 | well L1–5 |
| `clinic` Лечебница 1×1 | e1·115·80 · e2·720·200 · e3·4.5K·600 · e4·19K·1 400 · e5·71K·3 000 | clinic L1–5 |
| `school` Школа 2×2 | e0·40·edu 60, know 4 · e1·280·150, 9 · e2·1.9K·400, 22 · e3·8.8K·900, 45 · e4·35K·2 000, 80 · e5·124K·4 000, 140 · e6·410K·8 000, 240 | school L1–7 |
| `temple` Храм 2×2 | e0·40·culture 80, know 1.5, attraction 2 · e1·290·200 · e2·2.2K·600, attraction 15 | temple L1–3 |
| `theater` Театр 2×2 | e0·50·100 · e2·1.1K·300, +10 ₥ · e3·6K·800, +40 · e4·20K·1 500, +120 · e5·71K·3 000, +400 · e6·240K·6 000, +1.2K (attraction 3 → 50) | theater L1–6 |
| `park` Парк 1×1 either | e0·12·leisure 40 · e2·220·100 · e3·1.1K·250 · e4·4.1K·500 · e6·24K·1 000 | park L1–5 |
| `market` Рынок 2×2 either | e0·60·commerce 80, trade 20 · e1·290·200 · e2·1.6K·450 · e3·7.5K·1 000 · e4·27K·2 000 · e5·95K·4 000 · e6·320K·8 000, trade 2 000 | market L1–7 |
| `data_center` Дата-центр 2×2 either | e6·400K·know 200, data 6 000, power −30 | data_center L1 |

### 10.5 NEW buildings (hand-made models needed)

| id | Size / zone | Levels | Model work |
|---|---|---|---|
| `port` Порт | 3×2 coast | e2 Гавань · e3 Паровой порт · e5 Контейнерный терминал | **3 models** (+ ship props) |
| `station` Вокзал | 4×2 on track | e3 brick station · e4 electric terminal · e6 maglev | **3 models** (+ 4 train looks) |
| `metro_station` Станция метро | 1×1 | e4 art nouveau · e5 modern · e6 canopy | **3 small models** (+ x-ray trains) |
| `airport` Аэропорт | 10×4 sand | e5 airport · e6 international | **2 models** (+ 2 aircraft) |

Not hand-made (procedural): rail track pieces, trunk line, tunnels (x-ray only), and the **road decor kit** (7 lamp types, planter tree, bench, bus/shuttle shelter, traffic light, smart pole, zebra/stop-line decals, bike-lane paint).

**Totals:** 36 reused buildings / 155 levels (all v2 content ≤ 2100) + 4 new buildings / 11 level models. Validator changes: building size up to 10×4, a `network` field instead of the unique `role` for road/rail/metro, and zones (`mountain | coast | sand | land | either`) instead of features.

---

## 11. Research, goals, achievements

### 11.1 Discoveries (Открытия): 56 techs → 28

One lab slot. `time = years / (1 + researchBonus) / speed`, with `speed = clamp(0.6 + knowledgeRate · years / (2 · knowCost), 0.6, 1.25)`. Investing in schools speeds research up to 1.25× and neglecting them slows it to 0.6×. Each era gate needs 3 of the era's 4 (the finale needs all 4 of era 6).

| Era | Discovery (RU) | Knowledge + money · years | Unlocks / bonus |
|---|---|---|---|
| 0 | agriculture Земледелие | 15 + 20 · 2 | food +15 % |
| 0 | pottery Гончарное дело | 20 + 30 · 2 | house L2; storage +20 % |
| 0 | writing Письменность | 25 + 40 · 3 | school L1, theatre L1; research +10 % |
| 0 | coinage Чеканка монет | 40 + 80 · 3 | tax +10 % |
| 1 | ironworking Металлургия | 60 + 250 · 5 | mine, smithy |
| 1 | brickmaking Обжиг кирпича | 60 + 250 · 5 | kiln, house L4 |
| 1 | self_government Самоуправление | 80 + 350 · 6 | district hall + charters |
| 1 | herbalism Травничество и трёхполье | 50 + 200 · 5 | clinic, farm L2; food +10 % |
| 2 | printing Книгопечатание | 160 + 1.8K · 10 | university (school L3); research +25 % |
| 2 | architecture Архитектура | 180 + 2K · 10 | architect bureau, glassworks, house L5, blueprints |
| 2 | navigation Мореплавание | 200 + 2.5K · 12 | port, trade orders |
| 2 | banking Банковское дело | 170 + 2.2K · 10 | market L3; tax +10 % |
| 3 | steam Паровая машина | 420 + 9K · 14 | L3 resource levels, coal mine; production +5 % |
| 3 | railways Железные дороги | 520 + 14K · 16 | track, station, trunk line |
| 3 | steelmaking Сталеварение | 460 + 11K · 14 | steel mill, kiln L2, smithy L3 |
| 3 | public_health Общественное здравоохранение | 380 + 8K · 12 | well L3, clinic L3; happiness +3 |
| 4 | electricity Электричество | 950 + 45K · 22 | power plant, windmill L2, station L2 |
| 4 | metro Метрополитен | 1 150 + 70K · 26 | metro |
| 4 | concrete Железобетон | 850 + 40K · 22 | cement plant, house L8, block L2 |
| 4 | combustion ДВС | 900 + 45K · 22 | oil well, farm L4, avenue; production +5 % |
| 5 | computers Компьютеры | 2.1K + 170K · 28 | school L6, electronics fab; research +15 % |
| 5 | aviation Авиация | 2.5K + 260K · 32 | airport, routes |
| 5 | highrise Высотное строительство | 2.1K + 170K · 28 | business tower, house L10, block L4; housing +5 % |
| 5 | plastics Пластмассы | 1.9K + 140K · 26 | chemical plant, storehouse L5, arterial; storage +20 % |
| 6 | robotics Робототехника | 4.2K + 650K · 34 | L5 resource levels, smithy L5; production +10 % |
| 6 | bigdata Большие данные | 4.6K + 750K · 36 | data center, **smart programs**, electronics L2 |
| 6 | greentech Зелёные технологии | 4.2K + 650K · 34 | solar farm, vertical farm, farm L6, windmill L3, chemical L2 |
| 6 | composites Композиты | 5K + 850K · 40 | composites plant, house L11, block L5, glassworks L4, steel L4, **maglev**, smart street |

**Smart programs (Умные программы)**, the e6 verb. Up to 4 active. Each costs 300 K to activate plus 120 knowledge/yr:
1. Autonomous transit (Автономный транспорт): trips −25 %.
2. Smart grid (Умная сеть): power supply +15 %.
3. Predictive health (Предиктивная медицина): health capacity +25 %.
4. City OS (Городская ОС): tax +5 %, LV +3.
5. Circular economy (Замкнутый цикл): industry upkeep −10 %.
6. Clean air (Чистый воздух): pollution −20 %.

*(Sim: program count and #1 only.)*

### 11.2 Goals

* **Main quest line = the gate checklist** (§3.2). It is always pinned, compact, and shows the next 3 items.
* **Side goals:** 3 per era, rewarding money (≈ 2–4 years of income) or knowledge. Examples: Antiquity "Happy tribe" (happiness ≥ 70), Middle Ages "Iron age" (100 metal in stock), Renaissance "Heritage" (5 heritage buildings), Industrial "Steel reserve" (1 000 metal), Modern "Let there be light" (power ≥ 110 %), Contemporary "Skyline" (5 houses at L10), Near Future "Green power" (3 solar farms). Many come from v2 `goals.json`, re-targeted.
* **Need hints:** the advisor surfaces the binding constraint ("42 houses can't reach L5: culture"). In the sim this is exactly the decision driver.

### 11.3 Achievements (25 points each in the score)

"Ahead by a thousand" (lead ≥ 1 000) · "Golden chronicle" (gold medal in every era) · "Self-made" (an era with zero imports) · "Rail baron" (6 stations) · "Six lines" (6 metro lines) · "Open skies" (5 routes) · "All 14" (all strips) · "Full house" (all deposits used) · "Clean air" (pollution penalty 0 at 10 K pop) · "Gridlock-free" (ρ < 1 everywhere at 20 K pop) · "Heritage city" (20 heritage buildings) · "Eco-tower skyline" (50 houses L11) · "Expo" (finale) · 7 × "Monument of the era" (post-finale) and a few more. About 25 in total.

---

## 12. Score and leaderboard

```
Score = Σ_{e=1..6, entered} ( 1000 + max(0, H_e − Y_e) + medalPts_e )        medalPts: gold 300, silver 150, bronze 50
      + (finale ? 2000 + max(0, 2200 − Y_finale) : 0)
      + round(10 · √peakPopulation)                                         bounded by map (~70 K → ~2 650)
      + 100 · strips + 25 · achievements
```

* **Fair on a shared map:** same map, same deposits, same prices. Event *timing* comes from a chronicle-season seed, so all players in a season face the same events in the same years. **Money, upkeep, buildings count = 0 points**, which means idling or hoarding earns nothing. Population has diminishing returns and is capped by the map. Lead is speed-neutral (game years).
* **Ordering:** progress first (era base 1 000 each), then skill (lead and medals). Sim totals without achievements: **slow 19 817 · typical 22 608 · optimised 24 001**.
* **Board row** = best chronicle (current or finished). It shows era, year, lead and a medal strip. **New Chronicle** restarts the city and keeps the record.
* **Anti-cheat (client-authoritative save):** the server recomputes the score from the stored era-entry log and buildings. It checks Δgame ≤ Δwall × 5.5; entry year ≥ 0.6 × gold par; pop ≤ capacity from stored houses; strips ≤ era limit. Tester speeds or flags take the save off-board.

---

## 13. Random events (by era)

One event every **15–30 years** (first at year 15), weighted. At most one negative event is active at a time. None happen offline. Every event has a counter-play, and the effects are sized at ≈ 1–3 years of income so they cannot decide the leaderboard (and they are seeded per season).

| Era | Event | Effect | Counter-play |
|---|---|---|---|
| 0 | Bountiful harvest (Урожайный год) | food +50 % for 3 yr | — |
| 0 | Drought (Засуха) | farms −30 % for 4 yr | water coverage ≥ 80 % halves it |
| 0 | Travelling merchants (Купцы) | offer: sell up to 100 of a good at 2× price | — |
| 1 | Plague (Мор) | pop −8 % | health coverage ≥ 70 % → −2 % |
| 1 | Great fair (Ярмарка) | commerce +50 % for 5 yr | — |
| 1 | Fire in the wooden quarter (Пожар) | 3 houses ≤ L4 drop 1 level | water coverage ≥ 80 % prevents it |
| 2 | Patron's commission (Меценат) | +2 yr of tourism income | needs bureau or cathedral |
| 2 | Storm at sea (Шторм) | port closed 3 yr | a second trade route (station later) |
| 2 | Plague | as above | as above |
| 3 | Strike (Забастовка) | industry −30 % for 4 yr | happiness ≥ 65 cancels it |
| 3 | Great smog (Смог) | pollution ×2 for 3 yr | green charter halves it |
| 3 | Railway boom | station exports +50 % for 5 yr | — |
| 4 | Blackout (Блэкаут) | power plants −50 % for 2 yr | ≥ 20 % power reserve ignores it |
| 4 | Market crash (Биржевой крах) | commerce and business −40 % for 5 yr | market charter halves it |
| 4 | World's fair invitation | tourism ×2 for 5 yr | — |
| 5 | Gridlock week (Пробки) | trips +40 % for 3 yr | metro coverage ≥ 70 % negates it |
| 5 | Tech boom | goods export price +50 % for 5 yr | — |
| 5 | Heatwave (Жара) | water capacity ×0.8 for 3 yr | — |
| 6 | Data breach (Утечка данных) | smart programs off for 2 yr | data coverage 100 % prevents it |
| 6 | Solar maximum | solar +50 % for 5 yr | — |
| 6 | Storm surge (Нагон) | buildings on sand within 3 tiles of the sea −50 % for 2 yr | — |

*(Events are not simulated; their net expected effect is ≈ 0.)*

---

## 14. Pacing table (from the simulation)

**Script:** `C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\sim-progression.mjs`
**Saved output:** `C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\sim-progression.out.txt`
Run with `node sim-progression.mjs` (all profiles, ≈ 40 s), `--profile=typical --verbose` (event log), `--flows` (income and upkeep breakdown every 50 years), `--seeds` (spread over 5 seeds), `--costs` (generated cost table).

### 14.1 How the sim works

It runs the formulas of §§3, 5, 6 and 8 on a 1 s tick (25 ticks = 1 year) with an aggregate, non-spatial city.

**What it models:** land, mountain slots and coast slots per strip; deposits; private vs public construction with crews; the two-phase production settlement; two-tier labour; coverage by capacity; land value; traffic ρ; tax, commerce, business, tourism, fares, exports and orders; upkeep including service utilisation; imports; research speed; medals and Golden Age; organic growth.

**The heuristic player** works through needs each decision. In priority order: Town Hall when the checklist is green (and saving for it); research; food, power and fuel crises; gate items (saving if reachable within N years); services blocking the next house level; housing vs jobs balance; production deficits; storage; strips under land pressure; traffic; then growth filler. It respects an upkeep guard (net ≥ 10 % of gross for optional items), keeps land reserved for upcoming gate buildings, and redevelops (demolishes the lowest-value buildings) when a needed building has no room.

**Profiles:**

| | Decision interval | Spending buffer | Mistakes | Layout efficiency (coverage / road share / pollution exposure) | Other |
|---|---|---|---|---|---|
| **slow** | 15 s, 18 % chance of an AFK spell | 1.3× | 20 % random picks | 0.8 / 0.62 / 0.65 | never sells surplus |
| **typical** | 6 s, 8 % AFK | 1.1× | 8 % | 0.9 / 0.52 / 0.45 | |
| **optimised** | 2 s | 1.0× | 0 % | 1.0 / 0.42 / 0.25 | uses the tax lever, saves up to 18 yr for gate items and 40 yr for the Town Hall |

### 14.2 Summary (seed 7)

| Era entered | Optimised: year / min @1× | **Typical: year / min @1×** | Slow: year / min @1× | Typical pop | Typical net / month | Typical strips |
|---|---|---|---|---:|---:|---:|
| Middle Ages (1000) | 41 / 17 | **48 / 20** | 62 / 26 | 293 | 31 | 0 |
| Renaissance (1500) | 68 / 28 | **95 / 40** | 196 / 82 | 1 192 | 279 | 3 |
| Industrial (1800) | 116 / 48 | **160 / 67** | 411 / 171 | 3 530 | 1 295 | 5 |
| Modern (1900) | 186 / 78 | **242 / 101** | 604 / 252 | 8 060 | 5 021 | 6 |
| Contemporary (2000) | 333 / 139 | **410 / 171** | 926 / 386 | 18.5 K | 22.8 K | 9 |
| Near Future (2100) | 497 / 207 | **540 / 225** | 1 146 / 477 | 33.0 K | 50.5 K | 10 |
| **Finale (2200)** | 627 / 261 | **778 / 324** | 1 659 / 691 | 52.0 K | 134 K | 13 |

**Seed spread** (5 seeds, `--seeds`; era entry years):
* slow: 68–91 · 183–209 · 413–457 · 601–671 · 834–954 · 1 035–1 182 · **finale 1 559–1 759**
* typical: 41–47 · 74–87 · 134–152 · 222–243 · 342–370 · 525–555 · **finale 692–724**
* optimised: 41 · 68–72 · 115–120 · 180–195 · 297–343 · 455–510 · **finale 590–685**

Reading the numbers: the first era takes ≈ 20 min (first-session hook), and each later era takes 30–100 min at 1×. A typical complete chronicle is **5–5.5 h at 1×** (≈ 2–3 h with the speed buttons). Optimised is ≈ 20 % fewer game years and slow ≈ 2.1× more. Every profile stays ahead of history. The slow profile's lead shrinks from +1 389 (Industrial) to +541 at the finale, the "history is catching up" arc in action.

### 14.3 Raw output (seed 7)

```
City Chronicle 3 — pacing simulation (1 year = 25 s at 1x; real minutes are at 1x)

| Era entered | Profile | Year | Real min @1x | Lead vs history | Medal | Pop | Gross / month | Net / month | Upkeep share | Bank | Strips | Happiness |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|
| Middle Ages (1000) | slow | 62 | 26 | +938 | bronze | 217 | 28 | 26 | 6% | 1610 | 0 | 69 |
| Middle Ages (1000) | typical | 48 | 20 | +952 | silver | 293 | 32 | 31 | 5% | 1130 | 0 | 65 |
| Middle Ages (1000) | optimised | 41 | 17 | +959 | gold | 359 | 39 | 37 | 5% | 32 | 0 | 58 |
| Renaissance (1500) | slow | 196 | 82 | +1304 | bronze | 1015 | 244 | 227 | 7% | 186.0K | 1 | 62 |
| Renaissance (1500) | typical | 95 | 40 | +1405 | silver | 1192 | 302 | 279 | 8% | 43.7K | 3 | 65 |
| Renaissance (1500) | optimised | 68 | 28 | +1432 | gold | 2631 | 380 | 354 | 7% | 17.1K | 3 | 42 |
| Industrial (1800) | slow | 411 | 171 | +1389 | bronze | 3055 | 1252 | 1108 | 12% | 1.83M | 5 | 53 |
| Industrial (1800) | typical | 160 | 67 | +1640 | silver | 3530 | 1449 | 1295 | 11% | 304.7K | 5 | 54 |
| Industrial (1800) | optimised | 116 | 48 | +1684 | gold | 5644 | 1356 | 1154 | 15% | 142.2K | 5 | 58 |
| Modern (1900) | slow | 604 | 252 | +1296 | bronze | 7887 | 5037 | 4079 | 19% | 5.82M | 7 | 52 |
| Modern (1900) | typical | 242 | 101 | +1658 | silver | 8060 | 6042 | 5021 | 17% | 17.5K | 6 | 65 |
| Modern (1900) | optimised | 186 | 78 | +1714 | gold | 9791 | 4745 | 3779 | 20% | 1741 | 5 | 64 |
| Contemporary (2000) | slow | 926 | 386 | +1074 | bronze | 17.4K | 19.4K | 14.7K | 24% | 30.43M | 9 | 54 |
| Contemporary (2000) | typical | 410 | 171 | +1590 | bronze | 18.5K | 29.6K | 22.8K | 23% | 1.16M | 9 | 71 |
| Contemporary (2000) | optimised | 333 | 139 | +1667 | gold | 17.8K | 31.5K | 24.8K | 21% | 15.4K | 6 | 70 |
| Near Future (2100) | slow | 1146 | 477 | +954 | bronze | 32.4K | 65.0K | 38.5K | 41% | 27.65M | 11 | 55 |
| Near Future (2100) | typical | 540 | 225 | +1560 | silver | 33.0K | 78.8K | 50.5K | 36% | 4.44M | 10 | 67 |
| Near Future (2100) | optimised | 497 | 207 | +1603 | gold | 34.5K | 106.5K | 74.3K | 30% | 51.8K | 11 | 70 |
| Finale (2200) | slow | 1659 | 691 | +541 | bronze | 68.4K | 254.2K | 119.8K | 53% | 113.81M | 14 | 72 |
| Finale (2200) | typical | 778 | 324 | +1422 | silver | 52.0K | 250.4K | 134.0K | 46% | 285.3K | 13 | 76 |
| Finale (2200) | optimised | 627 | 261 | +1573 | gold | 51.5K | 276.7K | 185.6K | 33% | 337.3K | 13 | 77 |

money check (until finale): slow lowest=0, 0.0 yr below zero, 3159 organic upgrades · typical lowest=0, 0.0 yr · optimised lowest=-4.4K, 0.1 yr
score: slow 19817 · typical 22608 · optimised 24001
```

(Timeline every 100 years per profile is in the saved output file.)

---

## 15. Config sketch (world.json-level constants)

```jsonc
{
  "time": { "secondsPerYear": 25, "speeds": [1, 2, 5], "testerSpeeds": [20, 50],
            "secondsPerDay": 240, "daysPerSeason": 1, "seasonFarm": [1.0, 1.15, 1.05, 0.8],
            "offline": { "maxYearsOfNet": 1, "fullAfterHours": 8, "minGameYearsBetween": 25 } },
  "map": { "width": 100, "landRows": 40, "sandRows": 20, "seaRowsVisible": 30,
           "start": { "cols": [35, 64], "townHall": [49, 19] }, "trunkRailRow": 40,
           "strip": { "cols": 5,
                      "costs": [250, 1500, 5000, 16000, 40000, 110000, 260000, 600000, 1200000, 2400000, 4200000, 7000000, 10000000, 14000000],
                      "eras":  [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6] },
           "deposits": { "W1": "stone", "W2": "metal", "W3": "harbour", "W4": "fuel", "W5": "beach", "W6": "metal", "W7": "cape",
                         "E1": "farm", "E2": "fuel", "E3": "harbour", "E4": "stone", "E5": "oil", "E6": "farm", "E7": "headland" },
           "depositBonus": 0.5 },
  "population": { "laborShare": 0.6, "foodPerResident": 1.0, "growthPerYear": 0.75, "minGrowthPerYear": 2.5,
                  "unhappyDecline": 0.05, "starvingDecline": 0.075, "happyThreshold": 40, "unhappyThreshold": 25,
                  "organicUpgrade": 0.015 },
  "happiness": { "base": 40, "svc": { "water": 10, "health": 10, "edu": 8, "culture": 8, "commerce": 6, "leisure": 6 },
                 "transit": 4, "unemployment": 25, "unemploymentFree": 0.03, "starving": 25, "noPower": 15,
                 "pollutionMax": 20, "trafficMax": 15, "goldenAge": 5 },
  "economy": { "currency": "money", "tax": [1, 1.8, 3, 5, 8.5, 14, 22], "commerceShare": 0.3,
               "goodsPerResident": [0, 0.03, 0.05, 0.08, 0.10, 0.12, 0.14], "businessTax": 0.8,
               "tourismMul": 1.2, "farePerRider": 0.04,
               "price": { "food": 0.5, "wood": 0.8, "stone": 1, "metal": 2.5, "fuel": 2, "mat": 3, "goods": 6 },
               "priceIndex": [1, 1.6, 2.6, 4.2, 7, 11, 18], "importMul": 1.5, "exportMul": 0.6, "exportSaturation": 0.5,
               "orders": { "premium": 1.6, "qty": [0, 0, 40, 90, 200, 400, 700], "everyYears": 5, "expireYears": 20 },
               "storageBase": 300, "upgradeShare": 0.7, "refundShare": 0.5,
               "costMul": [1, 1.4, 2.0, 2.6, 3.2, 3.6, 4.0],
               "recipe": [ { "money": .40, "wood": .35, "stone": .25 }, { "money": .45, "wood": .30, "stone": .25 },
                           { "money": .45, "wood": .10, "stone": .10, "metal": .05, "mat": .20, "goods": .10 },
                           { "money": .45, "metal": .15, "mat": .30, "goods": .10 },
                           { "money": .45, "metal": .15, "fuel": .05, "mat": .30, "goods": .05 },
                           { "money": .45, "metal": .15, "mat": .25, "goods": .15 },
                           { "money": .45, "metal": .05, "mat": .30, "goods": .20 } ],
               "upkeep": { "center": 0, "housing": 0, "food": .008, "resources": .008, "storage": .008, "industry": .01,
                           "trade": .01, "infrastructure": .015, "power": .015, "transport": .02, "services": .02, "roads": .015 },
               "serviceIdleUpkeep": 0.5,
               "taxPolicy": [ { "id": "low", "mul": 0.85, "hap": 4 }, { "id": "normal", "mul": 1, "hap": 0 },
                              { "id": "high", "mul": 1.2, "hap": -6 }, { "id": "very_high", "mul": 1.4, "hap": -15 } ],
               "loan": { "maxYearsOfGross": 3, "interest": 0.08, "repayShareOfNet": 0.2 } },
  "landValue": { "base": 20, "coverage": 35, "transit": 15, "roadAura": 1.5, "perCharter": 2, "maxCharters": 5,
                 "pollution": -0.8, "seaside": 8, "seasideTiles": 5, "taxFactor": [0.8, 0.4] },
  "traffic": { "chunk": 10, "trips": [0.08, 0.10, 0.12, 0.20, 0.45, 0.90, 1.00], "jobsWeight": 0.5,
               "transitCut": 0.5, "prodPenalty": 0.6, "happyPerRho": 12 },
  "roads": [ { "id": "trail", "e": 0, "V": 1, "cap": 1, "lv": 0 }, { "id": "cobble", "e": 1, "V": 6, "cap": 1.5, "lv": 0 },
             { "id": "paved", "e": 2, "V": 20, "cap": 2.2, "lv": 1 }, { "id": "boulevard", "e": 3, "V": 70, "cap": 3.2, "lv": 3 },
             { "id": "avenue", "e": 4, "V": 260, "cap": 6, "lv": -1, "bus": 10, "tech": "combustion" },
             { "id": "arterial", "e": 5, "V": 800, "cap": 9, "lv": 0, "bus": 14, "tech": "plastics" },
             { "id": "smart", "e": 6, "V": 2000, "cap": 12, "lv": 6, "bus": 20, "tech": "composites" } ],
  "transport": { "trackV": 60, "tunnelV": 1500, "levelCrossingCapCut": 0.3,
                 "routes": { "cost": [0, 0, 0, 0, 0, 150000, 400000], "upkeep": [0, 0, 0, 0, 0, 25000, 60000] },
                 "smartPrograms": { "cost": 300000, "knowPerYear": 120, "max": 4 } },
  "research": { "slots": 1, "speedMin": 0.6, "speedMax": 1.25 },
  "chronicle": { "hist": [0, 1000, 1500, 1800, 1900, 2000, 2100], "finaleHist": 2200,
                 "pars": { "1": [46, 55], "2": [80, 100], "3": [130, 160], "4": [210, 245], "5": [350, 390], "6": [515, 565], "7": [660, 825] },
                 "goldenAge": { "gold": [0.15, 20], "silver": [0.10, 15], "bronze": [0.05, 10] } },
  "score": { "eraBase": 1000, "finaleBase": 2000, "leadMul": 1, "medal": { "gold": 300, "silver": 150, "bronze": 50 },
             "popMul": 10, "strip": 100, "achievement": 25 },
  "events": { "firstAfterYears": 15, "everyYears": [15, 30], "maxActiveNegative": 1, "seed": "season" }
}
```

Era gates, buildings, discoveries and medal pars live in their own content files (`epochs.json`, `buildings/*.json`, `techs.json`). Their values are exactly the `GATES`, `B`, `DISC` and `PARS` tables at the top of the sim.

---

## 16. Risks, open questions, cut list

### Risks
1. **The sim is aggregate.** Real radius coverage wastes capacity: players will need ≈ 10–25 % more service buildings than the sim (the slow profile's 0.8 coverage efficiency brackets this). Re-run the sim with coverage efficiency 0.75 if playtests show "can't reach L5" frustration.
2. **Late-game construction tedium.** Hundreds of houses × 11 levels. Mitigations: organic growth (1.5 %/yr), private construction needing no crew, and **"upgrade all eligible on this block / in view"** (bulk action, one confirmation, one summed cost) as a must-have for mobile.
3. **Upkeep share near 45–50 % at the finale.** This is acceptable for a mature city, but players coming from BuildIt may read it as "money vanishing". The budget screen must show it as category bars, with the tax and utilisation levers next to them.
4. **Pars depend on balance.** Any content change shifts medal pars. They are data, so re-derive them from the sim before each release (gold = optimised × 1.05, silver = typical × 1.05).
5. **Client-authoritative leaderboard.** Server recomputation and plausibility checks (§12) are a must before the board is public.
6. **Phone performance:** chunk traffic, coverage assignment and production must be indexed (spatial grid, cached counts) and recomputed on structure change only. The tick stays O(groups), as in the sim (≈ 100 groups for a 50 K city).

### Open questions
* Should **"buy missing"** be capped per year in the early eras to force production chains (BuildIt makes materials scarce)? The sim shows 23–47 M of imports over a full run, about a third of the late-era Town Hall bill. It is a real sink, but it lets a careless player skip chains. A cap of 3 years of income per era is the candidate.
* The finale par of 2200 is a design convention ("the next century of history"). Alternative: the finale par equals 2100 and the Near Future entry par equals 2050.
* Should the trunk railway also exist along the mountain foot (row 0), so mines connect without long branch lines?

### Cut first if scope must shrink (in order)
1. Post-finale monuments → keep the endless mode with records only.
2. Smart programs 2–6 → keep only Autonomous transit and make the finale ask for 1.
3. Flight route *types* → routes become plain counters (+tourism).
4. Per-chunk traffic → one city-wide ρ (as in the sim).
5. Port L3 and station L2 models → reuse L2/L1 with an era palette (saves 2 of 11 new models).
6. Seasonal farm multiplier, export saturation, deposits on cosmetic strips (W5, W7, E7).
7. **Never cut:** the Lead meter, medals, Town Hall gate checklists, the one-verb-per-era structure, metro, railway and airport (each carries a gate), and the road cross-section ladder.
