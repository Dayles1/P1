# API & Frontend Documentation

Reflects the actual, currently-working API and roles in this codebase — there is no Carrier/Client concept anywhere in the code, so documentation is organized by the real roles (`SUPER_ADMIN`, `ADMIN`, `USER`) and real feature areas instead.

- [`auth.md`](./auth.md) — registration, login/logout, password reset, email verification, password confirmation. Public + authenticated endpoints, available to everyone.
- [`user.md`](./user.md) — profile, avatars, sessions, personal settings, timezones. Available to any authenticated user regardless of role.
- [`admin.md`](./admin.md) — global app settings. Requires `SUPER_ADMIN` or `ADMIN`.
- [`chat.md`](./chat.md) — conversations & membership only; message send/list is **not implemented** — read this before attempting to build a chat UI.

Frontend: server-rendered Blade (`resources/views/blade/*`), talking to the JSON API via a shared Axios client (`resources/js/blade/axios`). Auth is a Sanctum bearer token stored in `localStorage`, **not** a server session — every page that needs to know "am I logged in" asks `GET /api/auth/me`, and route protection (guest-only / auth-only pages) is enforced client-side for UX plus real `401`/`403` responses server-side for actual security. See `auth.md`'s last section for the exact rules.

`docs/_audit/api-map.md` is a point-in-time working audit generated while building this frontend — useful historical context, but this README and the files above are the maintained reference going forward.
