# Synthesis notes (interrupted run)

The synthesizer was stopped by the usage limiter before writing gdd.md. Its report:

I stopped before finishing: your usage limiter fired at 80% of the 5-hour limit (it resets at 20:10). `gdd.md` has not been written yet. `sim-final.mjs` runs, but it is not final, so its numbers can't go in the doc yet.

**What exists**
- The simulation covers the three profiles, a 5-seed spread, star thresholds re-derived from the runs (written back into the data), daily mobile players, 8 exploit tests, 7 perturbation tests, a stress test of the empty-treasury path, a 32-point sweep, a spatial check of population gates against land capacity, and `--roster`, which generates all the content tables.
- Latest quick run, typical player: Near Future in 5 h 12 min (year 750, lead +1350), with 9 strips bought along the way. Slow takes 6 h 29 min. No profile soft-locks any more.
- The sweep spans 271–334 min. The tax lever and loans don't make an expert faster, so neither safety net can be farmed.

**Design decisions already in the sim**
- **Base:** the player concept, with all 35 v2 buildings and their 148 levels reused. 11 new models: port ×3, station ×3, metro ×3, airport ×2.
- **Upgrade price:** a trade-in rule, so a chain of upgrades always costs at least as much as building the top level directly. Demolishing refunds 50% of money actually paid, never the list price.
- **Tourism:** saturates against visitor capacity from transport. It is valued by each attraction's own level era. Heritage needs the building to have been finished two eras ago.
- **Era entry:** nothing jumps. Upkeep and prices depend on each building's own era, and the Golden Age ramps up and down.
- **Running inputs:** fuel and power auto-import while money > 0.
- **Empty treasury:** the costliest non-home building is mothballed each year until income covers upkeep, so the city can't dead-end.
- **Offline:** the calendar freezes, and a chest pays at most 1 year of net, once per 25 game years.
- **Score:** Chronicle points plus 20·√(peak population) × average happiness, plus land and achievements. Money counts zero and every term is bounded.
- **Map:** strips are priced by count only. The airport has a reserved 12×4 plot. Rail comes out of mountain portals. Metro entrances sit on road tiles, so a full map never blocks them.
- **Verbs:** each era adds one, via district charters, port trade orders, rail, metro, flight routes and smart programs.

**What's left**
1. Fix the failed patch and apply it. It sets the sweep winner as the optimised profile (interval 3, ROI 1.8, no tax lever, no loans), uses 5-seed medians for era lengths, and lowers service and transport upkeep. It failed on shell escaping before writing anything; rewrite it with the Write tool.
2. Make every era longer than the one before. Typical currently runs 30 / 32 / 32 / 52 / 84 / 82 min, so Contemporary is shorter than Modern. Then run the full report, including the spatial gate check, and confirm late gates leave 30–40% headroom.
3. Write `gdd.md` (sections 1–16 plus an engineering checklist), pasting in the real sim output.

Files are in C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\:
- sim-final.mjs
- _patch4.py
- _dbg.mjs
- _dbg2.mjs
- _sweep.mjs
