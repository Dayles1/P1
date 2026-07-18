<?php

namespace App\Http\Controllers\Api\Setting;

use App\Domain\Setting\Actions\ListTimezones;
use App\Http\Controllers\Controller;
use App\Http\Resources\Setting\TimezoneResource;
use Illuminate\Http\JsonResponse;

class TimezoneController extends Controller
{
    public function __construct(
        protected ListTimezones $listTimezones
    ) {}

    public function index(): JsonResponse
    {
        $timezones = $this->listTimezones->handle();
        return $this->success(
            data: TimezoneResource::collection($timezones)
        );
    }
}