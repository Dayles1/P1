<?php

namespace App\Games\City3\Http\Controllers;

use App\Games\City3\Http\Requests\CreateWorldRequest;
use App\Games\City3\Http\Requests\SyncWorldRequest;
use App\Games\City3\Testers;
use App\Games\City3\WorldStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The player's world in "Летопись города 3": load it, create it, save
 * changes, start over — only ever the signed-in player's own, found by
 * their user id. Answers with the same `{success, message, data}` envelope
 * as the host API, without depending on its controllers.
 */
class WorldController
{
    public function __construct(
        private WorldStore $worlds,
        private Testers $testers,
    ) {}

    /**
     * The world (null before the first one is founded) and whether the
     * player gets the tester tools.
     */
    public function show(Request $request): JsonResponse
    {
        $playerId = $this->playerId($request);
        $world = $this->worlds->find($playerId);

        return $this->success([
            'tester' => $this->testers->includes($playerId),
            'world' => $world === null ? null : $this->worlds->load($world),
        ]);
    }

    public function store(CreateWorldRequest $request): JsonResponse
    {
        $playerId = $this->playerId($request);

        if ($this->worlds->find($playerId) !== null) {
            return $this->error(__('city3::messages.world_exists'), 409);
        }

        $world = $this->worlds->create($playerId, $request->validated());

        return $this->success(['revision' => $world->revision, 'saved_at' => $world->updated_at?->toIso8601String()], 201);
    }

    public function sync(SyncWorldRequest $request): JsonResponse
    {
        $world = $this->worlds->find($this->playerId($request));

        if ($world === null) {
            return $this->error(__('city3::messages.world_missing'), 404);
        }

        $saved = $this->worlds->sync($world, $request->validated());

        if ($saved === null) {
            return $this->error(__('city3::messages.save_conflict'), 409, ['revision' => $world->revision]);
        }

        return $this->success(['revision' => $saved->revision, 'saved_at' => $saved->updated_at?->toIso8601String()]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $world = $this->worlds->find($this->playerId($request));

        if ($world !== null) {
            $this->worlds->delete($world);
        }

        return $this->success();
    }

    private function success(mixed $data = null, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => '', 'data' => $data], $status);
    }

    private function error(string $message, int $status, mixed $data = null): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'data' => $data], $status);
    }

    /**
     * The player: the host application's user id — the one thing the game
     * shares with it.
     */
    private function playerId(Request $request): int
    {
        return (int) $request->user()->getAuthIdentifier();
    }
}
