<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * RefreshDatabase rolls back the default connection and the games'
     * own ones: the games module's (app/Games) and each self-contained
     * game's, like the Sandbox (app/Games/Sandbox).
     *
     * @var list<string|null>
     */
    protected $connectionsToTransact = [null, 'games', 'sandbox'];
}
