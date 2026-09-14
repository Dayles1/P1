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
                A secure and simple way to manage your account, projects and personal workspace.
            </p>
        </div>


        <nav class="site-footer__links" aria-label="Footer">
            <a href="{{ route('home') }}">Home</a>
            <a href="{{ route('about') }}">About</a>
            <a href="{{ route('contact') }}">Contact</a>
        </nav>

    </div>


    <div class="site-footer__bottom">
        <span>
            © {{ date('Y') }} {{ config('app.name', 'Laravel') }}. All rights reserved.
        </span>
    </div>

</footer>
