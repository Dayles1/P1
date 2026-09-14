<?php

namespace App\Http\Requests\Admin;

use App\Domain\AccessControl\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role' => ['required', 'string', Rule::in([Role::SUPER_ADMIN, Role::ADMIN, Role::USER])],
        ];
    }
}
