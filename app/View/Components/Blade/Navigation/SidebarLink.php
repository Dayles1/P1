<?php

namespace App\View\Components\Blade\Navigation;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class SidebarLink extends Component
{
    public bool $active;

    /**
     * Create a new component instance.
     *
     * @param  string|null  $keys  Keyboard shortcut shown at the end of the row ("G H").
     * @param  string|null  $countKey  Names the unread counter shared/sidebar.js paints on the row.
     */
    public function __construct(
        public string $href,
        public string $icon = '',
        ?bool $active = null,
        public ?string $keys = null,
        public ?string $countKey = null,
    ) {
        $this->active = $active ?? request()->is(ltrim(parse_url($href, PHP_URL_PATH) ?: '/', '/').'*');
    }

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.navigation.sidebar-link');
    }
}
