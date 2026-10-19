/**
 * Feedback state (ui-spec §5.4): one toast at a time from a short queue
 * (only notable events; errors stay longer), the era banner, the Treasury
 * chest offered on return, and the undo offer after a demolition.
 */

import type { IconName } from '../icons/sprite';
import { Store } from './store';

export type ToastTone = 'good' | 'event' | 'bad';

export interface Toast {
    id: number;
    tone: ToastTone;
    icon: IconName;
    text: string;
    /** A button on the toast («Отменить», «Вернуть»). */
    action?: { label: string; run: () => void };
    /** Tap on the toast: open the related sheet. */
    open?: () => void;
    ms: number;
}

export interface Banner {
    epoch: number;
    stars: number;
    lead: number;
}

export interface FeedbackState {
    toast: Toast | null;
    banner: Banner | null;
    /** The chest on the card now (0: none). */
    chest: number;
    /** A chest closed without taking it waits under Задачи. */
    pendingChest: number;
}

const QUEUE_MAX = 4;

let toastSeq = 0;

export class FeedbackStore extends Store<FeedbackState> {
    private queue: Toast[] = [];
    private timer: number | null = null;

    constructor() {
        super({ toast: null, banner: null, chest: 0, pendingChest: 0 });
    }

    /** Queues a toast; `urgent` ones (undo) replace whatever shows. */
    toast(
        tone: ToastTone,
        icon: IconName,
        text: string,
        options: {
            action?: Toast['action'];
            open?: () => void;
            urgent?: boolean;
            ms?: number;
        } = {},
    ): void {
        const toast: Toast = {
            id: ++toastSeq,
            tone,
            icon,
            text,
            action: options.action,
            open: options.open,
            ms: options.ms ?? (tone === 'bad' ? 6000 : 4000),
        };

        if (options.urgent) {
            this.queue = this.queue.filter((item) => !item.action);
            this.show(toast);

            return;
        }

        if (
            this.getState().toast?.text === text ||
            this.queue.some((item) => item.text === text)
        ) {
            return;
        }

        this.queue.push(toast);

        if (this.queue.length > QUEUE_MAX) {
            this.queue.shift();
        }

        if (!this.getState().toast) {
            this.next();
        }
    }

    /** Hides the toast now (swipe, tap, action) and shows the next one. */
    dismiss(id?: number): void {
        const current = this.getState().toast;

        if (id !== undefined && current?.id !== id) {
            return;
        }

        this.next();
    }

    private show(toast: Toast): void {
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
        }

        this.set({ toast });
        this.timer = window.setTimeout(() => this.next(), toast.ms);
    }

    private next(): void {
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }

        const toast = this.queue.shift() ?? null;

        if (toast) {
            this.show(toast);
        } else {
            this.set({ toast: null });
        }
    }

    dispose(): void {
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
        }

        this.queue = [];
    }
}
