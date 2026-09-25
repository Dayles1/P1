import { icon } from './icon';

/**
 * Generic right-click (desktop) / long-press (mobile) context menu.
 * Not chat-specific — any `items` array of {label, icon, danger,
 * shortcut, onClick} (or {divider: true}) works. Only one menu is ever
 * open at a time.
 */
let currentMenu = null;
let cleanup = null;

export function closeContextMenu() {
    currentMenu?.remove();
    currentMenu = null;
    cleanup?.();
    cleanup = null;
}

export function openContextMenu(x, y, items) {
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'menu menu--compact menu--floating';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items
        .map((item, index) =>
            item.divider
                ? '<hr class="menu-divider">'
                : `
            <button type="button" class="menu-item ${item.danger ? 'menu-item--danger' : ''}" data-index="${index}" role="menuitem">
                ${item.icon ? icon(item.icon, { size: 16, className: 'menu-item__icon' }) : ''}
                <span>${item.label}</span>
                ${item.shortcut ? `<span class="menu-item__kbd">${item.shortcut}</span>` : ''}
            </button>
        `,
        )
        .join('');

    document.body.appendChild(menu);
    currentMenu = menu;

    const rect = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    menu.querySelector('[data-index]')?.focus();

    menu.addEventListener('click', (event) => {
        const button = event.target.closest('[data-index]');

        if (button) {
            items[Number(button.dataset.index)]?.onClick?.();
        }

        closeContextMenu();
    });

    const onOutside = (event) => {
        if (!menu.contains(event.target)) {
            closeContextMenu();
        }
    };

    const onKeydown = (event) => {
        if (event.key === 'Escape') {
            closeContextMenu();
        }
    };

    // Deferred so the very click/contextmenu event that opened this menu
    // doesn't immediately bubble into `onOutside` and close it again.
    window.setTimeout(() => {
        document.addEventListener('click', onOutside, { capture: true });
        document.addEventListener('contextmenu', onOutside, { capture: true });
        document.addEventListener('scroll', closeContextMenu, {
            capture: true,
            once: true,
        });
    }, 0);

    document.addEventListener('keydown', onKeydown);

    cleanup = () => {
        document.removeEventListener('click', onOutside, { capture: true });
        document.removeEventListener('contextmenu', onOutside, {
            capture: true,
        });
        document.removeEventListener('keydown', onKeydown);
    };
}

/** Long-press helper for touch devices — calls `onLongPress(x, y)` after ~500ms if the finger hasn't moved/lifted. */
export function attachLongPress(element, onLongPress) {
    let timer = null;
    let start = null;

    element.addEventListener(
        'touchstart',
        (event) => {
            const touch = event.touches[0];
            start = { x: touch.clientX, y: touch.clientY };

            timer = window.setTimeout(() => {
                onLongPress(start.x, start.y, event);
            }, 500);
        },
        { passive: true },
    );

    const cancel = (event) => {
        if (timer && start && event.touches?.[0]) {
            const touch = event.touches[0];

            if (
                Math.abs(touch.clientX - start.x) > 10 ||
                Math.abs(touch.clientY - start.y) > 10
            ) {
                window.clearTimeout(timer);
                timer = null;
            }

            return;
        }

        window.clearTimeout(timer);
        timer = null;
    };

    element.addEventListener('touchmove', cancel, { passive: true });
    element.addEventListener('touchend', cancel, { passive: true });
    element.addEventListener('touchcancel', cancel, { passive: true });
}
