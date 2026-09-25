<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Str;
use Illuminate\View\Component;

class Checkbox extends Component
{
    public string $inputId;

    /**
     * @param  string|null  $hint  Second line under the label.
     * @param  bool  $indeterminate  Mixed state for a "select all" over a partial selection.
     */
    public function __construct(
        public ?string $name = null,
        public bool $checked = false,
        public ?string $hint = null,
        public bool $indeterminate = false,
        ?string $id = null,
    ) {
        $this->inputId = $id ?? 'checkbox-'.Str::random(8);
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.checkbox');
    }
}
