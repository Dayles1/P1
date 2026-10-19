/**
 * Interface copy by key (ui-spec §8): `t('strip.buy')`, with `{name}`
 * placeholders filled from params. Russian is the only locale so far;
 * English and Uzbek add files with the same keys. Content names (eras,
 * buildings, discoveries) stay in the content files.
 */

import { ru, ruForms } from './ru';
import type { Copy, FormKey } from './ru';

export type CopyKey = keyof Copy;
export type Locale = 'ru' | 'en' | 'uz';

const LOCALES: Partial<Record<Locale, Partial<Copy>>> = { ru };

let current: Locale = 'ru';

export function setLocale(locale: Locale): void {
    current = LOCALES[locale] ? locale : 'ru';
}

export function locale(): Locale {
    return current;
}

/** Locales whose copy exists. */
export function availableLocales(): Locale[] {
    return (Object.keys(LOCALES) as Locale[]).filter((id) => LOCALES[id]);
}

/** The copy of a key with its `{params}` filled in. */
export function t(
    key: CopyKey,
    params: Record<string, string | number> = {},
): string {
    const text = LOCALES[current]?.[key] ?? ru[key] ?? key;

    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in params ? String(params[name]) : match,
    );
}

/**
 * Plural forms: Russian picks one/few/many (1 дом, 2 дома, 5 домов);
 * English and Uzbek one/other (the first and the last form).
 */
export function plural(count: number, forms: readonly string[]): string {
    const n = Math.abs(Math.round(count));

    if (current !== 'ru' || forms.length < 3) {
        return n === 1 ? forms[0] : forms[forms.length - 1];
    }

    const tens = n % 100;
    const last = n % 10;

    if (tens > 10 && tens < 20) {
        return forms[2];
    }

    return last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
}

/** «5 домов»: a count with its word (`plural` over the named forms). */
export function count(n: number, word: FormKey): string {
    return `${n} ${plural(n, ruForms[word])}`;
}

/** Just the word for a count: «домов». */
export function word(n: number, key: FormKey): string {
    return plural(n, ruForms[key]);
}
