/**
 * Repaints the body's textures in the browser, once per look: richer
 * colour for the skin, the iris of the eye texture in the chosen colour
 * (the pupil and the glint kept), and the skin under the hair and the
 * brows in the hair's colour. The models' own textures stay as they
 * are; every repaint is a new texture, cached.
 */

import * as THREE from 'three';

/** The iris on the eye texture: centred, this far out (share of the width). */
const IRIS = 0.125;
/** Blends the recoloured iris out over this much (share of the width). */
const IRIS_EDGE = 0.02;

const painted = new WeakMap<THREE.Texture, Map<string, THREE.Texture>>();

/** The texture's pixels to change and put back as a new texture, cached by key. */
function repaint(
    source: THREE.Texture,
    key: string,
    paint: (pixels: Uint8ClampedArray, width: number, height: number) => void,
): THREE.Texture {
    let cache = painted.get(source);

    if (!cache) {
        cache = new Map();
        painted.set(source, cache);
    }

    const done = cache.get(key);

    if (done) {
        return done;
    }

    const image = source.image as CanvasImageSource & {
        width: number;
        height: number;
    };
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context || !image.width) {
        return source;
    }

    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    paint(data.data, canvas.width, canvas.height);
    context.putImageData(data, 0, 0);

    const texture = source.clone();
    texture.source = new THREE.Source(canvas);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    cache.set(key, texture);

    return texture;
}

/** Richer colour: saturation times `amount`, a touch more contrast. */
export function saturate(source: THREE.Texture, amount: number): THREE.Texture {
    return repaint(source, `saturate:${amount}`, (pixels) => {
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const grey = 0.299 * r + 0.587 * g + 0.114 * b;

            pixels[i] = grey + (r - grey) * amount;
            pixels[i + 1] = grey + (g - grey) * amount;
            pixels[i + 2] = grey + (b - grey) * amount;
        }
    });
}

/** How far down the alpha goes where the skin is fully the hair's (see hairline). */
const HAIRLINE_MARK = 100;

/**
 * The skin under the hair and the brows in the hair's colour, their light
 * and shade kept: the texture marks them in its alpha (255 untouched, down
 * by HAIRLINE_MARK for fully), which is put back to opaque.
 */
export function hairline(source: THREE.Texture, color: number): THREE.Texture {
    const hair = new THREE.Color(color);
    const shade = new THREE.Color();

    return repaint(source, `hairline:${color}`, (pixels) => {
        for (let i = 0; i < pixels.length; i += 4) {
            const share = Math.min(1, (255 - pixels[i + 3]) / HAIRLINE_MARK);

            pixels[i + 3] = 255;

            if (share <= 0) {
                continue;
            }

            const light =
                (0.299 * pixels[i] +
                    0.587 * pixels[i + 1] +
                    0.114 * pixels[i + 2]) /
                255;

            // As the hair cards draw it: the colour times a grey that
            // varies with the strands.
            shade
                .copy(hair)
                .multiplyScalar(0.45 + 0.55 * light)
                .convertLinearToSRGB();
            pixels[i] += (shade.r * 255 - pixels[i]) * share;
            pixels[i + 1] += (shade.g * 255 - pixels[i + 1]) * share;
            pixels[i + 2] += (shade.b * 255 - pixels[i + 2]) * share;
        }
    });
}

/** The eye texture with its iris in a colour; the pupil and the glint stay. */
export function irisColor(source: THREE.Texture, color: number): THREE.Texture {
    const tint = new THREE.Color(color);
    const [tr, tg, tb] = [tint.r * 255, tint.g * 255, tint.b * 255];

    return repaint(source, `iris:${color}`, (pixels, width, height) => {
        const size = Math.min(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const distance =
                    Math.hypot(x - width / 2, y - height / 2) / size;
                const share =
                    1 -
                    THREE.MathUtils.smoothstep(
                        distance,
                        IRIS - IRIS_EDGE,
                        IRIS,
                    );

                if (share <= 0) {
                    continue;
                }

                const i = (y * width + x) * 4;
                const light =
                    (0.299 * pixels[i] +
                        0.587 * pixels[i + 1] +
                        0.114 * pixels[i + 2]) /
                    255;
                // The iris is mid-dark: the pupil (dark) and the glint
                // (bright) keep their own colour.
                const iris =
                    share *
                    THREE.MathUtils.smoothstep(light, 0.06, 0.16) *
                    (1 - THREE.MathUtils.smoothstep(light, 0.7, 0.85));
                const shade = Math.min(1.6, light / 0.35);

                pixels[i] += (tr * shade - pixels[i]) * iris;
                pixels[i + 1] += (tg * shade - pixels[i + 1]) * iris;
                pixels[i + 2] += (tb * shade - pixels[i + 2]) * iris;
            }
        }
    });
}
