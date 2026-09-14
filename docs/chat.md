# Chat API

Everything here requires `Authorization: Bearer <token>`. No role restriction beyond authentication and conversation membership.

Frontend page: `/chat` (and `/chat/{conversation}` to deep-link a specific thread) — conversation list, search, a new-conversation picker (private DM or group), message thread with send/poll, unread badges, responsive (single-pane on mobile, switches list ⇄ thread).

Realtime is polling-based (the open thread refetches every 5s) rather than broadcast-based — `routes/channels.php` has no conversation-scoped channel, and wiring one up was out of scope for this pass; polling is a deliberate, low-risk choice given the existing infrastructure rather than an oversight.

---

## Conversations

`GET /api/conversations?type=all|private|group|channel&search=&page=` → paginated `ConversationListResource[]` (title, avatar, unread count, last message preview, pinned state for the current user). For `type=private`, `title` is the *other* participant's name, resolved per-viewer — it is never a stored column.

`POST /api/conversations` — `{ "type": "private|group|channel", "title"?, "user_ids" }`.

- `user_ids` is **required** for every type (min 1). For `type: private` it must contain **exactly one** id — the person you're messaging.
- Starting a `private` conversation that already exists between the same two users **returns the existing conversation** instead of creating a duplicate (`ChatStore::findExistingPrivateConversation`) — safe to call repeatedly from a "message this user" button without worrying about spawning duplicate DMs.
- `title` is required unless `type` is `private`.

→ `ConversationShowResource` (full detail, including `members_count`).

`GET /api/conversations/{id}` → `ConversationShowResource`.

`PATCH /api/conversations/{conversation}` — `{ "title": "..." }` (3–60 chars).

`DELETE /api/conversations/{conversation}`.

`POST /api/conversations/{conversation}/pin` / `POST /api/conversations/{conversation}/unpin` — toggles the current user's pin on that conversation (stored on the membership pivot, not the conversation itself).

## Members

`GET /api/conversations/{conversation}/members` → `ConversationMemberResource[]` (name, avatar, pivot role, joined date, muted-until, whether it's you). Requires active membership in the conversation — `422` (`messages.chat.not_a_member`) otherwise, closing what was previously an IDOR (any authenticated user could list who's in any conversation, including a private DM, just by guessing/incrementing its id).

`POST /api/conversations/{conversation}/members` — `{ "user_ids": [1,2,3] }` (max 100, must be distinct existing user ids).

`DELETE /api/conversations/{conversation}/members` — same body shape, removes them.

## Finding someone to message

`GET /api/chat/users/search?q=` — **requires auth**. Searches `name`/`email` (min 2 characters in `q`), excludes the caller and anyone currently banned, capped at 10 results: `[{ "id": 2, "name": "...", "email": "..." }]`. Backs the "message a user" / "add to group" picker — there is no general-purpose user directory/listing endpoint for non-admins beyond this narrow search.

## Messages

`GET /api/conversations/{conversation}/messages?per_page=` → paginated `MessageResource[]`, **newest first**. Membership is enforced implicitly — the query is scoped through `$user->conversations()`, so requesting messages for a conversation you're not (or no longer) a member of 404s, not 403s (it never confirms the conversation even exists to a non-member). Viewing this endpoint also marks the conversation read for the caller (resets their `unread_count`, updates `last_read_message_id`/`last_read_at` on the membership pivot).

`POST /api/conversations/{conversation}/messages` — `{ "body": "...", "parent_message_id"? }` (`body` required, ≤5000 chars) → `201` with the created `MessageResource`. Sending a message also bumps the conversation's `last_message_id`/`last_message_at`, increments `unread_count` for every other active member, and resets the sender's own `unread_count` to 0.

```json
{
  "id": 1, "conversation_id": 1, "parent_message_id": null, "type": "text",
  "body": "Hello!", "is_mine": true,
  "sender": { "id": 2, "name": "Regular User", "avatar": null },
  "edited_at": null, "created_at": "...", "created_at_iso": "..."
}
```

## What's still out of scope

- Attachments on messages (`MessageAttachment` model/table exist, no upload endpoint wired to it) — text-only messages for now.
- Reactions and per-message read receipts (`MessageReaction`, `MessageRead` models exist, unexposed) — only conversation-level unread counts are surfaced.
- True realtime push (see the polling note above).
