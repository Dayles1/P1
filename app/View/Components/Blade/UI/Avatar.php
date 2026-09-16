<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Avatar extends Component
{
    public string $initials;

    /**
     * Create a new component instance.
     */
    public function __construct(
        public string $name = '',
        public ?string $src = null,
        public string $size = 'md',
    ) {
        $words = preg_split('/\s+/', trim($name)) ?: [];

        $this->initials = strtoupper(
            substr($words[0] ?? '', 0, 1).substr($words[1] ?? '', 0, 1)
        ) ?: '?';
    }

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.avatar');
    }
}
