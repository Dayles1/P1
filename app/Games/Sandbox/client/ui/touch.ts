/**
 * On-screen controls for phones and tablets: a joystick on the left (push
 * it all the way to run), drag anywhere else to look around (pinch to
 * zoom), and on the right a cluster of buttons around the thumb:
 *
 * - a big attack button in the corner;
 * - jump next to it (held in water: swim up);
 * - the hand above it, which shows what it would do right now (pick up,
 *   open, sit…) and lights up when there is something to do;
 * - build / eat, which only shows while holding something to build or eat
 *   — and in deep water gives way to "dive" (held: go down);
 * - a "more" button that folds out the rarer moves: crouch (held in
 *   water: dive), crawl and sit.
 *
 * They feed Input exactly like keys.
 */

import { t } from '../i18n';
import type { Action, Input } from '../input';
import { element, icon } from './dom';
import type { IconName } from './icons';

const LOOK_SPEED = 1.7;
const JOYSTICK_RADIUS = 56;

interface Button {
    name: IconName;
    label: string;
    action?: Action;
    hold?: 'attack' | 'rise' | 'dive';
    className: string;
}

export interface TouchContext {
    /** What the hand button would do, or null when there is nothing. */
    use: IconName | null;
    /** Build or eat with what is held, or null. */
    place: 'build' | 'eat' | 'book' | null;
    /** In deep water: the dive button shows instead. */
    swimming: boolean;
}

export class TouchControls {
    private element: HTMLElement;
    private stick: HTMLElement;
    private knob: HTMLElement;
    private useButton: HTMLElement;
    private placeButton: HTMLElement;
    private diveButton: HTMLElement;
    private more: HTMLElement;
    private moreButton: HTMLElement;
    private context: TouchContext = { use: null, place: null, swimming: false };
    private stickTouch: number | null = null;
    private stickOrigin = { x: 0, y: 0 };
    private lookTouch: { id: number; x: number; y: number } | null = null;
    private pinch: { distance: number } | null = null;
    private touches = new Map<number, { x: number; y: number }>();

    constructor(
        root: HTMLElement,
        private input: Input,
        private onAction: (action: Action) => void,
    ) {
        this.element = element('div', 'sb-touch');
        this.element.hidden = true;

        this.stick = element('div', 'sb-stick');
        this.knob = element('div', 'sb-stick__knob');
        this.stick.append(this.knob);

        const cluster = element('div', 'sb-touch__buttons');
        cluster.append(
            this.button({
                name: 'sword',
                label: '',
                hold: 'attack',
                className: 'sb-tb sb-tb--attack',
            }),
            this.button({
                name: 'jump',
                label: '',
                action: 'jump',
                hold: 'rise',
                className: 'sb-tb sb-tb--jump',
            }),
        );
        this.useButton = this.button({
            name: 'hand',
            label: '',
            action: 'interact',
            className: 'sb-tb sb-tb--use sb-tb--idle',
        });
        this.placeButton = this.button({
            name: 'build',
            label: '',
            action: 'use',
            className: 'sb-tb sb-tb--place',
        });
        this.placeButton.hidden = true;
        this.diveButton = this.button({
            name: 'crouch',
            label: '',
            hold: 'dive',
            className: 'sb-tb sb-tb--place sb-tb--dive',
        });
        this.diveButton.hidden = true;
        this.moreButton = this.button({
            name: 'more',
            label: '',
            className: 'sb-tb sb-tb--more',
        });
        this.moreButton.addEventListener('touchstart', () => this.toggleMore());

        this.more = element('div', 'sb-touch__more');
        this.more.hidden = true;
        this.more.append(
            this.button({
                name: 'crouch',
                label: t.stances.crouch,
                action: 'crouch',
                hold: 'dive',
                className: 'sb-tb sb-tb--small',
            }),
            this.button({
                name: 'crawl',
                label: t.stances.crawl,
                action: 'crawl',
                className: 'sb-tb sb-tb--small',
            }),
            this.button({
                name: 'sit',
                label: t.sit,
                action: 'sit',
                className: 'sb-tb sb-tb--small',
            }),
        );

        cluster.append(
            this.useButton,
            this.placeButton,
            this.diveButton,
            this.moreButton,
            this.more,
        );
        this.element.append(this.stick, cluster);
        root.append(this.element);

        this.element.addEventListener('touchstart', this.touchStart, {
            passive: false,
        });
        this.element.addEventListener('touchmove', this.touchMove, {
            passive: false,
        });
        this.element.addEventListener('touchend', this.touchEnd);
        this.element.addEventListener('touchcancel', this.touchEnd);
    }

    show(shown: boolean): void {
        this.element.hidden = !shown;

        if (!shown) {
            this.resetStick();
            this.lookTouch = null;
            this.touches.clear();
        }
    }

    /** What the hand and build buttons show. */
    setContext(context: TouchContext): void {
        if (
            context.use === this.context.use &&
            context.place === this.context.place &&
            context.swimming === this.context.swimming
        ) {
            return;
        }

        this.context = context;
        this.useButton.classList.toggle('sb-tb--idle', context.use === null);
        this.useButton
            .querySelector('.sb-ui-icon')!
            .replaceWith(icon(context.use ?? 'hand'));
        this.placeButton.hidden = context.place === null || context.swimming;
        this.diveButton.hidden = !context.swimming;

        if (context.place) {
            this.placeButton
                .querySelector('.sb-ui-icon')!
                .replaceWith(icon(context.place));
        }
    }

    private toggleMore(): void {
        this.more.hidden = !this.more.hidden;
        this.moreButton.classList.toggle('sb-tb--open', !this.more.hidden);
    }

    private button({
        name,
        label,
        action,
        hold,
        className,
    }: Button): HTMLElement {
        const button = element('button', className);
        button.type = 'button';
        button.setAttribute('aria-label', label || name);
        button.append(icon(name));

        if (label) {
            button.append(element('span', 'sb-tb__label', label));
        }

        button.addEventListener('touchstart', (event) => {
            event.preventDefault();
            event.stopPropagation();
            button.classList.add('sb-tb--down');

            if (action) {
                this.onAction(action);
            }

            if (hold) {
                this.input.setVirtualHeld(hold, true);
            }
        });

        const release = (event: TouchEvent) => {
            event.preventDefault();
            event.stopPropagation();
            button.classList.remove('sb-tb--down');

            if (hold) {
                this.input.setVirtualHeld(hold, false);
            }
        };

        button.addEventListener('touchend', release);
        button.addEventListener('touchcancel', release);

        return button;
    }

    private touchStart = (event: TouchEvent): void => {
        event.preventDefault();

        for (const touch of Array.from(event.changedTouches)) {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
            });

            if (
                touch.clientX < window.innerWidth * 0.4 &&
                this.stickTouch === null
            ) {
                this.stickTouch = touch.identifier;
                this.stickOrigin = { x: touch.clientX, y: touch.clientY };
                this.stick.style.left = `${touch.clientX}px`;
                this.stick.style.top = `${touch.clientY}px`;
                this.stick.classList.add('sb-stick--active');
            } else if (this.lookTouch === null) {
                this.lookTouch = {
                    id: touch.identifier,
                    x: touch.clientX,
                    y: touch.clientY,
                };
            } else {
                // A second finger on the look side: pinch to zoom.
                this.pinch = { distance: this.lookPinchDistance() };
            }
        }
    };

    private touchMove = (event: TouchEvent): void => {
        event.preventDefault();

        for (const touch of Array.from(event.changedTouches)) {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
            });

            if (touch.identifier === this.stickTouch) {
                let dx = touch.clientX - this.stickOrigin.x;
                let dy = touch.clientY - this.stickOrigin.y;
                const length = Math.hypot(dx, dy);

                if (length > JOYSTICK_RADIUS) {
                    dx = (dx / length) * JOYSTICK_RADIUS;
                    dy = (dy / length) * JOYSTICK_RADIUS;
                }

                this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
                const strength = Math.min(1, length / JOYSTICK_RADIUS);
                this.input.setVirtualMove(
                    dx / JOYSTICK_RADIUS,
                    -dy / JOYSTICK_RADIUS,
                    strength > 0.95 && length > JOYSTICK_RADIUS * 1.15,
                );
            } else if (
                this.lookTouch &&
                touch.identifier === this.lookTouch.id
            ) {
                if (this.pinch) {
                    const distance = this.lookPinchDistance();
                    const change = distance / Math.max(1, this.pinch.distance);

                    if (Math.abs(change - 1) > 0.08) {
                        this.input.addZoom(change > 1 ? -1 : 1);
                        this.pinch.distance = distance;
                    }
                } else {
                    this.input.addLook(
                        (touch.clientX - this.lookTouch.x) * LOOK_SPEED,
                        (touch.clientY - this.lookTouch.y) * LOOK_SPEED,
                    );
                }

                this.lookTouch.x = touch.clientX;
                this.lookTouch.y = touch.clientY;
            }
        }
    };

    private touchEnd = (event: TouchEvent): void => {
        for (const touch of Array.from(event.changedTouches)) {
            this.touches.delete(touch.identifier);

            if (touch.identifier === this.stickTouch) {
                this.resetStick();
            } else if (
                this.lookTouch &&
                touch.identifier === this.lookTouch.id
            ) {
                this.lookTouch = null;
                this.pinch = null;
            } else {
                this.pinch = null;
            }
        }
    };

    private lookPinchDistance(): number {
        const points = [...this.touches.entries()]
            .filter(([id]) => id !== this.stickTouch)
            .map(([, point]) => point);

        return points.length >= 2
            ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
            : 0;
    }

    private resetStick(): void {
        this.stickTouch = null;
        this.knob.style.transform = '';
        this.stick.classList.remove('sb-stick--active');
        this.input.setVirtualMove(0, 0, false);
    }
}
