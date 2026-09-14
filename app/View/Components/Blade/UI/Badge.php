<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Badge extends Component
{
    public function __construct(
        public string $variant = 'muted',
    ) {}

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.badge');
    }
}
