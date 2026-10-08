/** The game's words, in the page's language (ru, en or uz). */

import type { ArmorSlot, ItemId, ToolKind } from './items';
import type { RecipeGroup } from './recipes';
import type { Quality } from './settings';
import type { StatKey } from './stats';
import type { MobType } from './world/mob-models';

export type DeathCause = MobType | 'fall' | 'drown';

export type Tab = 'bag' | 'craft' | 'hero' | 'settings' | 'chest';

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
    quality_hint: string;
    smoothing_note: string;
    sensitivity: string;
    volume: string;
    sound: string;
    show_fps: string;
    gpu: string;
    gpu_software: string;
    stances: { crouch: string; crawl: string; sit: string; swim: string };
    biomes: Record<
        'meadow' | 'forest' | 'desert' | 'snow' | 'mountains',
        string
    >;
    items: Record<ItemId, [string, string]>;
}

const TEXTS: Record<'ru' | 'en' | 'uz', Texts> = {
    ru: {
        title: 'Песочница',
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
            ['Q · P', 'крафт · персонаж'],
            ['M · F3 · F4', 'звук · отладка · промотать время'],
            ['Esc', 'пауза'],
        ],
        saving: 'Сохранение…',
        saved: 'Сохранено',
        save_failed: 'Не удалось сохранить',
        tabs: {
            bag: 'Инвентарь',
            craft: 'Крафт',
            hero: 'Персонаж',
            settings: 'Настройки',
            chest: 'Сундук',
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
        },
        broke: 'сломался',
        durability: 'Прочность',
        artifact_found: 'Найден артефакт',
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
            deaths: 'Смертей',
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
            wind_feather: [
                'Перо ветра',
                'Артефакт гор. Пока оно с вами, вы прыгаете выше.',
            ],
            sun_stone: [
                'Солнечный камень',
                'Артефакт пустыни. Ночью светится вокруг вас.',
            ],
            frost_crystal: [
                'Ледяной кристалл',
                'Артефакт снегов. Дольше без воздуха и быстрее плаваете.',
            ],
            forest_heart: [
                'Сердце леса',
                'Артефакт леса. Добыча ресурсов в полтора раза больше.',
            ],
            golden_clover: [
                'Золотой клевер',
                'Артефакт лугов. Бегаете быстрее.',
            ],
        },
    },
    en: {
        title: 'Sandbox',
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
            ['Q · P', 'crafting · character'],
            ['M · F3 · F4', 'sound · debug · skip time'],
            ['Esc', 'pause'],
        ],
        saving: 'Saving…',
        saved: 'Saved',
        save_failed: 'Could not save',
        tabs: {
            bag: 'Inventory',
            craft: 'Crafting',
            hero: 'Character',
            settings: 'Settings',
            chest: 'Chest',
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
        },
        broke: 'broke',
        durability: 'Durability',
        artifact_found: 'Artifact found',
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
            deaths: 'Deaths',
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
            wind_feather: [
                'Wind feather',
                'Mountain artifact. While you carry it, you jump higher.',
            ],
            sun_stone: [
                'Sun stone',
                'Desert artifact. Glows around you at night.',
            ],
            frost_crystal: [
                'Frost crystal',
                'Snow artifact. Longer breath and faster swimming.',
            ],
            forest_heart: [
                'Heart of the forest',
                'Forest artifact. Half as much again from gathering.',
            ],
            golden_clover: [
                'Golden clover',
                'Meadow artifact. You run faster.',
            ],
        },
    },
    uz: {
        title: 'Qumdon',
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
            ['Q · P', 'yasash · qahramon'],
            ['M · F3 · F4', 'ovoz · nosozlik · vaqtni o‘tkazish'],
            ['Esc', 'pauza'],
        ],
        saving: 'Saqlanmoqda…',
        saved: 'Saqlandi',
        save_failed: 'Saqlab bo‘lmadi',
        tabs: {
            bag: 'Inventar',
            craft: 'Yasash',
            hero: 'Qahramon',
            settings: 'Sozlamalar',
            chest: 'Sandiq',
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
        },
        broke: 'sindi',
        durability: 'Mustahkamlik',
        artifact_found: 'Artefakt topildi',
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
            deaths: 'O‘limlar',
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
            wind_feather: [
                'Shamol pati',
                'Tog‘ artefakti. U bilan balandroq sakraysiz.',
            ],
            sun_stone: [
                'Quyosh toshi',
                'Cho‘l artefakti. Kechasi atrofingizni yoritadi.',
            ],
            frost_crystal: [
                'Muz kristali',
                'Qor artefakti. Nafas uzoqroq, suzish tezroq.',
            ],
            forest_heart: [
                'O‘rmon yuragi',
                'O‘rmon artefakti. Resurslar bir yarim baravar ko‘p.',
            ],
            golden_clover: [
                'Oltin beda',
                'O‘tloq artefakti. Tezroq yugurasiz.',
            ],
        },
    },
};

const language = document.documentElement.lang.slice(0, 2);

export const t: Texts = TEXTS[language as keyof typeof TEXTS] ?? TEXTS.en;
