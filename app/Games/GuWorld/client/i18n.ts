/** GU World's words, in the page's language (ru, en or uz). */

import type { DayPhase } from './engine/clock';

interface Texts {
    title: string;
    back: string;
    loading: string;
    load_failed: string;
    new_game: string;
    saved_game: string;
    repaired_time: string;
    day: string;
    phases: Record<DayPhase, string>;
    /** What exists so far: said plainly while the world is being built. */
    stage: string;
}

const TEXTS: Record<'ru' | 'en' | 'uz', Texts> = {
    ru: {
        title: 'GU World',
        back: 'Игры',
        loading: 'Загрузка…',
        load_failed: 'Не удалось загрузить сохранение',
        new_game: 'Новая игра',
        saved_game: 'Сохранение',
        repaired_time:
            'Время в сохранении было повреждено — начато первое утро.',
        day: 'день',
        phases: {
            night: 'ночь',
            dawn: 'рассвет',
            morning: 'утро',
            day: 'день',
            evening: 'вечер',
        },
        stage: 'Основа мира в разработке: игрового мира здесь пока нет.',
    },
    en: {
        title: 'GU World',
        back: 'Games',
        loading: 'Loading…',
        load_failed: 'Could not load the saved game',
        new_game: 'New game',
        saved_game: 'Saved game',
        repaired_time: 'The saved time was broken — the first morning begins.',
        day: 'day',
        phases: {
            night: 'night',
            dawn: 'dawn',
            morning: 'morning',
            day: 'day',
            evening: 'evening',
        },
        stage: 'The world’s foundation is being built: there is no game world here yet.',
    },
    uz: {
        title: 'GU World',
        back: 'O‘yinlar',
        loading: 'Yuklanmoqda…',
        load_failed: 'Saqlangan o‘yinni yuklab bo‘lmadi',
        new_game: 'Yangi o‘yin',
        saved_game: 'Saqlangan o‘yin',
        repaired_time: 'Saqlangan vaqt buzilgan edi — birinchi tong boshlandi.',
        day: 'kun',
        phases: {
            night: 'tun',
            dawn: 'tong',
            morning: 'ertalab',
            day: 'kunduz',
            evening: 'kechqurun',
        },
        stage: 'Dunyo poydevori qurilmoqda: bu yerda hali o‘yin dunyosi yo‘q.',
    },
};

function language(): keyof typeof TEXTS {
    const lang = document.documentElement.lang.slice(0, 2).toLowerCase();

    return lang === 'en' || lang === 'uz' ? lang : 'ru';
}

export const t: Texts = TEXTS[language()];
