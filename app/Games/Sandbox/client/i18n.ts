/** The game's words, in the page's language (ru, en or uz). */

import type { Species } from './gu';
import type {
    ArtifactType,
    Attribute,
    Gender,
    HeroClass,
    Passive,
    SkillRules,
} from './hero';
import type { ArmorSlot, ItemId, ToolKind } from './items';
import type { Beard, EyeColor, HairColor, HairStyle } from './player/looks';
import type { RecipeGroup } from './recipes';
import type { BodyStyle, Quality } from './settings';
import type { StatKey } from './stats';
import type { MobType } from './world/mob-models';
import type { Clan } from './world/qingmao';

export type DeathCause = MobType | 'fall' | 'drown';

export type Tab =
    'bag' | 'craft' | 'hero' | 'artifacts' | 'settings' | 'creative' | 'chest';

export type SkillName = SkillRules['name'];

interface Texts {
    title: string;
    back: string;
    start: string;
    start_touch: string;
    play: string;
    resume: string;
    paused: string;
    exit: string;
    rotate: string;
    controls_title: string;
    controls: [string, string][];
    saving: string;
    saved: string;
    save_failed: string;
    tabs: Record<Tab, string>;
    creative: {
        note: string;
        items: string;
        items_hint: string;
        artifacts: string;
        type: string;
        skill: string;
        give: string;
        hero: string;
        level_up: string;
        ten_levels: string;
        max_level: string;
        refill: string;
        immortal: string;
    };
    creative_no_hero: string;
    /** The playing screen's words (see ui/hud.ts). */
    hud: {
        /** N, NE, E… clockwise; an empty one is left out. */
        compass: string[];
        metres: string;
        until_sunset: string;
        until_dawn: string;
        start: string;
        now: string;
        run: string;
        crouch: string;
        xp: string;
        xp_of: string;
        points: string;
        attacks: string;
        flees: string;
        fire_near: string;
        bench_near: string;
        guard: string;
    };
    inventory_hint: string;
    craft: string;
    needs_fire: string;
    needs_workbench: string;
    crafted: string;
    sort: string;
    drop_one: string;
    drop_all: string;
    empty_slot: string;
    full: string;
    lmb: string;
    chop: string;
    mine: string;
    cut: string;
    attack: string;
    pick_up: string;
    take_fire: string;
    place: string;
    no_place: string;
    too_many: string;
    sit: string;
    stand_up: string;
    tree: string;
    pine: string;
    cactus: string;
    rock: string;
    ore: string;
    stump: string;
    log: string;
    bundle: string;
    no_room: string;
    needs: Record<ToolKind, string>;
    broke: string;
    durability: string;
    artifact_found: string;
    artifact: string;
    out_of_breath: string;
    sound_on: string;
    sound_off: string;
    equip: string;
    unequip: string;
    eat: string;
    bandage_up: string;
    armor_slots: Record<ArmorSlot, string>;
    health: string;
    armor: string;
    armor_blocks: string;
    health_full: string;
    low_health: string;
    died: string;
    death_causes: Record<DeathCause, string>;
    respawn: string;
    wake_bag: string;
    wake_camp: string;
    mobs: Record<MobType, string>;
    dismantle: string;
    open: string;
    close: string;
    craft_here: string;
    sleep_here: string;
    spawn_set: string;
    groups: Record<RecipeGroup, string>;
    all: string;
    craftable: string;
    pick_recipe: string;
    take_all: string;
    put_all: string;
    chest_hint: string;
    equipment: string;
    artifacts: string;
    not_found: string;
    stats: string;
    stat_names: Record<StatKey, string>;
    quality: string;
    qualities: Record<Quality, string>;
    body_style: string;
    body_styles: Record<BodyStyle, string>;
    hero_tab_hero: string;
    hero_tab_look: string;
    look_title: string;
    look_save: string;
    look_cancel: string;
    edit_look: string;
    hair_style: string;
    hair_styles: Record<HairStyle, string>;
    hair_color: string;
    hair_colors: Record<HairColor, string>;
    beard: string;
    beards: Record<Beard, string>;
    eye_color: string;
    eye_colors: Record<EyeColor, string>;
    quality_hint: string;
    smoothing_note: string;
    sensitivity: string;
    volume: string;
    sound: string;
    show_fps: string;
    start_over: string;
    start_over_hint: string;
    start_over_confirm: string;
    start_over_failed: string;
    gpu: string;
    gpu_software: string;
    stances: { crouch: string; crawl: string; sit: string; swim: string };
    biomes: Record<
        'meadow' | 'forest' | 'desert' | 'snow' | 'mountains',
        string
    >;
    /** The clan villages of Qing Mao: [short, full] name. */
    villages: Record<Clan, [string, string]>;
    map: {
        title: string;
        hint: string;
        hint_touch: string;
        you: string;
        summit: string;
        paths: string;
    };
    hero_title: string;
    /** A few lines on the world the hero wakes in. */
    hero_intro: string;
    hero_pick_gender: string;
    hero_start: string;
    hero_keeps: string;
    hero_gender_note: string;
    classes: Record<HeroClass, [string, string]>;
    genders: Record<Gender, string>;
    attributes: Record<Attribute, [string, string]>;
    attributes_title: string;
    derived_title: string;
    derived: {
        health: string;
        mana: string;
        stamina: string;
        defense: string;
        damage: string;
        speed: string;
        attack_speed: string;
        crit: string;
        knowledge: string;
    };
    level: string;
    level_short: string;
    level_up: string;
    xp: string;
    max_level: string;
    free_points: string;
    points_hint: string;
    add_point: string;
    skills: Record<SkillName, [string, string]>;
    skill_title: string;
    skill_ready: string;
    no_mana: string;
    mana: string;
    stamina: string;
    mana_full: string;
    crit: string;
    knowledge: string;
    knowledge_hint: string;
    research: string;
    research_cost: string;
    locked: string;
    learnt: string;
    not_enough_knowledge: string;
    study: string;
    drink: string;
    disassemble: string;
    disassembled: string;
    disassemble_note: string;
    dig: string;
    dig_site: string;
    enter: string;
    key_space: string;
    swim_up: string;
    swim_down: string;
    second_wind: string;
    artifacts_hint: string;
    artifact_types: Record<ArtifactType, string>;
    /** The Gu each artifact is (see gu.ts). */
    gu: Record<Species, string>;
    ranks: string[];
    layers: { mortal: string; immortal: string };
    rank: string;
    tree_title: string;
    tree_hint: string;
    tree_empty: string;
    tree_locked: string;
    stash_title: string;
    stash_empty: string;
    stash_full: string;
    to_tree: string;
    take_out: string;
    merge: string;
    merged: string;
    merge_needs: string;
    placed: string;
    choose_cell: string;
    gives: string;
    passives: Record<Passive, [string, string]>;
    sources: {
        start: string;
        levels: string;
        points: string;
        artifacts: string;
    };
    groups_profile: { survival: string; combat: string; other: string };
    regen: string;
    jump: string;
    swim: string;
    items: Record<ItemId, [string, string]>;
}

const TEXTS: Record<'ru' | 'en' | 'uz', Texts> = {
    ru: {
        title: 'Gu World',
        back: 'Игры',
        start: 'Нажмите, чтобы играть',
        start_touch: 'Коснитесь, чтобы играть',
        play: 'Играть',
        resume: 'Продолжить',
        paused: 'Пауза',
        exit: 'Выйти',
        rotate: 'Поверните телефон горизонтально',
        controls_title: 'Управление',
        controls: [
            ['W A S D', 'ходьба · Shift — бег'],
            ['Пробел', 'прыжок · залезть · всплыть'],
            ['C · Z · X', 'присесть (нырнуть) · ползти · сесть'],
            ['ЛКМ', 'рубить · добывать · бить'],
            ['E', 'подобрать · открыть · сесть'],
            ['ПКМ / R', 'построить · съесть'],
            ['1–6', 'выбрать предмет'],
            ['I / Tab', 'инвентарь'],
            ['Q · P · N', 'крафт · персонаж · карта'],
            ['M · F3 · F4', 'звук · отладка · промотать время'],
            ['G', 'умение класса'],
            ['Enter', 'создать · изучить (в меню)'],
            ['Esc', 'пауза'],
        ],
        saving: 'Сохранение…',
        saved: 'Сохранено',
        save_failed: 'Не удалось сохранить',
        tabs: {
            bag: 'Инвентарь',
            craft: 'Крафт',
            hero: 'Персонаж',
            artifacts: 'Артефакты',
            settings: 'Настройки',
            creative: 'Креатив',
            chest: 'Сундук',
        },
        creative: {
            note: 'Тестовый режим: бери что хочешь. Выключается в config/sandbox.php (SANDBOX_CREATIVE=false).',
            items: 'Вещи и ресурсы',
            items_hint: 'Клик — полная стопка в сумку.',
            artifacts: 'Артефакты',
            type: 'Тип',
            skill: 'Навык',
            give: 'Получить',
            hero: 'Герой',
            level_up: '+1 уровень',
            ten_levels: '+10 уровней',
            max_level: 'Макс. уровень',
            refill: 'Здоровье и мана — до полного',
            immortal: 'Бессмертие',
        },
        creative_no_hero: 'Сначала создайте героя',
        hud: {
            compass: ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'],
            metres: 'м',
            until_sunset: 'до заката {t}',
            until_dawn: 'до рассвета {t}',
            start: 'Начало',
            now: 'Сейчас',
            run: 'Бег',
            crouch: 'Присесть',
            xp: 'опыта',
            xp_of: '{xp} / {next} опыта',
            points: '+{n} очк. атрибутов — открыть',
            attacks: 'нападает',
            flees: 'убегает',
            fire_near: 'Огонь рядом · рецепты у костра открыты',
            bench_near: 'Верстак рядом · его рецепты открыты',
            guard: 'Защита',
        },
        inventory_hint:
            'Перетаскивайте предметы между ячейками · верхний ряд — быстрые слоты 1–6',
        craft: 'Создать',
        needs_fire: 'Нужен костёр рядом',
        needs_workbench: 'Нужен верстак рядом',
        crafted: 'Создано',
        sort: 'Сортировать',
        drop_one: 'Выбросить 1',
        drop_all: 'Выбросить всё',
        empty_slot: 'Выберите предмет',
        full: 'Инвентарь полон',
        lmb: 'ЛКМ',
        chop: 'Рубить',
        mine: 'Добывать',
        cut: 'Срезать',
        attack: 'Атаковать',
        pick_up: 'Подобрать',
        take_fire: 'Забрать костёр',
        place: 'Поставить',
        no_place: 'Сюда не поставить',
        too_many: 'Слишком много построек',
        sit: 'Сесть',
        stand_up: 'Встать',
        tree: 'Дерево',
        pine: 'Ель',
        cactus: 'Кактус',
        rock: 'Валун',
        ore: 'Железная руда',
        stump: 'Пень',
        log: 'Бревно',
        bundle: 'Свёрток',
        no_room: 'Здесь не встать',
        needs: {
            axe: 'Нужен топор',
            pickaxe: 'Нужна кирка',
            sword: 'Нужен меч',
            shovel: 'Нужна лопата',
        },
        broke: 'сломался',
        durability: 'Прочность',
        artifact_found: 'Найден артефакт',
        artifact: 'Артефакт',
        out_of_breath: 'Воздух кончается!',
        sound_on: 'Звук включён',
        sound_off: 'Звук выключен',
        equip: 'Надеть',
        unequip: 'Снять',
        eat: 'Съесть',
        bandage_up: 'Перевязаться',
        armor_slots: { head: 'Голова', body: 'Тело', feet: 'Ноги' },
        health: 'Здоровье',
        armor: 'Броня',
        armor_blocks: 'поглощает урона',
        health_full: 'Здоровье и так полное',
        low_health: 'Мало здоровья!',
        died: 'Вы погибли',
        death_causes: {
            deer: 'Вас затоптал олень',
            boar: 'Вас забодал кабан',
            wolf: 'Вас загрыз волк',
            zombie: 'Вас настиг мертвец',
            fall: 'Неудачное падение',
            drown: 'Вы утонули',
        },
        respawn: 'Возродиться',
        wake_bag: 'Вы проснётесь у спальника. Вещи остаются с вами.',
        wake_camp: 'Вы проснётесь в лагере. Вещи остаются с вами.',
        mobs: {
            deer: 'Олень',
            boar: 'Кабан',
            wolf: 'Волк',
            zombie: 'Мертвец',
        },
        dismantle: 'Разобрать',
        open: 'Открыть',
        close: 'Закрыть',
        craft_here: 'Крафт',
        sleep_here: 'Просыпаться здесь',
        spawn_set: 'Теперь вы будете просыпаться здесь',
        groups: {
            tools: 'Инструменты',
            weapons: 'Оружие',
            armor: 'Броня',
            building: 'Постройки',
            survival: 'Выживание',
        },
        all: 'Всё',
        craftable: 'Можно создать',
        pick_recipe: 'Выберите рецепт слева',
        take_all: 'Взять всё',
        put_all: 'Положить всё',
        chest_hint: 'Нажмите на предмет, чтобы переложить его',
        equipment: 'Снаряжение',
        artifacts: 'Артефакты',
        not_found: 'Ещё не найден',
        stats: 'Статистика',
        stat_names: {
            deer: 'Оленей',
            boar: 'Кабанов',
            wolf: 'Волков',
            zombie: 'Мертвецов',
            trees: 'Срублено деревьев',
            rocks: 'Разбито валунов',
            crafted: 'Создано предметов',
            artifacts: 'Найдено артефактов',
            digs: 'Раскопок',
            researched: 'Изучено рецептов',
            deaths: 'Смертей',
        },
        body_style: 'Стиль персонажа',
        body_styles: {
            realistic: 'Реализм',
            anime: 'Аниме',
        },
        hero_tab_hero: 'Герой',
        hero_tab_look: 'Внешность',
        look_title: 'Внешность',
        look_save: 'Сохранить',
        look_cancel: 'Отмена',
        edit_look: 'Изменить внешность',
        hair_style: 'Причёска',
        hair_styles: {
            short: 'Короткая',
            parted: 'С пробором',
            buns: 'Пучки',
            bob: 'Каре',
            ponytail: 'Хвост',
            long: 'Длинные',
            bald: 'Лысый',
        },
        hair_color: 'Цвет волос',
        hair_colors: {
            black: 'Чёрный',
            brown: 'Тёмный',
            chestnut: 'Каштановый',
            auburn: 'Рыжий',
            blonde: 'Блонд',
            platinum: 'Платиновый',
            pink: 'Розовый',
            blue: 'Синий',
        },
        beard: 'Борода',
        beards: {
            none: 'Нет',
            stubble: 'Щетина',
            mustache: 'Усы',
            goatee: 'Эспаньолка',
            full: 'Борода',
        },
        eye_color: 'Цвет глаз',
        eye_colors: {
            brown: 'Карие',
            hazel: 'Ореховые',
            green: 'Зелёные',
            blue: 'Голубые',
            grey: 'Серые',
            violet: 'Фиолетовые',
        },
        quality: 'Графика',
        qualities: {
            auto: 'Авто',
            low: 'Низкая',
            medium: 'Средняя',
            high: 'Высокая',
        },
        quality_hint:
            '«Авто» сама снижает чёткость, когда игра начинает тормозить.',
        smoothing_note: 'Сглаживание краёв включится после перезагрузки.',
        sensitivity: 'Чувствительность камеры',
        volume: 'Громкость',
        sound: 'Звук',
        show_fps: 'Показывать FPS',
        start_over: 'Начать заново',
        start_over_hint:
            'Удаляет героя, вещи, постройки, знания и статистику — игра начнётся с выбора класса.',
        start_over_confirm:
            'Начать заново? Герой, вещи, постройки, изученные рецепты и статистика будут удалены навсегда.',
        start_over_failed: 'Не удалось сбросить прогресс',
        gpu: 'Видеокарта',
        gpu_software:
            'Браузер рисует без видеокарты — поэтому игра тормозит. Включите «аппаратное ускорение» в настройках браузера.',
        stances: {
            crouch: 'Присед',
            crawl: 'Ползком',
            sit: 'Сидя',
            swim: 'Плаваю',
        },
        biomes: {
            meadow: 'Луга',
            forest: 'Лес',
            desert: 'Пустыня',
            snow: 'Снега',
            mountains: 'Горы',
        },
        villages: {
            gu_yue: ['Гу Юэ', 'Деревня клана Гу Юэ'],
            bai: ['Бай', 'Деревня клана Бай'],
            xiong: ['Сюн', 'Деревня клана Сюн'],
        },
        map: {
            title: 'Гора Цин Мао',
            hint: 'N или Esc — закрыть',
            hint_touch: 'Коснитесь, чтобы закрыть',
            you: 'Вы',
            summit: 'Вершина',
            paths: 'Тропы',
        },
        hero_title: 'Пробуждение',
        hero_intro:
            'Мир Гу жесток: здесь живут лишь сильные. В тебе только что открылась апертура — ты смертный, но уже не простой. Найди первого Гу и вырасти его: путь укажут они.',
        hero_pick_gender: 'Пол',
        hero_start: 'Войти в мир',
        hero_keeps: 'Ваши вещи, постройки и статистика останутся с вами.',
        hero_gender_note:
            'Женщины ловчее и быстрее, мужчины сильнее — на одно очко.',
        classes: {
            tank: [
                'Танк',
                'Много здоровья и защиты, тяжёлые удары. Медленный. Умение — «Стальная кожа».',
            ],
            fighter: [
                'Боец',
                'Сильный и надёжный, хорош во всём понемногу. Умение — «Вихрь».',
            ],
            assassin: [
                'Убийца',
                'Быстрый и ловкий: частые удары и критические попадания. Умение — «Рывок».',
            ],
            mage: [
                'Маг',
                'Много маны, бьёт огнём издалека, но хрупкий. Умение — «Огненный шар».',
            ],
        },
        attributes: {
            strength: ['Сила', 'Сила ударов, здоровье, защита'],
            agility: [
                'Ловкость',
                'Скорость, частота ударов, криты, выносливость',
            ],
            spirit: ['Дух', 'Мана, сила магии, знания из записей'],
        },
        genders: {
            male: 'Мужчина',
            female: 'Женщина',
        },
        attributes_title: 'Характеристики',
        derived_title: 'Показатели',
        derived: {
            health: 'Здоровье',
            mana: 'Мана',
            stamina: 'Выносливость',
            defense: 'Защита',
            damage: 'Сила удара',
            speed: 'Скорость',
            attack_speed: 'Частота ударов',
            crit: 'Шанс крита',
            knowledge: 'Знания из записей',
        },
        level: 'Уровень',
        level_short: 'Ур.',
        level_up: 'Новый уровень',
        xp: 'Опыт',
        max_level: 'Максимальный уровень',
        free_points: 'Свободные очки',
        points_hint: 'Нажмите «+», чтобы вложить очко в характеристику.',
        add_point: 'Вложить очко',
        skills: {
            guard: [
                'Стальная кожа',
                'На несколько секунд урон по вам сильно снижен.',
            ],
            whirlwind: ['Вихрь', 'Удар по всем врагам вокруг.'],
            dash: ['Рывок', 'Прыжок вперёд; следующий удар — критический.'],
            bolt: [
                'Огненный шар',
                'Шар огня летит во врага впереди. С посохом — сильнее.',
            ],
        },
        skill_title: 'Умение',
        skill_ready: 'готово',
        no_mana: 'Не хватает маны',
        mana: 'Мана',
        stamina: 'Выносливость',
        mana_full: 'Мана и так полная',
        crit: 'Крит!',
        knowledge: 'Знания',
        knowledge_hint:
            'Знания дают старые записи и древние обломки с раскопок и от мертвецов, а ещё разборка вещей. Простые вещи изучать не нужно.',
        research: 'Изучить',
        research_cost: 'знаний',
        locked: 'Нужно изучить',
        learnt: 'Изучено',
        not_enough_knowledge: 'Не хватает знаний',
        study: 'Изучить',
        drink: 'Выпить',
        disassemble: 'Разобрать',
        disassembled: 'Разобрано',
        disassemble_note:
            'Вернётся часть материалов. Если рецепт ещё не изучен — вы его узнаете.',
        dig: 'Копать',
        dig_site: 'Раскопки',
        enter: 'Enter',
        key_space: 'Пробел',
        swim_up: 'Всплыть',
        swim_down: 'Нырнуть',
        sources: {
            start: 'класс',
            levels: 'уровни',
            points: 'очки',
            artifacts: 'артефакты',
        },
        groups_profile: {
            survival: 'Выживание',
            combat: 'Бой',
            other: 'Движение и знания',
        },
        regen: 'Восстановление',
        jump: 'Прыжок',
        swim: 'Плавание',
        second_wind: 'Второе дыхание! Навык спас вас',
        artifacts_hint:
            'Артефакты не занимают сумку. Сливайте их в древо родословной (вкладка героя или здесь): ячейка даёт силу артефакта. Три одинаковых по типу и рангу сливаются в один рангом выше.',
        artifact_types: {
            stats: 'Артефакт характеристик',
            skill: 'Артефакт навыка',
        },
        gu: {
            leech: 'Кровавая пиявка',
            cicada: 'Цикада возрождения',
            locust: 'Прыгучая саранча',
            diver: 'Жук-ныряльщик',
            dragonfly: 'Стрекоза-вихрь',
            ironbeetle: 'Железный жук',
            caterpillar: 'Нефритовая гусеница',
            ant: 'Муравей-добытчик',
            firefly: 'Светлячок',
            rhino: 'Жук-силач',
            mantis: 'Богомол-боец',
            centipede: 'Сколопендра',
            spider: 'Паук-тень',
            moth: 'Лунный мотылёк',
            silkworm: 'Шелкопряд духа',
            scarab: 'Золотой скарабей',
        },
        ranks: [
            'Обычный',
            'Необычный',
            'Редкий',
            'Элитный',
            'Пиковый',
            'Бессмертный',
            'Древний',
            'Мифический',
            'Божественный',
        ],
        layers: {
            mortal: 'смертный',
            immortal: 'бессмертный',
        },
        rank: 'Ранг',
        tree_title: 'Древо родословной',
        tree_hint:
            'Ячейки открываются с уровнем. Артефакт в ячейке отдаёт свою силу; в занятую ячейку — старый вернётся в хранилище.',
        tree_empty: 'Пустое место',
        tree_locked: 'С уровня {level}',
        stash_title: 'Хранилище артефактов',
        stash_empty:
            'Пока пусто. Артефакты находятся в светящихся местах мира, на раскопках и у побеждённых существ — чем дальше от начала и сильнее герой, тем выше ранг.',
        stash_full: 'Хранилище артефактов полно',
        to_tree: 'В древо',
        take_out: 'Вынуть',
        merge: 'Слить ×3',
        merged: 'Слиянием получен',
        merge_needs: 'Для слияния нужно 3 артефакта одного типа и ранга.',
        placed: 'Слито в древо',
        choose_cell: 'Выберите ячейку древа, куда слить артефакт.',
        gives: 'Даёт',
        passives: {
            vampirism: [
                'Вампиризм',
                '{heal} урона в ближнем бою возвращается здоровьем.',
            ],
            second_wind: [
                'Второе дыхание',
                'Смертельный удар оставляет {health} здоровья (раз в {cooldown}).',
            ],
            double_jump: [
                'Двойной прыжок',
                'Прыжков в воздухе: {jumps}. Каждый прыжок выше на {height}.',
            ],
            water_breathing: [
                'Дыхание под водой',
                'Воздуха под водой {breath}, плавание быстрее на {swim}.',
            ],
            swiftness: ['Быстроногость', 'Бег быстрее на {speed}.'],
            iron_skin: ['Железная кожа', 'Каждый удар слабее на {block}.'],
            regeneration: [
                'Регенерация',
                '{health} здоровья в секунду сверх обычного.',
            ],
            gatherer: [
                'Добытчик',
                'Добыча с деревьев, камней и находок больше на {gather}.',
            ],
            radiance: ['Сияние', 'Ночью вокруг светло, ярче в {light}.'],
        },
        items: {
            wood: ['Древесина', 'Рубится из деревьев. Топором — быстрее.'],
            stone: ['Камень', 'Добывается из валунов. Киркой — быстрее.'],
            stick: ['Ветка', 'Валяется под ногами в лесу и в поле.'],
            pebble: ['Галька', 'Мелкие камешки — можно найти на земле.'],
            berries: [
                'Ягоды',
                'Растут на кустах; снова появляются через несколько минут. Немного лечат.',
            ],
            mushroom: ['Гриб', 'Чаще всего в лесу. Немного лечит.'],
            fiber: [
                'Волокно',
                'Из травы на лугах и из кактусов. Связывает инструменты.',
            ],
            flint: [
                'Кремень',
                'Попадается в пустыне, горах и снегах. Нужен для костра.',
            ],
            iron_ore: [
                'Железная руда',
                'Рыжие валуны в горах. Добывается только киркой.',
            ],
            iron: ['Железо', 'Переплавляется из руды у костра.'],
            stone_axe: ['Каменный топор', 'Рубит деревья вдвое быстрее рук.'],
            stone_pickaxe: [
                'Каменная кирка',
                'Бьёт камень вдвое быстрее и добывает руду.',
            ],
            wood_sword: [
                'Деревянный меч',
                'Лёгкий и быстрый. Срезает кактусы.',
            ],
            stone_sword: ['Каменный меч', 'Тяжелее и крепче деревянного.'],
            iron_axe: ['Железный топор', 'Валит дерево за пару ударов.'],
            iron_pickaxe: [
                'Железная кирка',
                'Лучшая кирка: камень и руда — в разы быстрее.',
            ],
            iron_sword: ['Железный меч', 'Самое сильное оружие.'],
            torch: ['Факел', 'Возьмите в руку — светит в темноте.'],
            campfire: [
                'Костёр',
                'Поставьте (ПКМ / R): греет, светит ночью, на нём жарят мясо и плавят железо. Ночные твари к огню не подходят.',
            ],
            raw_meat: [
                'Сырое мясо',
                'Добывается из животных. Лучше пожарить на костре.',
            ],
            cooked_meat: [
                'Жареное мясо',
                'Сытное: хорошо восстанавливает здоровье.',
            ],
            hide: [
                'Шкура',
                'Снимается с животных. Из неё шьют броню и спальник.',
            ],
            bandage: ['Бинт', 'Перевяжитесь (ПКМ / R) — вернёт здоровье.'],
            leather_helmet: ['Кожаный шлем', 'Лёгкая защита головы.'],
            leather_jacket: ['Кожаная куртка', 'Хорошо держит укусы.'],
            leather_boots: ['Кожаные сапоги', 'Лёгкая защита ног.'],
            iron_helmet: ['Железный шлем', 'Крепкая защита головы.'],
            iron_chestplate: [
                'Железный нагрудник',
                'Лучшая защита тела. Делается у верстака.',
            ],
            iron_boots: ['Железные сапоги', 'Крепкая защита ног.'],
            chest: ['Сундук', 'Хранит 12 стопок вещей. Разбирается топором.'],
            workbench: [
                'Верстак',
                'Рядом с ним делают железные инструменты и броню.',
            ],
            wood_wall: [
                'Деревянная стена',
                'Встаёт по сетке, стены складываются в дом. Звери через неё не пройдут.',
            ],
            wood_door: [
                'Деревянная дверь',
                'Стена с дверью: открывается и закрывается (E).',
            ],
            sleeping_bag: ['Спальник', 'После гибели вы проснётесь у него.'],
            shovel: [
                'Лопата',
                'Раскапывает раскопки быстро (кирка — медленно).',
            ],
            dagger: [
                'Кинжал',
                'Короткий клинок: удары очень частые, критов больше. Оружие убийцы.',
            ],
            war_hammer: [
                'Боевой молот',
                'Тяжёлый и медленный, но бьёт сильнее всего. Оружие танка.',
            ],
            staff: [
                'Посох',
                'Огненные шары мага сильнее на 40%. Каждый шар немного изнашивает посох.',
            ],
            healing_potion: [
                'Лечебное зелье',
                'Сразу возвращает много здоровья.',
            ],
            mana_potion: ['Зелье маны', 'Возвращает ману.'],
            old_notes: [
                'Старые записи',
                'Изучите (ПКМ / R или в инвентаре), чтобы получить знания.',
            ],
            relic_shard: [
                'Древний обломок',
                'Изучите, чтобы получить много знаний. Нужен для посоха и зелья маны.',
            ],
            wood_roof: [
                'Крыша',
                'Кладётся на клетку 2×2 поверх стен. Простая — изучать не нужно.',
            ],
            stone_wall: [
                'Каменная стена',
                'Намного крепче деревянной. Разбирается только киркой.',
            ],
        },
    },
    en: {
        title: 'Gu World',
        back: 'Games',
        start: 'Click to play',
        start_touch: 'Tap to play',
        play: 'Play',
        resume: 'Resume',
        paused: 'Paused',
        exit: 'Exit',
        rotate: 'Turn your phone sideways',
        controls_title: 'Controls',
        controls: [
            ['W A S D', 'walk · Shift to run'],
            ['Space', 'jump · climb · swim up'],
            ['C · Z · X', 'crouch (dive) · crawl · sit'],
            ['LMB', 'chop · mine · strike'],
            ['E', 'pick up · open · sit'],
            ['RMB / R', 'build · eat'],
            ['1–6', 'pick an item'],
            ['I / Tab', 'inventory'],
            ['Q · P · N', 'crafting · character · map'],
            ['M · F3 · F4', 'sound · debug · skip time'],
            ['G', 'class skill'],
            ['Enter', 'make · learn (in the menu)'],
            ['Esc', 'pause'],
        ],
        saving: 'Saving…',
        saved: 'Saved',
        save_failed: 'Could not save',
        tabs: {
            bag: 'Inventory',
            craft: 'Crafting',
            hero: 'Character',
            artifacts: 'Artifacts',
            settings: 'Settings',
            creative: 'Creative',
            chest: 'Chest',
        },
        creative: {
            note: 'Test mode: take anything. Turned off in config/sandbox.php (SANDBOX_CREATIVE=false).',
            items: 'Items and resources',
            items_hint: 'Click — a full stack into the bag.',
            artifacts: 'Artifacts',
            type: 'Type',
            skill: 'Skill',
            give: 'Get',
            hero: 'Hero',
            level_up: '+1 level',
            ten_levels: '+10 levels',
            max_level: 'Top level',
            refill: 'Health and mana to full',
            immortal: 'Immortal',
        },
        creative_no_hero: 'Make a hero first',
        hud: {
            compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
            metres: 'm',
            until_sunset: 'sunset in {t}',
            until_dawn: 'dawn in {t}',
            start: 'Start',
            now: 'Now',
            run: 'Run',
            crouch: 'Crouch',
            xp: 'XP',
            xp_of: '{xp} / {next} XP',
            points: '+{n} attribute points — open',
            attacks: 'attacking',
            flees: 'fleeing',
            fire_near: 'Fire nearby · campfire recipes open',
            bench_near: 'Workbench nearby · its recipes open',
            guard: 'Guard',
        },
        inventory_hint:
            'Drag items between slots · the top row is the 1–6 hotbar',
        craft: 'Make',
        needs_fire: 'Needs a fire nearby',
        needs_workbench: 'Needs a workbench nearby',
        crafted: 'Made',
        sort: 'Sort',
        drop_one: 'Drop 1',
        drop_all: 'Drop all',
        empty_slot: 'Pick an item',
        full: 'Inventory full',
        lmb: 'LMB',
        chop: 'Chop',
        mine: 'Mine',
        cut: 'Cut',
        attack: 'Attack',
        pick_up: 'Pick up',
        take_fire: 'Take the campfire',
        place: 'Place',
        no_place: 'Cannot place it here',
        too_many: 'Too many buildings',
        sit: 'Sit',
        stand_up: 'Stand up',
        tree: 'Tree',
        pine: 'Fir',
        cactus: 'Cactus',
        rock: 'Boulder',
        ore: 'Iron ore',
        stump: 'Stump',
        log: 'Log',
        bundle: 'Bundle',
        no_room: 'No room to stand',
        needs: {
            axe: 'Needs an axe',
            pickaxe: 'Needs a pickaxe',
            sword: 'Needs a sword',
            shovel: 'Needs a shovel',
        },
        broke: 'broke',
        durability: 'Durability',
        artifact_found: 'Artifact found',
        artifact: 'Artifact',
        out_of_breath: 'Running out of air!',
        sound_on: 'Sound on',
        sound_off: 'Sound off',
        equip: 'Put on',
        unequip: 'Take off',
        eat: 'Eat',
        bandage_up: 'Bandage up',
        armor_slots: { head: 'Head', body: 'Body', feet: 'Feet' },
        health: 'Health',
        armor: 'Armour',
        armor_blocks: 'of damage blocked',
        health_full: 'Health is already full',
        low_health: 'Low health!',
        died: 'You died',
        death_causes: {
            deer: 'Trampled by a deer',
            boar: 'Gored by a boar',
            wolf: 'Mauled by a wolf',
            zombie: 'Caught by the dead',
            fall: 'A bad fall',
            drown: 'You drowned',
        },
        respawn: 'Respawn',
        wake_bag:
            'You will wake up at your sleeping bag. You keep your things.',
        wake_camp: 'You will wake up at the camp. You keep your things.',
        mobs: {
            deer: 'Deer',
            boar: 'Boar',
            wolf: 'Wolf',
            zombie: 'The dead',
        },
        dismantle: 'Take apart',
        open: 'Open',
        close: 'Close',
        craft_here: 'Craft',
        sleep_here: 'Wake up here',
        spawn_set: 'You will wake up here from now on',
        groups: {
            tools: 'Tools',
            weapons: 'Weapons',
            armor: 'Armour',
            building: 'Building',
            survival: 'Survival',
        },
        all: 'All',
        craftable: 'Can make',
        pick_recipe: 'Pick a recipe on the left',
        take_all: 'Take all',
        put_all: 'Put all in',
        chest_hint: 'Tap an item to move it across',
        equipment: 'Equipment',
        artifacts: 'Artifacts',
        not_found: 'Not found yet',
        stats: 'Statistics',
        stat_names: {
            deer: 'Deer',
            boar: 'Boars',
            wolf: 'Wolves',
            zombie: 'The dead',
            trees: 'Trees felled',
            rocks: 'Boulders broken',
            crafted: 'Things made',
            artifacts: 'Artifacts found',
            digs: 'Excavations',
            researched: 'Recipes learnt',
            deaths: 'Deaths',
        },
        body_style: 'Character style',
        body_styles: {
            realistic: 'Realistic',
            anime: 'Anime',
        },
        hero_tab_hero: 'Hero',
        hero_tab_look: 'Looks',
        look_title: 'Looks',
        look_save: 'Save',
        look_cancel: 'Cancel',
        edit_look: 'Change looks',
        hair_style: 'Hairstyle',
        hair_styles: {
            short: 'Short',
            parted: 'Parted',
            buns: 'Buns',
            bob: 'Bob',
            ponytail: 'Ponytail',
            long: 'Long',
            bald: 'Bald',
        },
        hair_color: 'Hair colour',
        hair_colors: {
            black: 'Black',
            brown: 'Brown',
            chestnut: 'Chestnut',
            auburn: 'Auburn',
            blonde: 'Blonde',
            platinum: 'Platinum',
            pink: 'Pink',
            blue: 'Blue',
        },
        beard: 'Beard',
        beards: {
            none: 'None',
            stubble: 'Stubble',
            mustache: 'Moustache',
            goatee: 'Goatee',
            full: 'Full beard',
        },
        eye_color: 'Eye colour',
        eye_colors: {
            brown: 'Brown',
            hazel: 'Hazel',
            green: 'Green',
            blue: 'Blue',
            grey: 'Grey',
            violet: 'Violet',
        },
        quality: 'Graphics',
        qualities: {
            auto: 'Auto',
            low: 'Low',
            medium: 'Medium',
            high: 'High',
        },
        quality_hint:
            '“Auto” lowers the sharpness by itself when the game starts to stutter.',
        smoothing_note: 'Edge smoothing takes effect after a reload.',
        sensitivity: 'Camera sensitivity',
        volume: 'Volume',
        sound: 'Sound',
        show_fps: 'Show FPS',
        start_over: 'Start over',
        start_over_hint:
            'Deletes the hero, things, buildings, knowledge and stats — the game starts again from choosing a class.',
        start_over_confirm:
            'Start over? The hero, things, buildings, learnt recipes and stats will be deleted for good.',
        start_over_failed: 'Could not reset the progress',
        gpu: 'Graphics card',
        gpu_software:
            'The browser is drawing without the graphics card — that is why the game is slow. Turn on “hardware acceleration” in the browser settings.',
        stances: {
            crouch: 'Crouching',
            crawl: 'Crawling',
            sit: 'Sitting',
            swim: 'Swimming',
        },
        biomes: {
            meadow: 'Meadows',
            forest: 'Forest',
            desert: 'Desert',
            snow: 'Snowlands',
            mountains: 'Mountains',
        },
        villages: {
            gu_yue: ['Gu Yue', 'Gu Yue clan village'],
            bai: ['Bai', 'Bai clan village'],
            xiong: ['Xiong', 'Xiong clan village'],
        },
        map: {
            title: 'Qing Mao Mountain',
            hint: 'N or Esc to close',
            hint_touch: 'Tap to close',
            you: 'You',
            summit: 'Summit',
            paths: 'Paths',
        },
        hero_title: 'Awakening',
        hero_intro:
            'The world of Gu is cruel: only the strong live here. Your aperture has just opened — still a mortal, but no longer an ordinary one. Find your first Gu and raise it: the Gu will show the way.',
        hero_pick_gender: 'Gender',
        hero_start: 'Enter the world',
        hero_keeps: 'Your things, buildings and stats stay with you.',
        hero_gender_note:
            'Women are nimbler and quicker, men stronger — by one point.',
        classes: {
            tank: [
                'Tank',
                'Lots of health and defence, heavy blows. Slow. Skill: Iron skin.',
            ],
            fighter: [
                'Fighter',
                'Strong and steady, good at a bit of everything. Skill: Whirlwind.',
            ],
            assassin: [
                'Assassin',
                'Fast and nimble: quick blows and critical hits. Skill: Dash.',
            ],
            mage: [
                'Mage',
                'Lots of mana, strikes with fire from afar, but fragile. Skill: Fire bolt.',
            ],
        },
        attributes: {
            strength: ['Strength', 'How hard blows land, health, defence'],
            agility: [
                'Agility',
                'Speed, quicker blows, critical hits, stamina',
            ],
            spirit: ['Spirit', 'Mana, spell power, knowledge from notes'],
        },
        genders: {
            male: 'Man',
            female: 'Woman',
        },
        attributes_title: 'Attributes',
        derived_title: 'Figures',
        derived: {
            health: 'Health',
            mana: 'Mana',
            stamina: 'Stamina',
            defense: 'Defence',
            damage: 'Blow strength',
            speed: 'Speed',
            attack_speed: 'Blow rate',
            crit: 'Critical chance',
            knowledge: 'Knowledge from notes',
        },
        level: 'Level',
        level_short: 'Lv',
        level_up: 'Level up',
        xp: 'Experience',
        max_level: 'Top level',
        free_points: 'Free points',
        points_hint: 'Press “+” to put a point into an attribute.',
        add_point: 'Add a point',
        skills: {
            guard: ['Iron skin', 'For a few seconds you take far less damage.'],
            whirlwind: ['Whirlwind', 'Strikes every enemy around you.'],
            dash: ['Dash', 'A leap forward; the next blow is critical.'],
            bolt: [
                'Fire bolt',
                'A ball of fire flies at the enemy ahead. Stronger with a staff.',
            ],
        },
        skill_title: 'Skill',
        skill_ready: 'ready',
        no_mana: 'Not enough mana',
        mana: 'Mana',
        stamina: 'Stamina',
        mana_full: 'Mana is already full',
        crit: 'Critical!',
        knowledge: 'Knowledge',
        knowledge_hint:
            'Knowledge comes from old notes and relic shards (dug up, or dropped by the dead) and from taking things apart. Simple things need no learning.',
        research: 'Learn',
        research_cost: 'knowledge',
        locked: 'Needs learning',
        learnt: 'Learnt',
        not_enough_knowledge: 'Not enough knowledge',
        study: 'Study',
        drink: 'Drink',
        disassemble: 'Take apart',
        disassembled: 'Taken apart',
        disassemble_note:
            'Some of the materials come back. If its recipe is not learnt yet, you learn it.',
        dig: 'Dig',
        dig_site: 'Excavation',
        enter: 'Enter',
        key_space: 'Space',
        swim_up: 'Swim up',
        swim_down: 'Dive',
        sources: {
            start: 'class',
            levels: 'levels',
            points: 'points',
            artifacts: 'artifacts',
        },
        groups_profile: {
            survival: 'Survival',
            combat: 'Combat',
            other: 'Movement and knowledge',
        },
        regen: 'Regeneration',
        jump: 'Jump',
        swim: 'Swimming',
        second_wind: 'Second wind! The skill saved you',
        artifacts_hint:
            "Artifacts take no room in the bag. Merge them into the lineage tree (the hero tab, or here): a cell gives the artifact's power. Three of the same type and rank merge into one of the next rank.",
        artifact_types: {
            stats: 'Attribute artifact',
            skill: 'Skill artifact',
        },
        gu: {
            leech: 'Blood leech',
            cicada: 'Rebirth cicada',
            locust: 'Leaping locust',
            diver: 'Diving beetle',
            dragonfly: 'Whirlwind dragonfly',
            ironbeetle: 'Iron beetle',
            caterpillar: 'Jade caterpillar',
            ant: 'Gatherer ant',
            firefly: 'Firefly',
            rhino: 'Strongman beetle',
            mantis: 'Fighting mantis',
            centipede: 'Centipede',
            spider: 'Shadow spider',
            moth: 'Moon moth',
            silkworm: 'Spirit silkworm',
            scarab: 'Golden scarab',
        },
        ranks: [
            'Common',
            'Uncommon',
            'Rare',
            'Elite',
            'Peak',
            'Immortal',
            'Ancient',
            'Mythic',
            'Divine',
        ],
        layers: {
            mortal: 'mortal',
            immortal: 'immortal',
        },
        rank: 'Rank',
        tree_title: 'Lineage tree',
        tree_hint:
            'Cells open with the level. An artifact in a cell gives its power; put into a taken cell, the old one goes back to the store.',
        tree_empty: 'Empty place',
        tree_locked: 'From level {level}',
        stash_title: 'Artifact store',
        stash_empty:
            'Empty so far. Artifacts lie in glowing spots of the world, turn up in digs and fall from slain creatures — further from the start and with a stronger hero, of higher ranks.',
        stash_full: 'The artifact store is full',
        to_tree: 'Into the tree',
        take_out: 'Take out',
        merge: 'Merge ×3',
        merged: 'Merged into',
        merge_needs: 'A merge takes 3 artifacts of the same type and rank.',
        placed: 'Merged into the tree',
        choose_cell: 'Choose a cell of the tree to merge the artifact into.',
        gives: 'Gives',
        passives: {
            vampirism: [
                'Vampirism',
                '{heal} of melee damage dealt comes back as health.',
            ],
            second_wind: [
                'Second wind',
                'A lethal blow leaves {health} health instead (once every {cooldown}).',
            ],
            double_jump: [
                'Double jump',
                'Jumps in the air: {jumps}. Every jump {height} higher.',
            ],
            water_breathing: [
                'Water breathing',
                'Breath under water lasts {breath}, swimming {swim} faster.',
            ],
            swiftness: ['Swiftness', 'Running {speed} faster.'],
            iron_skin: ['Iron skin', 'Every blow {block} weaker.'],
            regeneration: [
                'Regeneration',
                '{health} health a second on top of the usual.',
            ],
            gatherer: [
                'Gatherer',
                '{gather} more from trees, rocks and finds.',
            ],
            radiance: [
                'Radiance',
                'Light around you at night, {light} as bright.',
            ],
        },
        items: {
            wood: ['Wood', 'Chopped from trees. Faster with an axe.'],
            stone: ['Stone', 'Mined from boulders. Faster with a pickaxe.'],
            stick: ['Stick', 'Lies about in the woods and fields.'],
            pebble: ['Pebble', 'Small stones found on the ground.'],
            berries: [
                'Berries',
                'Grow on bushes, which bear fruit again after a few minutes. Heal a little.',
            ],
            mushroom: ['Mushroom', 'Mostly in the forest. Heals a little.'],
            fiber: [
                'Fiber',
                'From meadow grass and cacti. Binds tools together.',
            ],
            flint: [
                'Flint',
                'Found in deserts, mountains and snow. Needed for a campfire.',
            ],
            iron_ore: [
                'Iron ore',
                'Rusty boulders in the mountains. Only a pickaxe gets it out.',
            ],
            iron: ['Iron', 'Smelted from ore at a campfire.'],
            stone_axe: [
                'Stone axe',
                'Chops trees twice as fast as bare hands.',
            ],
            stone_pickaxe: [
                'Stone pickaxe',
                'Breaks stone twice as fast and mines ore.',
            ],
            wood_sword: ['Wooden sword', 'Light and quick. Cuts cacti.'],
            stone_sword: ['Stone sword', 'Heavier and tougher than wood.'],
            iron_axe: ['Iron axe', 'Fells a tree in a couple of blows.'],
            iron_pickaxe: [
                'Iron pickaxe',
                'The best pickaxe: stone and ore go much faster.',
            ],
            iron_sword: ['Iron sword', 'The strongest weapon.'],
            torch: ['Torch', 'Hold it to light the dark.'],
            campfire: [
                'Campfire',
                'Place it (RMB / R): warm, bright at night, cooks meat and smelts iron. Night creatures keep away from fire.',
            ],
            raw_meat: [
                'Raw meat',
                'From animals. Better cooked on a campfire.',
            ],
            cooked_meat: ['Cooked meat', 'Filling: heals well.'],
            hide: [
                'Hide',
                'From animals. Made into armour and a sleeping bag.',
            ],
            bandage: ['Bandage', 'Bandage up (RMB / R) to get health back.'],
            leather_helmet: ['Leather cap', 'Light protection for the head.'],
            leather_jacket: ['Leather jacket', 'Stands up well to bites.'],
            leather_boots: ['Leather boots', 'Light protection for the feet.'],
            iron_helmet: ['Iron helmet', 'Strong protection for the head.'],
            iron_chestplate: [
                'Iron breastplate',
                'The best protection for the body. Made at a workbench.',
            ],
            iron_boots: ['Iron boots', 'Strong protection for the feet.'],
            chest: ['Chest', 'Holds 12 stacks. An axe takes it apart.'],
            workbench: [
                'Workbench',
                'Iron tools and armour are made next to it.',
            ],
            wood_wall: [
                'Wooden wall',
                'Snaps to a grid, so walls make a house. Animals cannot get through.',
            ],
            wood_door: [
                'Wooden door',
                'A wall with a door that opens and closes (E).',
            ],
            sleeping_bag: [
                'Sleeping bag',
                'After dying you wake up next to it.',
            ],
            shovel: [
                'Shovel',
                'Digs out excavations quickly (a pickaxe does it slowly).',
            ],
            dagger: [
                'Dagger',
                'A short blade: very quick blows and more critical hits. The assassin’s weapon.',
            ],
            war_hammer: [
                'War hammer',
                'Heavy and slow, but hits hardest of all. The tank’s weapon.',
            ],
            staff: [
                'Staff',
                'Makes a mage’s fire bolts 40% stronger. Every bolt wears it a little.',
            ],
            healing_potion: [
                'Healing potion',
                'Gives back a lot of health at once.',
            ],
            mana_potion: ['Mana potion', 'Gives back mana.'],
            old_notes: [
                'Old notes',
                'Study them (RMB / R, or in the inventory) for knowledge.',
            ],
            relic_shard: [
                'Relic shard',
                'Study it for a lot of knowledge. Needed for a staff and mana potions.',
            ],
            wood_roof: [
                'Roof',
                'Covers a 2×2 cell on top of the walls. Simple: no learning needed.',
            ],
            stone_wall: [
                'Stone wall',
                'Much tougher than wood. Only a pickaxe takes it down.',
            ],
        },
    },
    uz: {
        title: 'Gu World',
        back: "O'yinlar",
        start: "O'ynash uchun bosing",
        start_touch: "O'ynash uchun teging",
        play: "O'ynash",
        resume: 'Davom etish',
        paused: 'Pauza',
        exit: 'Chiqish',
        rotate: 'Telefonni yotqizib ushlang',
        controls_title: 'Boshqaruv',
        controls: [
            ['W A S D', 'yurish · Shift — yugurish'],
            ['Probel', 'sakrash · chiqish · suzib chiqish'],
            ['C · Z · X', 'cho‘kkalash (sho‘ng‘ish) · emaklash · o‘tirish'],
            ['SChT', 'kesish · qazish · urish'],
            ['E', 'olish · ochish · o‘tirish'],
            ['SOT / R', 'qurish · yeyish'],
            ['1–6', 'buyumni tanlash'],
            ['I / Tab', 'inventar'],
            ['Q · P · N', 'yasash · qahramon · xarita'],
            ['M · F3 · F4', 'ovoz · nosozlik · vaqtni o‘tkazish'],
            ['G', 'sinf mahorati'],
            ['Enter', 'yasash · o‘rganish (menyuda)'],
            ['Esc', 'pauza'],
        ],
        saving: 'Saqlanmoqda…',
        saved: 'Saqlandi',
        save_failed: 'Saqlab bo‘lmadi',
        tabs: {
            bag: 'Inventar',
            craft: 'Yasash',
            hero: 'Qahramon',
            artifacts: 'Artefaktlar',
            settings: 'Sozlamalar',
            creative: 'Kreativ',
            chest: 'Sandiq',
        },
        creative: {
            note: 'Sinov rejimi: xohlaganingizni oling. config/sandbox.php da o‘chiriladi (SANDBOX_CREATIVE=false).',
            items: 'Buyumlar va resurslar',
            items_hint: 'Bosing — sumkaga to‘liq dasta.',
            artifacts: 'Artefaktlar',
            type: 'Turi',
            skill: 'Ko‘nikma',
            give: 'Olish',
            hero: 'Qahramon',
            level_up: '+1 daraja',
            ten_levels: '+10 daraja',
            max_level: 'Eng yuqori daraja',
            refill: 'Sog‘liq va mana — to‘liq',
            immortal: 'O‘lmaslik',
        },
        creative_no_hero: 'Avval qahramon yarating',
        hud: {
            compass: ['Sh', '', 'Shq', '', 'J', '', 'G‘', ''],
            metres: 'm',
            until_sunset: 'quyosh botishiga {t}',
            until_dawn: 'tonggacha {t}',
            start: 'Boshlanish',
            now: 'Hozir',
            run: 'Yugurish',
            crouch: 'Cho‘kkalash',
            xp: 'tajriba',
            xp_of: '{xp} / {next} tajriba',
            points: '+{n} xususiyat ochkosi — ochish',
            attacks: 'hujum qilmoqda',
            flees: 'qochmoqda',
            fire_near: 'Olov yaqin · gulxan retseptlari ochiq',
            bench_near: 'Dastgoh yaqin · uning retseptlari ochiq',
            guard: 'Himoya',
        },
        inventory_hint:
            'Buyumlarni kataklar orasida suring · yuqori qator — 1–6 tezkor kataklar',
        craft: 'Yasash',
        needs_fire: 'Yonida gulxan kerak',
        needs_workbench: 'Yonida dastgoh kerak',
        crafted: 'Yasaldi',
        sort: 'Saralash',
        drop_one: '1 tasini tashlash',
        drop_all: 'Hammasini tashlash',
        empty_slot: 'Buyumni tanlang',
        full: 'Inventar to‘la',
        lmb: 'SChT',
        chop: 'Kesish',
        mine: 'Qazish',
        cut: 'Kesib olish',
        attack: 'Hujum',
        pick_up: 'Olish',
        take_fire: 'Gulxanni olish',
        place: 'Qo‘yish',
        no_place: 'Bu yerga qo‘yib bo‘lmaydi',
        too_many: 'Qurilmalar juda ko‘p',
        sit: 'O‘tirish',
        stand_up: 'Turish',
        tree: 'Daraxt',
        pine: 'Archa',
        cactus: 'Kaktus',
        rock: 'Xarsang',
        ore: 'Temir rudasi',
        stump: 'To‘nka',
        log: 'Xoda',
        bundle: 'Tugun',
        no_room: 'Bu yerda turib bo‘lmaydi',
        needs: {
            axe: 'Bolta kerak',
            pickaxe: 'Cho‘kich kerak',
            sword: 'Qilich kerak',
            shovel: 'Belkurak kerak',
        },
        broke: 'sindi',
        durability: 'Mustahkamlik',
        artifact_found: 'Artefakt topildi',
        artifact: 'Artefakt',
        out_of_breath: 'Havo tugayapti!',
        sound_on: 'Ovoz yoqildi',
        sound_off: 'Ovoz o‘chirildi',
        equip: 'Kiyish',
        unequip: 'Yechish',
        eat: 'Yeyish',
        bandage_up: 'Bog‘lash',
        armor_slots: { head: 'Bosh', body: 'Tana', feet: 'Oyoq' },
        health: 'Sog‘liq',
        armor: 'Zirh',
        armor_blocks: 'zarbani to‘sadi',
        health_full: 'Sog‘liq to‘la',
        low_health: 'Sog‘liq kam!',
        died: 'Siz halok bo‘ldingiz',
        death_causes: {
            deer: 'Bug‘u toptab ketdi',
            boar: 'To‘ng‘iz suzdi',
            wolf: 'Bo‘ri g‘ajidi',
            zombie: 'O‘liklar yetib oldi',
            fall: 'Baland joydan yiqildingiz',
            drown: 'Suvga cho‘kdingiz',
        },
        respawn: 'Qayta tirilish',
        wake_bag: 'Uyqu xaltasi yonida uyg‘onasiz. Buyumlar o‘zingizda qoladi.',
        wake_camp: 'Lagerda uyg‘onasiz. Buyumlar o‘zingizda qoladi.',
        mobs: {
            deer: 'Bug‘u',
            boar: 'To‘ng‘iz',
            wolf: 'Bo‘ri',
            zombie: 'O‘lik',
        },
        dismantle: 'Buzish',
        open: 'Ochish',
        close: 'Yopish',
        craft_here: 'Yasash',
        sleep_here: 'Shu yerda uyg‘onish',
        spawn_set: 'Endi shu yerda uyg‘onasiz',
        groups: {
            tools: 'Asboblar',
            weapons: 'Qurollar',
            armor: 'Zirh',
            building: 'Qurilish',
            survival: 'Omon qolish',
        },
        all: 'Hammasi',
        craftable: 'Yasash mumkin',
        pick_recipe: 'Chapdan retsept tanlang',
        take_all: 'Hammasini olish',
        put_all: 'Hammasini solish',
        chest_hint: 'Ko‘chirish uchun buyumni bosing',
        equipment: 'Jihozlar',
        artifacts: 'Artefaktlar',
        not_found: 'Hali topilmagan',
        stats: 'Statistika',
        stat_names: {
            deer: 'Bug‘ular',
            boar: 'To‘ng‘izlar',
            wolf: 'Bo‘rilar',
            zombie: 'O‘liklar',
            trees: 'Kesilgan daraxtlar',
            rocks: 'Sindirilgan xarsanglar',
            crafted: 'Yasalgan buyumlar',
            artifacts: 'Topilgan artefaktlar',
            digs: 'Qazishmalar',
            researched: 'O‘rganilgan retseptlar',
            deaths: 'O‘limlar',
        },
        body_style: 'Qahramon uslubi',
        body_styles: {
            realistic: 'Realistik',
            anime: 'Anime',
        },
        hero_tab_hero: 'Qahramon',
        hero_tab_look: 'Ko‘rinish',
        look_title: 'Tashqi ko‘rinish',
        look_save: 'Saqlash',
        look_cancel: 'Bekor qilish',
        edit_look: 'Ko‘rinishni o‘zgartirish',
        hair_style: 'Soch turmagi',
        hair_styles: {
            short: 'Qisqa',
            parted: 'Ajratilgan',
            buns: 'Tugunlar',
            bob: 'Kare',
            ponytail: 'Dum',
            long: 'Uzun',
            bald: 'Taqir',
        },
        hair_color: 'Soch rangi',
        hair_colors: {
            black: 'Qora',
            brown: 'Qo‘ng‘ir',
            chestnut: 'Kashtan',
            auburn: 'Malla',
            blonde: 'Sariq',
            platinum: 'Platina',
            pink: 'Pushti',
            blue: 'Ko‘k',
        },
        beard: 'Soqol',
        beards: {
            none: 'Yo‘q',
            stubble: 'Tuk',
            mustache: 'Mo‘ylov',
            goatee: 'Echki soqol',
            full: 'Soqol',
        },
        eye_color: 'Ko‘z rangi',
        eye_colors: {
            brown: 'Qo‘ng‘ir',
            hazel: 'Yong‘oqrang',
            green: 'Yashil',
            blue: 'Ko‘k',
            grey: 'Kulrang',
            violet: 'Binafsha',
        },
        quality: 'Grafika',
        qualities: {
            auto: 'Avto',
            low: 'Past',
            medium: 'O‘rta',
            high: 'Yuqori',
        },
        quality_hint: '«Avto» o‘yin sekinlashsa, aniqlikni o‘zi pasaytiradi.',
        smoothing_note:
            'Qirralarni silliqlash qayta yuklangandan so‘ng yoqiladi.',
        sensitivity: 'Kamera sezgirligi',
        volume: 'Ovoz balandligi',
        sound: 'Ovoz',
        show_fps: 'FPS ni ko‘rsatish',
        start_over: 'Qaytadan boshlash',
        start_over_hint:
            'Qahramon, buyumlar, qurilmalar, bilim va statistikani o‘chiradi — o‘yin sinf tanlashdan boshlanadi.',
        start_over_confirm:
            'Qaytadan boshlansinmi? Qahramon, buyumlar, qurilmalar, o‘rganilgan retseptlar va statistika butunlay o‘chiriladi.',
        start_over_failed: 'Jarayonni tiklab bo‘lmadi',
        gpu: 'Videokarta',
        gpu_software:
            'Brauzer videokartasiz chizmoqda — shuning uchun o‘yin sekin. Brauzer sozlamalarida «apparat tezlashtirish»ni yoqing.',
        stances: {
            crouch: 'Cho‘kkalab',
            crawl: 'Emaklab',
            sit: 'O‘tirib',
            swim: 'Suzmoqda',
        },
        biomes: {
            meadow: 'O‘tloqlar',
            forest: 'O‘rmon',
            desert: 'Cho‘l',
            snow: 'Qorliklar',
            mountains: 'Tog‘lar',
        },
        villages: {
            gu_yue: ['Gu Yue', 'Gu Yue urug‘i qishlog‘i'],
            bai: ['Bai', 'Bai urug‘i qishlog‘i'],
            xiong: ['Xiong', 'Xiong urug‘i qishlog‘i'],
        },
        map: {
            title: 'Qing Mao tog‘i',
            hint: 'Yopish — N yoki Esc',
            hint_touch: 'Yopish uchun teging',
            you: 'Siz',
            summit: 'Cho‘qqi',
            paths: 'So‘qmoqlar',
        },
        hero_title: 'Uyg‘onish',
        hero_intro:
            'Gu dunyosi shafqatsiz: bu yerda faqat kuchlilar yashaydi. Sening aperturang endigina ochildi — hali oddiy odamsan, lekin endi oddiy emassan. Birinchi Gu’ingni top va uni o‘stir: yo‘lni ular ko‘rsatadi.',
        hero_pick_gender: 'Jins',
        hero_start: 'Dunyoga kirish',
        hero_keeps:
            'Buyumlaringiz, qurilmalaringiz va statistikangiz saqlanadi.',
        hero_gender_note:
            'Ayollar chaqqonroq va tezroq, erkaklar kuchliroq — bir ochkoga.',
        classes: {
            tank: [
                'Tank',
                'Ko‘p sog‘liq va himoya, og‘ir zarbalar. Sekin. Mahorat: Po‘lat teri.',
            ],
            fighter: [
                'Jangchi',
                'Kuchli va ishonchli, hamma narsada yaxshi. Mahorat: Quyun.',
            ],
            assassin: [
                'Qotil',
                'Tez va chaqqon: tez-tez zarba va kritik urishlar. Mahorat: Otilish.',
            ],
            mage: [
                'Sehrgar',
                'Ko‘p mana, uzoqdan olov bilan uradi, lekin nozik. Mahorat: Olov shari.',
            ],
        },
        attributes: {
            strength: ['Kuch', 'Zarba kuchi, sog‘liq, himoya'],
            agility: [
                'Chaqqonlik',
                'Tezlik, zarba tezligi, kritlar, chidamlilik',
            ],
            spirit: ['Ruh', 'Mana, sehr kuchi, yozuvlardan bilim'],
        },
        genders: {
            male: 'Erkak',
            female: 'Ayol',
        },
        attributes_title: 'Xususiyatlar',
        derived_title: 'Ko‘rsatkichlar',
        derived: {
            health: 'Sog‘liq',
            mana: 'Mana',
            stamina: 'Chidamlilik',
            defense: 'Himoya',
            damage: 'Zarba kuchi',
            speed: 'Tezlik',
            attack_speed: 'Zarba tezligi',
            crit: 'Krit ehtimoli',
            knowledge: 'Yozuvlardan bilim',
        },
        level: 'Daraja',
        level_short: 'Dr.',
        level_up: 'Yangi daraja',
        xp: 'Tajriba',
        max_level: 'Eng yuqori daraja',
        free_points: 'Bo‘sh ochkolar',
        points_hint: 'Xususiyatga ochko qo‘shish uchun «+» ni bosing.',
        add_point: 'Ochko qo‘shish',
        skills: {
            guard: ['Po‘lat teri', 'Bir necha soniya sizga zarar ancha kam.'],
            whirlwind: ['Quyun', 'Atrofdagi barcha dushmanlarga zarba.'],
            dash: ['Otilish', 'Oldinga sakrash; keyingi zarba kritik.'],
            bolt: [
                'Olov shari',
                'Olov shari oldingi dushmanga uchadi. Hassa bilan kuchliroq.',
            ],
        },
        skill_title: 'Mahorat',
        skill_ready: 'tayyor',
        no_mana: 'Mana yetmaydi',
        mana: 'Mana',
        stamina: 'Chidamlilik',
        mana_full: 'Mana allaqachon to‘la',
        crit: 'Krit!',
        knowledge: 'Bilim',
        knowledge_hint:
            'Bilimni eski yozuvlar va qadimiy parchalar (qazishmalardan va o‘liklardan) hamda buyumlarni qismlarga ajratish beradi. Oddiy narsalarni o‘rganish shart emas.',
        research: 'O‘rganish',
        research_cost: 'bilim',
        locked: 'O‘rganish kerak',
        learnt: 'O‘rganilgan',
        not_enough_knowledge: 'Bilim yetmaydi',
        study: 'O‘rganish',
        drink: 'Ichish',
        disassemble: 'Qismlarga ajratish',
        disassembled: 'Ajratildi',
        disassemble_note:
            'Materiallarning bir qismi qaytadi. Retsept hali o‘rganilmagan bo‘lsa — uni bilib olasiz.',
        dig: 'Qazish',
        dig_site: 'Qazishma',
        enter: 'Enter',
        key_space: 'Probel',
        swim_up: 'Suzib chiqish',
        swim_down: 'Sho‘ng‘ish',
        sources: {
            start: 'sinf',
            levels: 'darajalar',
            points: 'ochkolar',
            artifacts: 'artefaktlar',
        },
        groups_profile: {
            survival: 'Omon qolish',
            combat: 'Jang',
            other: 'Harakat va bilim',
        },
        regen: 'Tiklanish',
        jump: 'Sakrash',
        swim: 'Suzish',
        second_wind: 'Ikkinchi nafas! Ko‘nikma sizni qutqardi',
        artifacts_hint:
            'Artefaktlar sumkada joy egallamaydi. Ularni nasl daraxtiga quying (qahramon yorlig‘ida yoki shu yerda): katak artefakt kuchini beradi. Bir xil turdagi va darajadagi uchtasi bir daraja yuqori bittaga qo‘shiladi.',
        artifact_types: {
            stats: 'Xususiyat artefakti',
            skill: 'Ko‘nikma artefakti',
        },
        gu: {
            leech: 'Qon zuluk',
            cicada: 'Tirilish chirildog‘i',
            locust: 'Sakrovchi chigirtka',
            diver: 'Sho‘ng‘uvchi qo‘ng‘iz',
            dragonfly: 'Quyun ninachi',
            ironbeetle: 'Temir qo‘ng‘iz',
            caterpillar: 'Zumrad qurt',
            ant: 'Yig‘uvchi chumoli',
            firefly: 'Yaltiroq qo‘ng‘iz',
            rhino: 'Polvon qo‘ng‘iz',
            mantis: 'Jangchi beshiktervatar',
            centipede: 'Qirqoyoq',
            spider: 'Soya o‘rgimchak',
            moth: 'Oy kapalagi',
            silkworm: 'Ruh ipak qurti',
            scarab: 'Oltin skarabey',
        },
        ranks: [
            'Oddiy',
            'Noodatiy',
            'Nodir',
            'Elita',
            'Cho‘qqi',
            'O‘lmas',
            'Qadimiy',
            'Afsonaviy',
            'Ilohiy',
        ],
        layers: {
            mortal: 'o‘lar',
            immortal: 'o‘lmas',
        },
        rank: 'Daraja',
        tree_title: 'Nasl daraxti',
        tree_hint:
            'Kataklar daraja bilan ochiladi. Katakdagi artefakt o‘z kuchini beradi; band katakka qo‘yilsa, eskisi omborga qaytadi.',
        tree_empty: 'Bo‘sh joy',
        tree_locked: '{level}-darajadan',
        stash_title: 'Artefaktlar ombori',
        stash_empty:
            'Hozircha bo‘sh. Artefaktlar dunyoning yorug‘ joylarida, qazishmalarda va yengilgan jonzotlardan topiladi — boshlang‘ichdan uzoqroqda va kuchli qahramonda darajasi yuqoriroq.',
        stash_full: 'Artefaktlar ombori to‘la',
        to_tree: 'Daraxtga',
        take_out: 'Olish',
        merge: '×3 qo‘shish',
        merged: 'Qo‘shilib hosil bo‘ldi',
        merge_needs:
            'Qo‘shish uchun bir xil turdagi va darajadagi 3 ta artefakt kerak.',
        placed: 'Daraxtga quyildi',
        choose_cell: 'Artefaktni quyish uchun daraxt katagini tanlang.',
        gives: 'Beradi',
        passives: {
            vampirism: [
                'Vampirizm',
                'Yaqin jangdagi zararning {heal} qismi sog‘liqqa qaytadi.',
            ],
            second_wind: [
                'Ikkinchi nafas',
                'O‘ldiradigan zarba o‘rniga {health} sog‘liq qoladi ({cooldown} da bir marta).',
            ],
            double_jump: [
                'Qo‘sh sakrash',
                'Havoda sakrashlar: {jumps}. Har sakrash {height} balandroq.',
            ],
            water_breathing: [
                'Suv ostida nafas',
                'Suv ostida havo {breath}, suzish {swim} tezroq.',
            ],
            swiftness: ['Chaqqonlik', 'Yugurish {speed} tezroq.'],
            iron_skin: ['Temir teri', 'Har bir zarba {block} kuchsizroq.'],
            regeneration: [
                'Regeneratsiya',
                'Odatdagidan tashqari soniyasiga {health} sog‘liq.',
            ],
            gatherer: [
                'Yig‘uvchi',
                'Daraxt, tosh va topilmalardan {gather} ko‘proq.',
            ],
            radiance: ['Nur', 'Kechasi atrof yorug‘, {light} yorqinroq.'],
        },
        items: {
            wood: ['Yog‘och', 'Daraxtlardan kesiladi. Bolta bilan tezroq.'],
            stone: ['Tosh', 'Xarsanglardan qaziladi. Cho‘kich bilan tezroq.'],
            stick: ['Shox', 'O‘rmon va dalada yotadi.'],
            pebble: ['Shag‘al', 'Yerda topiladigan mayda toshlar.'],
            berries: [
                'Rezavor',
                'Butalarda o‘sadi; bir necha daqiqadan so‘ng yana chiqadi. Biroz davolaydi.',
            ],
            mushroom: ['Qo‘ziqorin', 'Ko‘pincha o‘rmonda. Biroz davolaydi.'],
            fiber: [
                'Tola',
                'O‘tloq o‘tlari va kaktuslardan. Asboblarni bog‘laydi.',
            ],
            flint: [
                'Chaqmoqtosh',
                'Cho‘l, tog‘ va qorliklarda uchraydi. Gulxan uchun kerak.',
            ],
            iron_ore: [
                'Temir rudasi',
                'Tog‘lardagi zang rangli xarsanglar. Faqat cho‘kich bilan.',
            ],
            iron: ['Temir', 'Gulxanda rudadan eritiladi.'],
            stone_axe: [
                'Tosh bolta',
                'Daraxtni qo‘ldan ikki baravar tez kesadi.',
            ],
            stone_pickaxe: [
                'Tosh cho‘kich',
                'Toshni ikki baravar tez sindiradi va ruda qazadi.',
            ],
            wood_sword: ['Yog‘och qilich', 'Yengil va tez. Kaktus kesadi.'],
            stone_sword: ['Tosh qilich', 'Yog‘ochdan og‘irroq va pishiqroq.'],
            iron_axe: ['Temir bolta', 'Daraxtni bir-ikki zarbada yiqitadi.'],
            iron_pickaxe: ['Temir cho‘kich', 'Eng yaxshi cho‘kich.'],
            iron_sword: ['Temir qilich', 'Eng kuchli qurol.'],
            torch: ['Mash‘al', 'Qo‘lga oling — qorong‘ida yoritadi.'],
            campfire: [
                'Gulxan',
                'Qo‘ying (SOT / R): kechasi yoritadi, go‘sht pishiradi, temir eritadi. Tungi maxluqlar olovga yaqinlashmaydi.',
            ],
            raw_meat: [
                'Xom go‘sht',
                'Hayvonlardan olinadi. Gulxanda pishirgan ma’qul.',
            ],
            cooked_meat: ['Qovurilgan go‘sht', 'To‘yimli: yaxshi davolaydi.'],
            hide: [
                'Teri',
                'Hayvonlardan olinadi. Undan zirh va uyqu xaltasi tikiladi.',
            ],
            bandage: ['Bint', 'Bog‘lang (SOT / R) — sog‘liqni tiklaydi.'],
            leather_helmet: ['Charm dubulg‘a', 'Boshni yengil himoya qiladi.'],
            leather_jacket: ['Charm kurtka', 'Tishlashlarga yaxshi chidaydi.'],
            leather_boots: ['Charm etik', 'Oyoqni yengil himoya qiladi.'],
            iron_helmet: ['Temir dubulg‘a', 'Boshni mustahkam himoya qiladi.'],
            iron_chestplate: [
                'Temir sovut',
                'Tanani eng yaxshi himoya qiladi. Dastgohda yasaladi.',
            ],
            iron_boots: ['Temir etik', 'Oyoqni mustahkam himoya qiladi.'],
            chest: ['Sandiq', '12 dasta buyum sig‘adi. Bolta bilan buziladi.'],
            workbench: [
                'Dastgoh',
                'Uning yonida temir asbob va zirh yasaladi.',
            ],
            wood_wall: [
                'Yog‘och devor',
                'To‘r bo‘yicha turadi, devorlardan uy yasaladi. Hayvonlar o‘tolmaydi.',
            ],
            wood_door: [
                'Yog‘och eshik',
                'Eshikli devor: ochiladi va yopiladi (E).',
            ],
            sleeping_bag: [
                'Uyqu xaltasi',
                'Halok bo‘lgach, uning yonida uyg‘onasiz.',
            ],
            shovel: [
                'Belkurak',
                'Qazishmalarni tez qazadi (cho‘kich — sekin).',
            ],
            dagger: [
                'Xanjar',
                'Qisqa tig‘: juda tez zarbalar va ko‘proq kritlar. Qotil quroli.',
            ],
            war_hammer: [
                'Jang bolg‘asi',
                'Og‘ir va sekin, lekin eng kuchli uradi. Tank quroli.',
            ],
            staff: [
                'Hassa',
                'Sehrgarning olov sharlari 40% kuchliroq. Har bir shar hassani biroz yeyiltiradi.',
            ],
            healing_potion: [
                'Shifo damlamasi',
                'Darhol ko‘p sog‘liq qaytaradi.',
            ],
            mana_potion: ['Mana damlamasi', 'Manani qaytaradi.'],
            old_notes: [
                'Eski yozuvlar',
                'Bilim olish uchun o‘rganing (SOT / R yoki inventarda).',
            ],
            relic_shard: [
                'Qadimiy parcha',
                'Ko‘p bilim uchun o‘rganing. Hassa va mana damlamasi uchun kerak.',
            ],
            wood_roof: [
                'Tom',
                'Devorlar ustidagi 2×2 katakni yopadi. Oddiy — o‘rganish shart emas.',
            ],
            stone_wall: [
                'Tosh devor',
                'Yog‘ochnikidan ancha mustahkam. Faqat cho‘kich bilan buziladi.',
            ],
        },
    },
};

const language = document.documentElement.lang.slice(0, 2);

export const t: Texts = TEXTS[language as keyof typeof TEXTS] ?? TEXTS.en;
