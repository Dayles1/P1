<?php

namespace App\View\Components\Blade\Navigation;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Breadcrumb extends Component
{
    /**
     * Create a new component instance.
     *
     * @param array<int, array{label: string, url?: string|null}> $items
     */
    public function __construct(
        public array $items = [],
    ) {
        //
    }

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.navigation.breadcrumb');
    }
}
