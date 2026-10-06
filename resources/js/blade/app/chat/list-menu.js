import { escapeHtml } from '../../shared/forms';
import { t } from '../../shared/i18n';

/*
| The chat list's right-click / long-press menu, Telegram's set: pin,
| mute (for how long), mark read/unread, archive, clear history, and
| delete the chat or leave the group. Labels are escaped here because the
| shared context menu writes them as HTML.
*/

export const MUTE_OPTIONS = ['1h', '8h', '1d', '3d', 'forever'];

const label = (key, params) => escapeHtml(t(key, params));

/**
 * `actions`: { settings(patch), muteMenu(), markRead(), clear(), remove(), leave() }.
 */
export function conversationMenuItems(conversation, actions) {
    const isGroupLike = ['group', 'channel'].includes(conversation.type);
    const isCreator = ['creator', 'owner'].includes(conversation.my_role);
    const hasUnread =
        (conversation.unread_count || 0) > 0 || conversation.marked_unread;

    const items = [
        {
            label: label(
                conversation.is_pinned
                    ? 'chat.list_menu.unpin'
                    : 'chat.list_menu.pin',
            ),
            icon: 'pin',
            onClick: () =>
                actions.settings({ pinned: !conversation.is_pinned }),
        },
    ];

    if (!conversation.is_saved) {
        items.push(
            conversation.is_muted
                ? {
                      label: label('chat.list_menu.unmute'),
                      icon: 'bell',
                      onClick: () => actions.settings({ mute: 'off' }),
                  }
                : {
                      label: `${label('chat.list_menu.mute')} …`,
                      icon: 'bell-off',
                      onClick: () => actions.muteMenu(),
                  },
        );
    }

    items.push(
        hasUnread
            ? {
                  label: label('chat.list_menu.mark_read'),
                  icon: 'checks',
                  onClick: () => actions.markRead(),
              }
            : {
                  label: label('chat.list_menu.mark_unread'),
                  icon: 'check-circle',
                  onClick: () => actions.settings({ marked_unread: true }),
              },
        {
            label: label(
                conversation.is_archived
                    ? 'chat.list_menu.unarchive'
                    : 'chat.list_menu.archive',
            ),
            icon: 'archive',
            onClick: () =>
                actions.settings({ archived: !conversation.is_archived }),
        },
        { divider: true },
        {
            label: label('chat.list_menu.clear'),
            icon: 'refresh',
            onClick: () => actions.clear(),
        },
    );

    if (isGroupLike) {
        items.push({
            label: label('chat.list_menu.leave'),
            icon: 'logout',
            danger: true,
            onClick: () => actions.leave(),
        });

        if (isCreator) {
            items.push({
                label: label('chat.list_menu.delete_group'),
                icon: 'trash',
                danger: true,
                onClick: () => actions.remove(),
            });
        }
    } else if (!conversation.is_saved) {
        items.push({
            label: label('chat.list_menu.delete_chat'),
            icon: 'trash',
            danger: true,
            onClick: () => actions.remove(),
        });
    }

    return items;
}

export function muteMenuItems(onPick) {
    return MUTE_OPTIONS.map((value) => ({
        label: label(`chat.list_menu.mute_${value}`),
        icon: value === 'forever' ? 'bell-off' : 'clock',
        onClick: () => onPick(value),
    }));
}
