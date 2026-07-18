<?php

namespace Database\Seeders;

use App\Domain\Setting\Models\Timezone;
use Carbon\CarbonTimeZone;
use Illuminate\Database\Seeder;

class TimezoneSeeder extends Seeder
{
    public function run(): void
{
    foreach (timezone_identifiers_list() as $name) {

        $tz = new CarbonTimeZone($name);

        $offsetSeconds = $tz->getOffset(new \DateTime());

        $hours = intdiv(abs($offsetSeconds), 3600);
        $minutes = intdiv(abs($offsetSeconds) % 3600, 60);

        $sign = $offsetSeconds >= 0 ? '+' : '-';

        $offset = sprintf(
            '%s%02d:%02d',
            $sign,
            $hours,
            $minutes
        );

        Timezone::updateOrCreate(
            [
                'name' => $name,
            ],
            [
                'label' => $name . ' (UTC' . $offset . ')',
                'offset' => $offset,
                'is_active' => true,
            ]
        );
    }
}
}