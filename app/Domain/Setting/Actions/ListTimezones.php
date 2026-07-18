<?php

namespace App\Domain\Setting\Actions;

use App\Domain\Setting\Models\Timezone;

class ListTimezones
{
    public function handle()
{
    return Timezone::query()
        ->orderBy('offset')
        ->get();
}
}