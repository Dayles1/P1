/**
 * Strings of the games shell (the menu). The locale is whatever the server
 * rendered into <html lang>, i.e. the user's app language.
 */

type Dictionary = typeof ru;

const ru = {
    games: 'Игры',
    subtitle: 'Мини-игры, чтобы отдохнуть пять минут или пару вечеров.',
    back_to_app: 'В приложение',
    all: 'Все',
    play: 'Играть',
    continue: 'Продолжить',
    soon: 'Скоро',
    new: 'Новинка',
    empty: 'В этом жанре пока нет игр.',
    progress_city: ':year год · :epoch · :population жителей',
    progress_epochs: ':year год · :population жителей',
    genres: {
        strategy: 'Стратегии',
        party: 'Для компании',
        quiz: 'Викторины',
        duel: 'Дуэли',
        puzzle: 'Головоломки',
    },
    epochs: [
        'Раннее поселение',
        'Деревня',
        'Средневековый город',
        'Королевство',
        'Раннее новое время',
        'Торговый город',
        'Индустриальная эпоха',
        'Современный город',
        'Мегаполис',
    ],
    titles: {
        city: [
            'Летопись города',
            'Начните с пары хижин в 1000 году и проведите поселение через девять эпох — до сияющего мегаполиса.',
        ],
        dice: ['Кости', 'Бросьте кубик в чате и узнайте, кому сегодня везёт.'],
        quiz: ['Викторина', 'Вопросы на скорость для всей команды.'],
        tictactoe: ['Крестики-нолики', 'Классика один на один с коллегой.'],
        battleship: [
            'Морской бой',
            'Расставьте флот и потопите корабли соперника.',
        ],
        words: ['Слова', 'Угадайте слово из пяти букв за шесть попыток.'],
    } as Record<string, [string, string]>,
};

const en: Dictionary = {
    games: 'Games',
    subtitle: 'Mini games for a five-minute break or a couple of evenings.',
    back_to_app: 'Back to app',
    all: 'All',
    play: 'Play',
    continue: 'Continue',
    soon: 'Soon',
    new: 'New',
    empty: 'No games in this genre yet.',
    progress_city: 'Year :year · :epoch · :population residents',
    progress_epochs: 'Year :year · :population residents',
    genres: {
        strategy: 'Strategy',
        party: 'Party',
        quiz: 'Quizzes',
        duel: 'Duels',
        puzzle: 'Puzzles',
    },
    epochs: [
        'Early settlement',
        'Village',
        'Medieval town',
        'Kingdom',
        'Early modern age',
        'Trading city',
        'Industrial age',
        'Modern city',
        'Megalopolis',
    ],
    titles: {
        city: [
            'City Chronicle',
            'Start with a few huts in the year 1000 and lead your settlement through nine eras to a shining megalopolis.',
        ],
        dice: ['Dice', 'Roll a die in the chat and see who is lucky today.'],
        quiz: ['Quiz', 'Quick-fire questions for the whole team.'],
        tictactoe: ['Tic-tac-toe', 'The classic, one on one with a colleague.'],
        battleship: [
            'Battleship',
            'Place your fleet and sink your opponent’s ships.',
        ],
        words: ['Words', 'Guess the five-letter word in six tries.'],
    },
};

const uz: Dictionary = {
    games: 'O‘yinlar',
    subtitle:
        'Besh daqiqalik tanaffus yoki bir necha oqshom uchun mini o‘yinlar.',
    back_to_app: 'Ilovaga qaytish',
    all: 'Hammasi',
    play: 'O‘ynash',
    continue: 'Davom etish',
    soon: 'Tez orada',
    new: 'Yangi',
    empty: 'Bu janrda hozircha o‘yinlar yo‘q.',
    progress_city: ':year-yil · :epoch · :population aholi',
    progress_epochs: ':year-yil · :population aholi',
    genres: {
        strategy: 'Strategiyalar',
        party: 'Davra uchun',
        quiz: 'Viktorinalar',
        duel: 'Duellar',
        puzzle: 'Boshqotirmalar',
    },
    epochs: [
        'Ilk manzilgoh',
        'Qishloq',
        'O‘rta asrlar shahri',
        'Qirollik',
        'Ilk yangi davr',
        'Savdo shahri',
        'Sanoat davri',
        'Zamonaviy shahar',
        'Megapolis',
    ],
    titles: {
        city: [
            'Shahar solnomasi',
            '1000-yilda bir nechta kulbadan boshlang va manzilgohingizni to‘qqiz davr orqali megapolisgacha olib boring.',
        ],
        dice: [
            'Zar',
            'Chatda zar tashlang va bugun kimga omad kulishini biling.',
        ],
        quiz: ['Viktorina', 'Butun jamoa uchun tezkor savollar.'],
        tictactoe: ['X va O', 'Hamkasb bilan yakkama-yakka klassika.'],
        battleship: [
            'Dengiz jangi',
            'Flotingizni joylang va raqib kemalarini cho‘ktiring.',
        ],
        words: ['So‘zlar', 'Besh harfli so‘zni olti urinishda toping.'],
    },
};

const DICTIONARIES: Record<string, Dictionary> = { ru, en, uz };

export const locale = (document.documentElement.lang || 'ru').slice(0, 2);

export const t: Dictionary = DICTIONARIES[locale] ?? ru;

export function format(
    template: string,
    values: Record<string, string | number>,
): string {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.replace(`:${key}`, String(value)),
        template,
    );
}
