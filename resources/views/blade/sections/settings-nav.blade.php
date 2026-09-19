{{-- =====================================================
     SETTINGS SECONDARY SIDEBAR
     -----------------------------------------------------
     Real links to real routes, with the active state
     rendered server-side. That is safe here (unlike the
     main sidebar, which is data-turbo-permanent and has to
     recompute it in JS) because <main> is re-rendered from
     the server on every Turbo navigation.

     `data-settings-nav-link` is not used for navigation —
     it lets settings.js map an old `#section` hash onto the
     route that replaced it without duplicating URLs in JS.
     ===================================================== --}}

<nav class="settings-nav" data-settings-nav aria-label="{{ __('ui.settings.title') }}">

    @foreach ($groups as $group)
        <div
            class="settings-nav__group"
            @if ($group['roles'])
                data-requires-role="{{ $group['roles'] }}"
                hidden
            @endif
        >
            <span class="settings-nav__group-label">{{ $group['label'] }}</span>

            @foreach ($group['items'] as $id => [$url, $label])
                <a
                    @class(['settings-nav__link', 'settings-nav__link--active' => $section === $id])
                    href="{{ $url }}"
                    data-settings-nav-link="{{ $id }}"
                    @if ($section === $id) aria-current="page" @endif
                >{{ $label }}</a>
            @endforeach
        </div>
    @endforeach

</nav>
