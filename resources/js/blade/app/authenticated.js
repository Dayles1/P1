import '../shared/turbo-boot';
import '../shared/layout-controller';
import { bootstrapAppState } from '../shared/app-state';
import { initSiteChrome } from '../shared/site-chrome';

/*
|--------------------------------------------------------------------------
| Route guard
|--------------------------------------------------------------------------
|
| Every page using this layout requires a valid Sanctum token. This is
| the ONLY place bootstrapAppState() is awaited for the route-guard
| decision — because this module's URL never changes across a Turbo
| Drive session, this whole block runs exactly once per real page load
| (first visit, F5, or direct URL) and never again for the rest of the
| session, no matter how many soft-navigations follow.
|
*/

bootstrapAppState().then((user) => {
    if (!user) {
        const redirect = encodeURIComponent(
            window.location.pathname + window.location.search,
        );

        window.location.href = `/login?redirect=${redirect}`;

        return;
    }

    initSiteChrome(user);
});
