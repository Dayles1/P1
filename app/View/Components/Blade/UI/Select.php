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
     * @param  array<string|int, string>  $options  value => label
     */
    public function __construct(
        public ?string $label = null,
        public ?string $name = null,
        public array $options = [],
        public string|int|null $selected = null,
        public ?string $error = null,
        ?string $id = null,
    ) {
        $this->inputId = $id ?? 'select-'.Str::random(8);
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.select');
    }
}
