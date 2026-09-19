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
 *
 * Each URL space is its own mini-app: the page only ever shows the nav
 * of the group you are in. Crossing between them is the main sidebar's
 * job ("Settings" / "App settings"), not a second list of links that is
 * irrelevant to whatever you came here to change.
 */
class SettingsPageController extends Controller
{
    public const PERSONAL_GROUP = 'personal';

    public const APPLICATION_GROUP = 'application';

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
     * `/settings` — the personal section index.
     *
     * On a phone the settings nav is a full-width menu and this is the
     * list half of a list/detail pair; on a desktop the nav is always
     * visible next to the panel, so the JS fills the panel with the
     * group's first section.
     */
    public function index(): View
    {
        return $this->page(self::PERSONAL_GROUP, null);
    }

    public function personal(string $section): View
    {
        return $this->page(self::PERSONAL_GROUP, self::PERSONAL[$section]);
    }

    /**
     * `/admin/settings` — the same index, for the other group. It is a
     * page rather than a redirect to the first section so that the phone
     * list view (and the "back" link out of a section) has somewhere of
     * its own to land.
     */
    public function applicationIndex(): View
    {
        return $this->page(self::APPLICATION_GROUP, null);
    }

    public function application(string $section): View
    {
        return $this->page(self::APPLICATION_GROUP, self::APPLICATION[$section]);
    }

    private function page(string $group, ?string $section): View
    {
        return view('blade.pages.settings', [
            'group' => $group,
            'section' => $section,
        ]);
    }
}
