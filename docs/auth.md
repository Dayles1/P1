# Authentication API

Base path: `/api/auth`. All responses use the app's standard JSON envelope unless noted:

```json
{ "success": true|false, "message": "string", "data": { ... } }
```

Validation failures (`422`) bypass this envelope and use Laravel's default shape:

```json
{ "message": "The given data was invalid.", "errors": { "field": ["message"] } }
```

Auth model: this app uses **Sanctum personal access tokens** (`Authorization: Bearer <token>`), not cookie sessions. There is no CSRF requirement for `/api/*` calls. A token is created on login and must be stored client-side (this frontend uses `localStorage.auth_token`) and sent on every authenticated request.

---

## Register

`POST /api/auth/register`

Guard: none (public). Gated by settings: `auth.registration_open`, `auth.max_users_count`, `auth.max_register_users_count`.

**Request**
| Field | Rules |
|---|---|
| `name` | required, string, 5–60 chars |
| `email` | required, email, unique |
| `password` | required, confirmed (needs `password_confirmation`), min 8, mixed case, letters + numbers |
| `timezone` | nullable, string, must exist in `timezones.name` |

**Response `200`**
```json
{
  "success": true,
  "message": "messages.auth.register_success",
  "data": { "user": { "id": 1, "name": "...", "email": "...", "email_verified": true } }
}
```

Notes:
- Does **not** return a token — the user must log in separately afterward.
- `email_verified` reflects whether the account was auto-verified. It is auto-verified unless the `auth.email_verification_required` setting is on, in which case a verification email is queued instead.
- The default role (`USER` unless `auth.default_role_id` is set to a different role id) is assigned automatically.
- Errors: `403` if registration is closed; `422` with `max_users_limit_reached` / `daily_registration_limit_reached` if a cap is hit; standard `422` validation errors otherwise.

---

## Login

`POST /api/auth/login`

Guard: none (public). Gated by settings: `auth.login_open`, `auth.allowed_login_role_ids` (if non-empty, restricts login to users holding one of the listed role ids).

**Request**
| Field | Rules |
|---|---|
| `email` | required, email |
| `password` | required, string |
| `timezone` | optional, IANA timezone string (frontend sends the browser's detected timezone) |

**Response `200`**
```json
{
  "success": true,
  "message": "messages.auth.login_success",
  "data": {
    "user": { "id": 1, "name": "...", "email": "...", "email_verified": true },
    "token": "1|plaintext-sanctum-token"
  }
}
```

A `user_sessions` row is created for this login (device/IP/browser metadata), independent of the Sanctum token record.

Errors (`422`, on the `email` field): invalid credentials, banned user, banned department. `403` if login is closed or the user's role isn't in the allow-list.

---

## Logout

`POST /api/auth/logout` — **requires auth**

Revokes the current Sanctum token only (other devices/sessions stay logged in) and marks the matching `user_sessions` row as logged out.

**Response `200`**: `{ "success": true, "message": "messages.auth.logout_success" }`

---

## Current user

`GET /api/auth/me` — **requires auth**

Returns the full profile — see [`user.md`](./user.md#get-profile) for the exact `ProfileResource` shape (roles, permissions, avatar, ban, settings included). This is the endpoint the frontend calls on every page load to determine "am I logged in" — never assume from a cookie/session.

---

## Forgot password

`POST /api/auth/forgot-password`

Guard: none (public), throttled by Laravel's password-broker throttle (60s between requests per email).

**Request**: `{ "email": "user@example.com" }`

**Response `200`**: `{ "success": true, "message": "messages.auth.password_reset_link_sent" }`

Sends an email (via the standard Laravel `Password` broker) containing a link to `{APP_URL}/reset-password/{token}?email=...` — a page in this app's own frontend, not an API URL.

Errors: `422` on `email` (`passwords.user` if no account matches, `passwords.throttled` if requested too soon).

---

## Reset password

`POST /api/auth/reset-password`

Guard: none (public) — the token from the emailed link IS the credential.

**Request**
| Field | Rules |
|---|---|
| `token` | required (from the emailed link) |
| `email` | required, email |
| `password` | required, confirmed, same policy as register |

**Response `200`**: `{ "success": true, "message": "messages.auth.password_reset_success" }`

Side effects: **all of the user's existing Sanctum tokens are revoked** and all open `user_sessions` are marked logged out — resetting a password forces re-login everywhere.

Errors: `422` on `email` (`passwords.token` if invalid/expired, `passwords.user` if no match).

---

## Verify email

`GET /api/auth/email/verify/{id}/{hash}` — signed URL, throttled (6/min)

This is the link a user clicks from their verification email — it is **not** meant to be called via XHR/fetch. It always responds with an HTTP redirect (never JSON):

- `/login?verified=1` — newly verified
- `/login?verified=already` — was already verified
- `/login?verified=invalid` — bad id/hash or expired signature

## Resend verification email

`POST /api/auth/email/verification-notification` — throttled (6/min)

Works two ways:
- **Authenticated**: send a Bearer token, no body needed — resends to that user.
- **Guest**: send `{ "email": "..." }` — looks the user up by email and resends if found.

**Response `200`**: `{ "success": true, "message": "...", "data": { "sent": true|false } }` (`sent: false` means the account is already verified — this is not an error).

Errors: `422` if used as a guest with an email that doesn't match any account.

---

## Confirm password

`POST /api/auth/confirm-password` — **requires auth**

Re-verifies the current user's password before a sensitive UI action (e.g. before editing account security settings). This is a UX gate only — the actual sensitive endpoints (profile password/email change) independently re-validate `current_password` themselves, so this is defense in depth, not the sole protection.

**Request**: `{ "password": "..." }`

**Response `200`**: `{ "success": true, "message": "...", "data": { "confirmed": true } }`
**Response `422`** (wrong password): `{ "success": false, "message": "messages.auth.invalid_password" }`

---

## Guest vs. authenticated pages (frontend note)

There is no server session, so Blade's `@auth`/`@guest` directives cannot reflect login state — the frontend always resolves "am I logged in" client-side by checking for a token and calling `GET /api/auth/me`. Pages that need a session behave like this:

- **Guest-only** (`/login`, `/register`, `/forgot-password`, `/reset-password/*`): if a valid token is found, redirect to `/profile` (or `?redirect=` target).
- **Auth-only** (`/profile`, `/sessions`, `/settings`, `/admin/settings`, `/confirm-password`): if no valid token, redirect to `/login?redirect=<original path>`.
