<?php

use App\Domain\Identity\Models\User;
use App\Games\Sandbox\Http\Requests\SavePlayerRequest;
use App\Games\Sandbox\Item;
use App\Games\Sandbox\Models\Player;
use Illuminate\Support\Facades\Schema;

function sandboxPosition(array $overrides = []): array
{
    return ['x' => 12.5, 'y' => 3.25, 'z' => -40, 'yaw' => 1.5, ...$overrides];
}

test('the game has a page of its own, not the games SPA', function () {
    $this->withoutVite()
        ->get('/games/sandbox')
        ->assertOk()
        ->assertSee('id="sandbox-root"', false)
        ->assertSee('data-back-url="'.url('/games').'"', false)
        ->assertDontSee('id="games-root"', false);
});

test('players live in the sandbox database only', function () {
    expect(Schema::connection('sandbox')->hasTable('players'))->toBeTrue()
        ->and(Schema::hasTable('players'))->toBeFalse()
        ->and(Schema::connection('games')->hasTable('players'))->toBeFalse();
});

test('guests cannot load or save', function () {
    $this->getJson('/api/sandbox/player')->assertUnauthorized();
    $this->putJson('/api/sandbox/player', sandboxPosition())->assertUnauthorized();
    $this->deleteJson('/api/sandbox/player')->assertUnauthorized();
});

test('a new player has no saved position', function () {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('the position is saved under the player id and loads back', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition())
        ->assertOk()
        ->assertJsonPath('data.x', 12.5);

    $this->putJson('/api/sandbox/player', sandboxPosition(['x' => -3, 'yaw' => -2]))->assertOk();

    expect(Player::query()->sole())
        ->user_id->toBe($user->id)
        ->x->toBe(-3.0)
        ->yaw->toBe(-2.0);

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.z', -40)
        ->assertJsonPath('data.y', 3.25);
});

test('each player only sees their own position', function () {
    Player::factory()->create(['x' => 99]);

    $this->actingAs(User::factory()->create(), 'sanctum')
        ->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data', null);
});

test('a position outside the world is refused', function (array $position, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', $position)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect(Player::query()->count())->toBe(0);
})->with([
    'too far east' => [sandboxPosition(['x' => 300]), 'x'],
    'too far south' => [sandboxPosition(['z' => -300]), 'z'],
    'not a number' => [sandboxPosition(['y' => 'up']), 'y'],
    'missing yaw' => [['x' => 0, 'y' => 0, 'z' => 0], 'yaw'],
]);

test('the inventory and what was used up are saved and load back', function () {
    $user = User::factory()->create();
    $inventory = [['item' => 'wood', 'count' => 12], null, ['item' => 'berries', 'count' => 4]];
    $harvested = [['id' => 'tree:4', 'at' => 1_760_000_000_000], ['id' => 'pick:17', 'at' => 1_760_000_100_000]];

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition(['inventory' => $inventory, 'harvested' => $harvested]))
        ->assertOk();

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.inventory', $inventory)
        ->assertJsonPath('data.harvested', $harvested);
});

test('a save without inventory keeps the stored one', function () {
    $user = User::factory()->create();
    Player::factory()->create(['user_id' => $user->id, 'inventory' => [['item' => 'stone', 'count' => 3]]]);

    $this->actingAs($user, 'sanctum')->putJson('/api/sandbox/player', sandboxPosition())->assertOk();

    expect(Player::query()->sole()->inventory)->toBe([['item' => 'stone', 'count' => 3]]);
});

test('a player who never gathered anything has empty lists', function () {
    $user = User::factory()->create();
    Player::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/sandbox/player')
        ->assertJsonPath('data.inventory', [])
        ->assertJsonPath('data.harvested', []);
});

test('a broken inventory or harvest list is refused', function (array $extra, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition($extra))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'unknown item' => [['inventory' => [['item' => 'diamond', 'count' => 1]]], 'inventory.0'],
    'stack too big' => [['inventory' => [['item' => 'berries', 'count' => 31]]], 'inventory.0'],
    'empty stack' => [['inventory' => [['item' => 'wood', 'count' => 0]]], 'inventory.0'],
    'extra keys' => [['inventory' => [['item' => 'wood', 'count' => 1, 'enchanted' => true]]], 'inventory.0'],
    'too many slots' => [['inventory' => array_fill(0, 25, null)], 'inventory'],
    'odd id' => [['harvested' => [['id' => 'house:1', 'at' => 1]]], 'harvested.0.id'],
    'no time' => [['harvested' => [['id' => 'tree:1']]], 'harvested.0.at'],
]);

test('tools keep their wear, campfires and found artifacts are saved', function () {
    $user = User::factory()->create();
    $inventory = [['item' => 'iron_axe', 'count' => 1, 'wear' => 37], ['item' => 'campfire', 'count' => 2], ['item' => 'sun_stone', 'count' => 1]];
    $placed = [['type' => 'campfire', 'x' => 12.5, 'z' => -3.25]];
    $harvested = [['id' => 'art:2', 'at' => 1_760_000_000_000]];

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition(['inventory' => $inventory, 'placed' => $placed, 'harvested' => $harvested]))
        ->assertOk();

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.inventory', $inventory)
        ->assertJsonPath('data.placed', $placed)
        ->assertJsonPath('data.harvested', $harvested);
});

test('broken tools, campfires or artifacts are refused', function (array $extra, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition($extra))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'worn out' => [['inventory' => [['item' => 'stone_axe', 'count' => 1, 'wear' => 60]]], 'inventory.0'],
    'wear on wood' => [['inventory' => [['item' => 'wood', 'count' => 3, 'wear' => 1]]], 'inventory.0'],
    'two swords in a slot' => [['inventory' => [['item' => 'iron_sword', 'count' => 2]]], 'inventory.0'],
    'unknown thing placed' => [['placed' => [['type' => 'house', 'x' => 0, 'z' => 0]]], 'placed.0.type'],
    'placed off the map' => [['placed' => [['type' => 'campfire', 'x' => 900, 'z' => 0]]], 'placed.0.x'],
    'too many things placed' => [['placed' => array_fill(0, 201, ['type' => 'campfire', 'x' => 1, 'z' => 1])], 'placed'],
]);

test('health, worn armour, buildings with a chest full of things and stats load back', function () {
    $user = User::factory()->create();
    $equipment = [
        'head' => ['item' => 'iron_helmet', 'count' => 1, 'wear' => 12],
        'body' => ['item' => 'leather_jacket', 'count' => 1, 'wear' => 0],
        'feet' => null,
    ];
    $placed = [
        ['type' => 'campfire', 'x' => 1.5, 'z' => 2],
        ['type' => 'wood_wall', 'x' => 3, 'z' => 4, 'yaw' => 1.5708],
        ['type' => 'wood_door', 'x' => 5, 'z' => 4, 'yaw' => 0, 'open' => true],
        ['type' => 'sleeping_bag', 'x' => 6, 'z' => 7, 'yaw' => 3.1416, 'spawn' => true],
        ['type' => 'chest', 'x' => 8, 'z' => 9, 'yaw' => 0, 'items' => [null, ['item' => 'cooked_meat', 'count' => 7], null, ['item' => 'iron_sword', 'count' => 1, 'wear' => 3]]],
    ];
    $stats = ['wolf' => 3, 'trees' => 12, 'deaths' => 1];

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition([
            'health' => 63.5,
            'equipment' => $equipment,
            'placed' => $placed,
            'stats' => $stats,
        ]))
        ->assertOk();

    $this->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.health', 63.5)
        ->assertJsonPath('data.equipment', $equipment)
        ->assertJsonPath('data.placed', $placed)
        ->assertJsonPath('data.stats', $stats);
});

test('a character saved before health and armour loads with neither', function () {
    $user = User::factory()->create();
    Player::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/sandbox/player')
        ->assertOk()
        ->assertJsonPath('data.health', null)
        ->assertJsonPath('data.equipment', ['head' => null, 'body' => null, 'feet' => null])
        ->assertJsonPath('data.stats', []);
});

test('odd health, armour, buildings or stats are refused', function (array $extra, string $field) {
    $this->actingAs(User::factory()->create(), 'sanctum')
        ->putJson('/api/sandbox/player', sandboxPosition($extra))
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'too healthy' => [['health' => 150], 'health'],
    'boots on the head' => [['equipment' => ['head' => ['item' => 'iron_boots', 'count' => 1], 'body' => null, 'feet' => null]], 'equipment.head'],
    'a sword worn' => [['equipment' => ['head' => null, 'body' => ['item' => 'iron_sword', 'count' => 1], 'feet' => null]], 'equipment.body'],
    'a fourth armour slot' => [['equipment' => ['head' => null, 'body' => null, 'feet' => null, 'hands' => null]], 'equipment'],
    'worn-out armour' => [['equipment' => ['head' => null, 'body' => ['item' => 'iron_chestplate', 'count' => 1, 'wear' => 320], 'feet' => null]], 'equipment.body'],
    'things in a wall' => [['placed' => [['type' => 'wood_wall', 'x' => 0, 'z' => 0, 'items' => [['item' => 'wood', 'count' => 1]]]]], 'placed.0.items'],
    'an overfull chest' => [['placed' => [['type' => 'chest', 'x' => 0, 'z' => 0, 'items' => array_fill(0, 13, null)]]], 'placed.0.items'],
    'a broken stack in a chest' => [['placed' => [['type' => 'chest', 'x' => 0, 'z' => 0, 'items' => [['item' => 'wood', 'count' => 500]]]]], 'placed.0.items.0'],
    'a door that is ajar' => [['placed' => [['type' => 'wood_door', 'x' => 0, 'z' => 0, 'open' => 'ajar']]], 'placed.0.open'],
    'an unknown counter' => [['stats' => ['dragons' => 1]], 'stats'],
    'a negative counter' => [['stats' => ['wolf' => -1]], 'stats.wolf'],
]);

test('every buildable client structure can be saved', function () {
    $client = file_get_contents(app_path('Games/Sandbox/client/world/structures.ts'));
    preg_match('/export type StructureType =([^;]+);/', $client, $match);
    preg_match_all("/'([a-z_]+)'/", $match[1], $types);

    expect(collect($types[1])->push('campfire')->sort()->values()->all())
        ->toBe(collect(SavePlayerRequest::PLACEABLE)->sort()->values()->all());
});

test('every client armour piece is worn where the server expects it', function () {
    $client = file_get_contents(app_path('Games/Sandbox/client/items.ts'));
    preg_match_all("/\n    ([a-z_]+): \{[^}]*?armor: \{ slot: '([a-z]+)'/", $client, $pieces, PREG_SET_ORDER);

    expect($pieces)->not->toBeEmpty();

    foreach ($pieces as [, $item, $slot]) {
        expect(Item::from($item)->armorSlot())->toBe($slot);
    }

    expect(collect(Item::cases())->filter(fn (Item $item) => $item->armorSlot() !== null)->count())
        ->toBe(count($pieces));
});

test('every client item is known to the server', function () {
    $client = file_get_contents(app_path('Games/Sandbox/client/items.ts'));
    preg_match('/export type ItemId =([^;]+);/', $client, $match);
    preg_match_all("/'([a-z_]+)'/", $match[1], $ids);

    expect(collect(Item::cases())->pluck('value')->sort()->values()->all())
        ->toBe(collect($ids[1])->sort()->values()->all());
});

test('a player can reset their position', function () {
    $user = User::factory()->create();
    Player::factory()->create(['user_id' => $user->id]);

    $this->actingAs($user, 'sanctum')->deleteJson('/api/sandbox/player')->assertOk();

    expect(Player::query()->count())->toBe(0);
});
