# User API

Everything here requires `Authorization: Bearer <token>` (Sanctum) and is available to **any authenticated user regardless of role** (`USER`, `ADMIN`, or `SUPER_ADMIN`). For admin-only endpoints see [`admin.md`](./admin.md).

Frontend pages: `/profile`, `/sessions`, `/settings` (all under `resources/views/blade/layouts/authenticated.blade.php`).

---

## Get profile

`GET /api/profile`

**Response `200`**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "department": null,
    "roles": [{ "id": 3, "name": "User", "code": "USER" }],
    "permissions": [],
    "all_permissions": [],
    "ban": null,
    "avatar": { "id": 1, "url": "...", "path": "avatars/1/xxx.png" },
    "current_session": null,
    "settings": {
      "timezone": { "id": 276, "name": "Asia/Tashkent", "label": "Asia/Tashkent (UTC+05:00)", "offset": "+05:00" },
      "timezone_source": "manual",
      "locale": "en",
      "theme": "dark",
      "date_format": "Y-m-d",
      "time_format": "24h",
      "meta": null
    },
    "created_at": "2026-09-14 15:51:02",
    "updated_at": "2026-09-14 17:03:50"
  }
}
```

`department` is always `null` today — the `Department` relation exists in code but has no backing migration/column; treat it as reserved/inert. `ban`, when present and `is_active: true`, should be surfaced to the user (the frontend shows a banner).

## Update profile

`PATCH /api/profile`

| Field | Rules |
|---|---|
| `name` | sometimes, string, 5–60 chars |
| `email` | sometimes, email, unique (ignoring self) |
| `password` | sometimes, confirmed, same policy as register |
| `current_password` | **required only if `email` is actually changing (not just present-but-unchanged) or `password` is being set** — validated against the account's real password |

**Response `200`**: `{ "success": true, "message": "messages.profile.updated", "data": { ...same shape as GET /api/profile... } }`

Side effect: changing `email` resets `email_verified_at` to null and re-sends the verification email automatically.

Errors: `422` — `current_password` missing/wrong, weak password, email taken.

---

## Avatars

An avatar is an `Attachment` (`collection = avatar`). A user can have upload history; `avatar` in `ProfileResource`/`AuthUserResource`-adjacent responses always resolves to the **most recent** one.

### List avatar history
`GET /api/profile/avatars?per_page=15` → paginated `AttachmentResource[]`

### Upload avatar
`POST /api/profile/avatars` — multipart, field name `file`

Constraints: mimes `jpg,jpeg,png,webp,gif,mp4,mov,avi,mkv`; max size = the `user.max_avatar_size` setting (KB, default 5120).

**Response `200`**
```json
{ "success": true, "message": "messages.profile.avatar_uploaded", "data": { "id": 1, "collection": "avatar", "disk": "public", "path": "...", "original_name": "...", "filename": "...", "extension": "png", "mime_type": "image/png", "size": 68, "size_human": "68 B", "url": "http://.../storage/avatars/1/....png", "created_at": "..." } }
```

### Delete an avatar
`DELETE /api/profile/avatars/{avatar}` — removes the DB row and the underlying file.

---

## Sessions

A `user_sessions` row is created on every login (see [`auth.md`](./auth.md#login)) and tracks device/IP/browser + Sanctum token linkage. This is **separate** from the Sanctum token itself — revoking a session here also revokes its token.

### List sessions
`GET /api/sessions?status=all|active|expired` → paginated `SessionResource[]`

```json
{
  "id": 7, "personal_access_token_id": 7,
  "ip_address": "127.0.0.1", "user_agent": "...",
  "device_name": "Unknown device", "device_type": "desktop", "browser": "Chrome", "platform": "Windows",
  "logged_in_at": "...", "last_activity_at": "...", "logged_out_at": null,
  "status": "active", "is_current": true
}
```

`status` is derived (`active` when `logged_out_at` is null, else `expired`). `is_current` compares against the token used for *this* request.

### Revoke one session
`DELETE /api/sessions/{session}` — `{session}` is the `user_sessions` row id (not the token id). Cannot be used on your own current session via this endpoint's intended flow — the frontend hides the "Log out" action for `is_current: true` rows.

### Revoke all other sessions
`DELETE /api/sessions/others` → `{ "data": { "revoked_sessions": 3 } }`

---

## User settings (preferences)

One `UserSetting` row per user — timezone, locale, theme, date/time format, freeform `meta`. This drives frontend display, not app behavior server-side (except timezone, which formats every user-facing date via `UserDateFormatter`).

### Get settings
`GET /api/profile/settings` → `UserSettingResource` (shape shown in the `settings` block of `GET /api/profile` above).

### Update settings
`PUT /api/profile/settings`

| Field | Rules |
|---|---|
| `timezone_id` | nullable, must exist in `timezones` |
| `timezone_source` | nullable, string ≤50 (frontend sends `"manual"` whenever the user picks one explicitly) |
| `locale` | nullable, string ≤10 |
| `theme` | nullable, one of `light`, `dark`, `system` |
| `date_format` | nullable, string ≤50 (free-form, e.g. `Y-m-d`) |
| `time_format` | nullable, string ≤50 (frontend uses `24h`/`12h`) |
| `meta` | nullable, array (not exposed in the UI — send it only if you have a real use for it) |

Only send the fields you intend to change — omitted keys keep their current value.

**Frontend note**: saving `theme` here also immediately applies it to the live UI (`document.documentElement.dataset.theme` + `localStorage.theme`), keeping the stored preference and the on-screen theme toggle in sync.

---

## Timezones

`GET /api/timezones` — **public, no auth required**

Returns every active `Timezone` row: `{ "id": 276, "name": "Asia/Tashkent", "offset": "+05:00" }`. Used to populate the timezone `<select>` on both the register form and the settings page.
