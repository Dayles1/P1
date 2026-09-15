<?php

test('the old admin settings page redirects into the unified settings page', function () {
    $this->get('/admin/settings')
        ->assertRedirect('/settings#system');
});

test('the settings page renders', function () {
    $this->get('/settings')->assertOk();
});
