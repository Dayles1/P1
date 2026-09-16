import * as Turbo from '@hotwired/turbo';

/**
 * Importing the package starts Turbo Drive automatically. We keep a
 * reference on `window` because `i18n.js` needs to trigger a same-URL
 * soft-revisit after a locale change, and that's the documented way to
 * drive Turbo programmatically from other modules without importing the
 * package a second time.
 */
window.Turbo = Turbo;
