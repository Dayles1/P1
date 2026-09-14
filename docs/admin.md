# Admin API

Everything here requires `Authorization: Bearer <token>` **and** the `SUPER_ADMIN` or `ADMIN` role (enforced server-side by the `role:SUPER_ADMIN,ADMIN` middleware on the route group — a non-admin gets a real `403`, not just a hidden UI element).

`SUPER_ADMIN` and `ADMIN` now DO differ in one place: `App\Domain\Identity\Services\SuperAdminGuard`, backing the previously-inert `auth.protect_superadmin` setting. When that setting is on (the default, and locked):
- Only a `SUPER_ADMIN` can change a `SUPER_ADMIN`'s role or ban them — an `ADMIN` gets `403` even though they otherwise pass the route's role gate.
- Only a `SUPER_ADMIN` can grant the `SUPER_ADMIN` role to anyone (no self- or peer-escalation from `ADMIN`).

Everywhere else, both roles pass every admin check identically.

Frontend pages: `/admin/settings`, `/admin/users`, `/admin/sessions`, `/admin/sessions/{id}`, `/admin/request-logs` (all redirect/show "access denied" client-side for non-admins as a UX nicety; the real enforcement is the `403` above, and the sidebar/header only render the admin nav for users holding one of these roles).

---

## App settings

Global, key/value application configuration (`Setting` model). Every feature flag the backend reads at runtime (registration open/closed, password policy inputs, upload limits, etc.) lives here.

### List settings (grouped)

`GET /api/admin/settings`

**Response `200`** — grouped by `group`, not a flat list:
```json
{
  "success": true,
  "data": [
    {
      "group": "auth",
      "items": [
        { "id": 1, "key": "auth.registration_open", "value": true, "type": "boolean", "is_public": true, "is_locked": false },
        { "id": 4, "key": "auth.default_role_id", "value": 3, "type": "integer", "is_public": false, "is_locked": false }
      ]
    },
    { "group": "system", "items": [ "..." ] }
  ]
}
```

Groups present today: `auth`, `system`, `localization`, `upload`, `notification`, `user`, `security`. `value` is already cast to its real type (`boolean` → JS `true`/`false`, `integer` → number, `json` → array/object, `string`/`text` → string).

### Get one setting

`GET /api/admin/settings/{setting}` → flat `SettingResource` (adds `group` to the fields above, since it's redundant in the grouped list response).

### Update a setting

`PATCH /api/admin/settings/{setting}`

Request shape depends on the setting's `type`:

| Type | `value` | `operation` (optional) |
|---|---|---|
| `boolean` | `true`/`false` | `set` (default) or `toggle` (flips current value; `value` ignored) |
| `integer` | integer | `set` (default), `increment`, or `decrement` (`value` becomes the step, default 1) |
| `json` | array/object | `set` only |
| `string` / `text` | string | `set` only |

```json
{ "value": true, "operation": "set" }
```

**Response `200`**: updated flat `SettingResource`.

**Locked settings** (`is_locked: true`, e.g. `auth.protect_superadmin`) always reject writes:
```json
{ "message": "messages.settings.locked", "errors": { "setting": ["messages.settings.locked"] } }
```
The frontend disables the Save control for these rows, but the real protection is this server-side check.

### Known/notable setting keys

| Key | Type | Effect |
|---|---|---|
| `auth.registration_open` / `auth.login_open` | boolean | Hard-gates register/login (`403` when closed) |
| `auth.email_verification_required` | boolean | Whether new registrations require email verification before being usable |
| `auth.default_role_id` | integer | Role id auto-assigned on registration (falls back to the `USER` role if unset/invalid) |
| `auth.max_users_count` / `auth.max_register_users_count` | integer | Hard cap / daily cap on registrations |
| `auth.allowed_login_role_ids` | json (array of ints) | If non-empty, only users holding one of these role ids can log in |
| `auth.protect_superadmin` | boolean | Locked — not editable via this API, but now actually enforced (see above) |
| `user.max_avatar_size` | integer | KB limit enforced on avatar uploads |
| `localization.default_locale` / `localization.fallback_locale` | string | `default_locale` is also the fallback when no user/header/cookie locale can be resolved (`SetLocale` middleware) |

Settings not in this table (session lifetime, lockout attempts, notification channel toggles, upload mime/extension allow-lists, etc.) exist and are editable the same way, but nothing in the current codebase reads them yet — they're reserved for features not built out.

---

## Users

Backed by the existing `Ban` model/table (previously unused over HTTP) and the role/`SuperAdminGuard` system above.

### List users
`GET /api/admin/users?search=&role=SUPER_ADMIN|ADMIN|USER&page=` → paginated `AdminUserResource[]`:
```json
{ "id": 2, "name": "...", "email": "...", "email_verified": true, "roles": [...], "avatar": null, "ban": null, "is_banned": false, "created_at": "..." }
```

### User detail
`GET /api/admin/users/{user}` → same shape, with `permissions`/`department` also loaded.

### Change role
`PATCH /api/admin/users/{user}/role` — `{ "role": "SUPER_ADMIN"|"ADMIN"|"USER" }`. Replaces (syncs to) a single role — this app only ever assigns one of these three. Subject to `SuperAdminGuard` (see above): `403` if the caller isn't allowed to touch this target or grant this role.

### Ban / unban
`POST /api/admin/users/{user}/ban` — `{ "reason"?, "ends_at"? }` (`ends_at` omitted/null = permanent, else must be a future date). Also immediately revokes every one of the target's Sanctum tokens and marks their open `user_sessions` logged-out — a ban takes effect right away, not just on their next login attempt.

`DELETE /api/admin/users/{user}/ban` → clears the active ban (`BanStatus::Revoked`), they can sign in again.

Both are subject to `SuperAdminGuard` the same way role changes are.

---

## Sessions (every user)

Same underlying `user_sessions` data as [`user.md`](./user.md#sessions), just not scoped to the caller.

`GET /api/admin/sessions?status=all|active|expired&user_id=&search=&page=` → paginated `SessionResource[]`, each including a `user: {id, name, email}` block.

`GET /api/admin/sessions/{session}` → single `SessionResource`.

`DELETE /api/admin/sessions/{session}` → revokes it (token + `logged_out_at`), regardless of whose session it is.

`GET /api/admin/sessions/{session}/request-logs?...` — same filters/shape as the per-session request-log listing in `user.md`, just admin-scoped (no ownership check beyond the route's own role gate).

---

## Request logs (instance-wide)

`GET /api/admin/request-logs?method=&status=2xx..5xx&status_code=&user_id=&search=&sort=&page=` → paginated summary rows across **every** session/user, each including `user`/`session` summaries.

`GET /api/admin/request-logs/{requestLog}` → full detail (same shape as the per-session detail endpoint — query/headers/body/response, redacted the same way).

See [`user.md`](./user.md#request-logs-per-session) for the redaction rules and storage caps — they apply identically here.
