{{-- =====================================================
     SETTINGS SECONDARY SIDEBAR
     -----------------------------------------------------
     One group's sections — whichever URL space this page
     belongs to. Real links to real routes, with the active
     state rendered server-side. That is safe here (unlike
     the main sidebar, which is data-turbo-permanent and has
     to recompute it in JS) because <main> is re-rendered
     from the server on every Turbo navigation.
     ===================================================== --}}

<nav
    class="settings-nav"
    aria-label="{{ $group['title'] }}"
    @if ($group['roles'])
        data-requires-role="{{ $group['roles'] }}"
        hidden
    @endif
>

    @foreach ($group['items'] as $id => [$url, $label])
        <a
            @class(['settings-nav__link', 'settings-nav__link--active' => $section === $id])
            href="{{ $url }}"
            @if ($section === $id) aria-current="page" @endif
        >{{ $label }}</a>
    @endforeach

</nav>
