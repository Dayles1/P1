<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

abstract class Controller
{
    protected function success(
        mixed $data = null,
        string $message = 'Operation successful',
        int $status = 200,
        array $meta = []
    ): JsonResponse {
        return $this->respond(true, $data, $message, $status, $meta);
    }

    protected function error(
        string $message = 'An error occurred',
        int $status = 400,
        mixed $data = null,
        array $meta = []
    ): JsonResponse {
        return $this->respond(false, $data, $message, $status, $meta);
    }

    protected function responsePagination(
        LengthAwarePaginator $paginator,
        mixed $data = null,
        string $message = 'Operation successful',
        int $status = 200
    ): JsonResponse {
        return $this->respond(
            true,
            $data,
            $message,
            $status,
            [
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page'    => $paginator->lastPage(),
                    'per_page'     => $paginator->perPage(),
                    'total'        => $paginator->total(),
                    'from'         => $paginator->firstItem(),
                    'to'           => $paginator->lastItem(),
                    'links'        => [
                        'first' => $paginator->url(1),
                        'last'  => $paginator->url($paginator->lastPage()),
                        'prev'  => $paginator->previousPageUrl(),
                        'next'  => $paginator->nextPageUrl(),
                    ],
                ],
            ]
        );
    }

    protected function respond(
        bool $success,
        mixed $data = null,
        string $message = '',
        int $status = 200,
        array $meta = []
    ): JsonResponse {
        $payload = [
            'success' => $success,
            'message' => $message,
            'data'    => $data,
        ];

        if (!empty($meta)) {
            $payload = array_merge($payload, $meta);
        }

        return response()->json($payload, $status);
    }
}