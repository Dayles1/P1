<?php

namespace App\Http\Controllers\Api\AccessControl;

use App\Domain\AccessControl\Actions\ListRoles;
use App\Http\Controllers\Controller;
use App\Http\Resources\AccessControl\RoleResource;
use Illuminate\Http\JsonResponse;

class RoleController extends Controller
{
    public function __construct(
        protected ListRoles $listRoles,
    ) {}

    public function index(): JsonResponse
    {
        return $this->success(
            data: RoleResource::collection($this->listRoles->handle())
        );
    }
}
