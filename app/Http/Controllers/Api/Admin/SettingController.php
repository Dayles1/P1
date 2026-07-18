<?php

namespace App\Http\Controllers\Api\Admin;

use App\Domain\Setting\Actions\GetSettingsAction;
use App\Domain\Setting\Actions\UpdateSettingAction;
use App\Domain\Setting\Models\Setting;
use App\Http\Controllers\Controller;
use App\Http\Requests\Setting\UpdateSettingRequest;
use App\Http\Resources\Setting\SettingResource;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    public function __construct(
        private readonly GetSettingsAction $getSettingsAction,
        private readonly UpdateSettingAction $updateSettingAction,
    ) {
    }

    public function index(): JsonResponse
    {
        return $this->success(
            $this->getSettingsAction->handle()
        );
    }

    public function show(Setting $setting): JsonResponse
    {
        return $this->success(
            new SettingResource($setting)
        );
    }

    public function update(UpdateSettingRequest $request, Setting $setting): JsonResponse
    {
        $updated = $this->updateSettingAction->handle(
            setting: $setting,
            data: $request->validated()
        );

        return $this->success(
            data: new SettingResource($updated),
            message: __('messages.settings.updated')
        );
    }
}