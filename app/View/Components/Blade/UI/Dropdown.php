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
     *
     * @param  string|null  $triggerClass  Classes for the trigger <button> itself, so it can be the
     *                                     visible control (icon button, avatar pill) rather than a
     *                                     bare wrapper around one.
     * @param  string|null  $label  Accessible name for an icon-only trigger.
     * @param  string|null  $menuClass  Extra classes for the menu panel (width/padding variants).
     * @param  string  $menuRole  ARIA role of the panel: "menu" for a list of actions, "dialog"
     *                            for a panel with its own heading and controls (notifications).
     */
    public function __construct(
        public string $align = 'right',
        public ?string $triggerClass = null,
        public ?string $label = null,
        public ?string $menuClass = null,
        public string $menuRole = 'menu',
    ) {
        $this->id = 'dropdown-'.uniqid();
    }

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.dropdown');
    }
}
