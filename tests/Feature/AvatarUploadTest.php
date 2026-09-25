<?php

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Identity\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');

    $this->user = User::factory()->create();
    [$this->token] = createUserSession($this->user);

    $this->upload = fn (UploadedFile $file) => $this
        ->withHeader('Authorization', "Bearer {$this->token}")
        ->post('/api/profile/avatars', ['file' => $file], ['Accept' => 'application/json']);
});

/**
 * A real two-frame, looping 1×1 GIF.
 */
function animatedGif(): string
{
    $frame = "\x21\xF9\x04\x00\x0A\x00\x00\x00"
        ."\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00"
        ."\x02\x02\x44\x01\x00";

    return 'GIF89a'
        ."\x01\x00\x01\x00\x80\x00\x00"
        ."\x00\x00\x00\xFF\xFF\xFF"
        ."\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00"
        .$frame.$frame
        ."\x3B";
}

test('an animated gif is stored untouched, every frame kept', function () {
    $response = ($this->upload)(UploadedFile::fake()->createWithContent('party.gif', animatedGif()))
        ->assertOk()
        ->assertJsonPath('data.mime_type', 'image/gif')
        ->assertJsonPath('data.extension', 'gif');

    expect(Storage::disk('public')->get($response->json('data.path')))->toBe(animatedGif());
});

test('a short video avatar is accepted, as a gif saved from telegram usually is', function () {
    ($this->upload)(UploadedFile::fake()->create('scared.mp4', 120, 'video/mp4'))
        ->assertOk()
        ->assertJsonPath('data.mime_type', 'video/mp4');
});

test('a video format a browser cannot play is refused', function () {
    ($this->upload)(UploadedFile::fake()->create('clip.mkv', 120, 'video/x-matroska'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');
});
