<?php

namespace App\Games\Epochs\Http\Controllers;

use App\Games\Epochs\Http\Requests\CreateWorldRequest;
use App\Games\Epochs\Http\Requests\SyncWorldRequest;
use App\Games\Epochs\WorldStore;
use App\Games\Http\Controllers\GameController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The player's world in "City of Eras": load it, create it, save changes,
 * start over.
 */
class WorldController extends GameController
{
    public function __construct(
        protected WorldStore $worlds,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $world = $this->worlds->find($this->playerId($request));

        return $this->success($world === null ? null : $this->worlds->load($world));
    }

    public function store(CreateWorldRequest $request): JsonResponse
    {
        $playerId = $this->playerId($request);

        if ($this->worlds->find($playerId) !== null) {
            return $this->error(__('games::messages.world_exists'), 409);
        }

        $world = $this->worlds->create($playerId, $request->validated());

        return $this->success(['revision' => $world->revision, 'saved_at' => $world->updated_at?->toIso8601String()], status: 201);
    }

    public function sync(SyncWorldRequest $request): JsonResponse
    {
        $world = $this->worlds->find($this->playerId($request));

        if ($world === null) {
            return $this->error(__('games::messages.world_missing'), 404);
        }

        $saved = $this->worlds->sync($world, $request->validated());

        if ($saved === null) {
            return $this->error(__('games::messages.save_conflict'), 409, ['revision' => $world->revision]);
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
}
