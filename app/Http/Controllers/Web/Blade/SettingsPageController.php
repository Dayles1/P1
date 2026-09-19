<?php

namespace App\Http\Controllers\Web\Blade;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;

/**
 * Settings used to be one page that swapped sections client-side via a
 * `#personal-appearance`-style hash. Every section is a real route now —
 * its own URL, its own history entry, its own shareable link — so the
 * secondary sidebar is plain `<a href>` links instead of buttons that
 * poke at `window.location.hash`.
 *
 * The two groups are deliberately split across two URL spaces, because
 * they are two different things: `/settings/*` is what a user changes
 * about themselves, `/admin/settings/*` is instance-wide configuration
 * that only an administrator sees (and that the API enforces server-side
 * via `role:SUPER_ADMIN,ADMIN` — see routes/api.php).
 */
class SettingsPageController extends Controller
{
    /**
     * Personal sections, in sidebar order.
     *
     * Key = URL segment under `/settings`, value = the section id the
     * page's JS renders into the panel.
     *
     * @var array<string, string>
     */
    public const PERSONAL = [
        'profile' => 'personal-profile',
        'appearance' => 'personal-appearance',
        'language' => 'personal-language',
        'notifications' => 'personal-notifications',
        'security' => 'personal-security',
        'developer' => 'personal-developer',
    ];

    /**
     * Application sections, in sidebar order.
     *
     * Key = URL segment under `/admin/settings`, value = the section id
     * the page's JS renders into the panel.
     *
     * @var array<string, string>
     */
    public const APPLICATION = [
        'general' => 'application-general',
        'authentication' => 'application-authentication',
        'localization' => 'application-localization',
        'notifications' => 'application-notifications',
        'security' => 'application-security',
        'system' => 'application-system',
    ];

    /**
     * `/settings` itself — the section index.
     *
     * On a phone the settings nav is a full-width menu and this is the
     * list half of a list/detail pair; on a desktop the nav is always
     * visible next to the panel, so the JS simply fills the panel with
     * the first personal section.
     */
    public function index(): View
    {
        return $this->page(null);
    }

    public function personal(string $section): View
    {
        return $this->page(self::PERSONAL[$section]);
    }

    public function application(string $section): View
    {
        return $this->page(self::APPLICATION[$section]);
    }

    private function page(?string $section): View
    {
        return view('blade.pages.settings', ['section' => $section]);
    }
}
