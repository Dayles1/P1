/**
 * «Летопись города 3»: the page's entry. Guests go to the login page;
 * everyone else gets the game in #city3-root. The page has no router: the
 * back button leads to data-back-url (the games hub by default).
 */

import { Component, StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './city3.css';
import { goToLogin, hasToken } from './api';
import City3Game from './City3Game';

/**
 * Shows a readable card instead of a blank page when the game cannot
 * start at all (no WebGL, a crash while drawing). Problems while loading
 * the world are shown by the game itself.
 */
class Crash extends Component<
    { backUrl: string; children: ReactNode },
    { error: string | null }
> {
    state: { error: string | null } = { error: null };

    static getDerivedStateFromError(error: unknown): { error: string } {
        return {
            error: error instanceof Error ? error.message : String(error),
        };
    }

    render(): ReactNode {
        const { error } = this.state;

        if (error === null) {
            return this.props.children;
        }

        return (
            <div className="city epochs">
                <div className="city__loading">
                    <div className="epochs-error">
                        <p>
                            {/webgl/i.test(error)
                                ? 'Не удалось запустить 3D-графику. Нужен браузер с поддержкой WebGL — обновите его или включите аппаратное ускорение.'
                                : 'Не удалось запустить игру.'}
                        </p>
                        <code>{error}</code>
                        <div className="epochs-error__actions">
                            <a className="hud-button" href={this.props.backUrl}>
                                ← К списку игр
                            </a>
                            <button
                                type="button"
                                className="hud-button"
                                onClick={() => window.location.reload()}
                            >
                                Повторить
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const root = document.getElementById('city3-root')!;
const backUrl = root.dataset.backUrl || '/games';

if (!hasToken()) {
    goToLogin();
} else {
    createRoot(root).render(
        <StrictMode>
            <Crash backUrl={backUrl}>
                <City3Game backUrl={backUrl} />
            </Crash>
        </StrictMode>,
    );
}
