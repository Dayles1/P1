# Reverend Insanity — lore research database

Independent research data for GU World. Nothing here is loaded by the game; no game code, config or dependency was changed.

## Layout

| Path | Contents |
|---|---|
| `schemas/` | JSON Schemas. `common.schema.json` holds the shared envelope, claims, relations, confidence. |
| `gu/`, `characters/`, `factions/`, `locations/`, `regions/`, `recipes/` | One JSON file per entity, file name = stable id (`gu_moonlight_gu.json`). |
| `resources/`, `moves/`, `systems/`, `inheritances/`, `gu_houses/`, `paths/`, `creatures/`, `events/`, `chapters/` | Not built yet: the crawl was still running (see `audits/research-progress.md`). |
| `sources/sources.json` | Source catalogue with access status. |
| `indexes/` | `master-index.json` (every file), per-type indexes, `name-index.json`, `relations.json` (edge list). |
| `audits/` | Progress, coverage, contradictions, open questions, quality report. |
| `tools/` | Crawler, parser, builder, index builder, validator. Python standard library only. |
| `.cache/` | Raw HTML of sagaofgu.com plus parsed JSON. Gitignored; rebuild with the crawler. |

## Confidence and verification

- `confidence`: A = checked against the novel text; B = chapter-cited by the reference source; C = no adequate citation, or inferred; D = unverified at source, disputed or speculative.
- `verification` on each claim says how far the citation was checked: `text_checked`, `cross_checked_chapter_summary`, `citation_unchecked`, `no_citation`.
- **No claim has been checked against the novel text yet** (licensed text was not reachable), so there are no A records. B means "the source cites a specific chapter", not "we read that chapter".
- `certainty` mirrors the source's own grading (canon / inferred / disputed / unverified).
- Disputes are kept in `conflicts[]` with every position and its support.
- Canon prices are never invented: price mentions sit in `economy.price_claims` with `needs_review: true`; balance values go only in `game_proposals[]` tagged `GAME_PROPOSAL`.

## Names

- `names.zh`: from the source when it gives one (characters do, Gu do not). Never filled from memory.
- `names.pinyin` for characters is derived from the English romanization (`pinyin_status: derived_from_en_romanization`, toneless).
- `names.ru`: character names are Palladius transliterations (`ru_status: transliteration`). Gu names have no Russian yet (`unknown`); our own renderings must be marked `working_translation`.

## Text

`claims[].text` and `summary.text` are excerpts of sagaofgu.com wording (`text_origin: source_excerpt`), kept so each fact stays traceable. The site states no license: use them for research only and rewrite before anything reaches the game.

## Rebuild / continue

```sh
cd research/reverend-insanity-lore
python tools/crawl_sagaofgu.py .cache/sagaofgu/pages .cache/sagaofgu/sitemap-0.xml   # resumable, skips cached pages
python tools/parse_sagaofgu.py .cache/sagaofgu/pages .cache/parsed
python tools/build_from_sagaofgu.py .cache/parsed            # all sections; --sections gu,characters to limit
python tools/build_indexes.py
python tools/validate.py                                      # --all prints every error
```

If `.cache/sagaofgu/sitemap-0.xml` is missing: `curl -o .cache/sagaofgu/sitemap-0.xml https://sagaofgu.com/sitemap-0.xml`.
The builder never overwrites records whose `research.status` is `reviewed` or `verified`, and keeps hand-filled `zh`/`ru` names.
