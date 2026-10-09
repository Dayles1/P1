<?php

test('the page turns on the creative tab when the config allows it', function () {
    config(['sandbox.creative' => true]);

    $this->withoutVite()
        ->get('/games/sandbox')
        ->assertOk()
        ->assertSee('data-creative', false);
});

test('the page keeps the creative tab off otherwise', function () {
    config(['sandbox.creative' => false]);

    $this->withoutVite()
        ->get('/games/sandbox')
        ->assertOk()
        ->assertDontSee('data-creative', false);
});
