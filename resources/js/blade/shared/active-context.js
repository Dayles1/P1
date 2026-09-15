/**
 * Tiny in-memory, page-lifetime signal for "which conversation is the user
 * actually looking at right now" — set by chat.js as conversations open/
 * close, read by notification-bell.js so an incoming message notification
 * for a conversation that's already open on screen doesn't also ding/pop a
 * browser notification for something the user is already seeing.
 */
let activeConversationId = null;

export function setActiveConversationId(id) {
    activeConversationId = id ?? null;
}

export function getActiveConversationId() {
    return activeConversationId;
}

export function isConversationActive(id) {
    return document.visibilityState === 'visible'
        && activeConversationId !== null
        && Number(activeConversationId) === Number(id);
}
