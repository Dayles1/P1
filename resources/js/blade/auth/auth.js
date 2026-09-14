/**
 * ==========================================================================
 * AUTH LAYOUT
 * ==========================================================================
 *
 * Общий JavaScript авторизационного layout.
 *
 * Отвечает только за:
 * - тему
 * - переключатель темы
 * - анимацию темы
 *
 * SPA здесь отсутствует.
 * Forms здесь отсутствуют.
 * Axios здесь отсутствует.
 */

/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const root = document.documentElement;

const themeToggle =
    document.getElementById('theme-toggle');

/*
|--------------------------------------------------------------------------
| Theme
|--------------------------------------------------------------------------
*/

let themeAnimation = null;
let themeTransition = null;

/*
|--------------------------------------------------------------------------
| Reduced motion
|--------------------------------------------------------------------------
*/

function prefersReducedMotion() {
    return window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;
}

/*
|--------------------------------------------------------------------------
| Theme animation geometry
|--------------------------------------------------------------------------
*/

function getThemeGeometry() {
    if (!themeToggle) {
        return {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            radius: Math.hypot(
                window.innerWidth,
                window.innerHeight
            ),
        };
    }

    const rect =
        themeToggle.getBoundingClientRect();

    const x =
        rect.left + rect.width / 2;

    const y =
        rect.top + rect.height / 2;

    const radius =
        Math.ceil(
            Math.max(
                Math.hypot(x, y),

                Math.hypot(
                    window.innerWidth - x,
                    y
                ),

                Math.hypot(
                    x,
                    window.innerHeight - y
                ),

                Math.hypot(
                    window.innerWidth - x,
                    window.innerHeight - y
                )
            )
        );

    return {
        x,
        y,
        radius,
    };
}

/*
|--------------------------------------------------------------------------
| Reset animation state
|--------------------------------------------------------------------------
*/

function resetThemeAnimation() {
    themeAnimation = null;
    themeTransition = null;
}

/*
|--------------------------------------------------------------------------
| Toggle theme
|--------------------------------------------------------------------------
*/

function toggleTheme() {
    const isDarkLike =
        root.dataset.theme === 'dark' ||
        root.dataset.theme === 'black';

    const next = isDarkLike ? 'light' : 'dark';

    /*
    |--------------------------------------------------------------------------
    | No View Transition
    |--------------------------------------------------------------------------
    */

    if (
        !document.startViewTransition ||
        prefersReducedMotion()
    ) {
        root.dataset.theme = next;

        localStorage.setItem(
            'theme',
            next
        );

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | If animation is running
    |--------------------------------------------------------------------------
    */

    if (
        themeAnimation &&
        themeTransition
    ) {
        root.dataset.theme = next;

        localStorage.setItem(
            'theme',
            next
        );

        themeAnimation.reverse();

        return;
    }

    /*
    |--------------------------------------------------------------------------
    | Calculate button position before transition
    |--------------------------------------------------------------------------
    */

    const geometry =
        getThemeGeometry();

    /*
    |--------------------------------------------------------------------------
    | Start View Transition
    |--------------------------------------------------------------------------
    */

    themeTransition =
        document.startViewTransition(
            () => {
                root.dataset.theme = next;

                localStorage.setItem(
                    'theme',
                    next
                );
            }
        );

    /*
    |--------------------------------------------------------------------------
    | Reveal new theme
    |--------------------------------------------------------------------------
    */

    themeTransition.ready
        .then(() => {
            themeAnimation =
                root.animate(
                    [
                        {
                            clipPath:
                                `circle(0px at ` +
                                `${geometry.x}px ` +
                                `${geometry.y}px)`,
                        },

                        {
                            clipPath:
                                `circle(` +
                                `${geometry.radius}px at ` +
                                `${geometry.x}px ` +
                                `${geometry.y}px)`,
                        },
                    ],
                    {
                        duration: 560,

                        easing:
                            'cubic-bezier(0.16, 1, 0.3, 1)',

                        fill: 'both',

                        pseudoElement:
                            '::view-transition-new(root)',
                    }
                );

            themeAnimation.onfinish =
                resetThemeAnimation;

            themeAnimation.oncancel =
                resetThemeAnimation;
        })
        .catch(
            resetThemeAnimation
        );
}

/*
|--------------------------------------------------------------------------
| Theme toggle
|--------------------------------------------------------------------------
*/

themeToggle?.addEventListener(
    'click',
    toggleTheme
);