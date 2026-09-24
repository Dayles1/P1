<?php

namespace App\View\Components\Blade\UI;

use Closure;
use Illuminate\Contracts\View\View;
use Illuminate\View\Component;

class Avatar extends Component
{
    /**
     * The --hue-* token pairs initials can take, in the same order as
     * avatarHue() in resources/js/blade/shared/auth-state.js — both sides
     * must pick the same color for the same name.
     *
     * @var list<string>
     */
    public const HUES = ['blue', 'sky', 'violet', 'green', 'amber', 'rose', 'teal', 'orange'];

    public string $initials;

    public string $hue;

    /**
     * @param  string  $size  xs | sm | md | lg | xl
     * @param  string|null  $status  online | away | busy | offline — adds a presence dot
     */
    public function __construct(
        public string $name = '',
        public ?string $src = null,
        public string $size = 'md',
        public ?string $status = null,
    ) {
        $this->initials = self::initialsFor($name);
        $this->hue = self::hueFor($name);
    }

    /**
     * First letter of the first two words — multibyte-safe, so Cyrillic
     * names get real letters rather than half a byte sequence.
     */
    public static function initialsFor(string $name): string
    {
        $words = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $initials = mb_substr($words[0] ?? '', 0, 1).mb_substr($words[1] ?? '', 0, 1);

        return $initials === '' ? '?' : mb_strtoupper($initials);
    }

    /**
     * A stable hue per name: the sum of its code points picks one pair.
     */
    public static function hueFor(string $name): string
    {
        $sum = array_sum(array_map('mb_ord', mb_str_split($name) ?: []));

        return self::HUES[$sum % count(self::HUES)];
    }

    public function render(): View|Closure|string
    {
        return view('components.blade.u-i.avatar');
    }
}
