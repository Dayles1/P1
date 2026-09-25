{{-- =====================================================
     SETTINGS SECONDARY SIDEBAR
     -----------------------------------------------------
     One group's sections — whichever URL space this page
     belongs to — with an icon each, and on the personal side
     a way over to administration for admins. Real links to
     real routes, with the active state rendered server-side.
     That is safe here (unlike the main sidebar, which is
     data-turbo-permanent and has to recompute it in JS)
     because <main> is re-rendered from the server on every
     Turbo navigation.
     ===================================================== --}}

<nav
    class="settings-nav"
    aria-label="{{ $group['title'] }}"
    @if ($group['roles'])
        data-requires-role="{{ $group['roles'] }}"
        hidden
    @endif
>
    <span class="settings-nav__label">{{ $group['title'] }}</span>

    @foreach ($group['items'] as $id => [$url, $label, $icon])
        <a
            @class(['settings-nav__link', 'settings-nav__link--active' => $section === $id])
            href="{{ $url }}"
            @if ($section === $id) aria-current="page" @endif
        >
            <x-blade.u-i.icon :name="$icon" size="16" class="settings-nav__icon" />
            {{ $label }}
        </a>
    @endforeach

    @unless ($group['roles'])
        <div class="settings-nav__admin" data-requires-role="SUPER_ADMIN,ADMIN" hidden>
            <span class="settings-nav__label">{{ __('ui.shell.administration') }}</span>
            <a class="settings-nav__link" href="{{ route('admin.users') }}">
                <x-blade.u-i.icon name="users" size="16" class="settings-nav__icon" />
                {{ __('ui.nav.admin_users') }}
            </a>
            <a class="settings-nav__link" href="{{ route('admin.settings') }}">
                <x-blade.u-i.icon name="server" size="16" class="settings-nav__icon" />
                {{ __('ui.nav.admin_settings') }}
            </a>
        </div>
    @endunless
</nav>
