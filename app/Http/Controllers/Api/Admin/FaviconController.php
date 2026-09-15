<?php

namespace App\Http\Controllers\Api\Admin;

use App\Domain\Setting\Actions\DestroyFavicon;
use App\Domain\Setting\Actions\StoreFavicon;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreFaviconRequest;
use Illuminate\Http\JsonResponse;

class FaviconController extends Controller
{
    public function __construct(
        protected StoreFavicon $storeFavicon,
        protected DestroyFavicon $destroyFavicon,
    ) {}

    public function store(StoreFaviconRequest $request): JsonResponse
    {
        return $this->success(
            data: ['url' => $this->storeFavicon->handle($request->file('file'))],
            message: __('messages.settings.favicon_updated')
        );
    }

    public function destroy(): JsonResponse
    {
        return $this->success(
            data: ['url' => $this->destroyFavicon->handle()],
            message: __('messages.settings.favicon_removed')
        );
    }
}
