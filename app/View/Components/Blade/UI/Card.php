<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Card extends Component
{
    public function __construct(
        public ?string $title = null,
        public ?string $subtitle = null,
        public bool $flush = false,
    ) {}

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.card');
    }
}
