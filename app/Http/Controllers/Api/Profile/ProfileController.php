<?php

namespace App\Http\Controllers\Api\Profile;

use App\Domain\Profile\Actions\GetProfile;
use App\Domain\Profile\Actions\UpdateProfile;
use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Resources\Profile\ProfileResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function __construct(
        protected GetProfile $getProfile,
        protected UpdateProfile $updateProfile
    ) {
    }

    public function show(Request $request): JsonResponse
    {
        $profile = $this->getProfile->handle($request->user());

        return $this->success(
            data: new ProfileResource($profile)
        );
    }
    public function update(UpdateProfileRequest $request): JsonResponse
{
    $profile = $this->updateProfile->handle(
        $request->user(),
        $request->validated()
    );

    return $this->success(
        data: new ProfileResource($profile),
        message: __('messages.profile.updated')
    );
}
}