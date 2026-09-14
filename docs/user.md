# User API

Everything here requires `Authorization: Bearer <token>` (Sanctum) and is available to **any authenticated user regardless of role** (`USER`, `ADMIN`, or `SUPER_ADMIN`). For admin-only endpoints see [`admin.md`](./admin.md).

Frontend pages: `/dashboard`, `/profile`, `/sessions`, `/sessions/{id}`, `/settings`, `/chat` (all under `resources/views/blade/layouts/authenticated.blade.php`, with the shared sidebar).

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

### Session detail
`GET /api/sessions/{session}` → single `SessionResource` (same shape as the list). Authorization is enforced by `UserSessionPolicy::manage` — a session that isn't yours 403s, it never leaks whether the id exists at all.

### Revoke one session
`DELETE /api/sessions/{session}` — `{session}` is the `user_sessions` row id (not the token id). Cannot be used on your own current session via this endpoint's intended flow — the frontend hides the "Log out" action for `is_current: true` rows.

### Revoke all other sessions
`DELETE /api/sessions/others` → `{ "data": { "revoked_sessions": 3 } }`

---

## Request logs (per session)

Every `/api/*` request is recorded to `request_logs` by the `LogApiRequest` middleware (runs in `terminate()`, after the response is already sent — logging never adds latency) and tied to the caller's `user_sessions` row when one can be resolved from the bearer token. Sensitive fields (`password`, `password_confirmation`, `token`, `access_token`, the `Authorization`/`Cookie` headers, etc. — full list in `config/request-logging.php`) are replaced with `"[REDACTED]"` **before** the row is written, and request/response bodies are hard-capped (`request-logging.max_body_bytes`, default 8KB) with `body_truncated`/`response_truncated` flags set when a payload was cut.

Same ownership rule as the session itself: only the owning user (or an admin, via the separate `/api/admin/*` routes below) can read these.

### List a session's request log
`GET /api/sessions/{session}/request-logs?method=&status=2xx|3xx|4xx|5xx&status_code=&search=&sort=asc|desc&page=&per_page=` → paginated summary rows (`id, method, path, route_name, status_code, ip_address, duration_ms, created_at`).

### Request log detail
`GET /api/sessions/{session}/request-logs/{requestLog}` → full row: `query`, `headers`, `body`, `response_headers`, `response_body`, `duration_ms`, `ip_address`, `user_agent`, already-redacted per above. 404s (not 403) if the log belongs to a different session than the one in the URL — this is deliberate so a valid session id can't be used to fish for a request log id that actually belongs to someone else's session.

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
| `locale` | nullable, must be the `code` of an active `Language` row (currently `en`, `ru`, `uz`) |
| `theme` | nullable, one of `system`, `light`, `gray`, `dark`, `black`, `green`, `orange` (`App\Domain\Setting\Services\ThemeCatalog::codes()`) |
| `date_format` | nullable, one of `Y-m-d`, `d.m.Y`, `d/m/Y`, `m/d/Y` (`UserDateFormatter::availableDateFormats()`) |
| `time_format` | nullable, one of `24h`, `12h` (`UserDateFormatter::availableTimeFormats()`) |
| `meta` | nullable, array (not exposed in the UI — send it only if you have a real use for it) |

Only send the fields you intend to change — omitted keys keep their current value. `date_format`/`time_format` are not cosmetic-only: `UserDateFormatter` (used by every resource that renders a timestamp — sessions, request logs, chat messages, dashboard, profile) actually formats every date server-side according to these two fields plus the resolved timezone, so the same API response looks different per user without any client-side date math.

**Frontend note**: saving `theme` here also immediately applies it to the live UI via `resources/js/blade/shared/theme.js` (`data-theme` on `<html>` + `localStorage.theme`); saving `locale` writes the `locale` cookie (`SetLocale` middleware reads it on every subsequent request, including plain page loads — see `docs/README.md`) and reloads the page so server-rendered text updates immediately.

---

## Timezones

`GET /api/timezones` — **public, no auth required**

Returns every active `Timezone` row: `{ "id": 276, "name": "Asia/Tashkent", "offset": "+05:00" }`. Used to populate the timezone `<select>` on both the register form and the settings page.

---

## Languages

`GET /api/languages` — **public, no auth required**

Returns every active `Language` row: `{ "code": "ru", "name": "Русский", "is_default": false }`. Backs the language picker in the header and the `locale` `<select>` on the settings page.

---

## Dashboard

`GET /api/dashboard` — **requires auth**

One aggregate endpoint for the `/dashboard` landing page. Every number is a real query against the caller's own data — nothing here is fabricated for display:

```json
{
  "account": { "created_at": "...", "email_verified": true, "has_avatar": false, "has_timezone_set": true, "profile_completeness": 75 },
  "sessions": { "total": 4, "active": 2 },
  "requests": { "today": 12, "this_week": 88, "errors_this_week": 1 },
  "unread_messages": 3,
  "recent_sessions": [ "...SessionResource[]" ],
  "recent_requests": [ "...request log summary rows" ],
  "instance": { "total_users": 42, "active_sessions": 9, "requests_today": 310, "errors_today": 2 }
}
```

`instance` is only present for `SUPER_ADMIN`/`ADMIN` callers (instance-wide counts, not scoped to the caller) — it's simply absent from the JSON for a regular `USER`, not `null`.
