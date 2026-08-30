<?php

namespace App\Http\Controllers\Web\Blade;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AuthPageController extends Controller
{
    public function index(Request $request, ?string $token = null)
    {
        $path = '/' . trim(
            $request->path(),
            '/'
        );

        /*
        |--------------------------------------------------------------------------
        | Determine initial page
        |--------------------------------------------------------------------------
        */

        $currentPage = match (true) {

            $path === '/register'
                => 'register',

            $path === '/forgot-password'
                => 'forgot-password',

            str_starts_with(
                $path,
                '/reset-password/'
            )
                => 'reset-password',

            $path === '/verify-email'
                => 'verify-email',

            $path === '/confirm-password'
                => 'confirm-password',

            default
                => 'login',
        };


        /*
        |--------------------------------------------------------------------------
        | Render one SPA
        |--------------------------------------------------------------------------
        */

        return view(
            'blade.pages.auth.index',
            [
                'currentPage' => $currentPage,

                'resetToken' => $token,

                'resetEmail' =>
                    $request->query('email'),
            ]
        );
    }
}