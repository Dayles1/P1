# API & Frontend Documentation

Reflects the actual, currently-working API and roles in this codebase — there is no Carrier/Client concept anywhere in the code, so documentation is organized by the real roles (`SUPER_ADMIN`, `ADMIN`, `USER`) and real feature areas instead.

- [`auth.md`](./auth.md) — registration, login/logout, password reset, email verification, password confirmation. Public + authenticated endpoints, available to everyone.
- [`user.md`](./user.md) — profile, avatars, sessions, per-session request logs, personal settings, timezones, languages, dashboard. Available to any authenticated user regardless of role.
- [`admin.md`](./admin.md) — global app settings, user management (roles/bans), every session, instance-wide request logs. Requires `SUPER_ADMIN` or `ADMIN`.
- [`chat.md`](./chat.md) — conversations, membership, and messages (send/list now fully implemented, with a real `/chat` frontend).

Frontend: server-rendered Blade (`resources/views/blade/*`), talking to the JSON API via a shared Axios client (`resources/js/blade/axios`). Auth is a Sanctum bearer token stored in `localStorage`, **not** a server session — every page that needs to know "am I logged in" asks `GET /api/auth/me`, and route protection (guest-only / auth-only pages) is enforced client-side for UX plus real `401`/`403` responses server-side for actual security. See `auth.md`'s last section for the exact rules.

`docs/_audit/api-map.md` is a point-in-time working audit generated while building this frontend — useful historical context, but this README and the files above are the maintained reference going forward.

## Language / i18n

Three supported UI languages: `en`, `ru`, `uz` (`Language` rows, seeded by `LanguageSeeder`; `GET /api/languages` lists the active ones). Every user-facing string — API `message` fields, validation errors, and server-rendered Blade text — comes from `lang/{locale}/{auth,messages,validation,passwords,ui}.php`, never hardcoded. `ui.php` is the one dictionary shared between Blade (`__('ui.xxx')`) and client-rendered JS (`t('xxx')`, via `window.__i18n` injected by `blade.sections.i18n-bootstrap`).

`App\Http\Middleware\SetLocale` (global, both `web` and `api` groups) resolves the active locale per request in this order: the authenticated user's saved `user_settings.locale` → the `X-Locale` header (sent by the axios client on every XHR once a language is known) → the `locale` cookie (the only one of these that reaches a plain page load, which can't send a custom header) → the browser's `Accept-Language` → the `localization.default_locale` setting. Switching languages in the UI writes the cookie, saves it to the account if signed in, and reloads the page.

## Themes

Seven choices (`App\Domain\Setting\Services\ThemeCatalog`): `system` (resolved to `light`/`dark` client-side, never itself applied to the DOM) plus six real palettes — `light`, `gray`, `dark`, `black`, `green`, `orange` — implemented as CSS custom-property blocks in `resources/css/blade/app/app.css` (`html[data-theme="..."]`) and `resources/css/blade/auth/auth.css`. A tiny inline script (`blade.sections.theme-bootstrap`) applies the saved theme before first paint to avoid a flash. Persisted to `localStorage` for guests and to `user_settings.theme` for signed-in users.
