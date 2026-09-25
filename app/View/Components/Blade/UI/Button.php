<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Button extends Component
{
    /**
     * @param  string  $variant  primary | secondary | outline | ghost | danger
     * @param  string  $size  sm | md | lg
     * @param  string|null  $icon  Sprite icon shown before the label.
     * @param  string|null  $label  Accessible name — required when the button is icon-only (no slot).
     * @param  bool  $loading  Shows a spinner in place of the icon and blocks clicks (aria-busy).
     * @param  bool  $block  Full width.
     */
    public function __construct(
        public string $variant = 'primary',
        public string $size = 'md',
        public ?string $href = null,
        public string $type = 'button',
        public ?string $icon = null,
        public ?string $label = null,
        public bool $loading = false,
        public bool $block = false,
    ) {}

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.button');
    }
}
