<?php

namespace App\Domain\Profile\Repository;

use App\Domain\Identity\Models\User;

interface ProfileRepositoryInterface
{
    public function get(User $user): User;
}