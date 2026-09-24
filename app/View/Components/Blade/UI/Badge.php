<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Badge extends Component
{
    public const VARIANTS = ['neutral', 'primary', 'success', 'warning', 'danger', 'info', 'count'];

    /**
     * @param  string  $variant  neutral | primary | success | warning | danger | info | count
     *                           ("muted" is kept as an alias of neutral).
     */
    public function __construct(
        public string $variant = 'neutral',
    ) {
        if ($this->variant === 'muted' || ! in_array($this->variant, self::VARIANTS, true)) {
            $this->variant = 'neutral';
        }
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.badge');
    }
}
