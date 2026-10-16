# City Chronicle 3 — UI / UX design brief

## Your method
You are working as a design lead. Follow the frontend-design skill exactly — read it first:
`C:\Users\abdukabir\.claude\plugins\marketplaces\claude-plugins-official\plugins\frontend-design\skills\frontend-design\SKILL.md`
(two passes: a compact token plan — colour, type, layout, principles — reviewed against the brief and the listed AI-design clichés,
THEN build; restraint; self-critique with screenshots; writing guidance).

## The product
City Chronicle 3 (Летопись города 3) — a 3D city builder in the browser, from year 0 to 2100. The game design document is
`C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\design\gdd.md`
(read it: every panel, number and verb the UI must serve comes from there). The overall brief: `...\design\brief.md`.
The current (v2) UI and its problems are analysed in `...\understand\6-ui.md` (read the R9 section and "Risks").
The audience: Russian-speaking players (ru first; the UI must be ready for en and uz later — no text baked into images,
room for 30% longer strings), casual-to-midcore, many on phones.

## The user's words about the UI
"Use the designer skill and change the whole interface. Make it convenient for every device, compact and not in the way of the game.
SimCity [BuildIt] and Clash of Clans are your examples. A mobile version of the game is needed." Also: "the main interface shows only
the main currency" (one currency whose face changes by era: coins → … → banknotes → cards → digital), and "an era transition must not
change everything" — so the UI must NOT re-skin itself wholesale per era (v2 swapped fonts, colours and radii per era); the era may
show itself in a restrained way (e.g. the currency face, one accent, an ornament) while layout, type and components stay stable.

## Constraints
- It is a HUD over a full-screen WebGL scene: legible over bright daytime grass and sand AND over a dark night city; it must not hide
  the city. Prefer edges and corners; transient sheets over permanent panels; nothing permanent in the centre.
- Devices: phone portrait (360–430 px wide, the PRIMARY target), phone landscape, tablet, desktop (mouse + keyboard shortcuts).
  Respect env(safe-area-inset-*). Touch targets ≥ 44 px. One-thumb reach for the most frequent actions on phones.
- Input flows that must be designed for touch (v2 is hover-driven and broken on touch):
  placing a building (ghost appears, drag it, confirm ✓ / cancel ✗, rotate if the GDD needs it), drawing roads / rail / metro lines
  (start, drag, bend direction, confirm, cost preview, upgrade-by-redraw), bulldoze, move, selecting a building (inspector as a
  bottom sheet on phones, side panel on desktop), "upgrade all eligible", buying an expansion strip (on-map affordance + confirm),
  the era / Town Hall upgrade, research, goals, the budget/economy view, transport overlays (underground view for metro, traffic,
  coverage), speed controls (pause/×1/×2/×5), calendar + "ahead of history" display, save status + conflict, offline-return summary,
  toasts, settings (quality, sound, language), back to the games hub.
- Tech: React 19 function components + plain CSS with custom properties (no Tailwind, no new npm dependencies). Icons: an inline
  SVG icon set you define (consistent stroke/grid) for UI chrome — emoji are not acceptable for chrome (platform-dependent);
  buildings in the build menu show rendered thumbnails. Fonts: one or two families loaded from Google Fonts with Cyrillic support.
- Performance: the HUD must not re-render the whole React tree every 250 ms (v2 does) — design components around small subscribed
  pieces (money ticker, year, selection) so the implementation can use a store with selectors.
- Accessibility: visible keyboard focus, prefers-reduced-motion respected, contrast ≥ 4.5:1 for text on HUD surfaces.

## Deliverables (in the design folder)
1. `ui-<you>.md` — the design plan (tokens with hex values, type scale, spacing, radii, elevation, icon grid, motion rules),
   the reviewed-and-revised plan notes, ASCII wireframes for phone portrait / phone landscape / desktop, every component with its
   states, every interaction flow step by step, copy samples in Russian, and a component → React file plan.
2. `ui-<you>.html` — a static, self-contained HTML prototype (inline CSS/JS, no external scripts except Google Fonts) of the main HUD
   over a stand-in for the 3D scene (use a CSS-drawn or generated placeholder that resembles an isometric city on grass with a beach,
   bright AND a night variant toggle), showing: the top HUD, the build menu open, a placement in progress with confirm buttons,
   the building inspector, and the expansion-strip purchase. Make it responsive so it works at 390×844, 844×390 and 1440×900.
3. Screenshots of your prototype at those sizes made with the existing tool:
   `node "C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad\shot\shot.mjs" "file:///<path-to-html>" "<out-prefix>" 1500 phone,phone-land,desktop`
   (no token needed for a file:// page). LOOK at the PNGs (Read them) and iterate until they are good.

## How the current game looks (v2 UI ported as-is into City3)
The real game can be screenshotted with a mocked API (no token, no database writes):
`MOCK_API=city3 node "<scratchpad>\shot\shot.mjs" "http://192.168.10.77:8000/games/city3" "<out-prefix>" 14000 phone,desktop`
Baseline screenshots (v2 UI, the thing to replace): `<scratchpad>\shot\out\baseline-phone.png` and `baseline-desktop.png`
— on a phone the top bar wraps into three rows, the camera column and the open build dock cover most of the city, emoji everywhere.
(<scratchpad> = C:\Users\ABDUKA~1\AppData\Local\Temp\claude\D--www-P1\442b7740-3163-4c2a-ba39-91e558e98b78\scratchpad)
