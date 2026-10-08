<?php

namespace App\Games\Sandbox\Http\Requests;

use App\Games\Sandbox\Item;
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

    public const int MAX_HEALTH = 100;

    /**
     * What can be put down in the world.
     *
     * @var list<string>
     */
    public const array PLACEABLE = ['campfire', 'chest', 'workbench', 'wood_wall', 'wood_door', 'sleeping_bag'];

    /**
     * The counters on the character tab.
     *
     * @var list<string>
     */
    public const array STATS = ['deer', 'boar', 'wolf', 'zombie', 'trees', 'rocks', 'crafted', 'deaths'];

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
            'health' => ['sometimes', 'numeric', 'between:0,'.self::MAX_HEALTH],

            'inventory' => ['sometimes', 'array', 'max:'.Item::SLOTS],
            'inventory.*' => ['nullable', $this->validStack(...)],

            'equipment' => ['sometimes', 'array:'.implode(',', Item::ARMOR_SLOTS)],
            'equipment.head' => ['nullable', $this->wornOn('head')],
            'equipment.body' => ['nullable', $this->wornOn('body')],
            'equipment.feet' => ['nullable', $this->wornOn('feet')],

            'harvested' => ['sometimes', 'array', 'max:'.self::MAX_HARVESTED],
            'harvested.*' => ['array:id,at'],
            'harvested.*.id' => ['required', 'string', 'regex:/^(tree|rock|pick|art):\d{1,5}$/'],
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
