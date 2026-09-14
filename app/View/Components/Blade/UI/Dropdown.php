<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Dropdown extends Component
{
    public string $id;

    /**
     * Create a new component instance.
     */
    public function __construct(
        public string $align = 'right',
    ) {
        $this->id = 'dropdown-' . uniqid();
    }

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.dropdown');
    }
}
