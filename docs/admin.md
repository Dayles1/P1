# Admin API

Everything here requires `Authorization: Bearer <token>` **and** the `SUPER_ADMIN` or `ADMIN` role (enforced server-side by the `role:SUPER_ADMIN,ADMIN` middleware on the route group — a non-admin gets a real `403`, not just a hidden UI element).

There is currently no functional distinction between `SUPER_ADMIN` and `ADMIN` anywhere in the codebase beyond the seeded super-admin account itself — both roles pass every admin check identically today.

Frontend page: `/admin/settings` (redirects/shows "access denied" client-side for non-admins as a UX nicety; the real enforcement is the `403` above).

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
| `auth.protect_superadmin` | boolean | Locked — not editable via this API |
| `user.max_avatar_size` | integer | KB limit enforced on avatar uploads |
| `localization.default_locale` / `localization.fallback_locale` | string | Used when creating a user without an explicit timezone/locale |

Settings not in this table (session lifetime, lockout attempts, notification channel toggles, upload mime/extension allow-lists, etc.) exist and are editable the same way, but nothing in the current codebase reads them yet — they're reserved for features not built out.
