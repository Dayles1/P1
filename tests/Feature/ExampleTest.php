<?php

test('returns a successful response', function () {
    $response = $this->get(route('home'));

    $response->assertOk();
});

test('the landing page sends a signed-in visitor to the dashboard before it paints', function () {
    $this->withoutVite()
        ->get(route('home'))
        ->assertOk()
        ->assertSeeInOrder([
            "localStorage.getItem('auth_token')",
            'window.location.replace("\/dashboard")',
            '</head>',
        ], false);
});

test('other public pages do not redirect signed-in visitors', function () {
    $this->withoutVite()
        ->get(route('about'))
        ->assertOk()
        ->assertDontSee('window.location.replace', false);
});
