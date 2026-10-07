<?php

namespace App\Games\Epochs\Http\Controllers;

use App\Games\Epochs\Content\ContentRepository;
use App\Games\Epochs\Content\ContentValidator;
use App\Games\Epochs\Workshop;
use App\Games\Http\Controllers\GameController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use JsonException;

/**
 * The content files: the game loads them all at start; the Workshop
 * writes one at a time after checking the whole set still holds together.
 */
class ContentController extends GameController
{
    public function __construct(
        protected ContentRepository $content,
        protected ContentValidator $validator,
        protected Workshop $workshop,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success([
            'version' => $this->content->version(),
            'editable' => $this->workshop->canEdit($this->playerId($request)),
            'content' => $this->content->bundleForClient(),
        ]);
    }

    /**
     * Saves one file (or creates a new building). The body is the file's
     * JSON as text, so it is written exactly as edited.
     */
    public function update(Request $request, string $key): JsonResponse
    {
        if ($denied = $this->deny($request, $key)) {
            return $denied;
        }

        $request->validate(['json' => ['required', 'string', 'max:1000000']]);

        try {
            $asArray = json_decode($request->string('json')->toString(), true, 512, JSON_THROW_ON_ERROR);
            $asObject = json_decode($request->string('json')->toString(), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            return $this->error(__('games::messages.content_invalid_json'), 422, ['issues' => [['file' => $key, 'path' => '', 'message' => $exception->getMessage()]]]);
        }

        if (! is_array($asArray)) {
            return $this->error(__('games::messages.content_invalid_json'), 422, ['issues' => [['file' => $key, 'path' => '', 'message' => 'Ожидается объект']]]);
        }

        $bundle = $this->content->bundle();

        if (str_starts_with($key, 'buildings/')) {
            $bundle['buildings'][substr($key, 10)] = $asArray;
        } else {
            $bundle[$key] = $asArray;
        }

        if ($issues = $this->validator->validate($bundle)) {
            return $this->error(__('games::messages.content_invalid'), 422, ['issues' => $issues]);
        }

        $this->content->write($key, $asObject);

        return $this->success(['version' => $this->content->version()]);
    }

    /**
     * Removes a building file — refused while anything still refers to it.
     */
    public function destroy(Request $request, string $key): JsonResponse
    {
        if ($denied = $this->deny($request, $key)) {
            return $denied;
        }

        if (! str_starts_with($key, 'buildings/')) {
            return $this->error(__('games::messages.content_not_deletable'), 422);
        }

        $bundle = $this->content->bundle();

        unset($bundle['buildings'][substr($key, 10)]);

        if ($issues = $this->validator->validate($bundle)) {
            return $this->error(__('games::messages.content_in_use'), 422, ['issues' => $issues]);
        }

        $this->content->delete($key);

        return $this->success(['version' => $this->content->version()]);
    }

    private function deny(Request $request, string $key): ?JsonResponse
    {
        if (! $this->workshop->canEdit($this->playerId($request))) {
            return $this->error(__('games::messages.workshop_forbidden'), 403);
        }

        if (! ContentRepository::isValidKey($key)) {
            return $this->error(__('games::messages.content_unknown_file'), 404);
        }

        return null;
    }
}
