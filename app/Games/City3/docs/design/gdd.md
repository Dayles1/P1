# Летопись города 3 (City Chronicle 3) — Game Design Document

**Status:** final spec for implementation (v3.0, 2026-10-16). Base: `concept-player.md`; maths grafted from `concept-economist.md` and `concept-progression.md`; every must-fix item of `judges.md` is closed (Appendix A).
**Source of every number:** `sim/sim-final.mjs` (run `node design/sim/sim-final.mjs --roster`, ≈5 min). Its report is in §12. If a number here and in the sim disagree, the sim's config wins and this document must be updated.

**Conventions used everywhere**
- 1 tick = 1 game second = 1/25 game year. **All content rates are per year** (`/год`); the engine applies `rate / 25` per tick. No `/s` or `/min` in content or UI.
- Era index `e` = 0..6: e0 Античность, e1000 Средневековье, e1500 Возрождение, e1800 Индустриальная эра, e1900 Модерн, e2000 Современность, e2100 Ближнее будущее. **Level era** = the era of a building *level* (not of the city).
- Coordinates: `x` 0..99; **land rows y 0..39** (row 0 touches the mountain), **beach rows y 40..59** (59 = waterline), sea from y 60. If the map slice (slice 0) stores the grid with an offset, convert at the boundary; all rules below use these logical rows.
- Content ids are the existing ones in `content/buildings/*.json`. The sim uses 4 aliases (Appendix B).
- `nice(x)` = round to 2 significant digits (x ≥ 10) or to 0.1 (x < 10). All generated prices use it.

---

## 1. Pillars and the core loop

### 1.1 Pillars (rules the implementation must not break)
1. **One city, two thousand years.** Nothing is reset, re-skinned or repriced when an era begins. The same streets grow up level by level.
2. **A race against history.** One constant calendar (25 s = 1 year at ×1). Eras open by achievements, never by date. The lead over history is always on the HUD and is the largest part of the score.
3. **One currency.** `money` is the only number in the main HUD. Its face changes per era; its value never.
4. **One new verb per era**, and every era gate is built from the previous era's verb (§1.3).
5. **Phone first.** Every frequent action works with one thumb; bulk actions are minimum scope (§11.3).
6. **Bounded and fair.** Every income saturates, nothing dead-ends, money is worth 0 points, the map, prices and events are identical for every player.

### 1.2 Core loop (typical player at ×1; numbers from §12)
| Loop | Length | What the player does | Feedback |
|---|---|---|---|
| 30 s | 1 year | place or upgrade 1–3 things; homes fill | year ring fills; money pill delta `+12,4K/год`; residents walk in |
| 5 min | 12 years | close one need ("42 дома не растут до L5: нет Образования"), start a discovery, deliver a port order, finish a goal | goal fanfare; the lead jumps when a gate line turns green |
| Session (20–40 min real) | 50–100 years | most of one era gate (an era takes 30–76 min of game time), often one land strip | era banner, coin flip, stars, Golden Age |
| Long term | ≈ 5 h of game time to the Near Future (≈ 2.5 h real at ×2) | 7 eras, 9 strips; then 14 strips, 100 K+ citizens, achievements | Chronicle, leaderboard |

### 1.3 The seven eras at a glance
| Era | Money face | Town Hall | New verb (what you newly *do*) | Gate into the next era is built from |
|---|---|---|---|---|
| e0 Античность | Драхмы ₯ | L1–L2 | build, feed, connect: homes, roads, coverage | Агора + Школа философов |
| e1000 Средневековье | Гроши ₰ | L3 | **district charters** (Грамоты районов) | Управа с грамотой + 2 кузницы |
| e1500 Возрождение | Флорины ƒ | L4 | **port trade orders** | Гавань + 4 заказа + Стеклодувня |
| e1800 Индустриальная эра | Банкноты ₤ | L5 | **railway** from mountain portals | Вокзал у портала + Литейная |
| e1900 Модерн | Наличные ¤ | L6 | **metro lines** + power grid | Линия метро + Электростанция |
| e2000 Современность | Карты ▣ | L7 | **flight routes** | Аэропорт + 2 рейса + Завод электроники |
| e2100 Ближнее будущее | Кредиты ◈ | L8 | **smart programs** | — (content ends; sandbox continues) |

### 1.4 The whole game on one card
Money · citizens (and how full the homes are) · happiness · 4 services (water, health, education, leisure) and the home need ladder · 3 stocked goods (food, materials, goods) + 2 flows (fuel, power) · traffic · the Town Hall gate · the Chronicle (lead + stars). Nothing else is needed; every number is explained where the decision is made.

---

## 2. Calendar and eras

### 2.1 Calendar, speeds, atmosphere
- `year = 1 + time / 25` (display `floor`). Only `time` (game seconds) is stored. The year never jumps, never clamps and never depends on the era. After 2100 the calendar simply continues.
- Speeds: pause, ×1, ×2, ×5; testers also ×20, ×50 (a save that ever used tester speed or tester tools is flagged and kept off the leaderboard). Speed multiplies everything, so the lead is speed-neutral.
- HUD shows the **year only** (no month, no season) with a thin ring that fills once per game year.
- **Atmosphere clock** = real time while unpaused, independent of speed: day 480 s (night 120 s, dawn and dusk 40 s each), season 960 s, weather state 180–360 s (clear, cloud, rain, fog; snow in winter). It drives sky, lamps, lit windows, snow, foliage tint and sound only. **No economic effect** (v2's seasonal fertility and cold penalty are removed). It cannot strobe at ×5/×20/×50.
- Offline: the calendar is frozen (§4.12).

### 2.2 Era gates = Town Hall upgrades
The Town Hall level *is* the era. The gate is a checklist of at most 4 lines: population, two signature items, "3 of the era's 4 discoveries". When all are green the **Upgrade** button lights; paying starts a visible build; the era begins when the build finishes. **No other fee.**

| Enter | TH level | Population | Signature items (the previous era's verb) | Discoveries | TH cost (money + mat) | Build | Density path for this gate |
|---|---|---:|---|---|---:|---:|---|
| (mid-Antiquity, not an era) | L2 Дом вождя | 30 | — | — | 400 + 24 | 1 yr | — |
| e1000 Средневековье | L3 Ратуша | 80 | Агора (market L1) · Школа философов (school L1) | 3 of 4 e0 | 2.4K + 140 | 3 yr | — |
| e1500 Возрождение | L4 Дворец | 460 | Управа района с грамотой (district_hall L1) · 2 кузницы (smithy L1 ×2) | 3 of 4 e1000 | 22K + 1.3K | 5 yr | house L4 |
| e1800 Индустриальная эра | L5 Городская управа | 1 800 | Гавань (port L1) **and 4 delivered orders** · Стеклодувня (glassworks L1) | 3 of 4 e1500 | 150K + 9K | 7 yr | house L5, manors |
| e1900 Модерн | L6 Мэрия | 7 000 | Вокзал on a line to a portal (rail_station L1) · Литейная (steel_mill L1) | 3 of 4 e1800 | 800K + 48K | 9 yr | block L1, house L7, «Плотная застройка» |
| e2000 Современность | L7 Сити-холл | 20 000 | Линия метро: 2 stations on one line · Электростанция (power_plant L1) | 3 of 4 e1900 | 3.5M + 210K | 11 yr | house L8, block L2, avenues |
| e2100 Ближнее будущее | L8 Цифровая мэрия | 45 000 | Аэропорт **and 2 open flight routes** · Завод электроники | 3 of 4 e2000 | 18M + 1.1M | 13 yr | house L9–L10, block L3–L4, towers |

- An item counts when it is complete, active (not mothballed) and at ≥ the stated level. Two of the three required discoveries are implied by the items (Самоуправление; Мореплавание + Стеклоделие; Железные дороги + Сталеварение; Метрополитен + Электричество; Авиация + Полупроводники) — the third is the player's choice.
- Until a verb's slice is implemented (§15), its line is simply absent from `epochs.json` and the gate shows 3 lines.
- **Spirit of the Age (Дух времени)**, the catch-up: when `year > H_next` (the historical year of the next era), the next Town Hall upgrade and every discovery cost `min(30 %, 0.1 % × (year − H_next))` less. Card: «История ушла вперёд: −12 %».

### 2.3 Ahead of history: lead, stars, Golden Age
Historical years `H = [0, 1000, 1500, 1800, 1900, 2000, 2100]`.
- **Live lead** (HUD): `E(t) = H_e + f · (H_{e+1} − H_e)`, `f = 0.98` while the Town Hall upgrade is building, else `f = 0.95 · g`, with `g = 0.5 · min(1, P / popGate) + 0.5 · done / total`, `done = items complete + min(3, discoveries of the era)/3`, `total = items + 1`. `Lead = E(t) − year`. In e2100 `Lead = 2100 − year`. It falls by 1 every idle year and jumps when a line turns green (an item in the Middle Ages ≈ +79 years).
- HUD: `+1 352` green; amber with ▼ when it fell over the last 10 years. Tooltip: «Опережение истории: +1 352 года. Ваш город — как Европа 1 437 года (Средневековье, 63 % пути к Возрождению). Последнее: «Агора построена» +79 лет.» Late game copy: «История догоняет» (not a failure state).
- **At entry** the era log records `lead_e = H_e − Y_e` (Y_e = calendar year when the Town Hall finishes) and the stars.
- **Stars per era entry** (6 entries, max 18): ★ if `Y_e ≤ H_e`; ★★ if `Y_e ≤ s2`; ★★★ if `Y_e ≤ s3`. Thresholds live in `epochs.json` and are re-derived by the sim after every balance change (★★ = median typical entry × 1.05; ★★★ = best of the 10 simulated typical/expert runs × 1.02, so a careful player can always reach it):

| Era entered | ★ by year | ★★ by year | ★★★ by year |
|---|---:|---:|---:|
| e1000 | 1000 | 76 | 72 |
| e1500 | 1500 | 157 | 143 |
| e1800 | 1800 | 235 | 222 |
| e1900 | 1900 | 366 | 341 |
| e2000 | 2000 | 558 | 517 |
| e2100 | 2100 | 750 | 714 |

- **Golden Age (Золотой век):** on entry, `+5 % × stars` to taxes, export income and production for 10 years, ramping in over 2 years and out over the last 2, plus +3 happiness while active. Warm light tint, confetti on the Town Hall.
- **Chronicle screen:** one row per era: entry year, lead, stars, «на N лет раньше истории».

### 2.4 What changes on era entry — and what must not
| When | What |
|---|---|
| At once (Town Hall finishes) | era name in the chip; a 2.5 s non-blocking banner (no splash, no white flash, no year count-up); the money face flips (1.2 s coin flip; cross-fade if reduced motion); new build cards with a NEW badge; 4 new discoveries; the new story goal; stars + Golden Age start (ramped). |
| Over 20 game years | sky, fog and light palette blend; UI accent colour blends; ambience cross-fades (10 years); residents re-dress when they next leave home (5 %/year); traffic mix: share of new-era vehicles = years since entry / 20 (vehicles are never cleared); buildings that newly qualify as Heritage ramp ×1 → ×2. |
| Only when the player acts | every building and road keeps its level and its own era's look until upgraded; income rises only as homes are upgraded (tax and upkeep depend on the level's era). |
| Never | the map, the calendar rate, the money amount, prices, the upkeep or tax of existing buildings, the layout, the HUD layout and fonts (v2's per-era HUD theme is removed; only one accent colour per era remains). |

---

## 3. The currency and the resources

### 3.1 One `money`, seven faces
| Era | Full name (era card) | Short name (tooltips, a11y) | Symbol (text fallback) | SVG icon (24-px grid, drawn, not a font glyph) | Flavour line |
|---|---|---|---|---|---|
| e0 | Серебряные драхмы | Драхмы | ₯ | silver coin with an owl, slightly irregular strike | «Афинская сова — монета, которой верят от Сицилии до Понта.» |
| e1000 | Серебряные гроши | Гроши | ₰ | small coins spilling from a leather pouch | «Грош к грошу — и город растёт.» |
| e1500 | Золотые флорины | Флорины | ƒ | gold florin with a lily, milled edge | «Флорины Медичи ходят по всей Европе.» |
| e1800 | Банковские билеты | Банкноты | ₤ | engraved note with a guilloche border and a locomotive | «Бумага, за которой стоят пар и сталь.» |
| e1900 | Наличные деньги | Наличные | ¤ | folded bills with a coin on top | «Наличные — король Модерна.» |
| e2000 | Банковские карты | Карты | ▣ | card with a chip and the contactless mark | «Приложите карту — город платит сам.» |
| e2100 | Цифровые кредиты | Кредиты | ◈ | glowing hexagonal token | «Кредиты живут в облаке, а город — на земле.» |

- The face follows the **city's** era. The id is always `money`; **no redenomination, no conversion**. Old buildings that animate money (market, manor) keep their own era's coin.
- For 20 years after a change the money tooltip reads «1 ₰ = 1 ₯ — та же казна, новая монета».

### 3.2 Number formatting (one rule everywhere)
- 3 significant digits with Latin suffixes and the locale decimal separator: `999`, `1,24K`, `12,4K`, `124K`, `1,24M`, `1,24B` (ru). The HUD money text is ≤ 6 characters (icon not counted).
- Exact values only in tooltips/sheets, with thin spaces: `12 400`.
- Rates always per year: `+12,4K/год`. Negative values use `−` (U+2212) and the danger colour.
- Cost lines: `[icon] 1,2K + ▦ 60`; if materials are short the line shows the total with the import included: «▦ 20 докупим за 80».
- Screen readers: «Деньги: 12 400 (гроши)».

### 3.3 Resources (the complete list)
| id | Kind | What it is for | Made by | Used by | Import / export (per unit) | Shown |
|---|---|---|---|---|---|---|
| `money` | currency | everything is bought with it | taxes, exports, tourism, orders, fares, goals | construction, upkeep, research, land, imports | — | HUD pill (the only HUD resource) |
| `food` (Еда) | stock | 0.4 per citizen per year | farm, fishery, vertical_farm | citizens; chemical_plant L2 | import 1.0 automatically when short; export 0.4 above 90 % of cap | City sheet; badge when importing |
| `mat` (Стройматериалы; face: «дерево и камень» → «кирпич» → «тёсаный камень» → «сталь и кирпич» → «бетон» → «бетон и стекло» → «композиты») | stock | part of every construction price | lumber, quarry, mine, kiln, steel_mill, cement_plant, composites_plant | construction | missing amount bought at 4.0 when you build; export 1.5 above 90 % of cap | build cards, City sheet |
| `goods` (Товары) | stock | sold for money; port orders | smithy, glassworks, chemical_plant, electronics_fab | exports | export 6.0 × (1 + airport + rail freight + cargo route bonus) | City sheet |
| `fuel` (Топливо), from e1800 | flow (not stored) | runs heavy industry and power plants | coal_mine, oil_well | steel_mill, cement_plant, composites_plant, chemical_plant L1, power_plant | deficit imported at 3.0 while money > 0; surplus exported at 1.2 | City sheet gauge |
| power (Электричество), from e1900 | flow, effect fields only | homes L8+, most late buildings | power_plant, windmill L2+, solar_farm | `powerUse` of buildings | deficit bought from the regional grid at 100 per power unit-year while money > 0 | City sheet gauge; badge |

- There is no wood, stone, iron, tools, glass, coal, oil, plastic, electronics, data, knowledge… (v2's 22 resources fold into these). Port import discount: −10/−15/−20 % on all imports by port level.
- **Storage:** one cap applied to each of food, mat, goods = `1 200 + TH storage + Σ storehouse storage`. Overflow is wasted; the City sheet shows «пропадает N/год» in red.

---

## 4. Economy

### 4.0 Tick order (engine)
1. `time += 1`; finish constructions and research; if the structure changed, run the structural recompute (§4.13).
2. Every 25th tick (new year): organic growth, new port orders, treasury check, P* and happiness refresh, traffic refresh, event roll, telemetry.
3. Labour → power → production and fuel → food → imports → exports → happiness (city terms) → money → population.

### 4.1 Labour
`workers = 0.5 · P`. Jobs fill in priority classes **svc → food → raw → ind → com** (class = `jobClass` of the building, §8): `staff_c = min(1, workersLeft / jobs_c)`, then `workersLeft −= jobs_c`. Unemployment `u = max(0, workers − Σ jobs) / workers`. City sheet «Рабочие руки»: *не хватает рабочих* (any staff_c < 0.95) → build homes; *баланс*; *безработица* (`u > 0.05`) → build workplaces (shows the tax lost per year).

### 4.2 Production
Per building per year: `out = level output × depositMult × staff_class × congEff(access tile) × (1 + prod% + golden) × (powerUse > 0 ? 0.6 + 0.4·powerRatio : 1) × (1 + resource%) × charter × windmill`.
- `depositMult`: 1.5 on a rich deposit; ports and fisheries in the deep bay §5.3. `charter`: ×1.15 for `ind` buildings inside a craft charter (§7.5). `windmill`: farms within r3 of a windmill L1 ×1.25.
- Fuel users scale by `fuelRatio` when fuel cannot be bought (§4.3).

### 4.3 Food, fuel, power settlement
- **Food:** need = `0.4 · P` + chemical inputs. Shortfall → imported at `1.0 × (1 − importDisc)` if affordable, else **starving**: −25 happiness and population ×0.996 per tick (≈ −9.5 %/year).
- **Fuel:** need = Σ fuel inputs of working industry + Σ fuel use of working power plants. Deficit imported at `3.0 × (1 − importDisc)` while money > 0; at money 0, `fuelRatio = made / need` scales those buildings. Surplus is exported (§4.4).
- **Power:** supply = Σ power × staff_svc × fuelRatio (plants) × (1.15 with the Умная сеть program); use = Σ powerUse. Deficit bought from the grid at 100 per unit-year while money > 0; at money 0, `powerRatio = supply / use`: power users run at `0.6 + 0.4·ratio` and homes lose `15 · (1 − ratio)` happiness. A mothballed plant has no upkeep and no fuel use.

### 4.4 Exports and port orders (trade capacity is the saturation)
- Capacity per year `K = (Σ trade of TH, markets, port, the best 3 stations, airport, cargo routes) × (1 + trade%) × staff_com`. Port ×1.5 in the deep bay; stations ×1.5 with a through-line; markets inside a trade charter ×1.15.
- Sold automatically each tick in order: **goods** (all, minus stock reserved for open orders) at `6.0 × (1 + goodsPremium + freight + cargo)` → **fuel surplus** at 1.2 → **food** above 90 % of cap at 0.4 → **mat** above 90 % of cap at 1.5. `goodsPremium` = airport +15/+25 %; `freight = min(1, 0.35 · stations) × 10 %`; `cargo` = +10 % with a cargo route. Export income × (1 + golden). Revenue can never exceed `K × 10` per year (6 × 1.45 × Golden Age 1.15).
- **Port orders** (§7.1) pay 2× the export price for a fixed quantity.

### 4.5 Tourism (saturating, valued by each building's own era)
- Demand `X = Σ attraction × 4.0 × M[level era] × heritage × beach × charter` per year, `M = [1, 3.2, 12.1, 37.1, 85.7, 199.3, 352.9]`. Heritage ×2 (ramped over 20 years) for temple, theater, manor, market, school, park, architect_bureau whose **current level was completed ≥ 2 eras before the city's era**; manor on the beach ×1.5; inside a heritage charter ×1.5.
- Capacity `C = Σ visitor capacity` (TH 10→15K, port 600/2.5K/8K ×1.2 in the bay, best 3 stations 2.5K/8K/25K ×1.2 with a through-line, airport 40K/100K, tourist route +15K).
- `tourism / year = X·C / (X + C)` ≤ min(X, C). Cheap old buildings cannot print money: without transport capacity they earn little.

### 4.6 Taxes and other income
- **Tax / year** = `P × 1.0 × taxMult × (0.5 + h/100) × (1 − 0.3·u) × policy × (1 + tax% + golden + charter 0.08 + data 0.05 + business routes 0.03 each + City OS 0.04)`. `taxMult` = housing-weighted mean of `[1, 1.6, 2.5, 4, 6, 9, 13]` by **the level era of each home**, manors ×3. Charter/data apply to homes inside their radius (computed per home on structural change).
- **Fares / year** = `P × metroCoverage × 0.1 × 1.0 × taxMult`.
- **Goal rewards** (§9.2) and event gifts.

### 4.7 Happiness, services, needs, population
- **Coverage:** one Uint8 grid per service (water, health, education, leisure; plus `data`), stamped on build/upgrade/demolish with the Manhattan diamond of radius `r` from every footprint tile. A home is covered if any footprint tile is covered. Health exists from e1000; before that 3 services count.
- **Home happiness** `h_home = clamp(35 + 30·covered/unlocked + min(15, Σ auras) + TH aura + metro (+6/7/8 within a working station's radius, max 8) + road appeal of the access tile − min(30, Σ pollution) − traffic − airport noise 8 (within r4) + city terms, 0, 100)`. City terms (O(1)): discoveries, tax policy (+8/0/−10), green charter +4 (in radius), golden +3, Чистый воздух +2, density −6, starving −25, power −15·(1−ratio). City happiness = housing-weighted mean (shown in the HUD; tax uses it).
- **Traffic term:** `−min(15, 15 · max(0, ρ_access − 1))` (§6.5).
- **Need ladder (tiers):** a home level of tier T needs the first T of: 1 water · 2 leisure · 3 health · 4 education · 5 happiness ≥ 50 at the home · 6 an aura ≥ +4 at the tile (park, market, manor…) · 7 power ratio ≥ 0.95 · 8 transit (inside a working metro station radius, or the access road within 2 tiles of an avenue) · 9 happiness ≥ 65 · 10 data centre coverage (r10). A home may be built or upgraded to a level only if its tier is met at its tile; the button names what is missing («Для «Фахверкового дома» нужно: Образование»).
- **Effective housing** `Heff_home = housing × (1 + housing%) × (0.7 + 0.3·covered/unlocked) × (1.15 with «Плотная застройка»)`. **Occupancy** `occ(h) = clamp((h − 25)/45, 0, 1)` (full at 70). **Target** `P* = Σ Heff_home × occ(h_home)`, recomputed on structural change and once per year.
- **Population per tick:** if `P > P*`: `P −= max(0.2, 0.05·(P − P*))` (not below P*); else if starving: `P ×= 0.996`; else `P += (P* − P) · 0.03 · min(1, h/70) + 0.2`, capped at P*. Homes fill in ≈ 1–2 years.
- **Organic growth:** once per year every complete home whose next level is unlocked, belongs to an era ≤ city era − 1 and has its tier met gains `0.015` progress (start value = hash(uid) in 0..1); at 1 it climbs one level for free (`paid` unchanged). Old quarters modernise by themselves; current-era levels are always paid.
- **Pollution:** grid stamped like coverage (amount within r). Industry against the mountain and away from homes is the readable strategy.

### 4.8 Upkeep (money per year)
- Per level, materialised in content: `upkeep = money × rate[category] × eraMult[level era]`; rates: food 0.6 %, raw 0.8 %, industry 0.8 %, trade 0.8 %, storage 0.6 %, service 1.3 %, park 1.3 %, culture 0.8 %, energy 0.8 %, power 1.2 %, transport 0.8 %; **homes and the Town Hall 0**. `eraMult = [0.35, 0.5, 0.65, 0.8, 0.9, 1.0, 1.0]` — depends on the level's era, so era entry changes nothing.
- Networks: roads per tile (§6.3), rail 1 %/year of the track price per tile, metro tunnel 60 per tile per year, smart programs 1.5 % of gross each, flight routes 12K (airport L1) / 30K (L2) per route, loan interest 10 %/year.
- Target: building upkeep ≈ 6–10 % of gross in the early eras, ≤ 30 % late (sim, typical: 28 % at Near Future entry; all costs 31 %). The City sheet shows bars by category with their levers (mothball, tax policy, programs).

### 4.9 Construction prices, upgrades, refunds
- **Generator (already applied to every number in §8):** homes `money = nice(housing × cpc[level era] × typeMult × f)`, `cpc = [7, 22.4, 85, 260, 600, 1395, 2470]` (= home payback years [7, 14, 34, 65, 100, 155, 190] × tax 1.0 × taxMult), typeMult house 1, block 0.85, skyscraper 1.05, manor 3.5, `f = 1.15` for the second level of an era; other buildings `money = nice(base × M[level era] × f)`; `mat = nice(money × {civic 0.06, housing 0.08, raw 0.04, other 0.05})`. Producers: `gross/yr = ((money + 2.5·mat) / prodPayback[e] × k + upkeep) / (1 − inputShare)` with prodPayback `[10, 17, 34, 60, 90, 125, 150]` years; output units = gross / reference price (food 1, mat 2.5, goods 6, fuel 2.5, trade 3). Engineers copy the numbers of §8; the generator is for retuning.
- **Upgrade (trade-in):** `price = target × max(0.25, 1 − 0.7 × min(paid, listMoney(current level)) / targetMoney)` for money and mat alike. Levels may be skipped. A chain always costs ≥ the direct build (`total = paid + target − 0.7·min(paid, list) ≥ target`). The Town Hall pays full price (minus Spirit).
- `paid` = money actually paid for this building (all steps, imports included). Organic climbs add nothing.
- **Demolish:** refund 50 % of `paid` (money only). Roads: 50 % of the tile's current list money.
- **Buy missing materials:** at build time `max(0, matCost − stock)` is bought at `4.0 × (1 − importDisc)` and included in the shown price; one tap.
- **Move:** 10 % of the current level's list price; not for the Town Hall, port, station, airport.

### 4.10 Empty treasury, mothballing, loans
- Money never goes below 0. If a tick's costs exceed what is there, money stays 0 and the city is **в недоимке** for that year (orange badge).
- At each new year, if the city was in arrears and net/year < 0, the active non-home, non-TH building with the highest upkeep is **mothballed** (no effect, no upkeep, no jobs, grey with a lock badge), one per year, until net ≥ 0. The player can mothball or reopen any building by hand; the Advisor suggests reopening when net > 2 × its upkeep and demolishing surplus generators.
- At money 0, imports stop: food → starving, fuel → fuelRatio, power → powerRatio.
- **Ссуда казны (loan):** one at a time, up to 3 × gross/year, 10 %/year, repaid automatically with 25 % of positive net. Offered on the price sheet when a Town Hall upgrade or strip is unaffordable. Not farmable (§12.7).
- Stress test (§12.7): a city loaded with 1.5 × its gross in pointless upkeep recovers to positive net in 36 years with no decisions.

### 4.11 Policies (Town Hall card; each change locked for 5 years)
- **Налоги** (from e1000): Низкие ×0.8, +8 happiness · Обычные · Высокие ×1.2, −10 happiness.
- **Плотная застройка** (from e1800): housing +15 %, happiness −6, car trips +10 %.

### 4.12 Offline: frozen calendar + Treasury chest
- While the app is closed nothing advances: no time, no construction, no research, no events. The 3 600-tick catch-up of v2 is deleted.
- On return: if ≥ 25 game years have passed since the last claim and net > 0, the **Казна** chest offers `min(1, hoursAway / 8) × 1 year of net`. Card: «Пока вас не было, казна собрала 12,4K. Забрать». Daily players: 0.8 % of all income (3 sessions/day: 1.6 %) — a gift, not a strategy.

### 4.13 Performance rules (phones)
- Never port v2's O(B²) `recalculate()` or the per-tick O(goals × B) `updateGoals`.
- Structural change → re-stamp only the changed footprints into the coverage/aura/pollution/charter grids, recompute per-home static happiness and weights, recompute traffic only for buildings whose reach set changed. Per tick: O(1) aggregates. Goals checked every 5 ticks against cached counters.
- Labour, production, settlement and money use cached per-class totals.

### 4.14 Why money neither explodes nor dead-ends
Tax ≤ `P × 13 × 3 × 1.5 × 1.2 × bonuses` with P capped by land (§12.8); exports ≤ `K × 10`; tourism ≤ min(X, C); fares ≤ 10 % of tax. Homes and the Town Hall have no upkeep, imports are always available while money > 0, mothballing closes every negative spiral, the chest and loan are capped. Sim: no profile ever sat at 0 money; median bank 0.6 (expert) – 1.3 (typical) years of gross.

---

## 5. Map and land

### 5.1 The grid (identical for every player; no trees, rocks or reeds anywhere)
| Band | Rows | What may be built |
|---|---|---|
| Mountain (backdrop, outside play) | above row 0 | nothing; drawn as a ridge to the horizon; tunnel portals and ore/coal veins are drawn on its foot |
| Mountain foot | land rows 0–1 | quarry, mine, coal_mine: 2×2 footprints **covering rows 0–1**; anything else that fits |
| Land | rows 0–39 | every `land` and `landOrBeach` building |
| Beach | rows 40–58 | roads, rail track, and `landOrBeach` buildings only: manor, glassworks, storehouse, theater, park, windmill, solar_farm; the airport only on its plot |
| Waterline | row 59 | fishery (1×1), oil_well (on oil spots), port (3×2 on rows 58–59); piers are part of the models |
| Sea | rows 60+ | nothing; ships and planes, horizon |

Start owned: x 35–64, all 60 rows. Town Hall 2×2 at x 49–50, rows 19–20. A building needs an orthogonally adjacent road tile connected to the Town Hall (mountain buildings: a road on row 2).

### 5.2 Expansion strips
14 strips of 5 columns (7 per side), each the full depth. **Price depends only on how many strips you already own**, either side, no era gate; strips on one side are bought outwards in order (L2 needs L1). Price for the k-th purchase:

| # | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| price | 2.0K | 4.4K | 9.6K | 21K | 48K | 105K | 230K | 500K | 1.2M | 2.8M | 6.4M | 16M | 40M | 100M |

A price-only curve cannot deadlock against population gates; the typical player owns 2 strips at Industrial entry, 5 at Modern, 8 at Contemporary, 9 at Near Future, and all 14 in the sandbox. Strips are shown from day one in a locked tint with their deposits; the on-map plaque «+ Полоса · 4,4K · бухта» opens the confirm sheet.

### 5.3 Deposits and features (fixed positions)
| Strip | Columns | Deposit / feature (2×2 spots cover rows 0–1; oil spots are 1×1 on row 59) |
|---|---|---|
| start | 35–64 | coal x 37–38, x 40–41 · portal x 46 · ore x 56–57, x 59–60 |
| L1 | 30–34 | ore, **rich** (×1.5): x 30–31, x 33–34 |
| L2 | 25–29 | coal: x 25–26, x 28–29 |
| L3 | 20–24 | portal x 22 |
| L4 | 15–19 | oil ×4: x 15, 16, 18, 19 |
| L5 | 10–14 | coal, **rich**: x 10–11, x 13–14 |
| L6 | 5–9 | ore: x 5–6, x 8–9 |
| L7 | 0–4 | lighthouse cape: attraction of buildings on its beach ×1.25 |
| R1 | 65–69 | **deep bay**: a port whose footprint is in x 65–69 gets trade ×1.5, visitors ×1.2; the first 5 fisheries there ×1.25 |
| R2 | 70–74 | ore: x 70–71, x 73–74 |
| R3 | 75–79 | coal x 75–76 · portal x 77 · coal x 78–79 |
| R4 | 80–84 | ore, **rich**: x 80–81, x 83–84 |
| R5 | 85–89 | oil ×4, **rich**: x 85, 86, 88, 89 |
| R6 | 90–94 | sunny slope: solar farms there ×1.25 power |
| R7 | 95–99 | cape: as L7 |

Mines need an ore spot, coal mines a coal spot, oil wells an oil spot. Quarries use any other mountain-foot position. The first meaningful choice is L1 (rich ore) or R1 (deep bay). Cape and sunny bonuses are flavour (not simulated, < 1 % of income).

### 5.4 Airport plot (Будущий аэропорт)
A 12×4 outline on x 44–55, beach rows 46–49, drawn faintly from day one. Only roads and parks may stand on it; they are removed with a 100 % refund of `paid` when the airport is placed. Airport noise (−8 happiness within 4 tiles) can reach only beach manors. This prevents the "full beach, no airport" soft-lock.

---

## 6. Roads

### 6.1 Two families, one tile each (16 m)
- **Улица (street):** pleasant, raises the happiness of homes on it, lower capacity.
- **Проспект (avenue):** from e1800; high capacity, slightly noisy, carries trams/buses (transit share).
Build card line: «Проспекты везут, улицы радуют.» Roads may not be built on sea tiles (no bridges are needed).

### 6.2 Cross-sections (each fits 16 m; widths in metres)
| id | Name | Carriageway | Sidewalks | Median / verge | Markings, crossings | Decor |
|---|---|---|---|---|---|---|
| s1 | Тропа | 1 track 4 m packed earth | — | 6 m grass each side | none | none |
| s2 | Мостовая | 6 m cobbles, crowned | — | 1 m gutters + 4 m verges | none | wooden lantern every 3rd tile, hitching posts |
| s3 | Мощёная улица | 7 m flagstones, drain channel | 2 × 2.5 flagged, kerbs | — | none | oil lanterns on brackets every 2nd tile |
| s4 | Улица с газовыми фонарями | 7 m setts (2 lanes, unpainted) | 2 × 3, granite kerbs | — | sett crossing strip at junctions | gas lamp every tile (alternating), bollards |
| s5 | Асфальтовая улица | 2 × 3.5 asphalt | 2 × 3 concrete | — | dashed centre line, zebras + stop lines on junction arms | electric lamp every tile, kerb drains |
| s6 | Зелёная улица | 2 × 3.25 | 2 × 2.75 | 2 × 2 tree planters / parking | centre line, raised zebras, bike symbols | tree every tile, bench every 2nd, LED lamps |
| s7 | Смарт-улица | 2 × 3 autonomous lanes, LED studs | 2 × 2.5 with planters | 2 × 1.5 protected bike lanes | crossings light up when a pedestrian waits | smart poles every tile, benches |
| a1 | Тракт с конкой | 2 × 3.5 macadam, horse-tram rails in one lane | 2 × 2.5 footpaths | 2 × 1 gravel shoulders | none | telegraph poles, mile posts |
| a2 | Проспект | 4 × 3 asphalt | 2 × 2 | — | double centre line, lane dashes, zebras; **traffic lights where two avenues meet** | double-arm lamps, bus shelter every 4th tile |
| a3 | Бульвар с трамваем | 2 × 3 lanes + 3 m central tram track | 2 × 2 | trees beside the track | signalled crossings with islands | catenary, trees, tram stops every 4th tile |
| a4 | Смарт-проспект | 4 × 2.75 dynamic lanes | 2 × 2 with tree pits | 1 m green median | adaptive signals | smart poles, e-bus stops |

Junctions come from the NESW mask (end, straight, corner, T, cross); crossings and stop lines on every arm next to a junction; a street meeting an avenue gets a stop line on the street. Right-hand traffic; lane offsets come from the profile; vehicles are scaled to the 16 m tile (car ≈ 4.5 × 1.8 m); pedestrians walk on sidewalks.

### 6.3 Numbers per tile
| id | Era / unlock | money + mat | Capacity (trips/tile) | Upkeep/yr | Happiness next to it | Transit share |
|---|---|---:|---:|---:|---:|---:|
| s1 | e0 | 8 + 2 | 45 | 0 | 0 | — |
| s2 | e1000 | 24 + 6 | 65 | 0.07 | +1 | — |
| s3 | e1500 | 100 + 25 | 85 | 0.17 | +2 | — |
| s4 | e1800 | 320 + 80 | 110 | 0.4 | +2 | — |
| s5 | e1900 | 1.0K + 250 | 150 | 1 | +2 | — |
| s6 | e2000 | 2.8K + 700 | 180 | 2.3 | +4 | — |
| s7 | e2100, Умный город | 7.2K + 1.8K | 220 | 5.3 | +5 | — |
| a1 | e1800, Сталеварение | 1.0K + 250 | 260 | 1 | −2 | 3 % |
| a2 | e1900 | 2.8K + 700 | 450 | 3 | −3 | 5 % |
| a3 | e2000 | 8.0K + 2.0K | 420 | 6.7 | 0 | 15 % |
| a4 | e2100, Умный город | 20K + 5.0K | 560 | 15 | +1 | 18 % |

Cosmetic vehicle speed (tiles/s): s1 0.5, s2 0.7, s3 0.8, s4 1.0, s5–s6 1.6, s7 1.8, a1 1.2, a2–a3 1.9, a4 2.2; vehicles slow by `1/(1 + ρ²)`.

### 6.4 Upgrade by redraw
Dragging a road over existing road upgrades those tiles (street → avenue counts as an upgrade if it costs more): per tile `max(25 % × new, new − 0.7 × old)` money and mat. Downgrades only by bulldozing. «Улучшить улицу» in the inspector upgrades the whole connected segment of one class (cost summed, one confirm).

### 6.5 Traffic model (spatial, cached, cheap)
- Trips deposited at a building's access tile: homes `residents × 0.5 × (1 − transitShare)`, workplaces `jobs × staffing × 0.3`; ×1.1 with «Плотная застройка», ×0.8 with Автономный транспорт, −15 % with Умный город.
- `transitShare` per home = metro (0.35/0.40/0.45 inside a working station's radius) + the access avenue's transit share, max 0.6.
- Each building spreads its trips over the road tiles within 6 steps of its access tile (BFS capped at 85 tiles, cached): `load(t) += T_b × 10 / N_b`. `ρ(t) = load / capacity` (×0.8 capacity on level crossings). Recomputed for changed buildings on structural change and once per year.
- Effects at the access tile: workplaces `× 1/(1 + 0.4·max(0, ρ − 1))`; homes `−min(15, 15·max(0, ρ − 1))` happiness.
- Visible: overlay green < 0.7 < yellow < 1.0 < red; cars per tile `round(min(1.5, ρ) × lanes × 1.2)` within a vehicle budget (phones 60, desktop 150); badge «Пробки: −6 к довольству в 40 домах».

---

## 7. Transport and the other era verbs

### 7.1 Port (Порт) — e1500, Мореплавание
- Unique, 3×2 on rows 58–59 (pier into the sea). Levels Гавань (e1500) → Паровой порт (e1800) → Контейнерный терминал (e2000). Trade capacity 105/205/734 (×1.5 in the deep bay), visitors 600/2.5K/8K, all imports −10/−15/−20 %.
- **Trade orders (the e1500 verb):** order slots 2/3/4 by port level; while a slot is free a new order arrives every `6 / slots` years; it expires after 12 years. Good = deterministic `hash(order number)` among goods the city produces (food always; materials or goods once produced). Quantity `round(0.5 × portTrade × (0.6 + 0.8·hash))`, reward = quantity × export price × 2.0. The card on the port: «Заказ: 120 ▦ стройматериалов → 360 ƒ · 9 лет». Tap «Отгрузить» when in stock; open orders reserve stock from auto-export. The e1800 gate needs 4 delivered orders.
- Visuals: rowing boats → sailing ships → steamers → container ships.

### 7.2 Railway (Железная дорога) — e1800, Железные дороги
- **Track** is drawn like roads, one tile wide, on its own surface layer; it must connect to a **tunnel portal** at the mountain foot (start x 46; L3 x 22; R3 x 77). It may cross a road at a level crossing (shared tile, road capacity ×0.8, gates and bells). No overpasses.
- Track levels (whole network upgrades together at the trade-in rule): Паровая 6K/tile (e1800) → Электрифицированная 16K (e1900) → Скоростная 40K (e2000) → Маглев 100K (e2100). Upkeep 1 %/year of the price per tile.
- **Station (Вокзал)** 4×2, **rotatable** (`rot` 0 = long side east–west, 1 = north–south); a straight track run of ≥ 4 tiles must lie along one long side and be connected to a portal. Levels Вокзал (e1800) → Центральный вокзал (e1900) → Маглев-терминал (e2100): trade 838/1.6K/6.2K, visitors 2.5K/8K/25K. The best 3 stations count. **Through-line** (track joining two portals): station trade ×1.5, visitors ×1.2. Freight: goods export +10 % × min(1, 0.35 × stations).
- Visuals: a passenger and a freight train per station every 2 game years, out of the tunnel mouth; locomotive by track level.

### 7.3 Metro (Метро) — e1900, Метрополитен
- **Entrance** 1×1, placed **on an existing road tile** (a sidewalk pavilion; the road keeps working). It lives in the underground occupancy layer, so a full surface never blocks it. At most one per 12 road tiles; not within 3 tiles of another entrance.
- **Lines:** in Metro mode (x-ray view) tap «Новая линия», pick one of 6 colours, tap stations in order. Tunnels follow the Manhattan L-path between consecutive stations (toggle the bend), cost 12K per new tunnel tile, upkeep 60/tile/year. A station works on a line with ≥ 2 stations; a station on two lines is a transfer.
- Station levels Станция метро (e1900) → Станция-пересадка (e2000) → Смарт-хаб (e2100): radius r5/r6/r7, homes inside: car trips −35/−40/−45 %, +6/+7/+8 happiness, the transit need is met, fares §4.6. Capacity 4 000 riders per station; above that the effect scales by 4 000/riders.

### 7.4 Airport (Аэропорт) — e2000, Авиация
- Unique, 12×4, only on the reserved plot (§5.4), needs a road connection. Levels Аэропорт (e2000) → Аэрохаб (e2100): trade 8.3K/16K, visitors 40K/100K, goods export +15/+25 %, noise −8 within 4 tiles.
- **Flight routes (the e2000 verb):** slots 2 (L1) / 4 (L2). Opening costs 400K (slots 1–2) or 1.2M (slots 3–4); upkeep 12K per route per year (30K once the airport is L2). Types: **Туристический** +15 000 visitor capacity · **Грузовой** +2 500 trade capacity and goods +10 % · **Деловой** tax +3 %. Changing a type = close (no refund) and reopen. The e2100 gate needs 2 open routes.
- Visuals: a landing or take-off every 6 game years (L1) / 2 years (L2); planes approach over the sea.

### 7.5 District charters (e1000 verb) and smart programs (e2100 verb)
- **Управа района (district_hall)** 1×1, needs Самоуправление. On placement the player picks a charter for its radius (r6–r8); changing it costs 10 % of the hall's list price. **Ремесленная:** industry in radius +15 % output. **Торговая:** homes in radius +8 % tax, markets in radius +15 % trade capacity. **Зелёная:** pollution in radius −50 %, homes +4 happiness. **Наследия** (from e1500): attraction in radius ×1.5. The e1500 gate needs one hall with a charter.
- **Умные программы** (Умный город): at most 3 active, each costs 1.5 % of gross income per year, toggle any time: **Городская ОС** tax +4 % · **Автономный транспорт** car trips −20 % · **Чистый воздух** pollution −30 %, +2 happiness · **Умная сеть** power supply +15 %.

---

## 8. Building roster

### 8.1 What each era unlocks (`*` = new model)
| Era | Levels that open |
|---|---|
| e0 | town_center L1–2, house L1–2, farm L1, fishery L1, lumber L1, quarry L1, market L1, storehouse L1, well L1–2, school L1, temple L1, theater L1, park L1 |
| e1000 | town_center L3, house L3–4, manor L1, farm L2, fishery L2, lumber L2, quarry L2, mine L1, kiln L1, smithy L1, market L2, storehouse L2, clinic L1, school L2, temple L2, district_hall L1 |
| e1500 | town_center L4, house L5, manor L2, farm L3, mine L2, smithy L2, glassworks L1, market L3, storehouse L3, clinic L2, school L3, temple L3, theater L2, park L2, district_hall L2, architect_bureau L1, windmill L1, port L1* |
| e1800 | town_center L5, house L6–7, block L1, manor L3, fishery L3, lumber L3, quarry L3, mine L3, coal_mine L1, kiln L2, steel_mill L1, smithy L3, glassworks L2, market L4, storehouse L4, well L3, clinic L3, school L4, theater L3, park L3, port L2*, rail_station L1*, avenue a1, track 1 |
| e1900 | town_center L6, house L8, block L2, manor L4, farm L4, lumber L4, quarry L4, mine L4, coal_mine L2, oil_well L1, kiln L3, steel_mill L2, cement_plant L1, smithy L4, glassworks L3, market L5, well L4, clinic L4, school L5, theater L4, park L4, district_hall L3, architect_bureau L2, windmill L2, power_plant L1, rail_station L2*, metro_station L1* |
| e2000 | town_center L7, house L9–10, block L3–4, skyscraper L1, manor L5, farm L5, coal_mine L3, oil_well L2, steel_mill L3, cement_plant L2, chemical_plant L1, electronics_fab L1, market L6, storehouse L5, well L5, clinic L5, school L6, theater L5, district_hall L4, power_plant L2, port L3*, metro_station L2*, airport L1* |
| e2100 | town_center L8, house L11, block L5, skyscraper L2, manor L6, farm L6, fishery L4, vertical_farm L1, lumber L5, quarry L5, mine L5, oil_well L3, steel_mill L4, cement_plant L3, composites_plant L1, smithy L5, glassworks L4, chemical_plant L2, electronics_fab L2, market L7, storehouse L6, school L7, theater L6, park L5, district_hall L5, architect_bureau L3, data_center L1, windmill L3, power_plant L3, solar_farm L1, rail_station L3*, metro_station L3*, airport L2* |

**Totals:** 35 reused v2 buildings with 148 levels (every reused level keeps the model of the same level number in the same file) + 4 new buildings with **11 new models** (port ×3, rail_station ×3, metro_station ×3, airport ×2). Roads (11 cross-sections), track (4 looks), portals, junction pieces and decor are procedural. **Removed:** ai_foundry, antimatter_collider, electrolyzer, fusion_reactor, nanofab, spaceport, every level after e2100, the `road` levels 8–9, eras e2300/e2500/e3000. `lumber` becomes a tree plantation («Лесхоз», L1 renamed «Делянка»): no map trees exist. `architect_bureau` keeps its cosmetic blueprints (styles).

### 8.2 Full roster (generated by the sim; copy into `buildings/*.json`)
Legend: H housing · tier = need tier (§4.7) · J jobs · food/mat/goods/fuel `+` made, `−` used per year · trade = trade capacity per year · store = storage · visitors = visitor capacity · attr = attraction · ☺ aura (happiness within r) · ⚡+ supply / ⚡− use · ☠ pollution within r · tech = discovery that unlocks the level · build in game seconds · `jobs` class after the size.

**town_center** — Ратуша · 2×2 · land · jobs svc · unique

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Шатёр вождя | 0 + 0 | 0 | 0 | H 8, trade 6, store 1.2K, visitors 10, ☺+6 r4 |
| 2 | e0 | Дом вождя | 400 + 24 | 25 | 0 | H 12, trade 10, store 2.0K, visitors 20, ☺+7 r5 |
| 3 | e1000 | Ратуша | 2.4K + 140 | 75 | 0 | H 18, trade 25, store 4.8K, visitors 60, ☺+8 r5 |
| 4 | e1500 | Дворец | 22K + 1.3K | 125 | 0 | H 25, trade 80, store 12K, attr 2, visitors 200, ☺+10 r6 |
| 5 | e1800 | Городская управа | 150K + 9.0K | 175 | 0 | H 35, trade 250, store 32K, attr 3, visitors 600, ☺+10 r6 |
| 6 | e1900 | Мэрия | 800K + 48K | 225 | 0 | H 50, trade 600, store 80K, attr 4, visitors 2.0K, ☺+12 r7, ⚡−5 |
| 7 | e2000 | Сити-холл | 3.50M + 210K | 275 | 0 | H 70, trade 1.4K, store 200K, attr 6, visitors 6.0K, ☺+12 r7, ⚡−10 |
| 8 | e2100 | Цифровая мэрия | 18M + 1.10M | 325 | 0 | H 100, trade 3.0K, store 480K, attr 8, visitors 15K, ☺+14 r8, ⚡−15 |

**house** — Жилой дом · 1×1 · land · jobs com

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Шалаш | 28 + 2.2 | 5 | 0 | H 4 |
| 2 | e0 | Глинобитный дом | 48 + 3.8 | 7 | 0 | H 6, tier 1, tech masonry |
| 3 | e1000 | Изба | 220 + 18 | 9 | 0 | H 10, tier 2 |
| 4 | e1000 | Каменный дом | 360 + 29 | 12 | 0 | H 14, tier 3, tech brickmaking |
| 5 | e1500 | Фахверковый дом | 1.7K + 140 | 15 | 0 | H 20, tier 4 |
| 6 | e1800 | Кирпичный дом | 7.8K + 620 | 20 | 0 | H 30, tier 5 |
| 7 | e1800 | Доходный дом | 13K + 1.0K | 25 | 0 | H 42, tier 6 |
| 8 | e1900 | Многоэтажка | 42K + 3.4K | 30 | 0 | H 70, tier 7, ⚡−1.5, tech reinforced_concrete |
| 9 | e2000 | Высотка | 150K + 12K | 40 | 0 | H 110, tier 8, ⚡−2.5 |
| 10 | e2000 | Небоскрёб | 260K + 21K | 50 | 0 | H 160, tier 9, ⚡−3.5, tech highrise |
| 11 | e2100 | Эко-башня | 570K + 46K | 55 | 0 | H 230, tier 10, ☺+3 r1, ⚡−4 |

**block** — Жилой квартал · 2×2 · land · jobs com

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1800 | Рабочие бараки | 24K + 1.9K | 20 | 0 | H 110, tier 5, ☺-3 r1 |
| 2 | e1900 | Доходный квартал | 120K + 9.6K | 30 | 0 | H 230, tier 7, ⚡−3, tech reinforced_concrete |
| 3 | e2000 | Панельный дом | 450K + 36K | 35 | 0 | H 380, tier 8, ☺-2 r1, ⚡−6 |
| 4 | e2000 | Жилой комплекс | 740K + 59K | 45 | 0 | H 540, tier 9, ☺+3 r2, ⚡−9, tech highrise |
| 5 | e2100 | Модульный квартал | 1.60M + 130K | 50 | 0 | H 760, tier 10, ⚡−12 |

**skyscraper** — Башня · 2×2 · land · jobs com

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2000 | Башня арт-деко | 1.30M + 100K | 60 | 0 | H 900, tier 9, J 150, ☺+2 r2, ⚡−16, tech highrise |
| 2 | e2100 | Стеклянная башня | 3.40M + 270K | 70 | 0 | H 1300, tier 10, J 220, ☺+3 r2, ⚡−22 |

**manor** — Усадьба · 2×2 · land/beach · jobs com · tax ×3

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1000 | Усадьба | 780 + 62 | 15 | 0 | H 10, tier 2, attr 0.5, ☺+6 r3 |
| 2 | e1500 | Палаццо | 4.8K + 380 | 20 | 0 | H 16, tier 4, attr 1, ☺+8 r4 |
| 3 | e1800 | Особняк | 22K + 1.8K | 25 | 0 | H 24, tier 5, attr 1, ☺+10 r4 |
| 4 | e1900 | Вилла модерн | 67K + 5.4K | 30 | 0 | H 32, tier 7, attr 1.5, ☺+12 r5, ⚡−2 |
| 5 | e2000 | Пентхаус-комплекс | 230K + 18K | 40 | 0 | H 48, tier 9, attr 1.5, ☺+14 r5, ⚡−4 |
| 6 | e2100 | Эко-поместье | 550K + 44K | 45 | 0 | H 64, tier 10, attr 2, ☺+16 r6, ⚡−5 |

**farm** — Ферма · 2×2 · land · jobs food

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Поле | 240 + 12 | 6 | 0.5 | J 4, food +28 |
| 2 | e1000 | Ферма с амбаром | 770 + 39 | 10 | 2.3 | J 8, food +53, tech three_field |
| 3 | e1500 | Мельничная ферма | 2.9K + 150 | 14 | 11 | J 16, food +107 |
| 4 | e1900 | Механизированная ферма | 21K + 1.1K | 25 | 113 | J 60, food +377, ⚡−2, tech combustion |
| 5 | e2000 | Агрохолдинг | 48K + 2.4K | 35 | 288 | J 104, food +720, ⚡−4 |
| 6 | e2100 | Гидропоника | 85K + 4.3K | 40 | 510 | J 160, food +1.1K, ⚡−8, tech hydroponics |

**fishery** — Рыбный промысел · 1×1 · coast · jobs food

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Хижина рыбака | 120 + 6 | 5 | 0.3 | J 2, food +16 |
| 2 | e1000 | Причал | 380 + 19 | 8 | 1.1 | J 4, food +30 |
| 3 | e1800 | Рыбный порт | 4.5K + 230 | 20 | 22 | J 16, food +119, ☠2 r1 |
| 4 | e2100 | Акваферма | 42K + 2.1K | 40 | 252 | J 80, food +614, ⚡−4, tech hydroponics |

**vertical_farm** — Вертикальная ферма · 2×2 · land · jobs food

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2100 | Вертикальная ферма | 170K + 8.5K | 50 | 1.0K | J 160, food +2.4K, ⚡−15, tech hydroponics |

**lumber** — Лесхоз · 1×1 · land · jobs raw

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Делянка | 100 + 4 | 5 | 0.3 | J 3, mat +3.4 |
| 2 | e1000 | Лесопилка | 320 + 13 | 8 | 1.3 | J 6, mat +6.7 |
| 3 | e1800 | Паровая лесопилка | 3.7K + 150 | 18 | 24 | J 24, mat +30, ☠3 r2 |
| 4 | e1900 | Деревокомбинат | 8.6K + 340 | 25 | 62 | J 45, mat +56, ⚡−3, ☠4 r2 |
| 5 | e2100 | Лесная ферма | 35K + 1.4K | 40 | 280 | J 120, mat +189, ☺+2 r2, ⚡−5 |

**quarry** — Каменоломня · 2×2 · mountain foot · jobs raw

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Каменоломня | 200 + 8 | 8 | 0.6 | J 4, mat +11 |
| 2 | e1000 | Карьер | 640 + 26 | 12 | 2.6 | J 8, mat +21 |
| 3 | e1800 | Динамитный карьер | 7.4K + 300 | 20 | 47 | J 32, mat +84, ☠6 r3 |
| 4 | e1900 | Экскаваторный карьер | 17K + 680 | 30 | 122 | J 60, mat +149, ⚡−3, ☠8 r3 |
| 5 | e2100 | Роботизированный карьер | 71K + 2.8K | 45 | 568 | J 160, mat +477, ⚡−8, ☠4 r2 |

**mine** — Рудник · 2×2 · mountain foot · jobs raw · deposit: ore

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1000 | Железный рудник | 1.2K + 48 | 12 | 4.8 | J 12, mat +38, tech metallurgy |
| 2 | e1500 | Шахта | 4.4K + 180 | 15 | 23 | J 24, mat +75 |
| 3 | e1800 | Паровая шахта | 13K + 520 | 20 | 83 | J 48, mat +143, ☠6 r3 |
| 4 | e1900 | Глубокая шахта | 31K + 1.2K | 30 | 223 | J 90, mat +263, ⚡−4, ☠7 r3 |
| 5 | e2100 | Автошахта | 130K + 5.2K | 45 | 1.0K | J 240, mat +839, ⚡−10, ☠4 r2 |

**coal_mine** — Угольная шахта · 2×2 · mountain foot · jobs raw · deposit: coal

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1800 | Угольная шахта | 18K + 720 | 20 | 115 | J 48, fuel +178, ☠8 r3, tech steam_engine |
| 2 | e1900 | Механизированная шахта | 41K + 1.6K | 30 | 295 | J 90, fuel +318, ⚡−3, ☠10 r3 |
| 3 | e2000 | Угольный разрез | 96K + 3.8K | 40 | 768 | J 156, fuel +645, ⚡−5, ☠12 r4 |

**oil_well** — Нефтяная вышка · 1×1 · coast · jobs raw · deposit: oil

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1900 | Нефтяная вышка | 34K + 1.4K | 25 | 245 | J 75, fuel +281, ☠6 r2, tech combustion |
| 2 | e2000 | Насосная станция | 80K + 3.2K | 35 | 640 | J 130, fuel +566, ⚡−3, ☠6 r2 |
| 3 | e2100 | Глубоководная платформа | 140K + 5.6K | 45 | 1.1K | J 200, fuel +892, ⚡−5, ☠5 r2 |

**kiln** — Кирпичный завод · 1×1 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1000 | Печь обжига | 770 + 39 | 10 | 3.1 | J 8, mat +21, ☠3 r1, tech brickmaking |
| 2 | e1800 | Кирпичный завод | 8.9K + 450 | 18 | 57 | J 32, mat +86, ☠6 r2 |
| 3 | e1900 | Керамический комбинат | 21K + 1.1K | 28 | 151 | J 60, mat +161, ⚡−5, ☠5 r2 |

**steel_mill** — Сталелитейный завод · 2×2 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1800 | Литейная | 37K + 1.9K | 20 | 237 | J 64, mat +571, fuel −114, ☠10 r3, tech steelmaking |
| 2 | e1900 | Мартеновский завод | 86K + 4.3K | 30 | 619 | J 120, mat +1.0K, fuel −202, ⚡−4, ☠12 r3 |
| 3 | e2000 | Электросталь | 200K + 10K | 40 | 1.6K | J 208, mat +1.7K, fuel −83, ⚡−20, ☠8 r3 |
| 4 | e2100 | Фабрика сплавов | 350K + 18K | 50 | 2.8K | J 320, mat +2.6K, fuel −131, ⚡−30, ☠4 r2 |

**cement_plant** — Цементный завод · 2×2 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1900 | Цементный завод | 100K + 5.0K | 28 | 720 | J 120, mat +1.2K, fuel −235, ☠10 r3, tech reinforced_concrete |
| 2 | e2000 | Бетонный комбинат | 240K + 12K | 38 | 1.9K | J 208, mat +2.4K, fuel −471, ⚡−8, ☠10 r3 |
| 3 | e2100 | Геополимерный завод | 420K + 21K | 45 | 3.4K | J 320, mat +3.2K, fuel −158, ⚡−14, ☠4 r2 |

**composites_plant** — Завод композитов · 2×2 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2100 | Композитный завод | 850K + 43K | 50 | 6.8K | J 320, mat +7.3K, fuel −1.1K, ⚡−15, ☠3 r1, tech robotics |

**smithy** — Мастерская · 1×1 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1000 | Кузница | 1.0K + 50 | 10 | 4 | J 10, goods +21, ☠2 r1, tech metallurgy |
| 2 | e1500 | Мастерская | 3.9K + 200 | 14 | 20 | J 20, goods +42, ☠3 r1 |
| 3 | e1800 | Инструментальный завод | 12K + 600 | 20 | 77 | J 40, goods +80, ☠6 r2 |
| 4 | e1900 | Машзавод | 27K + 1.4K | 30 | 194 | J 75, goods +134, ⚡−6, ☠6 r2 |
| 5 | e2100 | Робофабрика | 110K + 5.5K | 45 | 880 | J 200, goods +394, ⚡−12, ☠2 r1 |

**glassworks** — Стекольный завод · 2×2 · land/beach · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1500 | Стеклодувня | 11K + 550 | 14 | 57 | J 40, goods +125, ☠3 r1, tech glassblowing |
| 2 | e1800 | Стекольный завод | 33K + 1.7K | 20 | 211 | J 80, goods +232, ☠5 r2 |
| 3 | e1900 | Флоат-завод | 75K + 3.8K | 30 | 540 | J 150, goods +387, ⚡−6, ☠5 r2 |
| 4 | e2100 | Завод умного стекла | 310K + 16K | 45 | 2.5K | J 400, goods +1.2K, ⚡−14 |

**chemical_plant** — Химический завод · 2×2 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2000 | Нефтехимзавод | 480K + 24K | 40 | 3.8K | J 260, goods +2.9K, fuel −2.1K, ⚡−10, ☠12 r3, tech semiconductors |
| 2 | e2100 | Биопластиковый завод | 850K + 43K | 45 | 6.8K | J 400, goods +4.2K, food −6.3K, ⚡−14, ☠2 r1 |

**electronics_fab** — Завод электроники · 2×2 · land · jobs ind

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2000 | Завод электроники | 720K + 36K | 45 | 5.8K | J 312, goods +3.2K, ⚡−15, tech semiconductors |
| 2 | e2100 | Чиповая фабрика | 1.30M + 65K | 50 | 10K | J 480, goods +5.1K, ⚡−30 |

**market** — Рынок · 2×2 · land · jobs com

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Агора | 320 + 16 | 10 | 0.9 | J 4, trade 9.9, ☺+4 r3 |
| 2 | e1000 | Ярмарка | 1.0K + 50 | 14 | 4 | J 8, trade 19, attr 0.5, ☺+5 r4 |
| 3 | e1500 | Торговый дом | 3.9K + 200 | 18 | 20 | J 16, trade 41, attr 1, ☺+6 r4 |
| 4 | e1800 | Биржа | 12K + 600 | 25 | 77 | J 32, trade 86, attr 1, ☺+6 r4 |
| 5 | e1900 | Универмаг | 27K + 1.4K | 30 | 194 | J 60, trade 155, attr 2, ☺+8 r5, ⚡−4 |
| 6 | e2000 | Торговый центр | 64K + 3.2K | 40 | 512 | J 104, trade 324, attr 3, ☺+10 r5, ⚡−10 |
| 7 | e2100 | Голо-молл | 110K + 5.5K | 50 | 880 | J 160, trade 513, attr 4, ☺+12 r6, ⚡−18 |

**storehouse** — Склад · 1×1 · land/beach · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Амбар | 160 + 8 | 6 | 0.3 | J 1, store 1.6K |
| 2 | e1000 | Склад | 510 + 26 | 9 | 1.5 | J 2, store 4.8K |
| 3 | e1500 | Пакгауз | 1.9K + 95 | 12 | 7.4 | J 4, store 12K |
| 4 | e1800 | Товарный склад | 5.9K + 300 | 18 | 28 | J 8, store 32K |
| 5 | e2000 | Логистический центр | 32K + 1.6K | 30 | 192 | J 26, store 120K, ⚡−3 |
| 6 | e2100 | Автосклад | 56K + 2.8K | 40 | 336 | J 40, store 280K, ⚡−6 |

**well** — Колодец · 1×1 · land · jobs svc · covers water

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Колодец | 120 + 6 | 5 | 0.6 | water r3 |
| 2 | e0 | Акведук | 360 + 18 | 10 | 1.6 | J 1, water r4, tech masonry |
| 3 | e1800 | Водокачка | 4.5K + 230 | 15 | 47 | J 8, water r6 |
| 4 | e1900 | Водопровод | 10K + 500 | 20 | 117 | J 15, water r8, ⚡−2 |
| 5 | e2000 | Водоочистная станция | 24K + 1.2K | 30 | 312 | J 26, water r10, ⚡−6 |

**clinic** — Лечебница · 1×1 · land · jobs svc · covers health

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1000 | Знахарь | 510 + 26 | 8 | 3.3 | J 4, health r3 |
| 2 | e1500 | Лазарет | 1.9K + 95 | 14 | 16 | J 8, health r4 |
| 3 | e1800 | Больница | 5.9K + 300 | 20 | 61 | J 16, health r6 |
| 4 | e1900 | Поликлиника | 14K + 700 | 26 | 164 | J 30, health r7, ⚡−3 |
| 5 | e2000 | Медцентр | 32K + 1.6K | 36 | 416 | J 52, health r9, ⚡−8 |

**school** — Школа · 2×2 · land · jobs svc · covers education

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Школа философов | 480 + 24 | 12 | 2.2 | J 3, education r4, research +15%, tech writing |
| 2 | e1000 | Монастырская школа | 1.5K + 75 | 16 | 9.8 | J 6, education r5, research +20% |
| 3 | e1500 | Университет | 5.8K + 290 | 22 | 49 | J 12, education r6, research +30%, attr 1, tech printing |
| 4 | e1800 | Академия наук | 18K + 900 | 28 | 187 | J 24, education r7, research +40%, attr 1, tech public_education |
| 5 | e1900 | НИИ | 41K + 2.1K | 32 | 480 | J 45, education r8, research +55%, ⚡−5 |
| 6 | e2000 | Технопарк | 96K + 4.8K | 42 | 1.2K | J 78, education r9, research +70%, ⚡−12, tech computers |
| 7 | e2100 | Лаборатория будущего | 170K + 8.5K | 50 | 2.2K | J 120, education r10, research +90%, ⚡−18 |

**temple** — Храм · 2×2 · land · jobs svc · covers leisure

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Святилище | 360 + 18 | 10 | 1.6 | J 2, leisure r4, attr 1 |
| 2 | e1000 | Церковь | 1.2K + 60 | 16 | 7.8 | J 4, leisure r5, attr 2 |
| 3 | e1500 | Собор | 6.5K + 330 | 30 | 55 | J 8, leisure r7, attr 5 |

**theater** — Театр · 2×2 · land/beach · jobs svc · covers leisure

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Амфитеатр | 600 + 30 | 14 | 2.7 | J 3, leisure r4, attr 1, needs Town Hall L2 |
| 2 | e1500 | Театр | 7.3K + 370 | 18 | 62 | J 12, leisure r5, attr 2 |
| 3 | e1800 | Опера | 22K + 1.1K | 25 | 229 | J 24, leisure r6, attr 4 |
| 4 | e1900 | Кинотеатр | 51K + 2.6K | 28 | 597 | J 45, leisure r6, attr 4, ⚡−4 |
| 5 | e2000 | Мультиплекс | 120K + 6.0K | 38 | 1.6K | J 78, leisure r7, attr 6, ⚡−10 |
| 6 | e2100 | Голотеатр | 210K + 11K | 45 | 2.7K | J 120, leisure r8, attr 8, ⚡−16 |

**park** — Парк · 1×1 · land/beach · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e0 | Роща | 48 + 2.4 | 4 | 0.2 | ☺+4 r2 |
| 2 | e1500 | Сад | 580 + 29 | 8 | 4.9 | ☺+6 r3 |
| 3 | e1800 | Парк | 1.8K + 90 | 10 | 19 | attr 0.3, ☺+8 r3 |
| 4 | e1900 | Сквер с фонтаном | 4.1K + 210 | 14 | 48 | attr 0.5, ☺+10 r4, ⚡−1 |
| 5 | e2100 | Эко-парк | 17K + 850 | 25 | 221 | attr 1, ☺+12 r5, ⚡−2 |

**district_hall** — Управа района · 1×1 · land · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1000 | Сельская управа | 960 + 48 | 10 | 3.8 | J 4, charter r6, tech self_government |
| 2 | e1500 | Управа | 3.6K + 180 | 14 | 19 | J 8, charter r7 |
| 3 | e1900 | Префектура | 26K + 1.3K | 20 | 187 | J 30, charter r7, ⚡−2 |
| 4 | e2000 | Мэрия округа | 60K + 3.0K | 28 | 480 | J 52, charter r8, ⚡−5 |
| 5 | e2100 | Цифровой хаб | 110K + 5.5K | 35 | 880 | J 80, charter r8, ⚡−8 |

**architect_bureau** — Бюро архитекторов · 2×2 · land · jobs svc · unique

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1500 | Мастерская зодчего | 9.7K + 490 | 20 | 50 | J 8, attr 1 |
| 2 | e1900 | Архитектурное бюро | 69K + 3.5K | 30 | 497 | J 30, attr 2, ⚡−2 |
| 3 | e2100 | 3D-студия | 280K + 14K | 45 | 2.2K | J 80, attr 3, ⚡−8 |

**data_center** — Дата-центр · 2×2 · land · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2100 | Дата-центр | 1.10M + 55K | 45 | 8.8K | J 240, data r10, tax +5% in range, research +30%, ⚡−30, tech smart_city |

**windmill** — Ветряк · 1×1 · land/beach · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1500 | Ветряная мельница | 2.9K + 150 | 12 | 15 | J 4, farms +25% r3 |
| 2 | e1900 | Ветрогенератор | 21K + 1.1K | 20 | 151 | J 15, ⚡+12, tech electricity |
| 3 | e2100 | Ветропарк | 85K + 4.3K | 30 | 680 | J 40, ⚡+40, tech solar_power |

**power_plant** — Электростанция · 2×2 · land · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1900 | Угольная электростанция | 210K + 11K | 35 | 2.3K | J 90, fuel −200, ⚡+80, ☠15 r4, tech electricity |
| 2 | e2000 | ТЭЦ | 480K + 24K | 45 | 5.8K | J 156, fuel −300, ⚡+200, ☠12 r4 |
| 3 | e2100 | Газотурбинная | 850K + 43K | 50 | 10K | J 240, fuel −400, ⚡+400, ☠8 r3 |

**solar_farm** — Солнечная ферма · 2×2 · land/beach · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2100 | Солнечная ферма | 640K + 32K | 40 | 5.1K | J 40, ⚡+150, tech solar_power |

**port** — Порт · 3×2 · coast · jobs svc · unique

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1500 | **NEW** Гавань | 7.3K + 370 | 25 | 38 | J 24, trade 105, visitors 600, imports −10%, ☠1 r1, tech navigation |
| 2 | e1800 | **NEW** Паровой порт | 22K + 1.1K | 35 | 141 | J 48, trade 205, visitors 2.5K, imports −15%, ☠4 r2 |
| 3 | e2000 | **NEW** Контейнерный терминал | 120K + 6.0K | 50 | 960 | J 156, trade 734, visitors 8.0K, imports −20%, ⚡−10, ☠4 r2 |

**rail_station** — Вокзал · 4×2 · land · jobs svc · rotatable

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1800 | **NEW** Вокзал | 100K + 5.0K | 40 | 640 | J 80, trade 838, visitors 2.5K, tech railways |
| 2 | e1900 | **NEW** Центральный вокзал | 240K + 12K | 50 | 1.7K | J 150, trade 1.6K, visitors 8.0K, ⚡−6 |
| 3 | e2100 | **NEW** Маглев-терминал | 1.20M + 60K | 70 | 9.6K | J 400, trade 6.2K, visitors 25K, ⚡−20 |

**metro_station** — Станция метро · 1×1 · on a road tile · jobs svc

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e1900 | **NEW** Станция метро | 150K + 7.5K | 30 | 1.1K | J 30, metro r5, trips −35%, ☺+6, ⚡−3, tech subway |
| 2 | e2000 | **NEW** Станция-пересадка | 360K + 18K | 35 | 2.9K | J 52, metro r6, trips −40%, ☺+7, ⚡−5 |
| 3 | e2100 | **NEW** Смарт-хаб | 640K + 32K | 40 | 5.1K | J 80, metro r7, trips −45%, ☺+8, ⚡−8 |

**airport** — Аэропорт · 12×4 · airport plot · jobs svc · unique

| L | era | name | money + mat | build s | upkeep/yr | effects (per year) |
|---|---|---|---:|---:|---:|---|
| 1 | e2000 | **NEW** Аэропорт | 2M + 100K | 90 | 16K | J 520, trade 8.3K, visitors 40K, goods price +15%, ⚡−20, tech aviation |
| 2 | e2100 | **NEW** Аэрохаб | 4.10M + 210K | 120 | 33K | J 800, trade 16K, visitors 100K, goods price +25%, ⚡−35 |


---

## 9. Research, goals, achievements, events

### 9.1 Discoveries (Открытия): 28, 4 per era, paid in money
- One at a time; time in game seconds ÷ research speed, `speed = 1 + min(1.5, Σ school research % + discovery research %)`. Only the current era's and older discoveries are available. A gate needs any 3 of the era's 4 (two are implied by the gate items, §2.2). Spirit of the Age discounts them (§2.2). UI: a 7-column timeline of 4 cards; each card names one effect and what it unlocks.

| era | id | name | cost | time s | effect | unlocks |
|---|---|---|---:|---:|---|---|
| e0 | agriculture | Земледелие | 190 | 32 | food +25 % | — |
| e0 | masonry | Каменная кладка | 240 | 40 | mat +20 % | house L2, well L2 |
| e0 | writing | Письменность | 290 | 44 | research +10 % | school L1 |
| e0 | coinage | Чеканка монет | 340 | 52 | tax +10 %, trade +20 % | — |
| e1000 | three_field | Трёхполье | 960 | 56 | food +25 % | farm L2 |
| e1000 | metallurgy | Металлургия | 1.2K | 70 | — | mine L1, smithy L1 |
| e1000 | self_government | Самоуправление | 1.4K | 77 | tax +5 % | district_hall L1 |
| e1000 | brickmaking | Обжиг кирпича | 1.7K | 91 | — | kiln L1, house L4 |
| e1500 | printing | Книгопечатание | 5.8K | 80 | research +25 % | school L3 |
| e1500 | navigation | Мореплавание | 7.2K | 100 | trade +25 % | port L1 |
| e1500 | banking | Банковское дело | 8.6K | 110 | tax +10 % | — |
| e1500 | glassblowing | Стеклоделие | 10K | 130 | — | glassworks L1 |
| e1800 | steam_engine | Паровая машина | 38K | 104 | production +10 % | coal_mine L1 |
| e1800 | steelmaking | Сталеварение | 48K | 130 | — | steel_mill L1, avenue a1 |
| e1800 | railways | Железные дороги | 58K | 143 | — | rail_station L1, track |
| e1800 | public_education | Всеобщее образование | 67K | 169 | research +15 %, happiness +3 | school L4 |
| e1900 | electricity | Электричество | 220K | 128 | — | power_plant L1, windmill L2 |
| e1900 | reinforced_concrete | Железобетон | 280K | 160 | — | cement_plant L1, house L8, block L2 |
| e1900 | subway | Метрополитен | 340K | 176 | — | metro_station L1 |
| e1900 | combustion | Двигатель внутреннего сгорания | 390K | 208 | production +5 % | oil_well L1, farm L4 |
| e2000 | computers | Компьютеры | 1.1M | 152 | research +25 % | school L6 |
| e2000 | highrise | Высотное строительство | 1.4M | 190 | housing +5 % | skyscraper L1, house L10, block L4 |
| e2000 | semiconductors | Полупроводники | 1.7M | 209 | — | electronics_fab L1, chemical_plant L1 |
| e2000 | aviation | Авиация | 2.0M | 247 | — | airport L1 |
| e2100 | robotics | Робототехника | 4.8M | 176 | production +20 % | composites_plant L1 |
| e2100 | solar_power | Солнечная энергетика | 6.0M | 220 | — | solar_farm L1, windmill L3 |
| e2100 | smart_city | Умный город | 7.2M | 242 | happiness +5, traffic loads −15 % | data_center L1, street s7, avenue a4, smart programs |
| e2100 | hydroponics | Гидропоника | 8.4M | 286 | — | vertical_farm L1, farm L6, fishery L4 |

### 9.2 Goals (Задачи)
- **Main quest = the gate checklist**, always pinned (next 3 open lines).
- **Story goals** (gold, one visible at a time, teach the next system; reward in money):
  - e0: «Первые очаги» 3 houses 160 · «Хлеб насущный» a farm 160 · «Камень с гор» a quarry 160 · «Деревня» 20 citizens 240 · «Агора» 240 · «Первые письмена» Письменность 240 · «Дом вождя» TH L2 400 · «Вода в каждый дом» 90 % of ≥ 10 home tiles covered by water 320
  - e1000: «Средние века» 1 200 · «Кузница» 800 · «Город» 200 citizens 1 200 · «Лекарь» a clinic 600 · «Первая грамота» a district hall 800
  - e1500: «Возрождение» 6 000 · «Гавань» 6 000 · «Университет» school L3 4 800 · «1 000 жителей» 6 000
  - e1800: «Индустриальная эра» 28 000 · «Сила пара» 6 smithies/glassworks/steel mills 20 000 · «Первый вокзал» 32 000 · «4 000 жителей» 28 000
  - e1900: «Модерн» 120 000 · «Да будет свет» power supply > 0 100 000 · «Первая линия метро» 2 stations 120 000 · «12 000 жителей» 120 000
  - e2000: «Современность» 480 000 · «Аэропорт» 600 000 · «30 000 жителей» 480 000
  - e2100: «Ближнее будущее» 1 600 000
- **Side goals:** always 2 on screen, generated from templates against the city's state («Накройте водой 90 % домов», «Улучшите 5 домов до «Каменного дома»», «Продайте 200 товаров», «Доставьте 3 заказа», «Довольство 70 на 10 лет»); reward 0.5 × gross/year; refresh every 10 years. Not simulated (≈ +2 % of income).

### 9.3 Achievements (Достижения): 16, +250 score each
Опередить историю (★★★ in any era) · Золотая летопись (all 18 stars) · Летописец (all 28 discoveries) · Наследие (10 Heritage buildings) · Гавань мира (container terminal in the deep bay) · Стальной путь (a through-line between two portals) · Подземка (4 metro lines with ≥ 2 stations each) · Окно в мир (Aerohub) · Весь берег (all 14 strips) · Мегаполис (100 000 citizens) · Без пробок (whole network ρ < 0.8 with 50 000 citizens) · Чистое небо (no home with pollution ≥ 2 with 50 000 citizens) · Самодостаточный (no imports for 20 years in e2100) · Город-сад (happiness ≥ 90 for 10 years) · Век за веком (reach year 1000) · Без недоимок (never in arrears). The sim reaches 10–11 of 16 in a 7-hour game.

### 9.4 Random events
- One every 8 ± 2 years, first at year 15. **Deterministic:** the event of calendar year Y is `hash(Y)` over the current era's list, so every player meets the same caravan in the same year. None offline. Values are sized in years of gross (≈ 1–3 % of an era's income); not simulated (expected value ≈ +1 %).
- 50 % gifts (tap to collect), 50 % choice cards with the effect printed on each button; a choice waits in the event tray for 10 years, then the free option is taken. Every hazard names its counter-measure.

| Era | Gift | Choice | Hazard (counter-play) |
|---|---|---|---|
| e0 | Урожайный год: +1 year of food production | Караван: buy 40 ▦ at half the import price? | Засуха: farms −30 % for 4 years (water coverage ≥ 80 % halves it) |
| e1000 | Ярмарка: +1 year of export income | Монахи-переписчики: −30 % time on the current discovery for 1 year of tax? | Поветрие: −15 happiness for 4 years (−5 with health coverage ≥ 80 %) |
| e1500 | Меценат: one free temple or theatre upgrade | Торговый флот: trade capacity +50 % for 4 years for 1 year of export income? | Пожар: one wooden house (L1–L5) loses a level unless water-covered |
| e1800 | Золотая лихорадка: +1 year of tax | Забастовка: pay 1 year of industry upkeep, or industry −30 % for 2 years | Смог: −8 happiness for 4 years within r4 of industry (green charter cancels) |
| e1900 | Радиошоу о городе: tourism +50 % for 4 years | Биржевой крах: bail out (1 year of export income) or trade −30 % for 4 years | Блэкаут: power plants −50 % for 2 years (≥ 20 % power reserve ignores it) |
| e2000 | Стартап выстрелил: goods +30 % for 4 years | Фестиваль: close 10 road tiles for 1 year, +12 happiness | Жара: power use +20 % for 2 years |
| e2100 | Дроны-доставщики: traffic loads −20 % for 4 years | Хакеры: pay 1 year of program costs, or −10 happiness for 2 years | Нагон: beach buildings within 3 tiles of the sea −50 % for 2 years |

### 9.5 Advisor (Советник): one line above the Build button
The first matching rule wins; tapping the line opens the overlay or card that fixes it:
1. starving or food imports > 3 % of gross → «Город покупает еду: постройте ферму»; 2. power or fuel bought for > 8 % of gross → «Электричество покупаем у соседей: своя станция окупится за N лет»; 3. arrears/mothballed buildings → «Казна пуста: законсервировано 3 здания»; 4. upkeep > 90 % of gross for 10 years → «Содержание съедает доход: законсервируйте или снесите лишнее»; 5. homes full and a need blocks the next level → «42 дома не растут до L5: нет Образования рядом»; 6. unemployment > 6 % → workplaces; 7. workers short → homes; 8. ρ > 1.2 in many homes → road upgrade / avenue / metro; 9. an open gate line → «Для Возрождения: ещё 2 кузницы»; 10. cash idle > 8 years of gross → «Деньги лежат без дела: купите полосу или улучшите дома». In the sim, a player who ignores it is 4 % slower (§12.7).

---

## 10. Score and leaderboard

```
Score = Chronicle + City + Land + Achievements                     (money = 0 points; every term is bounded)
Chronicle    = Σ over entered eras (1 000 + max(0, round(lead_e)) + [0, 100, 300, 600][stars_e])
City         = round(20 × √peakPopulation × (0.8 + 0.4 × bestH50 / 100))
Land         = 100 × strips owned
Achievements = 250 × achievements (max 16)
```
- `bestH50` = best value of the 50-year moving average of city happiness (counted from year 50), so happiness cannot be spiked at submission. `peakPopulation` and banked Chronicle points never fall.
- Bounds: Chronicle ≤ 19.9K (6 × 1 000 + Σ H_e + 6 × 600), City ≤ ≈ 14K (full-map capacity ≈ 350K), Land ≤ 1 400, Achievements ≤ 4 000. Sim end states (2 h after entering e2100): slow 26.6K, typical 29.9K, expert 28.7K; Chronicle is 56–58 % of the score — speed against history matters most, the size and happiness of the city ≈ 30 %. Carpeting the beach with parks or theatres adds nothing.
- **Server recomputes the score** from the stored era log, peak population, best happiness, strips and achievements (§14); the client value is ignored. Plausibility: Δgame time ≤ Δwall time × 5.5 between saves; era entry years ≥ 0.6 × ★★★ threshold; peak population ≤ 1.2 × Σ housing of the stored homes; strips 0..14. Tester-flagged saves are off-board.
- Tabs: **Общий** · **Летопись** (stars, then lead) · **Эта эпоха** (players currently in the same era). Row: name, era, year, lead, star strip, score. Hub summary: era id + name, year, population, score.

---

## 11. UI surfaces (content only; layout belongs to the UI designer)

### 11.1 Always on screen
- **Money pill** (the only resource in the HUD): era face icon + value (≤ 6 chars) + net delta `+12,4K/год` (green/red). It also carries the yearly result: **no toast every year**. Tap → City sheet.
- **Alert badges** beside the pill (food import, power/fuel import, arrears, traffic, unemployment, workers short); each opens its overlay or sheet.
- **Citizens and happiness:** `4 120 / 4 300` (population / P*) and a face with %.
- **Calendar chip:** year with the year ring · era name · live lead `+1 352` (green, or amber ▼ «История догоняет»). Tap → Chronicle; long-press → lead tooltip with the last cause.
- **Speed:** ‖ ×1 ×2 ×5 (testers ×20 ×50); save status dot; menu.
- **Four thumb buttons:** Строить · Улучшить · Задачи · Город; the Advisor line above Строить; the pinned main quest (next 3 gate lines) as a compact chip.

### 11.2 Sheets and panels
- **Build sheet:** categories (Жильё, Еда, Материалы, Производство, Торговля, Услуги, Досуг, Энергия, Транспорт, Дороги); card = rendered thumbnail, name, cost line (money + ▦), one effect line («+20 жителей · нужны вода, досуг», «+28 еды/год · окупится за 9 лет»), NEW badge, lock reason («Откроется: Мореплавание»).
- **Placement:** ghost on tap, drag, ✓ / ✗, rotate (station only), the reason when invalid («Рудник ставят у подножия гор на рудную жилу», «Шум аэропорта: −8 к довольству у 3 домов»), price with imported materials.
- **Line drawing** (road, rail, metro): tap start, drag, bend toggle, live cost, ✓ / ✗; upgrade-by-redraw shows the trade-in price; one-finger pan stays possible (drawing starts only from the line tool's start tap).
- **Inspector** (building): name, level, era badge, state (строится / законсервировано / наследие), what it does now, needs for the next level (homes), Upgrade (trade-in price), Mothball/Reopen, Move, Demolish («Вернём 50 % уплаченного: 1,2K»); type extras: charter picker (district hall), order cards (port), routes (airport), lines (metro), «Улучшить улицу (12 участков)» (roads).
- **Upgrade sheet (bulk):** «Устаревшие дома в кадре: 14 → «Каменный дом», 4,9K» grouped by target level, one confirm; «Улучшить всё доступное».
- **Town Hall card:** gate checklist (≤ 4 lines with progress), Upgrade button with cost and build time, Spirit discount, policies (taxes, density), loan offer, storage cap.
- **City sheet (budget):** income per year by source (taxes, export, tourism, orders, fares) and costs by category (buildings by category, roads, rail and metro, imports of food/materials/fuel/power, routes and programs, interest) as bars; net; «Главные потери» (top 3 constraints in money per year); Рабочие руки; stocks food/mat/goods with cap and rates; fuel and power gauges; happiness breakdown; homes full vs P*.
- **Overlays:** each service (diamonds), happiness, traffic, pollution, zones and deposits (auto when placing), airport noise, metro x-ray.
- **Research timeline**, **Goals** (story, side, achievements), **Chronicle** (era rows, lead explanation, leaderboard tabs).
- **Land strip:** on-map plaque at each next strip («+ Полоса · 4,4K · бухта») → confirm sheet.
- **Era entry:** 2.5 s banner + coin flip; optional «Что нового» sheet.
- **Return:** Treasury chest card («Пока вас не было, казна собрала 12,4K» — Забрать).
- **Events tray**, toasts (only notable: era, goal, Town Hall built, event, error; at most one per 5 s), save status + 409 conflict modal, settings (quality, sound, language), back to the hub.

### 11.3 Bulk actions (minimum scope)
Drag-paint rows of homes and roads; «Улучшить улицу»; «Устаревшие в кадре → одним касанием»; upgrade-by-redraw of road segments. The sim counts ≈ 1 200 actions to the Near Future, ≈ 950 taps with these.

---

## 12. Pacing and balance (sim output, 2026-10-16)

### 12.1 Method
`sim-final.mjs` implements §2–§7 with 1-second ticks and three greedy players, 5 seeds each (seed 1 deterministic; seeds 2–5 add ±30 % decision jitter, AFK spells and mistakes): **slow** (acts every 40 s, keeps idle cash, builds new instead of upgrading, careless zoning), **typical** (every 15 s, sensible priorities), **expert** (`optimised`, every 3 s, spends to zero, good zoning). Coverage, roads and pollution are aspatial approximations; one spatial pass checks the gates against real land (§12.8). Era lengths below are medians of the 5 seeds.

### 12.2 Era lengths (minutes of game time at ×1) — each era at least as long as the one before
| Era | slow | typical | expert |
|---|---:|---:|---:|
| Античность | 32 | 30 | 32 |
| Средневековье | 32 | 32 | 32 |
| Возрождение | 58 | 32 | 32 |
| Индустриальная эра | 68 | 51 | 47 |
| Модерн | 87 | 71 | 71 |
| Современность | 124 | 76 | 86 |
| **Total to the Near Future** | **6 h 54 min** | **4 h 57 min** | **5 h 00 min** |

### 12.3 Entry minute, year and stars (medians; stars = how many of 5 runs got ★/★★/★★★)
| Era | slow min · year · stars | typical min · year · stars | expert min · year · stars | typical year range |
|---|---|---|---|---|
| e1000 | 32 · 77 · 3/1/1 | 30 · 72 · 1/2/2 | 32 · 77 · 5/0/0 | 71–106 |
| e1500 | 64 · 154 · 1/4/0 | 62 · 149 · 1/3/1 | 64 · 155 · 1/4/0 | 140–195 |
| e1800 | 124 · 299 · 5/0/0 | 93 · 224 · 1/3/1 | 97 · 234 · 2/3/0 | 217–268 |
| e1900 | 195 · 468 · 5/0/0 | 145 · 348 · 1/3/1 | 145 · 348 · 0/4/1 | 334–387 |
| e2000 | 282 · 678 · 5/0/0 | 221 · 532 · 1/4/0 | 214 · 516 · 0/1/4 | 517–567 |
| e2100 | 414 · 994 · 5/0/0 | 297 · 714 · 0/3/2 | 300 · 722 · 0/4/1 | 700–734 |

The typical player reaches the Near Future around **year 714**, about 1 390 years ahead of history; a slow player around year 994; lead at entry peaks in the Industrial era (≈ +1 580) and then shrinks («История догоняет»). Typical (seed 1) at each entry: population 101 / 527 / 2.2K / 8.0K / 20.9K / 46K; strips 0 / 0 / 2 / 5 / 8 / 9; gross per year 160 / 2.3K / 12.6K / 66K / 276K / 848K.

### 12.4 Economy health (typical)
| Era | tax / trade / tourism / orders+fares (% of income) | all costs (% of gross) | ρ (traffic) |
|---|---|---:|---:|
| e0 | 93 / 3 / 4 / 0 | 10 % | 0.58 |
| e1000 | 60 / 39 / 1 / 0 | 6 % | 0.92 |
| e1500 | 58 / 38 / 4 / 1 | 8 % | 1.11 |
| e1800 | 60 / 37 / 3 / 0 | 14 % | 1.08 |
| e1900 | 72 / 21 / 5 / 2 | 32 % | 1.37 |
| e2000 | 68 / 22 / 6 / 4 | 31 % | 1.05 |
| e2100 | 79 / 13 / 4 / 5 | 23 % | 1.52 |

Median bank: 1.3 years of gross (typical), 0.6 (expert), 11 (slow, which hoards). Tourism earns 28–81 % of its demand (capacity binds from the Renaissance). No profile ever had an empty treasury; loans were never needed.

### 12.5 Daily mobile players (calendar frozen offline, chest on return)
| Era | 20 min/day at ×2: day · year · stars | 3 × 10 min/day at ×2: day · year · stars |
|---|---|---|
| e1000 | 1 · 70 · ★★★ | 1 · 69 · ★★★ |
| e1500 | 2 · 147 · ★★ | 2 · 145 · ★★ |
| e1800 | 3 · 226 · ★★ | 2 · 219 · ★★★ |
| e1900 | 4 · 353 · ★★ | 3 · 328 · ★★★ |
| e2000 | 6 · 543 · ★★ | 4 · 496 · ★★★ |
| e2100 | 8 · 725 · ★★ | 5 · 677 · ★★★ |

Being away never costs lead or stars. The chest was 0.8 % of all income (1 session/day) and 1.6 % (3 sessions/day).

### 12.6 End state (2 h after entering the Near Future, seed 1)
| Profile | year | population | happiness | gross/yr | strips | score (Chronicle / City / Land / Ach.) |
|---|---:|---:|---:|---:|---:|---|
| slow | 1263 | 108K | 79 | 2.9M | 14 | 26.6K (14.9K / 7.5K / 1.4K / 2.75K) |
| typical | 1022 | 149K | 90 | 5.0M | 13 | 29.9K (17.0K / 8.8K / 1.3K / 2.75K) |
| expert | 998 | 138K | 91 | 4.1M | 11 | 28.7K (16.6K / 8.6K / 1.1K / 2.5K) |

### 12.7 Robustness (typical, seed 1, baseline 306 min to the Near Future)
| Test | Result |
|---|---|
| E1 Antiquity amphitheatres carpeting the beach from e1800 | 9 % slower (tourism saturates) |
| E2 build an L1 hut, then upgrade straight to the target | −0.7 % (trade-in removes the discount) |
| E3 demolish organically grown homes for refunds | 14 % slower (refund = 50 % of paid) |
| E4 spend every coin on beach parks from year 1 | stalls in Antiquity (upkeep = income); score 389 — no score exploit; Advisor rule 4 is the counter |
| E5 high tax always | 4 % slower |
| E6 loan farming | 5.5 % slower (interest) |
| E7 never pay for home upgrades (organic only) | ±0 % (organic climbs fill older levels only) |
| E8 ignore the Advisor | 4 % slower |
| P1/P2 coverage efficiency −20 % / +20 % | −2 % / −11 % |
| P3 road capacity −20 % | +8 % |
| P4 upkeep +25 % | +7 % |
| P5 taxes −10 % | +10 % |
| P6 organic growth off | −5 % |
| P7 tourism capacity × 0.5 | +14 % |
| Stress: +44 free coal plants (upkeep + fuel 1.5 × gross), money 0, 150 years without decisions | 745 s in arrears, 30 buildings mothballed, net positive again after 36 years, lowest population 84 %, money never < 0; Near Future at 514 min |
| 32-point sweep around the expert (interval, ROI, reserve, tax lever, loans) | 275–323 min; tax lever −3 %, loans +4 %, acting every 3 s vs 8 s: no difference |

### 12.8 Spatial check: population gates vs real land (40-row layout, exact diamonds)
| Gate into | population | strips at entry (typical) | capacity at that width | gate / capacity | gate / full map |
|---|---:|---:|---:|---:|---:|
| e1000 | 80 | 0 | 2.0K | 4 % | 1 % |
| e1500 | 460 | 0 | 4.6K | 10 % | 3 % |
| e1800 | 1 800 | 2 | 10.1K | 18 % | 7 % |
| e1900 | 7 000 | 5 | 31.7K | 22 % | 12 % |
| e2000 | 20 000 | 8 | 71K | 28 % | 20 % |
| e2100 | 45 000 | 9 | 257K | 17 % | 13 % |

Every gate leaves ≥ 72 % headroom (with the measured 54 % workplace share instead of 35 %: still ≥ 60 %). With every service radius −1 the full map still holds 338K.

### 12.9 Open balance issues (known, accepted)
- The greedy expert is not faster than the typical player in total (5 h 00 vs 4 h 57): pace is set by structure (gates, paybacks), and the heuristics plateau. ★★★ is therefore calibrated on the best simulated runs; human experts are expected to beat it. Re-derive the thresholds after every balance change.
- Costs reach 31–32 % of gross in Modern and Contemporary (typical), slightly above the 30 % target; the budget sheet makes them visible with levers.
- The sim is aspatial: budget ±20 % retuning of service radii and road capacity after the first playable, using the tester telemetry (§15, slice 2).

---

## 13. Content JSON shapes (what each file becomes)

Slice 0 already ships the fixed map, the strip state, the constant calendar and no trees/rocks; where it chose other field names, keep them and map the constants below onto them.

### 13.1 `world.json`
```jsonc
{
  "map":  { "width": 100, "landRows": 40, "beachRows": 20, "seaRowsVisible": 30, "tileMeters": 16,        // slice 0
            "start": { "minX": 35, "maxX": 64 }, "townHall": { "x": 49, "y": 19 },
            "airportPlot": { "x": 44, "y": 46, "w": 12, "h": 4 },
            "portals": [46, 22, 77],                                                                      // x on row 0
            "deposits": [ { "kind": "coal", "x": 37, "y": 0, "w": 2, "h": 2 }, { "kind": "ore", "x": 30, "y": 0, "w": 2, "h": 2, "rich": true },
                          { "kind": "oil", "x": 15, "y": 59, "w": 1, "h": 1 } /* … every spot of §5.3 */ ],
            "features": { "bay": { "minX": 65, "maxX": 69, "trade": 1.5, "visitors": 1.2, "fishery": 1.25, "fisheryMax": 5 },
                          "cape": [ { "minX": 0, "maxX": 4 }, { "minX": 95, "maxX": 99 } ], "capeAttraction": 1.25,
                          "sunny": { "minX": 90, "maxX": 94, "solar": 1.25 } } },
  "land": { "stripWidth": 5, "perSide": 7, "contiguous": true,
            "price": [2000, 4400, 9600, 21000, 48000, 105000, 230000, 500000, 1200000, 2800000, 6400000, 16000000, 40000000, 100000000] },
  "time": { "secondsPerYear": 25, "startYear": 1, "speeds": [0, 1, 2, 5], "testerSpeeds": [20, 50],
            "atmosphere": { "dayRealSeconds": 480, "nightRealSeconds": 120, "twilightRealSeconds": 40, "seasonRealSeconds": 960, "weatherRealSeconds": [180, 360] } },
  "offline": { "chestYearsOfNet": 1, "chestFillRealHours": 8, "chestCooldownYears": 25 },
  "start": { "epoch": "e0", "population": 6, "resources": { "money": 1200, "food": 160, "mat": 160, "goods": 0 },
             "buildings": [ { "type": "town_center", "level": 1, "at": [49, 19] } ] },
  "economy": {
    "currency": "money", "taxPerCitizen": 1.0, "taxMultByLevelEra": [1, 1.6, 2.5, 4, 6, 9, 13],
    "workforceShare": 0.5, "unemploymentTaxLoss": 0.3, "labourOrder": ["svc", "food", "raw", "ind", "com"],
    "foodPerCitizen": 0.4, "storageBase": 1200, "exportAbove": 0.9,
    "prices": { "foodImport": 1.0, "foodExport": 0.4, "matImport": 4.0, "matExport": 1.5, "goodsExport": 6.0,
                "fuelImport": 3.0, "fuelExport": 1.2, "gridPower": 100 },
    "freight": { "perStation": 0.35, "premium": 0.10 },
    "tradeIn": 0.7, "upgradeFloor": 0.25, "refundShare": 0.5, "moveShare": 0.1,
    "loan": { "maxYearsOfGross": 3, "ratePerYear": 0.10, "repayShareOfNet": 0.25 },
    "arrears": { "mothballPerYear": 1 },
    "spirit": { "perYear": 0.001, "cap": 0.3 },
    "policies": { "lockYears": 5,
                  "tax": { "fromEpoch": "e1000", "low": { "tax": 0.8, "happiness": 8 }, "normal": { "tax": 1, "happiness": 0 }, "high": { "tax": 1.2, "happiness": -10 } },
                  "density": { "fromEpoch": "e1800", "housing": 0.15, "happiness": -6, "trips": 0.10 } } },
  "population": { "growthRate": 0.03, "growthFlat": 0.2, "moveOutShare": 0.05, "starvingDecline": 0.004,
                  "occupancy": { "from": 25, "span": 45 }, "comfortFill": [0.7, 0.3], "organicPerYear": 0.015,
                  "needs": ["water", "leisure", "health", "education", "happy50", "aura4", "power", "transit", "happy65", "data"] },
  "happiness": { "base": 35, "comfort": 30, "auraCap": 15, "pollutionCap": 30, "starving": 25, "noPower": 15,
                 "metroCap": 8, "airportNoise": { "radius": 4, "happiness": -8 } },
  "traffic": { "tripsPerCitizen": 0.5, "tripsPerJob": 0.3, "tripLength": 10, "reachSteps": 6, "reachCap": 85,
               "effSlope": 0.4, "happyPerUnit": 15, "happyCap": 15, "levelCrossingCapacity": 0.8, "transitShareCap": 0.6 },
  "tourism": { "perAttraction": 4.0, "valueByLevelEra": [1, 3.2, 12.1, 37.1, 85.7, 199.3, 352.9],
               "heritage": { "mult": 2, "eraGap": 2, "rampYears": 20, "types": ["temple", "theater", "manor", "market", "school", "park", "architect_bureau"] },
               "beachManor": 1.5 },
  "chronicle": { "golden": { "perStar": 0.05, "years": 10, "rampYears": 2, "happiness": 3 },
                 "lead": { "busyShare": 0.98, "progressShare": 0.95 }, "transitionYears": 20 },
  "verbs": {
    "charters": { "changeShare": 0.1, "craft": { "industry": 0.15 }, "trade": { "tax": 0.08, "markets": 0.15 },
                  "green": { "pollution": -0.5, "happiness": 4 }, "heritage": { "fromEpoch": "e1500", "attraction": 1.5 } },
    "orders": { "slots": [2, 3, 4], "everyYears": 6, "expireYears": 12, "quantityShare": 0.5, "premium": 2.0 },
    "rail": { "track": [ { "epoch": "e1800", "price": 6000 }, { "epoch": "e1900", "price": 16000 }, { "epoch": "e2000", "price": 40000 }, { "epoch": "e2100", "price": 100000 } ],
              "trackUpkeepShare": 0.01, "countedStations": 3, "throughTrade": 1.5, "throughVisitors": 1.2 },
    "metro": { "tunnelPrice": 12000, "tunnelUpkeep": 60, "lines": 6, "roadTilesPerStation": 12, "minSpacing": 3, "ridersPerStation": 4000, "fareShare": 0.1 },
    "routes": { "slots": [2, 4], "openPrice": [400000, 1200000], "upkeep": [12000, 30000],
                "tourist": { "visitors": 15000 }, "cargo": { "trade": 2500, "goodsPremium": 0.10 }, "business": { "tax": 0.03 } },
    "programs": { "max": 3, "costShareOfGross": 0.015, "cityos": { "tax": 0.04 }, "autonomous": { "trips": -0.2 },
                  "cleanair": { "pollution": -0.3, "happiness": 2 }, "grid": { "power": 0.15 } } },
  "score": { "eraPoints": 1000, "starPoints": [0, 100, 300, 600], "cityPerSqrtPop": 20, "happinessFactor": [0.8, 0.4],
             "happinessWindowYears": 50, "stripPoints": 100, "achievementPoints": 250 },
  "events": { "firstYear": 15, "everyYears": [6, 10], "list": [ /* §9.4: { id, epoch, kind: gift|choice|hazard, text, effect, counter } */ ] },
  "npc": { /* v2 block kept; vehicle budget 60 phone / 150 desktop */ }
}
```
Removed from v2: `map.seed`, `time.secondsPerDay/daysPerSeason/maxOfflineSeconds`, `economy.clearFeature`, `economy.upgradeShare`, `moveCostPerTile`, `districts` (→ `verbs.charters`), `population.taxPerPerson/foodPerPerson/coldPenalty` and the other per-second constants.

### 13.2 `epochs.json` (7 eras; e2300/e2500/e3000 deleted)
```jsonc
{ "id": "e1500", "year": 1500, "name": "Возрождение", "tagline": "…",
  "currency": { "name": "Золотые флорины", "short": "Флорины", "symbol": "ƒ", "icon": "money-e1500", "flavor": "Флорины Медичи ходят по всей Европе." },
  "verb": "orders",                                   // build | charters | orders | rail | metro | routes | programs
  "entry": { "townHallLevel": 4, "population": 460, "discoveries": 3, "stars": [157, 143],
             "items": [ { "type": "district_hall", "level": 1, "count": 1, "label": "Управа района с грамотой", "charter": true },
                        { "type": "smithy", "level": 1, "count": 2, "label": "2 кузницы" } ] },
  "accent": "#c8a24a", "palette": { /* building palette; road/roadEdge/roadMark/roadStyle removed */ }, "ambience": "town" }
```
`entry` = what is needed to **enter** this era (e0 has none; TH L2 at population 30 is in `world.start`/town_center). Special item flags: `ordersDelivered: 4` (port), `connectedToPortal: true` (rail_station), `sameLine: true` (metro_station ×2), `routes: 2` (airport). Removed: `yearsPerDay`, `territory`, `next`, `theme`.

### 13.3 `resources.json`
`{ id, kind: "currency"|"stock"|"flow", name, icon, epoch, faces?: { e0: "Дерево и камень", … } }` for exactly `money`, `food`, `mat`, `goods`, `fuel`; power stays in building effects. Prices live in `world.economy.prices`.

### 13.4 `techs.json` (28) and `goals.json`
- Tech: `{ id, name, icon, epoch, description, cost: { "money": 7200 }, time: 100, requires: [], bonus: { "trade": 25 } }` (percent integers; keys `produces{food|mat|goods|*}`, `tax`, `trade`, `research`, `housing`, `happiness`, `traffic`). Unlocks are expressed by `level.tech` in building files (table §9.1); avenue a1 → `steelmaking`, s7/a4 and programs → `smart_city`.
- Goals: `{ "story": [ { id, epoch, name, condition, reward: { "money": 240 } } ], "sideTemplates": [ { id, condition, rewardYearsOfGross: 0.5 } ], "achievements": [ { id, name, description, condition } ] }`. New condition types: `stars`, `strips`, `peakPopulation`, `heritage`, `ordersDelivered`, `metroLines`, `throughLine`, `buildingLevel`, `trafficBelow`, `pollutionBelow`, `noImportsYears`, `happinessYears`, `calendarYear`, `neverArrears`, `coverage`.

### 13.5 `buildings/*.json`
Delete the 6 files of §8.1 and every level after e2100. Add `port.json`, `rail_station.json`, `metro_station.json`, `airport.json`, `avenue.json`, `rail.json`. Building fields:
```jsonc
{ "id": "mine", "name": "Рудник", "category": "resources", "size": { "w": 2, "h": 2 }, "unique": false,
  "jobClass": "raw",                                   // svc | food | raw | ind | com
  "placement": { "zone": "mountain", "deposit": "ore", "requiresRoad": true },   // land | landOrBeach | mountain | coast | road | airportPlot
  "heritage": false, "rotatable": false, "taxMult": 1, "network": null,          // network: "road" | "rail" for line pieces
  "levels": [ { "level": 1, "name": "Железный рудник", "epoch": "e1000", "tech": "metallurgy",
                "cost": { "money": 1200, "mat": 48 }, "upkeep": 4.8, "buildTime": 12, "tier": 0,
                "effects": { "housing": 0, "jobs": 12, "produces": { "mat": 38 }, "consumes": {}, "trade": 0, "storage": 0,
                             "power": 0, "powerUse": 0, "aura": null, "pollution": null, "coverage": null,
                             "attraction": 0, "visitors": 0, "research": 0, "importDiscount": 0, "goodsPremium": 0,
                             "transit": null, "charterRadius": 0, "dataTax": null, "boost": null },
                "model": { /* v2 parts unchanged */ } } ] }
```
- All rates per year. `coverage: { service, radius }`; `transit: { radius, share, happiness }`; `dataTax: { radius, percent }`; `boost` (windmill L1: farms +25 % r3). Remove `near`, `seasonal`, `defense`, `role`. Validators accept sizes up to 12×4 and `rot` for `rotatable`.
- `road.json` (street, `network: "road"`, levels s1–s7) and `avenue.json` (`network: "road"`, a1–a4): level = `{ level, name, epoch, tech?, cost, upkeep, capacity, appeal, transit, speed, profile }` with
  `profile = { carriageway: { lanes, laneWidth, surface, tram? }, sidewalk: { width, surface, kerb } | null, median: { width, kind: "grass"|"planter"|"tram"|"bike" } | null, markings: { centre: "none"|"dashed"|"double"|"studs", lanes: "none"|"dashed", edge: bool }, crossings: "none"|"setts"|"zebra"|"raised"|"signal"|"smart", signals: "none"|"avenueJunctions"|"adaptive", decor: [ { kind, every, side } ] }` (values of §6.2).
- `rail.json` (`network: "rail"`): 4 track levels `{ epoch, cost: { money }, upkeep, look }`.

---

## 14. Save and persistence (what the server must accept)

Save format **version 2**; a version-1 world is wiped on load with a notice (v3 has no players yet).
- **worlds** (new migration with a new filename, `city3` connection): add `save_version`, `land_left`, `land_right` (0..7, slice 0), `peak_population`, `era_log` JSON `[{ era, t }]` (≤ 7, strictly increasing era, non-decreasing `t` ≤ `time`; the server derives year, lead and stars from `t` and `epochs.json`), `economy` JSON `{ policy, dense, loan, arrearsYears, goldenStart, goldenStars, chestT, h50, bestH50, programs[], routes[], orders: { seq, nextT, delivered, open: [{ good, qty, reward, expiresT }] }, flags: { gardenT, selfT, flow, clean, tester } }` (whitelisted keys, numeric bounds), `transport` JSON `{ railLevel, metroLines: [{ id, color, stations: [uid] }] }` (≤ 6 lines × 32 stations, uids must be metro stations), `layers` JSON `{ roads, rail }` = base64 of 100 × 60 bytes (road code 0 none, 1–7 street, 8–11 avenue; rail 0–4), non-zero only inside owned columns. Stop sending `tiles` (slice 0) and NPCs (regenerated from homes). `year` and `score` are computed by the server; client values are ignored. `seed/width/height` become constants.
- **buildings:** add `paid` (unsigned, money), `rot` (0/1), `mothballed` (bool), `built_era` (0..6, era when the current level finished; Heritage), `organic` (0..1), `charter` (string ≤ 16, district halls). Road tiles are no longer building rows.
- **Validation** (`WorldPayloadRules`): type ∈ content ids; level ≤ the file's levels; footprint inside the owned columns and rows 0..59; zone per `placement.zone` (mountain: y = 0 on a deposit/foot spot as required; coast: bottom row 59; landOrBeach: bottom row ≤ 58; land: bottom row ≤ 39; airportPlot: exactly the plot); one of each unique type; `rot` only for rotatable types; `time` never decreases and grows ≤ Δwall × 5.5 (+60 s slack) unless tester; strips monotonic.
- **Leaderboard** (`LeaderboardController`, own `/api/city3/leaderboard` and `/summary`): rank on the server score; tabs `?tab=overall|chronicle|era`; summary = `{ epoch, epoch_name, year, population, score, played_at }`.
- Keepalive saves stay < 64 KB: layers ≈ 16 KB, building deltas, no NPCs.

---

## 15. Implementation plan (after slice 0 = fixed map, strip state, 25 s/year calendar, no trees/rocks)

Every slice compiles, passes `npx tsc -p app/Games/City3/client/tsconfig.json`, `npm run test:city3`, `php artisan test --compact tests/Feature/Games/City3` and leaves a playable game. Gate lines of verbs that do not exist yet are omitted from `epochs.json` until their slice (§2.2). Economy maths lives in pure TS modules with vitest tests that replay fixed cases from the sim.

1. **Content v3 and one currency.** Content: rewrite `epochs.json` (7 eras, `currency`, `entry`, stars, accent), `resources.json`, `techs.json` (28), `goals.json`, all `buildings/*.json` per §8 (per-year units, `cost{money,mat}`, `upkeep`, `jobClass`, `placement.zone`, `tier`), delete removed files/levels. Engine: `engine/content/types.ts`, `registry.ts` (validator: sizes to 12×4, `network` instead of unique `role`, zones), `engine/sim/game.ts` reads per-year values (/25), money only, tax 1.0, buy-missing; `content.ts`. UI: `ui/hud.tsx` money pill with the era face; `ui/common.tsx` formatter (§3.2). Server: `ContentRepository.php` ids, `tests/Feature/Games/City3/City3ContentTest.php`. Tests: content validity, formatter, per-year conversion.
2. **Economy core.** New `engine/sim/economy.ts` (labour classes, production, fuel/power/food settlement, imports, exports with capacity, storage, upkeep, tax, tourism saturation, fares), `engine/sim/grids.ts` (coverage, aura, pollution, charter stamping), `engine/sim/population.ts` (static/city happiness, need tiers, P*, growth, organic). Replace v2 `recalculate()`/`updateEconomy()`/`updatePopulation()` in `game.ts`. Tester telemetry: per-era log of ρ, coverage, income mix (for the ±20 % retune). UI: City sheet v1 (`ui/epoch.tsx` stats → budget bars), inspector needs line. Tests: vitest parity cases (fixed city → expected yearly flows from the sim).
3. **Prices and safety nets.** `engine/sim/pricing.ts` (trade-in, `paid`, 50 % refund, move), mothballing and arrears, loan, policies, offline chest; delete `catchUp` in `engine/save/serializer.ts`. Server: migration + `Models/Building.php` (`paid`, `mothballed`, `organic`, `built_era`), `economy` JSON in `WorldStore.php`/`WorldPayloadRules.php`. UI: price sheet, mothball/reopen, chest card. Tests: chain ≥ direct, refund basis, arrears recovery, chest cooldown.
4. **Eras and the Chronicle.** Town Hall gate flow (checklist, build time, Spirit), live lead, stars, Golden Age, `era_log`; gradual transition (sky/fog/accent blend over 20 years in `scene/sky.ts`, NPC re-dress and vehicle mix in `engine/sim/npcs.ts`, no traffic wipe; remove the splash/year count-up in `ui/epoch.tsx`). Server: `era_log`, server-side score in `WorldStore.php`, `LeaderboardController.php`. UI: calendar chip with lead and tooltip, Chronicle screen, Town Hall card. Tests: lead formula, star thresholds, score recompute.
5. **Land and placement.** Strip purchase action and price curve (if not in slice 0), zones (mountain foot, deposits, portals, coast, beach, airport plot with refund), deposit multipliers, bay/cape/sunny; `engine/sim/game.ts canPlace`, `scene/terrain.ts`/`scene/overlays.ts` (deposit and zone overlay), on-map strip plaque. Server: zone validation. Tests: placement table, strip contiguity.
6. **Roads.** `road.json`/`avenue.json` profiles; road layer (`engine/world/world-map.ts` network bitmask instead of road buildings); `scene/roads.ts` rewrite (cross-section pieces per junction type, rebuilt per 16×16 chunk, instanced lamps/trees/benches/shelters/signals), vehicles on lanes with right-hand traffic and scaled models (`scene/people.ts`), pedestrians on sidewalks; `engine/sim/traffic.ts` (cached BFS spreading, ρ, effects); upgrade by redraw, «Улучшить улицу»; traffic overlay. Server: `layers.roads`. Tests: trade-in per tile, ρ on a fixed grid, layer encoding.
7. **District charters** (e1000 verb): district_hall charter picker, charter grid effects, gate line. Tests: charter effects inside/outside radius.
8. **Port and trade orders** (e1500 verb): `port.json` with 3 new models, coast placement, bay, order generator (deterministic), deliver action, gate line; ship visuals. Server: `economy.orders`. Tests: order sequence identical for two cities.
9. **Railway** (e1800 verb): rail layer, portals, level crossings, rotatable station (`rot`), connectivity to portals, through-line, freight; 3 station models, trains in `scene/` (instanced, path-following); gate line. Server: `layers.rail`, `rot`. Tests: portal connectivity, through-line detection.
10. **Metro + power grid** (e1900 verb): underground layer, entrances on road tiles, line builder (tap stations, L-path tunnels, 6 colours), x-ray view (`scene/materials.ts`), transit effects, fares; power gauge and grid purchase UI; gate line. Server: `transport.metroLines`. Tests: tunnel pricing, coverage, line validity after demolition.
11. **Airport and flight routes** (e2000 verb): 2 models, plot placement, noise, routes UI and effects, planes; gate line. Tests: route slots and effects.
12. **Smart programs and Near Future polish** (e2100 verb): program toggles, data centre need, s7/a4.
13. **Goals, achievements, events, Advisor.** Story/side goals, 16 achievements (cached counters, checked every 5 ticks), deterministic events and tray, Advisor rules (§9.5). Tests: event schedule by year, achievement conditions.
14. **New HUD and mobile input** (UI designer's spec on top of §11): touch placement ghost + ✓/✗, line drawing without stealing pan, bulk actions, store with selectors (no 250 ms whole-tree render), i18n keys.
15. **Rendering at scale:** instancing/BatchedMesh per bucket, LOD, tiered shadows and DPR on phones, event-driven sync; the 1 000+ building city at 30 fps on a mid-range phone.

---

## Appendix A — judges' must-fix items and where they are closed
| Item | Where |
|---|---|
| Offline must not move the calendar; capped chest tied to game time | §2.1, §4.12, §12.5 |
| No economic step at era entry (prices, tax, upkeep, tourism by the level's era; Golden Age and Heritage ramp) | §2.4, §4.5, §4.6, §4.8 |
| One rate unit `/год`; no yearly toast | §3.2, §11.1 |
| Reserved airport plot, noise off the homes | §5.4, §7.4 |
| Strips cannot deadlock gates; expansion inside the main arc; gates ≥ 30–40 % below capacity | §5.2, §12.3, §12.8 |
| Gate ≤ 4 lines, one sink (TH upgrade + build time), no separate fee | §2.2 |
| Short cost lines (money + one material line, buy-missing in one tap) | §3.2, §4.9 |
| Bulk actions in minimum scope | §11.3 |
| Lead always on the HUD with its cause; «История догоняет» | §2.3, §11.1 |
| One new verb per era; gates built from it | §1.3, §2.2, §7 |
| Seasons never affect the economy; no strobing | §2.1 |
| Star maths (max 18, ★★★ reachable, thresholds in data, re-derived) | §2.3, §9.3, §12.3 |
| Score: no spam terms, money 0, happiness averaged, Chronicle share > 50 %, server recompute | §10, §12.7 |
| Upkeep share ≈ 30 % with budget bars and levers | §4.8, §11.2, §12.4 |
| City big when metro/airport arrive (8–20K at metro, 21–46K at airport) | §12.3 |
| Currency faces as SVG icons, no odd glyphs | §3.1 |
| Rail from mountain portals, no fixed trunk | §7.2 |
| Aspatial sim: ±20 % retune from telemetry | §12.9, §15 slice 2 |
| Horizon / no floating slab, fixed map, no trees/rocks | slice 0 (done), §5.1 |
| Engine limits: sizes to 12×4, `network`, road/rail bitmask, underground layer, station rotation | §13.5, §15 slices 1, 6, 9, 10 |
| Per-tick cost O(1); grids; static/city happiness split | §4.13 |
| Rendering at scale | §15 slice 15 |
| Persistence: no tiles, packed layers, era log, economy state, versioned, < 64 KB | §14 |
| Leaderboard trust; events seeded by year | §9.4, §10, §14 |
| Honest model count; unique port and airport | §8.1 |
| Gradual visuals (NPCs, HUD theme, sky, no flash) | §2.4 |
| Mobile input (ghost + ✓/✗, pan while drawing, metro by tapping stations) | §7.3, §11.2 |
| Road scale 16 m, lanes, right-hand traffic, sidewalks | §6.2 |
| Module setup, pure TS economy with vitest | §15 |
| Trade-in upgrades; refund 50 % of paid | §4.9, §12.7 (E2, E3) |
| Tourism saturates, valued by level era, Heritage by time since construction | §4.5, §12.7 (E1) |
| Running inputs auto-import; mothballed plants cost nothing | §4.3, §4.10 |
| Safety nets not farmable; arrears path tested | §4.10, §12.7 (E6, stress) |
| No dead resource (wood folded into materials; no knowledge) | §3.3 |

## Appendix B — sim aliases and files
- Sim ids `villa`, `workshop`, `forestry`, `tower` = content ids `manor`, `smithy`, `lumber`, `skyscraper`. The sim's road ids `s1–s7`, `a1–a4` are the levels of `road.json` and `avenue.json`.
- Re-run after any balance change: `node app/Games/City3/docs/design/sim/sim-final.mjs --roster`; copy the new star thresholds into `epochs.json` and the roster into §8.
