/** A tiny typed event bus: the simulation emits, the renderer, audio and UI listen. */

export type GameEvent =
    /** `:amount` in the text is the amount, formatted by the interface. */
    | {
          type: 'toast';
          text: string;
          tone: 'info' | 'good' | 'bad';
          amount?: number;
      }
    | { type: 'built'; uid: number }
    | {
          type: 'placed';
          uid: number;
          x: number;
          y: number;
          w: number;
          h: number;
          sound: string | null;
      }
    | {
          type: 'upgraded';
          uid: number;
          x: number;
          y: number;
          w: number;
          h: number;
          sound: string | null;
      }
    | {
          type: 'removed';
          x: number;
          y: number;
          w: number;
          h: number;
          sound: string | null;
      }
    /** An era began: its stars and lead at entry (gdd §2.3). */
    | { type: 'epoch'; epoch: number; stars: number; lead: number }
    | { type: 'researched'; tech: string }
    | { type: 'achievement'; goal: string }
    | { type: 'restyled'; uid: number }
    | { type: 'season'; season: string }
    | { type: 'weather'; weather: string }
    | { type: 'sound'; id: string }
    | { type: 'error'; text: string };

type Listener = (event: GameEvent) => void;

export class EventBus {
    private listeners = new Set<Listener>();

    on(listener: Listener): () => void {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    }

    emit(event: GameEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    clear(): void {
        this.listeners.clear();
    }
}
