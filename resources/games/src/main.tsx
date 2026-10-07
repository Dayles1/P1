import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Hub } from './hub/Hub';
import { hasToken } from './shared/api';
import './styles.css';

/**
 * The games SPA. It lives at /games and is independent of the main app's
 * pages; the server only serves an empty HTML shell for every /games URL.
 */

const CityGame = lazy(() => import('./city/CityGame'));
const EpochsGame = lazy(() => import('./epochs/EpochsGame'));
const Workshop = lazy(() => import('./epochs/workshop/Workshop'));

const root = document.getElementById('games-root')!;
const homeUrl = root.dataset.homeUrl || '/dashboard';

if (!hasToken()) {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
}

createRoot(root).render(
    <StrictMode>
        <BrowserRouter basename="/games">
            <Suspense fallback={<div className="games-loading">⏳</div>}>
                <Routes>
                    <Route path="/" element={<Hub homeUrl={homeUrl} />} />
                    <Route path="/city" element={<CityGame />} />
                    <Route path="/epochs" element={<EpochsGame />} />
                    <Route path="/epochs/workshop" element={<Workshop />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    </StrictMode>,
);
