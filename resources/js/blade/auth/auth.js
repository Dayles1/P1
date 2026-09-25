/**
 * Auth layout chrome — theme + language pickers only (the same shared
 * components the authenticated header uses, so guests get full control
 * before signing in). Everything else (SPA navigation, forms, validation)
 * lives in `auth-pages.js`.
 */

import { api } from '../axios';
import { initDropdowns } from '../shared/dropdown';
import { initFormControls } from '../shared/form-controls';
import { initLocalePicker } from '../shared/i18n';
import { initShortcuts } from '../shared/shortcuts';
import { initThemePicker } from '../shared/theme-picker';

initThemePicker();
initLocalePicker(api);
initDropdowns();
initShortcuts();
initFormControls();
