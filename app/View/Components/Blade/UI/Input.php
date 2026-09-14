<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Str;
use Illuminate\View\Component;

class Input extends Component
{
    public string $inputId;

    public function __construct(
        public ?string $label = null,
        public string $type = 'text',
        public ?string $name = null,
        public ?string $hint = null,
        public ?string $error = null,
        ?string $id = null,
    ) {
        $this->inputId = $id ?? 'field-'.Str::random(8);
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.input');
    }
}
