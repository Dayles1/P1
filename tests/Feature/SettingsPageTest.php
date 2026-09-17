<?php

test('the old admin settings page redirects into the unified settings page', function () {
    $this->get('/admin/settings')
        ->assertRedirect('/settings#application-system');
});

test('the old standalone profile page redirects into the unified settings page', function () {
    $this->get('/profile')
        ->assertRedirect('/settings#personal-profile');
});

test('the settings page renders', function () {
    $this->get('/settings')->assertOk();
});
