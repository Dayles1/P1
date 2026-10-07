/** A tiny typed event bus: the simulation emits, the renderer, audio and UI listen. */

export type GameEvent =
    | { type: 'toast'; text: string; tone: 'info' | 'good' | 'bad' }
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
    | { type: 'cleared'; x: number; y: number; text: string }
    | { type: 'epoch'; epoch: number }
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
