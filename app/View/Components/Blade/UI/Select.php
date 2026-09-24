<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Str;
use Illuminate\View\Component;

class Select extends Component
{
    public string $inputId;

    /**
     * A native <select> — the right choice for short, plain lists. Options
     * come from `$options` (value => label) or the slot.
     *
     * @param  array<string|int, string>  $options
     * @param  string|null  $placeholder  An empty first option ("Choose…").
     * @param  string  $size  sm | md | lg
     */
    public function __construct(
        public ?string $label = null,
        public ?string $name = null,
        public array $options = [],
        public string|int|null $selected = null,
        public ?string $error = null,
        public ?string $hint = null,
        public ?string $placeholder = null,
        public bool $required = false,
        public string $size = 'md',
        ?string $id = null,
    ) {
        $this->inputId = $id ?? 'field-'.Str::random(8);
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.select');
    }
}
