<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Str;
use Illuminate\View\Component;

class Input extends Component
{
    public string $inputId;

    /**
     * A plain `.field-input` unless something has to sit inside the box
     * with it (icon, prefix/suffix, an action, a status), then a
     * `.field-box` wrapping a bare input.
     *
     * @param  string|null  $icon  Leading sprite icon (search, lock, calendar…).
     * @param  string|null  $prefix  Fixed text before the value ("https://").
     * @param  string|null  $suffix  Unit after the value ("per minute").
     * @param  bool  $clearable  Adds a clear (×) button.
     * @param  bool  $copyable  Adds a copy button (for read-only ids, keys).
     * @param  bool  $success  Marks the value as checked and fine.
     * @param  bool  $loading  Shows a spinner at the end (async validation).
     * @param  string  $size  sm | md | lg
     */
    public function __construct(
        public ?string $label = null,
        public string $type = 'text',
        public ?string $name = null,
        public ?string $hint = null,
        public ?string $error = null,
        public bool $required = false,
        public ?string $icon = null,
        public ?string $prefix = null,
        public ?string $suffix = null,
        public bool $clearable = false,
        public bool $copyable = false,
        public bool $success = false,
        public bool $loading = false,
        public string $size = 'md',
        ?string $id = null,
    ) {
        $this->inputId = $id ?? 'field-'.Str::random(8);
    }

    public function boxed(): bool
    {
        return $this->icon || $this->prefix || $this->suffix
            || $this->clearable || $this->copyable || $this->success || $this->loading;
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.input');
    }
}
