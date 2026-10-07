<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * RefreshDatabase rolls back the default connection and the games
     * module's own one (app/Games keeps its tables in a separate database).
     *
     * @var list<string|null>
     */
    protected $connectionsToTransact = [null, 'games'];
}
