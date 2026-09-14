<?php

namespace App\View\Components\Blade\Navigation;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class NavLink extends Component
{
    public bool $active;

    /**
     * Create a new component instance.
     */
    public function __construct(
        public string $href,
        ?bool $active = null,
    ) {
        $this->active = $active ?? request()->is(ltrim(parse_url($href, PHP_URL_PATH) ?: '/', '/') ?: '/');
    }

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.navigation.nav-link');
    }
}
