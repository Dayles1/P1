# Летопись города 3: UI specification (HUD, sheets, touch input)

**Status:** design spec for slice 14 «New HUD and mobile input» (gdd.md §15), 2026-10-17.
**Sources:** `gdd.md` (§11 UI surfaces, §2 calendar and lead, §3 currency and formatting, §5 strips, §6 roads, §7 verbs, §9 goals), `ui-brief.md`, `../analysis/6-ui.md` (v2 problems R9 and Risks).
**Prototype:** `ui-prototype.html` (open it directly; `#s=idle|build|place|inspect|strip|hall|city|goals|upgrade|chronicle`, `&t=night`, `&bare` hides the prototype switcher). The prototype is the visual reference. Where it and this text disagree, this text wins.

Every number and verb below comes from the GDD. The snapshot used in copy and in the prototype is one consistent mid-Middle-Ages city:
- year 121, Средневековье, entered in year 74 (★★);
- money 8 420 гроша at +1 262 a year;
- 380 citizens out of P* 412, happiness 71 %;
- lead +1 207 (the city is like Europe of 1 328);
- Renaissance gate 1 of 4 lines done;
- one strip owned (L1).

---

## 1. Direction

**Chronicle instruments over a living city.** The HUD is a small set of dark lapis instruments pinned to the screen edges, like the brass and enamel dials of a clock tower. The city stays the picture. The instruments never change shape, font or colour when an era begins (gdd §2.4). The era shows itself in three places only:
- the money face;
- one accent colour;
- the era name.

- **Palette: the illuminator's pigments.** Chronicles were written in lapis, malachite, cinnabar and saffron on vellum. The UI uses exactly that vocabulary, and each pigment has one meaning:

  | Pigment | Meaning |
  |---|---|
  | Lapis | Surfaces |
  | Vellum | Text |
  | Malachite | Good / confirm |
  | Cinnabar | Bad / cancel / destroy |
  | Saffron | The one primary action and "buy" |
  | Amber | Warning / paused |

  The colours come from the subject, not from a template.
- **The one bold element: the calendar instrument.** "A race against history" is pillar 2 and the largest part of the score. The calendar puts that race on screen in three parts:
  - a year ring that fills once per game year; its centre is the speed control (a clock that shows how fast it runs);
  - the year and the era;
  - a **race line**: six era segments, a vellum tick for the calendar year, an era-coloured pennant for the city's "historical year", and the lead between them in malachite (amber when falling).

  Everything else stays quiet.
- **Tactile, game-grade controls.** References: SimCity BuildIt, Clash of Clans.
  - Pressable things have a solid bottom "lip" and sink 2 px when pressed.
  - Readouts (money, citizens, calendar) are flat with a thin rim.
  - So the lip itself tells the player "you can press this".
- **Edges and the thumb zone.**
  - Readouts sit in the top corners.
  - Everything frequent sits in the bottom 170 px on phones (Build, Upgrade, Goals, City, ✓ / ✗, quest, advisor, layers).
  - Nothing permanent sits in the centre.
  - Sheets are transient. They move the camera so that they never hide what they describe.

---

## 2. Plan, review, revisions

### 2.1 First token plan (before building)
- Colour: lapis surfaces (#1B2448 family), vellum text, malachite/cinnabar/saffron/amber meanings, one era accent.
- Type: Geologica (Cyrillic-native geometric grotesque, variable `wght` + `SHRP` "sharpness" axis). Text at SHRP 0; numerals at SHRP 100 for a minted, engraved look. One family, two voices.
- Layout: top-left money and citizens; top-centre calendar; top-right speed and menu; bottom four thumb buttons; advisor above Build.
- Principles: stable chrome; the era only in the face, the accent and the name; the lip means pressable; sheets never cover their subject.

### 2.2 Review against the brief and the cliché list
| Check | Verdict | Change |
|---|---|---|
| Cream + serif + terracotta (cliché 1) | Avoided: no cream surfaces, no serif. | Era accents were checked to stay away from #D97757 (industrial brass #E3A066 is yellow-tan, not terracotta). |
| Near-black + one acid accent (cliché 2) | Lapis is a clearly blue pigment, not a tinted black. Meanings use four hues. | – |
| SaaS card kit (cliché 4) | Build cards are cards by necessity. | Radii form a hierarchy (pill 999 / instrument 18 / button 16 / card 12 / chip 10 / sheet 22). No identical grey shadows: instruments float on a dark double shadow; cards inside sheets are flat with a 1 px rim. |
| Template chrome (cliché 5) | No uppercase eyebrows, no monospace data labels, no "→" on buttons. | The GDD's plaque copy «+ Полоса · 4,4K · бухта» is rendered as a structured plaque (plus disc, "Полоса", price, feature icon and word), not a middle-dot string. |
| Glass blur HUD (generic game default) | Rejected. `backdrop-filter` over a live WebGL canvas costs GPU time on phones every frame. | Surfaces are 95 % opaque lapis with a vellum rim, which reads over bright sand and a night city alike. |
| Top-centre calendar | Violated "prefer corners" and fought the money pill for width on 360-px phones. | Calendar moved to the top-right corner. Speed moved into the ring. The menu moves under the calendar on phones. |

### 2.3 Revisions from the screenshot rounds
1. **Round 1** (`ui-r1-*`):
   - The citizens row ran under the 3-row calendar on 390-px phones.
   - The Roman numeral "II" in the ring read as a pause glyph.
   - The plaque lacked a noun.

   Fixes:
   - Band 1 now holds only the two instruments.
   - Alerts get their own row.
   - The ring centre now shows the speed (×1, ×2, ×5, or ‖ in amber).
   - The quest chip moved to the thumb zone on phones.
   - The plaque reads "Полоса".
2. **Round 2** (`ui-r2-*`):
   - Side panels covered the strip and the building they described.
   - Desktop panels stretched to full height.
   - The coverage diamond was invisible on grass.
   - The drag handles looked like stray dots.
   - The landscape card grid clipped its text (a grid item with `overflow:hidden` collapses its rows; use `grid-auto-rows:max-content`).

   Fixes:
   - The **focus rule**: the camera pans so the subject sits in the visible part.
   - Panels are content-sized.
   - The coverage diamond is a vellum fill with a dark-malachite outline.
   - The ghost has four ground arrows.
3. **Round 3** (`ui-r3-*`):
   - Phone panels opened at 76 % and hid the Town Hall. They now open at a 62 % "peek" and scroll inside.
   - Landscape ✓ / ✗ now sit at the far left and far right (two thumbs).
   - Inline progress bars needed `display:block`.

---

## 3. Tokens

### 3.1 Colour (all on `:root`; no per-era theme)
| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--lapis-950` | #0F1530 | text on saffron/malachite fills, deepest wells | – |
| `--lapis-900` | #141B38 | thumbnails, input wells, segmented-control track | – |
| `--lapis-800` | #1B2448 | HUD surface (at 95 % alpha), sheet body | base |
| `--lapis-700` | #24305C | buttons, cards, list rows inside sheets | – |
| `--lapis-600` | #2F3C6E | disabled fills, progress tracks, selected segment | – |
| `--lapis-500` | #45548C | grips, strong dividers | – |
| `--vellum` | #FAF6EC | primary text and icons | 14.0 : 1 on 800 |
| `--haze` | #B3BCDD | secondary text, units, inactive tabs | 8.0 : 1 |
| `--dim` | #8590BC | disabled text only | 4.8 : 1 on 800, 3.4 : 1 on 600 (disabled) |
| `--malachite` | #74DB9F | positive numbers, lead, met needs | 8.9 : 1 |
| `--malachite-fill` / `-lip` | #3DBB74 / #1F7A47 | ✓ confirm button, "Забрать" | icon 7.3 : 1 |
| `--cinnabar` | #FF8C7A | negative numbers (with U+2212 "−"), missing needs, destructive outlines | 6.7 : 1 |
| `--cinnabar-fill` / `-lip` | #E4573F / #9A2E1C | ✗ cancel button, bad alert badges (icon only, white) | icon 3.7 : 1 |
| `--saffron` / `-lip` | #FFC24B / #B57B0C | the primary action (Строить, Купить, Улучшить), "Новое", strip "+" | text 11.2 : 1 |
| `--amber` | #FFC857 | warnings, paused, falling lead, lock reasons | 9.8 : 1 |
| `--rim` | rgba(250,246,236,.16) | 1-px inner rim of every surface | – |
| `--lip` | #0A0F27 | 3-px lip under pressables | – |

Rules:
- Text on a HUD surface never drops below 4.5 : 1. The 95 % surface over the brightest sand (#EAD9A6) keeps vellum above 12 : 1.
- Negative values use U+2212 "−" and cinnabar.
- Colour is never the only signal. Missing needs carry ✗, the falling lead carries ▼, alert badges carry icons.

### 3.2 Era accent (content: `epochs.json → accent`)
One accent per era, blended over 20 game years after entry (gdd §2.4). It is used for exactly these things:
- the year-ring fill;
- the race-line pennant and the flag before the lead;
- the era tag dot in the inspector;
- progress bars of the gate checklist;
- the quest chip's Town Hall icon.

Proposed values (each ≥ 6.8 : 1 on lapis-800):

| Era | Accent | Idea |
|---|---|---|
| e0 Античность | #C9D17A | olive leaf |
| e1000 Средневековье | #E79A8E | madder |
| e1500 Возрождение | #EBC562 | florin gold (the GDD example #c8a24a also passes: 6.3 : 1) |
| e1800 Индустриальная эра | #E3A066 | brass and steam |
| e1900 Модерн | #8DD3B0 | verdigris (Art Nouveau) |
| e2000 Современность | #79B8FF | signal blue |
| e2100 Ближнее будущее | #C3A6FF | ultraviolet |

The accent is never used:
- for buttons, focus, or good/bad meaning;
- for layout, radii or fonts.

### 3.3 Type
- **Family:** Geologica from Google Fonts. Request `family=Geologica:wght,SHRP@400..800,0..100&display=swap`, and also the plain `wght@400..800` request as a fallback. It has Latin and Cyrillic subsets (Uzbek Latin and Cyrillic covered). Fallback stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. No second family.
- **Two voices of one family:**
  - Text: SHRP 0, weights 450–700.
  - Numerals and the display year: SHRP 100, weight 760, `font-variant-numeric: tabular-nums lining-nums` (verified in the prototype: "1111" and "0000" measure the same width). The money ticker never jitters.
- **Scale** (ratio ≈ 1.2, phone sizes; desktop identical except where noted):

| Token | px / line-height | Use |
|---|---|---|
| `--t-xs` | 11 / 1.3 | badges, card effect lines, captions (minimum size) |
| `--t-sm` | 13 / 1.25 | body, chips, labels, advisor |
| `--t-md` | 15 / 1.3 | placement-bar name, list titles |
| `--t-lg` | 18 / 1.2 | sheet titles |
| `--num-hud` | 20 / 1.0 (22 desktop) | money value, year |
| `--t-xl` | 22 / 1.15 | era banner title |
| `--t-2xl` | 28 / 1.1 | Chronicle lead number |

- Sentence case everywhere. No all-caps. No letter-spaced eyebrows.
- Sheet sections use plain labels in haze ("Для «Каменного дома» нужно"), not uppercase tags.
- **Length budget:** every text container allows +30 % (en/uz). Chips truncate with an ellipsis and keep the full text in `aria-label` and `title`. Sheet text wraps; no fixed-width text boxes.
- Line length in sheets ≤ 52 ch (`max-width:52ch` on hint paragraphs).

### 3.4 Spacing, safe areas, breakpoints
- **Spacing:** a 4-px grid. Steps 4 / 6 / 8 / 10 / 12 / 16 / 24.
- **Gutters:** edge gutter `--gut` is 10 px (phone portrait), 8 px (phone landscape) and 16 px (desktop). Every zone offsets by `env(safe-area-inset-*) + --gut` (tokens `--top --bot --lft --rgt`). The page meta keeps `viewport-fit=cover`.
- **Touch targets:** ≥ 44 × 44 px. Alert badges are 38 px visual with a 46 px hit area (`::before` inset −4 px). ✓ / ✗ are 56 px (60 in landscape).

| Layout | Media query | Notes |
|---|---|---|
| Phone portrait (primary) | default | 360–430 wide; tablet portrait uses it with sheets capped at 560 px and centred |
| Phone landscape | `(orientation: landscape) and (max-height: 520px)` | side panels on the right; thumbs bottom-right |
| Desktop / tablet landscape | `(min-width: 1024px) and (min-height: 600px)` | right panel 400 px; build tray bottom-centre; shortcut hints visible |
| Input refinements | `(hover: hover)` adds hover and tooltips; `(pointer: coarse)` keeps all targets ≥ 44 even on large screens | – |

### 3.5 Radii (hierarchy, not one value)
| Radius | Use |
|---|---|
| pill 999 | readout chips, plaques, segmented speed |
| instrument 18 | calendar |
| button 16 | thumbs, sheet buttons |
| card 12 | build cards, fact tiles |
| chip 10 | list rows, need chips |
| sheet 22 | sheet top corners; all corners on desktop panels |

### 3.6 Elevation and the lip rule
| Level | Recipe | Used by |
|---|---|---|
| Readout | `inset 0 0 0 1px --rim, 0 1px 2px rgba(5,8,24,.55), 0 6px 16px rgba(5,8,24,.26)` | money, citizens, calendar, quest, advisor, plaques |
| Pressable | readout rim + `0 3px 0 --lip` (lip) + soft shadow; `:active` → `translateY(2px)`, lip 1 px | every button except list rows and tabs |
| Sheet | `inset 0 1px 0 --rim, 0 -10px 30px rgba(5,8,24,.38)` | bottom sheets; desktop panels `0 12px 40px` |
| Flat | 1-px rim only | cards and rows inside sheets |

- Primary (saffron) and confirm (malachite) buttons have a coloured lip (`--saffron-lip`, `--malachite-lip`).
- Disabled buttons lose the lip and turn lapis-600 / dim.

### 3.7 Icons
- **Grid:** a 24-px grid with 2-px stroke, round caps and joins, and a 2-px live-area padding.
- **Sizes:** drawn at 24; used at 24 (thumbs), 20 (sheets, alerts), 18 (chips) and 14–16 (inline cost lines, stroke 2.2).
- **Delivery:** one inline `<svg><symbol>` sprite in `ui/icons/sprite.tsx`. Components use `<Icon name="build" size={24}/>`. No emoji in chrome.
- **Chrome set** (ids as in the prototype):

| Group | Icons |
|---|---|
| Thumbs | build (hammer), upgrade (double chevron), goals (checklist), city (bars) |
| Chrome | menu, x, check, pause, layers, compass, target, bulldoze, move, rotate |
| People | people, face, bulb, lock, chev, chev-l, back, plus |
| Resources and alerts | wheat (food), bolt (power), drop (fuel), car (traffic), coin-off (arrears), briefcase (unemployment), hardhat (workers short) |
| Menu | cloud (save), sliders (settings), sound, globe (language) |
| Progress | flask (research), book (Chronicle, with a ribbon), hall (Town Hall), mat (materials), crate (goods), star, flag (lead pennant, story goals), trophy, chest (Казна) |
| Strips and map | anchor (bay), fish, pick (ore/coal), alert, water, health, edu, masks |
| Build categories | house, wheat, mat, factory, stall, service, masks, bolt, train, road |

- Still to draw: portal (tunnel arch), lighthouse (cape), sun (sunny slope), metro (M in a circle), rail, plane, port.
- **Currency faces** (gdd §3.1): seven duotone drawn icons on the same 24-grid with explicit fills (not `currentColor`). They are shown at 31 px in a 42-px lapis-950 disc in the money pill, and at 16 px in cost lines:

  | Id | Face |
  |---|---|
  | `cur-e0` | silver drachma with an owl, irregular strike |
  | `cur-e1000` | leather pouch with spilling groschen |
  | `cur-e1500` | gold florin with a lily and a milled edge |
  | `cur-e1800` | engraved note with a guilloche and a locomotive |
  | `cur-e1900` | folded bills with a coin |
  | `cur-e2000` | card with a chip and the contactless mark |
  | `cur-e2100` | glowing hexagonal token |

  The text symbol (₯ ₰ ƒ ₤ ¤ ▣ ◈) is used only in plain-text contexts (notifications, `title`).
- **Materials** in cost lines use the `mat` icon (three blocks), never the "▦" glyph, except in plain text.

### 3.8 Motion
| What | Duration / easing | Reduced motion |
|---|---|---|
| Button press | 90 ms, `cubic-bezier(.2,.8,.2,1)` | instant |
| Popover in/out | 160 ms fade + 4 px rise | fade 1 ms |
| Sheet in | 260 ms rise 24 px + fade; out 180 ms | fade only |
| Year ring | continuous, written from the frame loop (no CSS animation) | steps once per game year |
| Money | text swaps with no count-up for normal ticks; a gain ≥ 5 % at once (goal reward, chest) counts up over 600 ms with one saffron glint | swap |
| Coin flip on era entry | 1.2 s Y-rotation of the face disc (gdd §2.4) | 300 ms cross-fade |
| Era banner | 2.5 s: slide down 240 ms, hold, slide up 240 ms | fade |
| Lead jump (a gate line turns green) | pennant slides along the race line 500 ms; the lead number ticks up | swap |
| Strip bought | lock tint wipes from the town side outwards 600 ms | instant |
| Toast | 220 ms rise; auto-hide 4 s (errors 6 s) | fade |

- No looping idle animation in the HUD.
- The paused state is shown by colour (amber), not by blinking.

### 3.9 Layers (z-index)
| z | Layer |
|---|---|
| 0 | canvas |
| 5 | world-anchored plaques |
| 10 | HUD zones |
| 15 | placement / line bar and coach |
| 20 | sheets |
| 25 | popovers (menu, speed, quest lines) |
| 30 | toasts and era banner |
| 40 | modal dialogs (conflict, confirm) |

---

## 4. Layout and wireframes

Zones:

| Zone | Contents |
|---|---|
| TL | money, citizens, alerts |
| TR | calendar, menu (speed pop) |
| QZ | quest chip |
| MAP | layers, compass |
| B | advisor, thumbs |
| Plaques | world-anchored |

### 4.1 Phone portrait, idle (390 × 844; works down to 360)
```
┌──────────────────────────────────────────┐ safe-top
│╭────────────────╮   ╭──────────────────╮ │
││(₰) 8,42K       │   │(×1) 121 г. ⚑+1 207│ │  band 1: the two instruments
││    +1,26K/год  │   │     Средневековье │ │
│╰────────────────╯   │ ▬▬▌▬▬⚑▬ ▬ ▬ ▬ ▬  │ │  race line
│╭──────────────────╮ ╰──────────────────╯ │
││ 👥 380/412 | ☺71 %│                ╭──╮ │  band 2: citizens · menu(+save dot)
│╰──────────────────╯                │≡ •│ │
│ (🌾) (🚗)   alert badges (only when any) ╰──╯ │  band 3
│                                          │
│ ‹(+)4,4K                    4,4K(+)›     │  edge chips: off-screen strips (idle only)
│                 the city                 │
│                                          │
│╭────────────────────────╮    (◇)  (◎)   │  QZ (quest) · MAP (layers, compass)
││🏛 К Возрождению ■□□□  ›│                │
│╰────────────────────────╯                │
│╭────────────────────────────────────────╮│
││💡 18 домов не растут: нет лечебницы  › ││  advisor
│╰────────────────────────────────────────╯│
│╭────────╮╭────────╮╭────────╮╭────────╮  │
││ Строить ││Улучшить9││ Задачи •││ Город  │ │  thumbs (60 px), Строить = saffron
│╰────────╯╰────────╯╰────────╯╰────────╯  │
└──────────────────────────────────────────┘ safe-bottom
```
- **Widths at 360:** money ≤ 142 + 6 + calendar ≤ 184 = 332 ≤ 336.
  - The calendar's text column is sized for the longest era name («Индустриальная эра»).
  - Band 2 is citizens ≤ 170 plus the menu.
  - Band 3 holds up to 4 badges; from the 5th they collapse into one badge «+N».
- **Coverage:** top 150 px (left) / 124 px (right); bottom 170 px. The centre 520 px is free.

### 4.2 Phone portrait with sheets
```
 Build tray (≈ 300 px)                  Inspector / panels (peek 62 %, drag to 90 %)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ [band 1 + 2 HUD stays]       │        │ [band 1 + 2 HUD stays]       │
│      city (camera oy 36 %)   │        │   ▣ selected (camera oy 27 %) │
│╭────────────────────────────╮│        │╭────────────────────────────╮│
││          ───               ││        ││           ───              ││
││ ‹Торговля [Услуги•] Досуг›(⌂̸)(✕)│     ││ [img] Изба               ✕ ││
││╭──────╮╭──────╮╭──────╮╭── ││        ││ Жилой дом, уровень 3 из 11 ││
│││ img  ││ img  ││ img  ││   ││        ││ ● Средневековье            ││
│││Знахарь││Акведук││Монаст.││  ││        ││ [Жители 10/10][Налог +20/год][Довольство 74 %]
│││510+26 ││360+18 ││1,5K+75││  ││        ││ Для «Каменного дома» нужно ││
│││Здоровье││Вода r4││Образ. ││  ││        ││ (✓Вода)(✓Досуг)(✗Здоровье) ││
││╰──────╯╰──────╯╰──────╯╰── ││        ││ [ Поставить знахаря ]      ││
│╰────────────────────────────╯│        ││ [ Улучшить 210 + 17 ] (dis)││
└──────────────────────────────┘        ││ [Переместить] [Снести]     ││
 thumbs, advisor, quest, map buttons     │╰────────────────────────────╯│
 hide while any sheet is open            └──────────────────────────────┘
```

### 4.3 Phone portrait, placement
```
┌──────────────────────────────┐
│ [band 1 + 2 HUD]             │
│        ▲                     │
│     ◀ [ghost] ▶   coverage diamond (vellum fill, dark-green edge),
│        ▼          homes inside tinted green
│                              │
│  ╭ (✥) Перетащите здание, чтобы сдвинуть ╮   coach (first 3 times)
│╭────────────────────────────╮│
││(✗)   Знахарь 1×1        (✓)││  placement bar: 56-px ✗ (cinnabar) at the left thumb,
││      [₰]510 + [▦]26        ││  ✓ (malachite) at the right thumb
││  Здоровье получат 14 домов ││  effect (malachite) or reason (cinnabar)
│╰────────────────────────────╯│
└──────────────────────────────┘
```

### 4.4 Phone landscape (844 × 390)
```
┌───────────────────────────────────────────────────────────────────────┐
│╭──────────╮╭─────────────────╮(🌾)(🚗)      ╭────────────────────╮ ╭──╮│
││(₰) 8,42K ││👥 380/412 | ☺71 %│              │(×1) 121 г. ⚑+1 207  │ │≡ ││
││ +1,26K/год╰─────────────────╯              │  Средневековье ▬▬⚑▬ │ ╰──╯│
│╰──────────╯                                 ╰────────────────────╯     │
│╭───────────────────────╮                                               │
││🏛 К Возрождению ■□□□ ›│  ‹(+)4,4K                          4,4K(+)›   │
│╰───────────────────────╯                 city                (◇)(◎)    │
│╭──────────────────────────────────────╮ ╭──────╮╭──────╮╭──────╮╭──────╮│
││💡 18 домов не растут: нет лечебницы › │ │Строить││Улучш.││Задачи││Город ││
│╰──────────────────────────────────────╯ ╰──────╯╰──────╯╰──────╯╰──────╯│
└───────────────────────────────────────────────────────────────────────┘
 Sheets: a right side panel (min(420 px, 52 vw), full height). The camera re-centres on the free left part.
 The build tray is the same panel with a 2–3 column card grid (vertical scroll).
 The placement bar spans the full width: ✗ far left, ✓ far right.
```

### 4.5 Desktop (1440 × 900)
```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│╭──────────╮╭────────────────╮(🌾)(🚗)         ╭──────────────────╮╭‖ ×1 ×2 ×5╮ ╭──╮   │
││(₰) 8,42K ││👥 380/412 ☺71 %│                  │(×1) 121 г. ⚑+1 207││(segmented)│ │≡•│   │
││ +1,26K/год╰────────────────╯                  │ Средневековье ▬▬⚑▬│╰──────────╯ ╰──╯   │
│╰──────────╯                                   ╰──────────────────╯                    │
│╭ 🏛 К Возрождению ■□□□ ────────╮                                ╭ panel 400 px ───────╮ │
││ 👥 Жители          380 / 460 ││                                │ Inspector / Strip / │ │
││ ⚒ Кузницы            1 / 2   ││                                │ City / Town Hall …  │ │
││ ⚗ Открытия эпохи     2 / 3   ││          the city              │ (content height)    │ │
││ [🏛 Открыть ратушу]          ││                                ╰─────────────────────╯ │
│╰──────────────────────────────╯                                                       │
│                  ╭──────────────────────────────────────────────────╮           (◇)   │
│                  │💡 18 домов не растут: нет лечебницы рядом      › │           (◎)   │
│                  ╰──────────────────────────────────────────────────╯                 │
│                  ╭B Строить─╮╭U Улучшить 9╮╭G Задачи •╮╭C Город──╮                    │
│                  ╰──────────╯╰────────────╯╰──────────╯╰─────────╯                    │
└───────────────────────────────────────────────────────────────────────────────────────┘
 The build tray replaces the thumbs: bottom-centre, min(1060 px, 100 % − 32 px), horizontal cards 156 px.
```

---

## 5. Components and their states

### 5.1 HUD
| Component | Content | States |
|---|---|---|
| **MoneyPill** | Era face disc (42 px), value (≤ 6 chars, `--num-hud`), net `+1,26K/год` (malachite) or `−310/год` (cinnabar). | normal · **arrears** (value 0, net cinnabar, face disc gets a cinnabar rim; the arrears badge appears) · **face flip** for 1.2 s at era entry · **«1 ₰ = 1 ₯»** line in the tooltip for 20 years after a face change. Tap → City sheet. aria: «Деньги: 8 420 (гроши), плюс 1 260 в год». |
| **CitizensChip** | people icon, `380`, `/412` (P*, haze), divider, face icon, `71 %`. | Face colour: ≥ 65 malachite, 40–64 amber, < 40 cinnabar. **Growing** (P < P*): `/412` stays haze. **Over capacity** (P > P*): `/412` turns amber. Tap → City sheet, scrolled to happiness. |
| **AlertBadges** | One 38-px round badge per active alert, in gdd §11.1 order: food import 🌾, power/fuel import ⚡, arrears, traffic 🚗, unemployment, workers short. | Bad (cinnabar fill, white icon): food import > 3 % of gross, power/fuel > 8 %, arrears. Warning (amber fill, lapis icon): traffic, unemployment, workers short. Appears with a 160 ms pop. More than 4 → the 4th becomes «+N», which opens a list popover. Tap → its overlay or sheet section. Event tray badge (saffron, with a count) joins this row when a choice waits. |
| **CalendarInstrument** | **Ring button** (54 × 64 hit area): the ring fills once per game year in the era accent; the centre shows `×1` / `×2` / `×5` or ‖. **Main button**: year (`121`, SHRP numerals) + `г.`; lead with a pennant (`⚑ +1 207`); era name; race line. | **Running:** accent ring. **Paused:** ring and centre amber, the instrument gets a 1.5 px amber rim. **Lead falling** (fell over the last 10 years): lead and race fill amber, the pennant icon becomes ▼. **History catching up** (Near Future, lead < 0): lead shown as `−34` in haze, no fill. **Gate building:** the pennant sits at f = 0.98. Tap ring → speed popover. Tap main → Chronicle. Long-press 500 ms (touch) or hover (desktop) → lead tooltip card. |
| **RaceLine** | Six equal segments (eras 0→1000, 1000→1500, …, 2000→2100). The vellum tick is the calendar year mapped into its era segment. The pennant is the city's E(t) = era index + f. The fill between them is the lead. | Width 112 px on phones, 160 px on desktop. `aria-hidden`; the main button's label carries the numbers. |
| **SpeedPopover** | `‖ ×1 ×2 ×5` (testers also `×20 ×50` and a «Тест» tag). | Phone: pops under the instrument and closes after a choice or an outside tap. Desktop: always-visible segmented control between the calendar and the menu. Selected option: vellum fill, lapis text. |
| **MenuButton** | 44-px round button; save dot at its top-right. | Dot states: green «Сохранено», pulsing amber «Сохраняем…» (pulse disabled with reduced motion), red «Не сохранено» (tap → menu with «Повторить»). Opens the Menu popover. |
| **QuestChip** | Town Hall icon (accent), «К Возрождению», 4 pips (malachite = line done), chevron. | Collapsed (phone default) · expanded: three open lines with progress bars + «Открыть ратушу». Desktop: always expanded as a card under the money. **All green:** pips all malachite, the label becomes «Ратуша готова к улучшению», one saffron glint. **Building:** «Дворец строится: 3 года» with a bar. Line count follows `epochs.json` (3 or 4 lines, gdd §2.2). |
| **AdvisorLine** | Bulb (saffron) + one sentence (first matching rule of gdd §9.5) + chevron. | Tap → opens the overlay or card that fixes it. Long-press → «Скрыть совет»: collapses to a bulb button until a new rule fires. Text truncates; the full text is in `aria-label`. |
| **ThumbBar** | Строить (saffron) · Улучшить (count badge: eligible homes in frame) · Задачи (malachite dot: a reward to collect; saffron dot: new story goal) · Город. | Pressed (sinks 2 px) · open (the button of the open sheet shows a vellum underline when the sheet is a side panel and the bar stays visible) · desktop shortcut keycap top-left (B, U, G, C). |
| **MapButtons** | Layers (overlays), Compass (tap: rotate the camera 90°; long-press or double-tap: back to the Town Hall, north up). | Layers shows the accent dot when an overlay is on. The metro x-ray is reached here (Слои → Метро). |
| **StripPlaque** | World-anchored at the middle of the next purchasable strip on each side: saffron "+" disc, «Полоса», price with the face, feature icon + word (уголь / бухта / руда, богатая / портал / нефть / мыс / солнце). | Visible when its anchor is on screen and outside the HUD zones. **Affordable** (normal) · **unaffordable** (price in amber; the plaque still opens the sheet, which offers the loan). Hidden during placement and in the build tray. |
| **EdgeChip** | `‹ (+) 4,4K` on the side where an off-screen plaque lies (idle only, vertically clamped to 40–55 % of the height). | Tap → camera glides to the strip and opens the strip sheet. |

### 5.2 Sheets (one `Sheet` primitive)
**Placement of the Sheet:**
- Phone portrait: bottom sheet. Peek at content height up to 62 %; drag the grip up to 90 %, swipe down to close.
- Phone landscape: right side panel.
- Desktop: right panel, 400 px, content height, under the top-right HUD.
- `kind="tray"` (build) is a bottom sheet on phones and desktop, and the right panel in landscape.

**Behaviour:**
- `role="dialog"`, non-modal (the map stays live).
- Focus moves to the title on open, Esc closes, focus returns to the opener.
- Only one sheet at a time. Opening another replaces it without a close animation.
- **Focus rule:** a sheet about a world object calls `renderer.focusOn(x, y, inset)` so the object sits in the visible part (phone: upper 27 %; side panel: centre of the free area).

| Sheet | Content | States |
|---|---|---|
| **BuildTray** | Tabs in gdd §11.2 order: Жильё, Еда, Материалы, Производство, Торговля, Услуги, Досуг, Энергия, Транспорт, Дороги. Each tab: icon + name; a saffron dot if it holds a NEW card. Header tool: **Снос** (icon-only on phones). Close ✕. Cards scroll horizontally on phones and desktop and form a grid in landscape. | Opens on the last used tab; the first time, on the tab of the Advisor's fix. Tabs fade at the edges when they scroll. Empty tab: one inviting sentence («Энергия появится в Возрождении: ветряная мельница ускорит фермы рядом»). |
| **BuildCard** | Rendered thumbnail (engine `scene/thumbnails.ts`, lazy, cached), name (level name), cost line `[face]510 + [mat]26`, one effect line (gdd §11.2 style: «+14 жителей. Нужны вода, досуг, здоровье», «+53 еды в год, окупится за 17 лет», «Здоровье в радиусе 3»), «Новое» badge. | **Locked:** the thumbnail is greyed, with an amber lock line «Откроется: Мореплавание» (tech) or «Откроется: Возрождение» (era). Only the next era's buildings are shown. **Unaffordable:** the cost is cinnabar; the card still opens placement, which states the shortfall. **Unique and built:** «Уже построен: показать». **Pressed:** lip sink. One card per building at its best unlocked level; the level is chosen in the placement bar. |
| **Inspector** | Header: thumbnail, level name, «Жилой дом, уровень 3 из 11», era tag (dot in the **level's** era accent, so an old Шалаш in a medieval city says «Античность»). Facts row (3 tiles, per type): homes → Жители, Налог, Довольство; producers → output/year, workers, upkeep; services → radius and homes covered. **Needs** (homes): chips for the next level's tier with ✓ / ✗, one hint sentence, one fixing action. Actions: Улучшить (trade-in price), Переместить (10 %), Законсервировать / Открыть, Снести (refund line). | States: строится (progress bar + years left) · законсервировано (grey; Открыть is primary) · наследие (saffron tag «Наследие ×2») · no road (cinnabar banner «Нет дороги до ратуши») · power/inputs short. Type extras: charter picker (district hall), order cards with «Отгрузить» (port), flight routes (airport), lines list (metro station), «Улучшить улицу (12 участков)» and capacity/ρ (road). Move is absent for Town Hall, port, station and airport; Снести is absent for the Town Hall. |
| **UpgradeSheet** | «Устаревшие дома в кадре». Groups by target level: «9 домов → «Изба»» + gain + price button. Blocked groups give the reason + Показать. Primary: «Улучшить всё доступное [face]1,8K». | Empty: «В кадре нечего улучшать. Сдвиньте карту». Money short: the primary buys groups in order while money lasts and says «Хватит на 6 из 9». |
| **TownHallSheet** | Checklist lines (≤ 4) with progress bars (accent). Each line is tappable and leads to its fix (build tray at the item, City → homes, Задачи → Открытия). Stars row: the three thresholds as tiles («★★★ до 143 года», «★★ до 157 года», «★ до 1500 года»); the best still reachable one is outlined saffron. Upgrade button: cost + build years. Spirit-of-the-Age line «История ушла вперёд: −12 %» when active. Policies: Налоги (3-way segmented with effects; locked 5 years after a change: «Можно сменить в 126 году»), Плотная застройка (from e1800). Loan offer when the upgrade is unaffordable. Storage cap. | Gate incomplete → button disabled + «Ещё 3 условия». Complete → saffron button + glint. Building → progress + «Эпоха начнётся в 129 году». |
| **CitySheet** | Totals (Доход, Расход, Итого). «Главные потери» (top 3, each with a fix button). Income bars (taxes, export, tourism, orders, fares). Cost bars (buildings by category, roads, rail and metro, imports of food/materials/fuel/power, routes and programs, interest). Рабочие руки. Запасы (food/mat/goods with cap and rates; «пропадает N/год» in cinnabar on overflow). Fuel and power gauges (from e1800 / e1900). Happiness breakdown. Homes full vs P*. | Arrears banner «В недоимке: законсервировано 2 здания» with Открыть buttons. Mothballed list. |
| **GoalsSheet («Задачи»)** | Tabs: Эпоха (gate summary + story goal), **Открытия** (research), Задачи (2 side goals), Достижения (16). Reward rows to collect sit on top with «Забрать». | Story goal completed → «Забрать» (malachite). Side goals refresh every 10 years («Новые задачи через 4 года»). |
| **Research (tab)** | A 7-column timeline, one column per era, 4 cards each. Phone: horizontal snap scroll, the current era centred. Card: name, one effect, what it unlocks, cost, time, «Изучить». | done (malachite check) · active (accent bar, «осталось 1 год») · available · locked (older or later era: «Сначала Возрождение»). One at a time: other «Изучить» buttons say «После «Обжиг кирпича»». Spirit discount shown on cost. |
| **ChronicleSheet** | Header: the race line large (full width, era labels under the segments) and the lead sentence. One row per entered era: entry year, lead, stars, «на 926 лет раньше истории». Leaderboard tabs: Общий · Летопись · Эта эпоха (name, era, year, lead, stars, score). | Before the first era entry: «Первая звезда — войти в Средневековье до 1000 года». |
| **StripSheet** | Title (feature name: «Глубокая бухта», «Богатая руда», …), «Полоса справа/слева: 5 клеток в ширину, от гор до моря». 14-strip diagram (owned malachite, this one saffron). Feature lines with icons (gdd §5.3). Цена / В казне / Следующая полоса. «Купить полосу [face]4,4K». | Unaffordable: button disabled «Не хватает 1 200» + loan row «Ссуда казны: до 5 300 под 10 % в год» [Взять ссуду]. Out of order (L2 before L1): not shown; only the next strips have plaques. |
| **OverlaysSheet («Слои»)** | Radio list: Вода · Здоровье (from e1000) · Образование · Досуг · Довольство · Движение · Загрязнение · Зоны и месторождения · Шум аэропорта (e2000) · Метро (e1900, x-ray). Each row has its legend inline. | Active overlay → a legend chip in the QZ row («Движение: зелёный < 0,7, жёлтый < 1, красный — пробка» ✕). Placement and line tools switch their own overlay automatically and restore the previous one after. |
| **SettingsSheet** | Графика (Авто · Низкая · Средняя · Высокая), Звук (on/off + volume), Язык (Русский · English · Oʻzbekcha), Подсказки (coach marks on/off), Сбросить город (danger, typed confirm «СБРОС»). Tester tools if `tester`. | Auto quality: phones start at Low/Medium (v2 always High); the low-fps hint (v2's «🐢») becomes a toast «Графика упрощена: 24 к/с» with Вернуть. |

### 5.3 Tools (bars that replace the bottom zone)
| Bar | Layout | States |
|---|---|---|
| **PlacementBar** | ✗ (56, cinnabar) · info (name + footprint, cost line, effect or reason) · ✓ (56, malachite). Optional controls inside the info: level stepper `‹ Изба · Каменный дом ›` (homes), ⟳ rotate (rail station). | valid · invalid (✓ disabled, reason in cinnabar) · short of money (cost cinnabar, «Не хватает 120») · buy-missing («▦ 20 докупим за 80» inside the cost) · painting (homes/roads/parks: «8 домов: 1,8K + ▦ 140») |
| **LineBar** | ✗ · info (class name, «12 участков», cost, upgrade part «5 улучшим: 110 + ▦ 28») · Изгиб toggle · ✓. Road class chips above the bar: Улица / Проспект (when unlocked); rail: track level; metro: line colour swatch. | waiting for start («Коснитесь начала дороги») · drawing · blocked tiles (cinnabar, reason) · partial («Хватит на 8 из 12 участков» + «Построить 8») |
| **BulldozeBar** | ✗ · «Снос: выберите здание или проведите по дороге» · Снести (cinnabar-outline button, enabled when something is selected, with the refund «вернём 110»). | – |
| **Coach chip** | One line above the bar, first 3 uses of each tool: «Перетащите здание, чтобы сдвинуть», «Проведите от точки, чтобы проложить дорогу». | – |

### 5.4 Feedback
| Component | Spec |
|---|---|
| **Toast** | Top-centre under the HUD, max 360 px; at most one per 5 s, queued; only notable events (gdd §11.2): era, goal done, Town Hall built, event, error, research done, strip bought. Icon tone: malachite (done), saffron (event), cinnabar (error). Tap → related sheet; swipe up to dismiss. `role="status" aria-live="polite"`; errors `assertive`. |
| **EraBanner** | Top-centre, non-blocking, 2.5 s. Face disc (coin flip) + era name (22 px) + stars earned (saffron) + «на 1 343 года раньше истории» + «Что нового» link (opens a sheet: new verb, new buildings, 4 discoveries, Golden Age 10 years). No splash, no white flash, no year count-up. |
| **ChestCard** | On return when gdd §4.12 allows: a small centred card (modal-lite, the map dimmed 30 %): chest icon, «Пока вас не было, казна собрала 12,4K», «Забрать» (malachite). Closing without taking keeps it in Задачи. |
| **ConflictDialog** | Modal, pauses the game: «Этот город изменили в другой вкладке или на другом устройстве». «Загрузить последнюю версию» (primary) · «Остаться здесь» (closes; saving stays off; the save dot stays red). |
| **ConfirmDialog** | Only for irreversible, expensive actions: reset city, demolish a building whose refund > 1 year of net, close a flight route. Replaces v2 `window.confirm`. |
| **LeadTooltip** | Card under the calendar: «Опережение истории: +1 207 лет. Ваш город — как Европа 1 328 года (Средневековье, 66 % пути к Возрождению). Последнее: «Управа района с грамотой» +79 лет.» Late game: «История догоняет: город на 34 года позади». |
| **EventCard** | Choice events in a sheet; each button prints its effect («Купить 40 ▦ за 80», «Отказаться»). Gifts as a toast with «Забрать». A waiting choice keeps the saffron badge in the alerts row and expires after 10 years (free option taken, toast). |

---

## 6. Interaction flows

### 6.1 Place a building (touch)
1. Строить → tray. Tap a card. The tray hides. The ghost appears at the valid tile nearest to the screen centre (a spiral search up to 6 tiles, preferring tiles next to a road). The type's overlay switches on:
   - coverage diamond for services;
   - deposits and zones for mines, the coast and the airport plot;
   - noise for the airport.
2. The bar shows name, cost and effect («Здоровье получат 14 домов»). Homes inside the diamond are tinted.
3. **Move the ghost:**
   - a drag that starts on the ghost (its footprint + 1 tile) moves it; it snaps per tile with a 5 ms `navigator.vibrate` tick where supported;
   - a drag elsewhere pans the camera; pinch zooms and rotates;
   - a tap on another tile jumps the ghost there.
4. Invalid tile: the ghost and footprint turn cinnabar and ✓ disables. The reason comes from `canPlace`, for example:
   - «Рудник ставят у подножия гор на рудную жилу»;
   - «Нужна дорога рядом с входом»;
   - «Шум аэропорта: −8 к довольству у 3 домов» (allowed, shown in amber).
5. Homes: the stepper picks the level. If the tier is not met at the tile, the reason names it: «Для «Каменного дома» нужно: Здоровье». The stepper offers the best level allowed.
6. ✓ builds.
   - Single buildings return to the tray, with the same tab and scroll.
   - Repeatable types (homes, roads, parks, farms, fisheries, lumber) keep the tool. The next ghost goes to the nearest valid tile beside the last one.
7. **Paint (homes, parks):** long-press the ghost 400 ms, then drag. A row of ghosts follows the drag (an L-path like roads). The bar shows the count and total. ✓ builds all; money cuts the row with a cinnabar tail.
8. ✗ or Esc → back to the tray. A second ✗ or Esc closes it.

**Desktop:**
- The ghost follows the cursor; a click places it (✓ and Enter also work); drag-paint with the left button.
- Middle or right drag pans; wheel zooms toward the cursor; R rotates (station); Esc cancels.

### 6.2 Draw roads, rail and metro
1. Tray → Дороги → card (Тропа / Мостовая / … / Проспект) → the line tool. The LineBar says «Коснитесь начала дороги».
2. **Tap:** a start handle appears (a 44-px vellum ring on the tile). One-finger drags that do not start on the handle still pan; drawing never steals the pan (gdd §11.2).
3. **Drag from the handle:** an L-path preview.
   - The first leg runs along the longer axis; **Изгиб** (or Shift on desktop) flips the corner.
   - Tiles show as new (vellum), upgrade (malachite ↑) or blocked (cinnabar with a reason: «Дороги не строят на море»).
4. **Release:** the path stays. Both end handles stay draggable. The bar shows «12 участков [face]290 + [mat]72». Upgrade-by-redraw shows the trade-in part «из них 5 улучшим: 110 + ▦ 28» (gdd §6.4).
5. ✓ builds. The tool stays active and the end becomes the next start (chain drawing). ✗ or Esc ends.
6. Money short: the path is cut at the affordable point. «Хватит на 8 из 12 участков»; ✓ reads «Построить 8».

**Rail** (gdd §7.2):
- Same flow on the rail layer.
- Validation «Путь должен дойти до портала в горах». Level crossings are marked with a gate icon and «Переезд: дорога −20 %».
- The station is a normal placement with ⟳ (R): «Вокзал ставят вдоль прямого пути из 4 клеток».

**Metro** (gdd §7.3):
1. Слои → Метро, or the station card. This enters the **x-ray view**: the surface dims to 35 %, roads stay outlined.
2. The LineBar becomes: «Новая линия» → a colour pick (6 swatches) → «Коснитесь станций по порядку».
3. A tap on an existing entrance adds it. A tap on a road tile proposes a new entrance (price shown; rule «Не ближе 3 клеток к другой станции»).
4. Tunnels preview as L-paths between consecutive stations; each segment has its own Изгиб.
5. The cost line: «Тоннель 9 клеток: 108K».
6. ✓ opens the line; ✗ cancels; leaving x-ray restores the surface.

### 6.3 Bulldoze, move
- **Снос** (tray header or X):
  - The bulldoze bar appears.
  - A tap on a building highlights it cinnabar; the bar shows «Снести «Избу»? Вернём 110» and **Снести**.
  - A drag along roads selects a run: «Снести 6 участков, вернём 72».
  - Nothing is destroyed without the bar's confirm.
  - Refunds over 1 year of net use the ConfirmDialog.
- **Move:** Inspector → Переместить. The ghost of the same building appears with the placement bar «Переезд [face]22» (10 % of the level price). On ✓, the old spot clears. Not offered for the Town Hall, port, station and airport.

### 6.4 Select and inspect
1. Tap a building → Inspector (phone peek, landscape and desktop panel). The camera focuses it into the visible part.
2. A tap on another building swaps the content.
3. A tap on empty ground or ✕ closes.
4. Repeated taps on the same spot cycle stacked buildings (v2 PickCycle).
5. Needs ✗ → one fixing action (for example «Поставить знахаря» opens placement for the clinic, already near the home).
6. Upgrade shows the trade-in price; disabled with a reason line in amber when the tier or the era blocks it.

### 6.5 Upgrade all eligible
1. «Улучшить» (badge = upgradable homes in frame; recomputed when the camera stops, debounced 300 ms) → UpgradeSheet.
2. Per group «Улучшить», or «Улучшить всё доступное». No toast: the homes show scaffolding.
3. Blocked groups → Показать (switches on the needed overlay and closes the sheet).
4. Roads: inspector → «Улучшить улицу (12 участков)» (one confirm, cost summed).

### 6.6 Buy an expansion strip
1. **Plaque** on the map (or an edge chip) → the camera glides to the strip (strip outlined saffron, bay/deposits visible) → StripSheet.
2. **«Купить полосу [face]4,4K»** → the lock tint wipes away; toast «Полоса куплена: Глубокая бухта». The plaques move to the next strips with the next price (9,6K).
3. **Unaffordable:** the disabled button says «Не хватает 1 200» and offers the **loan** (gdd §4.10): «Ссуда казны: до 5 300 под 10 % в год» → confirm sheet with the repayment rule «Возвращается сама: 25 % чистого дохода».

### 6.7 Town Hall and era entry
1. The quest chip (or tapping the Town Hall) opens the TownHallSheet. Each line leads to its fix.
2. All lines green → the chip says «Ратуша готова к улучшению»; Advisor rule 9 switches to it.
3. «Улучшить до «Дворца»» → a confirm with the price (Spirit discount if any) and «Стройка 5 лет». The Town Hall gets scaffolding; the chip shows «Дворец строится: 3 года».
4. Build done:
   - EraBanner;
   - the money face coin-flips;
   - the accent starts its 20-year blend;
   - new cards get «Новое» and new tabs get dots;
   - Задачи gets the new story goal;
   - stars + Golden Age go into the banner and the Chronicle.
5. Nothing else moves: layout, fonts and the HUD stay.

### 6.8 Research and goals
- Задачи → Открытия (or T). Pick an available card → «Изучить [face]1,7K». The card shows its progress. On finish: toast «Открытие: Обжиг кирпича. Открыто: печь обжига, «Каменный дом»».
- Задачи → Эпоха / Задачи / Достижения. «Забрать» collects rewards (the malachite dot on the thumb).

### 6.9 Budget
- Город (or the money pill, or citizens). «Главные потери» buttons open the fixing overlay or the tray at the fixing card. Bars show exact values on tap (thin spaces: `1 240`).

### 6.10 Overlays
- Слои → radio list → the legend chip in the QZ row. ✕ or Слои again turns it off.
- Tools switch overlays automatically: service placement → its coverage; mines and coast → deposits/zones; the airport → noise; metro → x-ray.

### 6.11 Speed, calendar, lead
- Tap the ring → `‖ ×1 ×2 ×5` (Space toggles pause; 1 / 2 / 3 = ×1 / ×2 / ×5).
- Tap the calendar → Chronicle. Long-press or hover → LeadTooltip.
- The lead number updates once per game year (and at once when a gate line turns green: the pennant slides, 500 ms).

### 6.12 Save, conflict, return, hub
- **Autosave** every 20 s on revision change; keepalive on hide (v2 logic). The save dot reports it.
- **409** → ConflictDialog (pauses).
- **Return:** the calendar was frozen; if gdd §4.12 qualifies, the ChestCard.
- **Menu:**
  - Летопись (H), Открытия (T), Слои (L), Настройки;
  - «Сохранено 12 с назад»;
  - «К списку игр» (keepalive save, then `data-back-url`).

---

## 7. Input model

### 7.1 Gestures (canvas)
| Gesture | Idle / inspect | Placement | Line tool | Bulldoze |
|---|---|---|---|---|
| Tap | select building / close panel | move the ghost to the tile | set the start (first tap) | select a building |
| One-finger drag | pan | on the ghost: move it; elsewhere: pan | from a handle: draw; elsewhere: pan | along roads: select a run; elsewhere: pan |
| Long-press 400–500 ms | building quick info (name + level) | on the ghost: paint mode | – | – |
| Two fingers | pinch zoom + twist rotate + pan (v2 core kept) | same | same | same |
| Double-tap | zoom in one step toward the point | – | – | – |

The pointer machine lives in `ui/input/gestures.ts` as a pure reducer (testable). The 5-px drag threshold is kept from v2. **The ghost is computed on pointer-down/up, not on hover (fixes v2 R9b).**

### 7.2 Mouse
| Input | Action |
|---|---|
| Left click | select or place |
| Left drag | pan; with a line or paint tool, draw |
| Right / middle drag | rotate and tilt (v2) |
| Wheel | zoom toward the cursor |
| Hover | ghost follows; tooltips on HUD items |

### 7.3 Keyboard (one window listener; dialogs take priority, so Esc never fires twice: v2 Risk 5)
| Key | Action |
|---|---|
| B | Строить (toggle tray) |
| U | Улучшить |
| G | Задачи |
| C | Город |
| H | Летопись |
| T | Открытия |
| L | Слои |
| X | Снос |
| M | Переместить (selected) |
| R | Rotate the ghost (station) |
| Enter | Confirm placement or line |
| Esc | Cancel tool → close sheet → close popover |
| Space | Pause / resume |
| 1 / 2 / 3 | ×1 / ×2 / ×5 |
| Shift (line tool) | Flip the bend |
| WASD / arrows | Pan |
| Q / E | Rotate |
| + / − | Zoom |
| Home | To the Town Hall |
| Tab / Shift+Tab | Move through HUD and sheet controls; focus is always visible (two-tone ring: lapis 2 px + vellum 2 px + lapis halo) |

Letter shortcuts also match the Russian layout's physical keys (B=И, U=Г, G=П, C=С, H=Р, T=Е, L=Д, X=Ч, M=Ь, R=К).

---

## 8. Copy (ru first; keys ready for en and uz)

**Voice:**
- Plain verbs, sentence case. The button names the result: «Купить полосу», «Построить», «Снести», «Забрать».
- The same word follows through the flow: «Купить полосу» → toast «Полоса куплена».
- Errors say what is wrong and how to fix it, never «Ошибка».
- No exclamation marks except in the era banner.

**Numbers:** gdd §3.2 everywhere:
- HUD `8,42K`, sheets `8 420` (thin space U+2009);
- rates `/год`;
- negatives with «−».

| Key | Russian |
|---|---|
| `hud.money.aria` | Деньги: {exact} ({faceShort}), {sign} {net} в год. Открыть бюджет города |
| `hud.citizens.aria` | Жители: {pop} из {target} возможных. Довольство {h} % |
| `hud.calendar.aria` | {year} год, {era}. Опережение истории: {lead} лет. Открыть летопись |
| `hud.speed.aria` | Скорость ×{n}. Изменить скорость · Пауза |
| `hud.lead.tooltip` | Опережение истории: +{lead} лет. Ваш город — как Европа {cityYear} года ({era}, {pct} % пути к {next}). Последнее: «{cause}» +{years} лет. |
| `hud.lead.falling` | История догоняет: опережение упало на {n} лет за 10 лет |
| `hud.quest.label` / `.ready` / `.building` | К {nextDative} · Ратуша готова к улучшению · {hall} строится: {n} года |
| `alert.food` | Город покупает еду: {n} в год |
| `alert.power` | Электричество покупаем у соседей: {n} в год |
| `alert.arrears` | Казна пуста: законсервировано {n} здания |
| `alert.traffic` | Пробки: −{n} к довольству в {homes} домах |
| `alert.jobless` | Безработица {pct} %: нужны рабочие места |
| `alert.workers` | Не хватает рабочих: нужны дома |
| `advisor.*` | the ten rules of gdd §9.5 verbatim, e.g. «18 домов не растут: нет лечебницы рядом», «Деньги лежат без дела: купите полосу или улучшите дома» |
| `place.reason.road` | Нужна дорога рядом с входом |
| `place.reason.mountain` | {name} ставят у подножия гор{deposit, ore: на рудную жилу; coal: на угольный пласт} |
| `place.reason.coast` | Только у кромки воды |
| `place.reason.land` | Сюда нельзя: полоса не куплена |
| `place.reason.tier` | Для «{level}» нужно: {needs} |
| `place.noise` | Шум аэропорта: −8 к довольству у {n} домов |
| `place.coach` | Перетащите здание, чтобы сдвинуть |
| `line.start` / `line.coach` | Коснитесь начала дороги · Проведите от точки, чтобы проложить дорогу |
| `line.cost` | {n} участков · из них {u} улучшим |
| `line.partial` | Хватит на {k} из {n} участков |
| `rail.portal` | Путь должен дойти до портала в горах |
| `metro.spacing` | Не ближе 3 клеток к другой станции |
| `inspector.level` | {family}, уровень {l} из {max} |
| `inspector.needs` | Для «{next}» нужно |
| `inspector.refund` | Вернём 50 % уплаченного: {n} |
| `inspector.upgradeBlocked` | Сначала нужно {need} рядом |
| `upgrade.title` / `.group` / `.all` | Устаревшие дома в кадре · {n} домов → «{level}» · Улучшить всё доступное |
| `strip.plaque` | Полоса {price} {feature} |
| `strip.buy` / `strip.bought` | Купить полосу · Полоса куплена: {name} |
| `strip.short` / `loan.offer` | Не хватает {n} · Ссуда казны: до {max} под 10 % в год |
| `hall.gate` | К {nextDative}: готово {d} из {n} |
| `hall.stars` | Звёзды за вход в {nextAccusative} |
| `hall.spirit` | История ушла вперёд: −{pct} % |
| `era.banner` | {era}. {stars}. На {n} лет раньше истории |
| `era.whatsNew` | Что нового |
| `money.faceChanged` | 1 {new} = 1 {old} — та же казна, новая монета |
| `chest.text` / `.take` | Пока вас не было, казна собрала {n} · Забрать |
| `save.ok` / `.saving` / `.failed` | Сохранено {ago} назад · Сохраняем… · Не сохранено: нет связи. Повторить |
| `conflict.text` | Этот город изменили в другой вкладке или на другом устройстве |
| `conflict.reload` / `.stay` | Загрузить последнюю версию · Остаться здесь |
| `settings.*` | Графика · Авто · Низкая · Средняя · Высокая · Звук · Язык · Подсказки · Сбросить город |
| `menu.back` | К списку игр |
| `empty.energy` | Энергия появится в Возрождении: ветряная мельница ускорит фермы рядом. Электричество — в Модерне |

i18n notes:
- `ui/i18n/{ru,en,uz}.ts` with the same key set, plus `plural(n, forms)` (ru: one/few/many; uz: one/other; en: one/other).
- Case forms that Russian needs («к Возрождению», «в Возрождение») come from content: `epochs.json` gains `nameDative` and `nameAccusative` (or the copy is rephrased to avoid case: «Следующая эпоха: Возрождение»).
- Content names stay in content.
- Engine strings (`canPlace` reasons, toasts) become **codes with params**, not text; the UI translates them.

---

## 9. Accessibility
- Contrast as in §3.1. Never colour alone.
- Visible focus on every control: the two-tone ring works on saffron, lapis and the scene.
- Every icon-only button has an `aria-label` that carries its shortcut in `aria-keyshortcuts`.
- Numbers in labels are exact («8 420 (гроши)»), not compact.
- Sheets: `role="dialog"`, labelled by their title; Esc closes; focus is trapped only in modal dialogs (Conflict, Confirm, Chest).
- The canvas has `role="img"` and a short label. All game actions are reachable from the HUD and sheets (selection by keyboard: Tab into «Город» lists, «Показать» focuses the camera).
- `prefers-reduced-motion`: as in §3.8.
- `prefers-contrast: more`: the rim becomes 2 px vellum at 40 %.
- Touch targets ≥ 44 px. The thumb zone holds the frequent actions; nothing frequent sits in the top 25 % on phones except readouts.
- Text can grow to 130 % (browser zoom) without overlap. The HUD switches to the compact alert stack («+N») when needed.

---

## 10. Performance contract (what the implementation must keep)
- **No whole-tree timer render.** The v2 `useReducer` tick every 250 ms (City3Game.tsx) is removed.
- **One sampler.** The frame loop calls `hudStore.sample(game)` at 4 Hz. It builds a flat snapshot of primitives and **pre-formatted strings** from cached aggregates (O(1); gdd §4.13). Subscribers re-render only when their selected slice changed. At ×1:
  - the money text changes ≤ 1×/s;
  - the year changes once per 25 s;
  - most frames render nothing.
- **Imperative per-frame bits**, written to DOM refs from `useFrame` and never through React state:
  - the year-ring progress (`--p`);
  - plaque positions (`renderer.project`);
  - the ghost/handle overlay (renderer `Overlay` ref, as in v2).
- **Structural data** (cards, inspector details, upgrade groups, gate lines) recomputes only when `game.revision` or the selection changes.
- **Thumbnails** render lazily, one per idle frame (`requestIdleCallback`), cached as object URLs. Never all at once on the first tray open (v2 Risk 2).
- **CSS:** no `backdrop-filter`, no animated shadows. Sheets animate `transform` and `opacity` only. Images are SVG sprites.
- **Budget:** HUD React work < 1 ms per frame on a mid phone at ×1. A tray or sheet opening < 16 ms after the first thumbnail.

---

## 11. Component → React file plan (`app/Games/City3/client/ui`)

The new UI replaces the v2 port in this folder:

| v2 file | Fate |
|---|---|
| `hud.tsx` | split into `hud/*` |
| `build.tsx` | → `sheets/build/*` |
| `inspector.tsx` | → `sheets/inspector/*` |
| `epoch.tsx` | → `sheets/TownHallSheet.tsx`, `sheets/ChronicleSheet.tsx`, `feedback/EraBanner.tsx` |
| `research.tsx` | → `sheets/goals/ResearchTab.tsx` |
| `bureau.tsx` | → `sheets/BureauSheet.tsx` (styles kept, gdd §8.1) |
| `common.tsx` | → `format.ts`, `icons/*`, `sheets/Sheet.tsx`, `kit/*` |

- `City3Game.tsx` shrinks to wiring: renderer, game, stores, `<Hud/>`.
- CSS moves from `city3.css` and `styles/base.css` (HUD parts) into `ui/styles/*.css`.
- Every class takes the `c3-` prefix (v2 class names collide with the v1 city: 6-ui Risk 8).

### 11.1 Stores
```ts
// ui/store/hud-store.ts — the 4 Hz snapshot (no React inside)
export interface HudSnapshot {
  moneyText: string; moneyExact: number; netText: string; netSign: -1 | 0 | 1; face: EraId; arrears: boolean;
  popText: string; targetText: string; overCapacity: boolean; happiness: number;
  alerts: readonly AlertId[];                 // stable array identity unless the set changes
  year: number; era: EraId; eraIndex: number; accent: string;
  lead: number; leadFalling: boolean; leadAhead: boolean; raceNow: number; raceCity: number; // 0..1 along the race line
  speed: 0 | 1 | 2 | 5 | 20 | 50; tester: boolean;
  save: 'saved' | 'saving' | 'failed'; savedAgoS: number;
  gate: { readonly lines: readonly GateLine[]; done: number; total: number; state: 'open' | 'ready' | 'building'; yearsLeft?: number };
  advisor: { rule: number; key: string; params: Record<string, string | number>; target: FixTarget } | null;
  upgradeInFrame: number; goalsToCollect: number; newStory: boolean; eventsWaiting: number;
}
export interface HudStore { getSnapshot(): HudSnapshot; subscribe(fn: () => void): () => void; sample(game: Game, view: CameraView): void; }
export function createHudStore(): HudStore;          // sample() copies only changed fields (structural sharing)

// ui/store/use-hud.ts
export function useHud<T>(select: (s: HudSnapshot) => T, equal: (a: T, b: T) => boolean = Object.is): T;
// useSyncExternalStore + a selector memo keyed by snapshot identity; shallowEqual helper for tuples.

// ui/store/ui-store.ts — UI state (sheet, tool, selection, popover, overlay) with a tiny reducer
export type SheetId = 'build' | 'inspect' | 'upgrade' | 'hall' | 'city' | 'goals' | 'chronicle' | 'strip' | 'overlays' | 'settings' | 'bureau' | 'event' | 'whatsNew';
export type Tool =
  | { kind: 'select' }
  | { kind: 'place'; type: string; level: number; rot: 0 | 1; ghost: Tile | null; paint: Tile[] }
  | { kind: 'line'; network: 'road' | 'rail' | 'metro'; cls: string; start: Tile | null; end: Tile | null; bend: 0 | 1; lineId?: string }
  | { kind: 'bulldoze'; picked: number[] | null }
  | { kind: 'move'; uid: number; ghost: Tile | null };
export interface UiState { sheet: SheetId | null; tool: Tool; selection: { uid: number } | { strip: StripId } | null;
  popover: 'speed' | 'menu' | 'quest' | 'alerts' | null; overlay: OverlayId | null; buildTab: CategoryId; coachSeen: Record<string, number>; }
export const uiStore: Store<UiState, UiAction>; export function useUi<T>(select: (s: UiState) => T): T;

// ui/store/structural.ts — memo by game.revision (+ selection) for heavy derived data
export function useStructural<T>(compute: (game: Game) => T, deps?: unknown[]): T;

// ui/store/frame.ts — per-frame imperative subscribers (ring, plaques, money tween)
export function useFrame(cb: (dt: number, view: CameraView) => void): void;   // registered with the game loop
```

### 11.2 Files
| File | Component(s) / module | Reads (selector) | Re-renders when |
|---|---|---|---|
| `Hud.tsx` | zone layout (TL, TR, QZ, MAP, B), switches B ↔ tool bars | `useUi(s => [s.sheet, s.tool.kind])` | sheet or tool kind changes |
| `hud/MoneyPill.tsx` | MoneyPill + `CurrencyFace` + coin flip | `[moneyText, netText, netSign, face, arrears]` | text changes (≤ 1/s) |
| `hud/CitizensChip.tsx` | CitizensChip | `[popText, targetText, overCapacity, happiness]` | population text / band |
| `hud/AlertBadges.tsx` | badges + «+N» popover + event badge | `[alerts, eventsWaiting]` | set changes |
| `hud/CalendarInstrument.tsx` | ring button (speed), main button, `RaceLine` | `[year, era, accent, lead, leadFalling, leadAhead, raceNow, raceCity, speed]`; the ring fill via `useFrame` | year/lead change (≈ 1/25 s) |
| `hud/RaceLine.tsx` | race line (also used large in the Chronicle) | props | – |
| `hud/SpeedPopover.tsx` | `‖ ×1 ×2 ×5` (+ tester) | `[speed, tester]` + `useUi(popover)` | speed |
| `hud/MenuButton.tsx` | menu + save dot + Menu popover | `[save, savedAgoS]` (the ago text only while open) | save state |
| `hud/QuestChip.tsx` | chip + lines (expanded on desktop) | `gate` (shallow) | a line changes |
| `hud/AdvisorLine.tsx` | advisor | `advisor` | rule or params change |
| `hud/ThumbBar.tsx` | four thumbs, badges, shortcuts | `[upgradeInFrame, goalsToCollect, newStory]` | counts |
| `hud/MapButtons.tsx` | layers, compass | `useUi(overlay)` | overlay |
| `map/StripPlaques.tsx` | plaques + edge chips | `useStructural(strips)` + `useFrame` for positions | strips owned / money band (affordable) |
| `sheets/Sheet.tsx` | primitive: bottom / side / tray, grip snap (62 % / 90 %), focus, Esc, focus rule | props | – |
| `sheets/build/BuildTray.tsx`, `CategoryTabs.tsx`, `BuildCard.tsx`, `Thumb.tsx` | tray, tabs, cards, lazy thumbnails | `useStructural(buildCatalog)` + money band | revision / tab |
| `sheets/inspector/Inspector.tsx` + `Facts.tsx`, `NeedsLadder.tsx`, `InspectorActions.tsx`, `extras/{CharterPicker,PortOrders,FlightRoutes,MetroLines,RoadSegment}.tsx` | inspector | `useStructural(inspect(uid))` + a 1/s live facts selector | revision, selection, live facts text |
| `sheets/UpgradeSheet.tsx` | bulk upgrade | `useStructural(upgradeGroups(frame))` | revision, camera stop |
| `sheets/TownHallSheet.tsx` + `GateChecklist.tsx`, `StarsRow.tsx`, `Policies.tsx`, `LoanOffer.tsx` | Town Hall card | `gate` + structural | gate / revision |
| `sheets/CitySheet.tsx` + `BudgetBars.tsx`, `TopLosses.tsx`, `Stocks.tsx`, `Gauges.tsx`, `HappinessBreakdown.tsx` | budget | `useHud(budget)` (a sub-snapshot sampled at 1 Hz only while open) | values while open |
| `sheets/goals/GoalsSheet.tsx`, `ResearchTab.tsx`, `AchievementsTab.tsx` | Задачи | structural + `researchProgress` (1 Hz while open) | – |
| `sheets/ChronicleSheet.tsx` + `Leaderboard.tsx` | Летопись | structural + fetch | – |
| `sheets/StripSheet.tsx` | strip purchase + loan | structural(strip) + `moneyExact` band | – |
| `sheets/OverlaysSheet.tsx`, `SettingsSheet.tsx`, `BureauSheet.tsx`, `EventSheet.tsx`, `WhatsNewSheet.tsx` | – | – | – |
| `tools/PlacementBar.tsx`, `LineBar.tsx`, `BulldozeBar.tsx`, `CoachChip.tsx` | tool bars | `useUi(tool)` + `useStructural(placeCheck(tool))` | ghost tile changes |
| `feedback/Toasts.tsx`, `EraBanner.tsx`, `ChestCard.tsx`, `ConflictDialog.tsx`, `ConfirmDialog.tsx`, `LeadTooltip.tsx` | feedback | event bridge queue | queue changes |
| `kit/Button.tsx`, `kit/CostLine.tsx`, `kit/Bar.tsx`, `kit/Segmented.tsx`, `kit/Chip.tsx` | shared pieces (`CostLine` renders face + mat icon, cinnabar when short, buy-missing) | props | – |
| `icons/sprite.tsx`, `icons/Icon.tsx`, `icons/currency.tsx` | sprite (`<IconSprite/>` once in `Hud`), `<Icon/>`, `<CurrencyFace era/>` | – | – |
| `input/gestures.ts` | pure pointer reducer: pan, pinch, tap, long-press, ghost drag, line handles, paint | – | unit-tested |
| `input/keyboard.ts` | shortcut map (Latin + Russian physical keys), dialog priority | – | unit-tested |
| `bridge.ts` | EventBus → toasts, era banner, structural revision, renderer overlay (`ghost`, `coverage`, `linePath`, `handles`, `strip`, `overlayMode`, `xray`) | – | – |
| `format.ts` | `money()`, `exact()`, `perYear()`, `signed()`, `years()`, `percent()`, U+2212, thin spaces (gdd §3.2) | – | unit-tested |
| `i18n/index.ts`, `ru.ts`, `en.ts`, `uz.ts` | `t(key, params)`, `plural()` | locale | – |
| `styles/tokens.css`, `hud.css`, `sheets.css`, `tools.css` | tokens of §3 on `:root`; `--era` set once on `.c3` from the snapshot accent (blended) | – | – |

### 11.3 Renderer and engine needs (small, for the slice owners)
- `renderer.project(x, y, z): [sx, sy, visible]` for plaques and edge chips.
- `renderer.focusOn(x, y, inset: { top, right, bottom, left }, smooth)` for the focus rule.
- `Overlay` gains:
  - `ghostState` ('ok' | 'bad' | 'warn');
  - `ghostHandles: boolean`;
  - `paint: Tile[]`;
  - `coverage: { service, x, y, w, h, r } | null`;
  - `line: { path, handles, kinds: ('new' | 'up' | 'bad')[] } | null`;
  - `stripHighlight: StripId | null`;
  - `overlay: OverlayId | null`;
  - `xray: 'buildings' | 'metro' | null`.
- Engine: `canPlace` returns `{ ok, code, params }`, not Russian text. Cheap counters for the snapshot:
  - net/year;
  - alerts;
  - gate lines;
  - advisor rule;
  - lead and E(t);
  - `upgradeCandidates(rect)`.

### 11.4 Tests (vitest, `npm run test:city3`)
- `format.test.ts`: every §3.2 example (`999`, `1,24K`, `12,4K`, `124K`, `1,24M`, `−310/год`, `12 400`).
- `hud-store.test.ts`: `sample()` with unchanged inputs notifies no one; a money change notifies only money selectors.
- `gestures.test.ts`: tap vs pan threshold; a drag from the ghost moves the ghost and a drag elsewhere pans; a line drag only from a handle; long-press paint.
- `keyboard.test.ts`: Esc order (tool → sheet → popover); Russian layout keys.
- `race-line.test.ts`: mapping of a year and E(t) into the 6-segment line.

---

## 12. Open questions
1. **Era name cases:** add `nameDative` / `nameAccusative` to `epochs.json`, or rephrase («Следующая эпоха: Возрождение»)? The spec assumes the content fields.
2. **Accent values:** adopt the proposed list (§3.2) in `epochs.json`, or keep the GDD's darker e1500 #c8a24a (also passes contrast)?
3. **Residents:** v2 had an NPC panel and a follow camera. The GDD lists no NPC surface, so the spec drops them. Keep a tiny «житель» card?
4. **Demolish undo:** a 5-second «Отменить» on demolition would remove most ConfirmDialogs. It needs an engine rollback of the refund. Worth it?
5. **Conflict:** does the server accept a forced overwrite («Оставить эту версию»)? If yes, add it as the secondary action.
6. **Upgrade badge scope:** «в кадре» (GDD) changes as the camera moves. Alternative: whole-city count, with the sheet still filtered to the frame.
7. **Thumbnails:** are 3D thumbnails rendered per level (as v2), or one per building with a level badge? The tray assumes per level, lazily.

### Decisions (lead, 2026-10-17)
1. Rephrase the copy so era names stay in the nominative («Следующая эпоха: Возрождение»); no case fields in `epochs.json`.
2. Adopt the proposed accent list (§3.2) in `epochs.json`.
3. No residents panel and no follow camera.
4. Yes: a 5-second «Отменить» after demolition instead of confirmation dialogs (the engine rolls back the refund).
5. Yes: the server accepts a forced overwrite on a save conflict («Оставить эту версию» as the secondary action).
6. The «Улучшить» badge counts the whole city; the sheet itself stays filtered to the frame.
7. Thumbnails per level, rendered lazily and cached.
