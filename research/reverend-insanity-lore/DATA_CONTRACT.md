# DATA_CONTRACT — лор-база ↔ движок GU World

Статус: **черновик 0.1** (2026-10-09), ждёт отзыва игрового агента и пользователя.

## 1. Роли

- **Лор-база** (`research/reverend-insanity-lore/`) хранит канон, источники, достоверность и связи. Она не знает о координатах, балансе и runtime-состоянии.
- **Движок** (`app/Games/GuWorld`) хранит игровые сущности, координаты, баланс и сохранения. Лор-базу целиком никогда не загружает.
- **Экспортёр** живёт на стороне движка. Он читает `indexes/` и записи по id и выдаёт компактный проверенный JSON для рантайма.

## 2. Идентификаторы

- Лор-id: `^(gu|char|rcp|fac|loc|reg|res|move|sys|inh|house|path|race|evt|ch|term)_[a-z0-9_]+$`. Имя файла совпадает с id (`gu/gu_moonlight_gu.json`).
- Лор-id — это ссылки на шаблоны контента, а не runtime-id. Runtime-id движка имеют вид `kind[:part…]`, например `npc:gu_yue:…`.
- NPC — отдельная игровая сущность с полем `template: "char_…"`. Игровая локация — с необязательным полем `lore_ref: "loc_…" | "reg_…"`.
- **Стабильность.** Опубликованный id не меняется и не удаляется. При переименовании или слиянии старый id остаётся записью с `canon_status: "duplicate"` и связью `duplicate_of`. Экспортёр следует по ней.
- Где найти записи: `indexes/master-index.json` (id → файл, тип), индексы по типам (`gu-index.json`, `character-index.json`, `location-index.json`, `faction-index.json`, `region-index.json`), `name-index.json` (имя/алиас → id), `relations.json` (рёбра графа).

## 3. Версии

- `schema_version: "major.minor"`, сейчас `1.0`.
- Ломающее изменение: удаление или переименование обязательного поля, смена типа или смысла значения. Такое изменение повышает major. Экспортёр проверяет major и отказывается работать с неизвестным.
- Добавление необязательных полей и значений перечислений повышает minor. Неизвестные поля экспортёр игнорирует.

## 4. Поля, на которые может опираться движок (v1)

Для всех типов:

| Поле | Тип | Примечание |
|---|---|---|
| `id`, `entity_type`, `schema_version` | string | обязательны |
| `names.ru` | string \| null | см. `names.ru_status`: `official` / `transliteration` / `working_translation` / `unknown` |
| `names.zh`, `names.en`, `names.aliases` | | `zh` только из источника |
| `canon_status` | enum | `confirmed`, `partially_confirmed`, `unverified`, `speculative`, `duplicate` |
| `confidence` | A–D | см. §6 |
| `first_appearance.chapter` | int \| null | 1..2334 |
| `relations[]` | `{type, target, role, from_chapter, to_chapter}` | типы связей — §5 |
| `game_proposals[]` | `{tag: "GAME_PROPOSAL", field, value}` | единственное место для игровых значений |

Для Гу:

| Поле | Примечание |
|---|---|
| `classification.ranks[].rank` | список зафиксированных рангов. Пустой список = ранг неизвестен; диапазон 1–9 не достраивается |
| `classification.rank_type` | `mortal` / `immortal` / `unknown` |
| `classification.paths[]` | ссылки на `path_*` |
| `feeding.food_raw`, `feeding.foods[]` | `foods` ссылаются на `res_*` |
| `refinement.recipes[]`, `refinement.used_in_recipes[]` | ссылки на `rcp_*` |
| `ownership_history[]` | `{character, role, from_chapter, to_chapter}` |
| `economy.canonical_prices[]` | только проверенные цены; `price_claims` — сырьё, не для игры |

Для персонажей: `cultivation.rank_timeline[]` (`{rank, as_of_chapter}`; это ранг мастера, а не ранг Гу), `cultivation.paths[]`, `biography.region|race|status`, `gu_held[]`, связи `member_of` (фракции).

Поле `attributes` содержит сырые поля инфобокса источника. Это нестабильная часть, движку на неё не опираться.

## 5. Типы связей (v1)

`held_by` (Гу → владелец), `member_of`, `in_region`, `race`, `seat`, `path`, `feeds_on`, `produces`, `uses_move`, `took_part_in`, `linked_inheritance`, `uses_gu_house`, `duplicate_of`. Новые типы добавляются как minor-изменение.

## 6. Тексты и достоверность

- В игру попадают **только** тексты с `text_origin: "own_words"`. Тексты `source_excerpt` (выдержки sagaofgu) остаются только для исследования.
- Порог по умолчанию для экспорта: `confidence ∈ {A, B, C}` и `canon_status ∉ {speculative, duplicate}`. Всё остальное — только с явным флагом в контенте.
- Оговорка: на сегодня записей уровня A нет. B означает «источник указал конкретную главу», но глава не перечитывалась. Более строгий фильтр строится по полю `claims[].verification`.

## 7. Что в лор-базе не хранится

Координаты, границы, точки появления, рельеф, раскладка зданий, распорядки NPC, баланс. Всё это игровые допущения, они живут в игровом контенте и `config/gu_world.php`. Исключение — `game_proposals` с тегом `GAME_PROPOSAL`: это предложения, а не канон.

## 8. Проверка

- Лор-сторона: `python tools/validate.py` проверяет схемы, уникальность и совпадение id с именем файла, ссылки, индексы и источники.
- Сторона движка: экспортёр проверяет major-версию, обязательные поля и существование всех id, на которые ссылается игровой контент.

## 9. Открыто

- Транслитерация: по умолчанию Палладий (`古月` = «Гу Юэ»), альтернатива «Гу Юе». Ждём решения пользователя.
- Формат и расположение файла экспорта (предложение: `app/Games/GuWorld/content/lore-export.json` на стороне движка).
- Нужен ли движку отдельный индекс «сущности по арке или главе» для постепенного открытия контента.
