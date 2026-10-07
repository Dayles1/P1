import { Component } from 'react';
import type { ReactNode } from 'react';

/**
 * Keeps a half-edited file from taking the Workshop down: if a preview
 * cannot draw the draft, it says so and the editor stays usable.
 */
export class PreviewBoundary extends Component<
    { children: ReactNode; resetKey: string },
    { error: string | null; key: string }
> {
    state = { error: null as string | null, key: this.props.resetKey };

    static getDerivedStateFromError(error: unknown) {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }

    static getDerivedStateFromProps(
        props: { resetKey: string },
        state: { error: string | null; key: string },
    ) {
        return props.resetKey !== state.key
            ? { error: null, key: props.resetKey }
            : null;
    }

    render() {
        if (this.state.error) {
            return (
                <p className="ws-error">
                    Превью не может это нарисовать: {this.state.error}
                </p>
            );
        }

        return this.props.children;
    }
}
