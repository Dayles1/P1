import { initSiteChrome } from '../shared/site-chrome';

/*
|--------------------------------------------------------------------------
| Route guard
|--------------------------------------------------------------------------
|
| Every page using this layout requires a valid Sanctum token. If
| initSiteChrome()'s own /api/auth/me call comes back empty, bounce to
| login with a redirect-back target instead of rendering a broken page.
|
*/

initSiteChrome().then((user) => {
    if (!user) {
        const redirect = encodeURIComponent(
            window.location.pathname + window.location.search,
        );

        window.location.href = `/login?redirect=${redirect}`;
    }
});
