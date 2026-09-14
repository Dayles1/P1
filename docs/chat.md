# Chat API (partial — no frontend yet)

Everything here requires `Authorization: Bearer <token>`. No role restriction beyond authentication.

**Status: intentionally not built into the frontend in this pass.** The API can create conversations and manage membership, but has **no endpoint to send or list messages** — `Api\Chat\MessageController` exists as an empty, unrouted stub, even though `Message`/`MessageAttachment`/`MessageReaction`/`MessageRead` models and migrations exist. A real chat screen needs that backend work done first (new routes + a request + an action + a resource for messages) — scope it as its own task rather than bolting a UI onto a conversation list that can never show a message.

Documented here for completeness / for whoever picks up messaging next.

---

## Conversations

`GET /api/conversations?type=all|private|group|channel&search=&page=` → paginated `ConversationListResource[]` (title, avatar, unread count, last message preview, pinned state for the current user).

`POST /api/conversations` — `{ "type": "private|group|channel", "title"?, "user_ids"? }` (`title`/`user_ids` required unless `type` is `private`) → `ConversationShowResource`.

`GET /api/conversations/{id}` → `ConversationShowResource` (full detail: creator, locked/archived flags, member count, meta).

`PATCH /api/conversations/{conversation}` — `{ "title": "..." }` (3–60 chars).

`DELETE /api/conversations/{conversation}`.

`POST /api/conversations/{conversation}/pin` / `POST /api/conversations/{conversation}/unpin` — toggles the current user's pin on that conversation (stored on the membership pivot, not the conversation itself).

## Members

`GET /api/conversations/{conversation}/members` → `ConversationMemberResource[]` (name, avatar, pivot role, joined date, muted-until, whether it's you).

`POST /api/conversations/{conversation}/members` — `{ "user_ids": [1,2,3] }` (max 100, must be distinct existing user ids).

`DELETE /api/conversations/{conversation}/members` — same body shape, removes them.

---

## What's missing before a chat UI is viable

- Send a message: no route/controller exists.
- List messages in a conversation: no route/controller exists.
- Mark as read / typing indicators / reactions: models exist (`MessageRead`, `MessageReaction`), nothing exposes them over HTTP.
- Real-time delivery: `routes/channels.php` only defines the stock per-user private channel (`App.Models.User.{id}`) — no conversation-scoped broadcast channel exists yet, so even once messages can be sent, live delivery to other members needs a channel + `ShouldBroadcast` event added.
