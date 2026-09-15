/**
 * Auth layout chrome — theme + language pickers only (the same shared
 * components the authenticated header uses, so guests get full control
 * before signing in). Everything else (SPA navigation, forms, validation)
 * lives in `auth-pages.js`.
 */

import { api } from '../axios';
import { initThemePicker } from '../shared/theme-picker';
import { initLocalePicker } from '../shared/i18n';

initThemePicker();
initLocalePicker(api);
