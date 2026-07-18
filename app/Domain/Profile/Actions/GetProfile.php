<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Identity\Models\User;
use App\Domain\Profile\Repository\ProfileRepositoryInterface;

class GetProfile
{
    public function __construct(
        protected ProfileRepositoryInterface $profileRepository,
    ) {
    }

    public function handle(User $user): User
    {
        return $this->profileRepository->get($user);
    }
}