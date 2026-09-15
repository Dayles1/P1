{{-- =====================================================
     SITE FOOTER
     ===================================================== --}}

<footer class="site-footer">

    <div class="site-footer__inner">

        <div class="site-footer__brand">
            <a href="{{ route('home') }}" class="site-logo">
                <span class="site-logo__mark">
                    {{ strtoupper(substr(config('app.name', 'L'), 0, 1)) }}
                </span>

                <span class="site-logo__name">
                    {{ config('app.name', 'Laravel') }}
                </span>
            </a>

            <p class="site-footer__tagline">
                {{ __('ui.footer.tagline') }}
            </p>
        </div>


        <nav class="site-footer__links" aria-label="Footer">
            <a href="{{ route('home') }}">{{ __('ui.nav.home') }}</a>
            <a href="{{ route('about') }}">{{ __('ui.nav.about') }}</a>
            <a href="{{ route('contact') }}">{{ __('ui.nav.contact') }}</a>
        </nav>

    </div>


    <div class="site-footer__bottom">
        <span>
            © {{ date('Y') }} {{ config('app.name', 'Laravel') }}. {{ __('ui.footer.rights_reserved') }}
        </span>
    </div>

</footer>
