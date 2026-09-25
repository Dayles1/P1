import * as Turbo from '@hotwired/turbo';

/**
 * Importing the package starts Turbo Drive automatically. We keep a
 * reference on `window` because `i18n.js` needs to trigger a same-URL
 * soft-revisit after a locale change, and that's the documented way to
 * drive Turbo programmatically from other modules without importing the
 * package a second time.
 */
window.Turbo = Turbo;

/*
 * Turbo only shows its progress bar once a visit has taken 500ms, and a
 * link hovered long enough is prefetched and opens instantly — so the
 * bar appeared on some page changes and not others. With no delay it
 * shows on every one, and simply finishes fast when the page is ready.
 */
Turbo.config.drive.progressBarDelay = 0;
