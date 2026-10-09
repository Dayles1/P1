/**
 * Sandbox — an open world to walk around in. Entry point of the browser
 * client: checks the player is signed in, loads where they left off and
 * starts the game.
 */

import { goToLogin, hasToken, loadPlayer } from './api';
import { Game } from './game';
import './styles.css';

const root = document.getElementById('sandbox-root')!;

if (!hasToken()) {
    goToLogin();
} else {
    loadPlayer()
        .catch(() => null)
        .then((saved) => {
            new Game({
                root,
                backUrl: root.dataset.backUrl || '/',
                creative: 'creative' in root.dataset,
                saved,
            }).start();
        });
}
