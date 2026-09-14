<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Modal extends Component
{
    public function __construct(
        public string $id,
        public ?string $title = null,
    ) {}

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.modal');
    }
}
