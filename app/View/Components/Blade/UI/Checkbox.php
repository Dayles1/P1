<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Str;
use Illuminate\View\Component;

class Checkbox extends Component
{
    public string $inputId;

    public function __construct(
        public ?string $name = null,
        public bool $checked = false,
        ?string $id = null,
    ) {
        $this->inputId = $id ?? 'checkbox-'.Str::random(8);
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.checkbox');
    }
}
