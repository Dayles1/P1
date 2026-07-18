<?php

namespace App\Http\Controllers\Api\Profile;

use App\Domain\Identity\Actions\Setting\GetUserSettings;
use App\Domain\Identity\Actions\Setting\UpdateUserSettings;
use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\UpdateUserSettingRequest;
use App\Http\Resources\Profile\UserSettingResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSettingController extends Controller
{
    public function __construct(
        protected GetUserSettings $getUserSettings,
        protected UpdateUserSettings $updateUserSettings,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $settings = $this->getUserSettings->handle(
            $request->user()
        );

        return $this->success(
            data: new UserSettingResource($settings)
        );
    }


    public function update(
        UpdateUserSettingRequest $request
    ): JsonResponse {
        $settings = $this->updateUserSettings->handle(
            user: $request->user(),
            data: $request->validated()
        );

        return $this->success(
            data: new UserSettingResource($settings),
            message: __('messages.settings.updated')
        );
    }
}