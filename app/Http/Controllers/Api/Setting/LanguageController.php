<?php

namespace App\Http\Controllers\Api\Setting;

use App\Domain\Localization\Actions\ListLanguages;
use App\Http\Controllers\Controller;
use App\Http\Resources\Localization\LanguageResource;
use Illuminate\Http\JsonResponse;

class LanguageController extends Controller
{
    public function __construct(
        protected ListLanguages $listLanguages,
    ) {}

    public function index(): JsonResponse
    {
        return $this->success(
            data: LanguageResource::collection($this->listLanguages->handle())
        );
    }
}
