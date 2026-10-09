# Quality report (2026-10-09, first pass)

Validator: `python tools/validate.py` — schema, ids, file names, indexes and sources all pass.
Remaining errors: 515 dangling references to `res_*` (materials), because the resources section was not built yet. They resolve once the crawl finishes and `resources/` is built.

## Gu (1035 records)
- rank recorded: 613 / missing: 422
- rank_type: {'immortal': 304, 'unknown': 342, 'mortal': 389}
- path linked: 0 (paths section not crawled yet, links filtered); food known: 102; appearance described: 376
- with ownership history: 726; with unreviewed price mentions: 154
- with source conflicts: 25; stubs: 1
- organism_type: all `unknown` (not classified yet)
- zh names: 0 (source has none); ru names: 0
- canonical_prices: 0 — price mentions not reviewed yet

## Characters (913 records)
- Chinese name present: 2; Palladius ru: 640; rank timeline present: 575
- Rank timelines come from the source infobox and can stop early (Fang Yuan's ends at rank 6, ch. 630).

## Verification
- No claim checked against the novel text (A = 0).
- Cross-check against chapter summary pages not run yet: the chapter pages were not downloaded yet. Every claim is `citation_unchecked` or `no_citation`.
