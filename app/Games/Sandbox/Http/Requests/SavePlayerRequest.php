<?php

namespace App\Games\Sandbox\Http\Requests;

use App\Games\Sandbox\Heroes;
use App\Games\Sandbox\Item;
use App\Games\Sandbox\Models\Player;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SavePlayerRequest extends FormRequest
{
    /**
     * Half the world's width: the client keeps the character inside it.
     */
    public const int WORLD_HALF_SIZE = 256;

    /**
     * The most used-up trees, rocks, finds and artifacts one save remembers.
     */
    public const int MAX_HARVESTED = 3000;

    /**
     * The most things a player may have put down: campfires and buildings
     * together.
     */
    public const int MAX_PLACED = 200;

    /**
     * Slots in a chest.
     */
    public const int CHEST_SLOTS = 12;

    /**
     * Most knowledge points a player can hoard.
     */
    public const int MAX_KNOWLEDGE = 100000;

    /**
     * What can be put down in the world.
     *
     * @var list<string>
     */
    public const array PLACEABLE = ['campfire', 'chest', 'workbench', 'wood_wall', 'wood_door', 'wood_roof', 'stone_wall', 'sleeping_bag'];

    /**
     * The counters on the character tab.
     *
     * @var list<string>
     */
    public const array STATS = ['deer', 'boar', 'wolf', 'zombie', 'trees', 'rocks', 'digs', 'artifacts', 'crafted', 'researched', 'deaths'];

    public function authorize(): bool
    {
        return true;
    }

    /**
     * Position is always sent; everything else only replaces what is
     * stored when it is.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $half = self::WORLD_HALF_SIZE;

        return [
            'x' => ['required', 'numeric', "between:-{$half},{$half}"],
            'y' => ['required', 'numeric', 'between:-100,500'],
            'z' => ['required', 'numeric', "between:-{$half},{$half}"],
            'yaw' => ['required', 'numeric', 'between:-7,7'],
            'hero' => ['sometimes', 'array:class,gender,level,xp,points,look,artifacts'],
            'hero.class' => ['required_with:hero', Rule::in(Heroes::classes())],
            'hero.gender' => ['required_with:hero', Rule::in(Heroes::genders())],
            'hero.level' => ['required_with:hero', 'integer', 'between:1,'.Heroes::maxLevel()],
            'hero.xp' => ['required_with:hero', 'integer', 'min:0', $this->belowNextLevel(...)],
            'hero.points' => ['present_with:hero', 'array:'.implode(',', Heroes::attributes()), $this->earnedPoints(...)],
            'hero.points.*' => ['integer', 'min:0'],
            'hero.artifacts' => ['sometimes', 'array:stash,tree'],
            'hero.artifacts.stash' => ['present_with:hero.artifacts', 'list', 'max:'.Heroes::stashSize()],
            'hero.artifacts.stash.*' => ['required', $this->validArtifact(...)],
            'hero.artifacts.tree' => ['present_with:hero.artifacts', 'list', $this->openCells(...)],
            'hero.artifacts.tree.*' => ['nullable', $this->validArtifact(...)],
            'hero.look' => ['sometimes', 'array:hair,hair_color,beard,eyes'],
            'hero.look.hair' => ['required_with:hero.look', Rule::in(Heroes::looks('hair'))],
            'hero.look.hair_color' => ['required_with:hero.look', Rule::in(Heroes::looks('hair_color'))],
            'hero.look.beard' => ['required_with:hero.look', Rule::in(Heroes::looks('beard'))],
            'hero.look.eyes' => ['required_with:hero.look', Rule::in(Heroes::looks('eyes'))],

            'health' => ['sometimes', 'numeric', 'min:0', $this->notAbove('health')],
            'mana' => ['sometimes', 'numeric', 'min:0', $this->notAbove('mana')],

            'inventory' => ['sometimes', 'array', 'max:'.Item::SLOTS],
            'inventory.*' => ['nullable', $this->validStack(...)],

            'equipment' => ['sometimes', 'array:'.implode(',', Item::ARMOR_SLOTS)],
            'equipment.head' => ['nullable', $this->wornOn('head')],
            'equipment.body' => ['nullable', $this->wornOn('body')],
            'equipment.feet' => ['nullable', $this->wornOn('feet')],

            'harvested' => ['sometimes', 'array', 'max:'.self::MAX_HARVESTED],
            'harvested.*' => ['array:id,at'],
            'harvested.*.id' => ['required', 'string', 'regex:/^(tree|rock|pick|art|dig):\d{1,5}$/'],
            'harvested.*.at' => ['required', 'integer', 'min:0'],

            'placed' => ['sometimes', 'array', 'max:'.self::MAX_PLACED],
            'placed.*' => ['array:type,x,z,yaw,items,open,spawn'],
            'placed.*.type' => ['required', Rule::in(self::PLACEABLE)],
            'placed.*.x' => ['required', 'numeric', "between:-{$half},{$half}"],
            'placed.*.z' => ['required', 'numeric', "between:-{$half},{$half}"],
            'placed.*.yaw' => ['sometimes', 'numeric', 'between:-7,7'],
            'placed.*.items' => ['sometimes', 'prohibited_unless:placed.*.type,chest', 'array', 'max:'.self::CHEST_SLOTS],
            'placed.*.items.*' => ['nullable', $this->validStack(...)],
            'placed.*.open' => ['sometimes', 'boolean'],
            'placed.*.spawn' => ['sometimes', 'boolean'],

            'stats' => ['sometimes', 'array:'.implode(',', self::STATS)],
            'stats.*' => ['integer', 'min:0', 'max:1000000000'],

            'research' => ['sometimes', 'array:points,known'],
            'research.points' => ['required_with:research', 'integer', 'min:0', 'max:'.self::MAX_KNOWLEDGE],
            'research.known' => ['present_with:research', 'array', 'max:'.count(Item::cases())],
            'research.known.*' => ['distinct', Rule::enum(Item::class)],
        ];
    }

    /**
     * The validated save, with slots back in slot order (validation lists
     * empty ones first) — the inventory's and every chest's.
     *
     * @return array<string, mixed>
     */
    public function player(): array
    {
        $data = $this->validated();

        if (isset($data['inventory'])) {
            $data['inventory'] = $this->inSlotOrder($data['inventory']);
        }

        foreach ($data['placed'] ?? [] as $index => $placed) {
            if (isset($placed['items'])) {
                $data['placed'][$index]['items'] = $this->inSlotOrder($placed['items']);
            }
        }

        return $data;
    }

    /**
     * @param  array<int, mixed>  $slots
     * @return list<mixed>
     */
    private function inSlotOrder(array $slots): array
    {
        ksort($slots);

        return array_values($slots);
    }

    /**
     * The hero the save is about: the one it sends, else the stored one.
     *
     * @return array{class?: string, gender?: string, level?: int, points?: array<string, int>, artifacts?: array{stash?: array<int, mixed>, tree?: array<int, mixed>}}|null
     */
    private function hero(): ?array
    {
        $sent = $this->input('hero');

        if (is_array($sent) && in_array($sent['class'] ?? null, Heroes::classes(), true) && in_array($sent['gender'] ?? null, Heroes::genders(), true)) {
            return [
                'class' => $sent['class'],
                'gender' => $sent['gender'],
                'level' => max(1, min(Heroes::maxLevel(), (int) ($sent['level'] ?? 1))),
                'points' => is_array($sent['points'] ?? null) ? $sent['points'] : [],
                'artifacts' => ['tree' => is_array($sent['artifacts']['tree'] ?? null) ? $sent['artifacts']['tree'] : []],
            ];
        }

        return Player::query()->where('user_id', $this->user()?->getAuthIdentifier())->value('hero');
    }

    /**
     * Health or mana no higher than the hero's attributes allow.
     */
    private function notAbove(string $what): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($what): void {
            $hero = $this->hero();
            $most = $what === 'health' ? Heroes::maxHealth($hero) : Heroes::maxMana($hero);

            if (is_numeric($value) && $value > $most + 0.01) {
                $fail("The {$attribute} cannot be above {$most}.");
            }
        };
    }

    /**
     * Experience is spent on reaching levels: what is left is below what
     * the next one takes (at the top level it just keeps counting).
     */
    private function belowNextLevel(string $attribute, mixed $value, Closure $fail): void
    {
        $level = $this->input('hero.level');

        if (is_int($level) && $level < Heroes::maxLevel() && is_int($value) && $value >= Heroes::experienceToNext($level)) {
            $fail("The {$attribute} is enough for the next level.");
        }
    }

    /**
     * An artifact the rules allow (see Heroes::isArtifact).
     */
    private function validArtifact(string $attribute, mixed $value, Closure $fail): void
    {
        if (! Heroes::isArtifact($value)) {
            $fail("The {$attribute} is not an artifact the rules allow.");
        }
    }

    /**
     * No more cells in the lineage tree than the hero's level opens.
     */
    private function openCells(string $attribute, mixed $value, Closure $fail): void
    {
        $level = $this->input('hero.level');

        if (is_array($value) && is_int($level) && count($value) > Heroes::treeCells($level)) {
            $fail("The {$attribute} has more cells than level {$level} opens.");
        }
    }

    /**
     * No more free points put into attributes than the level has given.
     */
    private function earnedPoints(string $attribute, mixed $value, Closure $fail): void
    {
        $level = $this->input('hero.level');

        if (! is_array($value) || ! is_int($level)) {
            return;
        }

        $spent = array_sum(array_map(fn (mixed $points): int => is_int($points) ? $points : 0, $value));

        if ($spent > Heroes::bonusPointsUpTo($level)) {
            $fail("The {$attribute} add up to more than level {$level} gives.");
        }
    }

    /**
     * A slot is empty (null) or one stack: `{item, count}` of a known
     * item, at least one and no more than the item stacks to — plus
     * `wear` (uses so far, below its durability) for a tool or armour.
     */
    private function validStack(string $attribute, mixed $value, Closure $fail): void
    {
        $keys = is_array($value) ? array_keys($value) : [];
        sort($keys);

        if ($keys !== ['count', 'item'] && $keys !== ['count', 'item', 'wear']) {
            $fail("The {$attribute} slot must be empty or hold an item and a count.");

            return;
        }

        $item = is_string($value['item']) ? Item::tryFrom($value['item']) : null;

        if ($item === null) {
            $fail("The {$attribute} item is unknown.");

            return;
        }

        if (! is_int($value['count']) || $value['count'] < 1 || $value['count'] > $item->maxStack()) {
            $fail("The {$attribute} stack holds 1 to {$item->maxStack()}.");

            return;
        }

        $durability = $item->durability();

        if (array_key_exists('wear', $value) && ($durability === null || ! is_int($value['wear']) || $value['wear'] < 0 || $value['wear'] >= $durability)) {
            $fail("The {$attribute} wear does not fit the item.");
        }
    }

    /**
     * A worn piece: a valid stack of armour made for that part of the body.
     */
    private function wornOn(string $part): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($part): void {
            $this->validStack($attribute, $value, $fail);

            $item = is_array($value) && is_string($value['item'] ?? null) ? Item::tryFrom($value['item']) : null;

            if ($item !== null && $item->armorSlot() !== $part) {
                $fail("The {$attribute} item is not worn on the {$part}.");
            }
        };
    }
}
