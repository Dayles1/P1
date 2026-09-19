<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * The provider publishes one set of rates a day, shortly after 00:00
 * UTC. Running an hour later leaves room for it to be late without the
 * app filing yesterday's numbers under today (the rate row is dated
 * from the payload, not from the clock here), and withoutOverlapping
 * keeps a slow run from being started again on top of itself.
 */
Schedule::command('currency:sync')
    ->dailyAt('01:00')
    ->timezone('UTC')
    ->withoutOverlapping()
    ->runInBackground();
