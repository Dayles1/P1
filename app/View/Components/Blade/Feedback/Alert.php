<?php

namespace App\View\Components\Blade\Feedback;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Alert extends Component
{
    /**
     * @param  string  $type  success | error | warning | info
     * @param  string|null  $title  Bold first line; the slot becomes the secondary text.
     */
    public function __construct(
        public string $type = 'info',
        public bool $dismissible = true,
        public ?string $title = null,
    ) {}

    /**
     * Get the view / contents that represent the component.
     */
    public function render(): View|Closure|string
    {
        return view('components.blade.feedback.alert');
    }
}
