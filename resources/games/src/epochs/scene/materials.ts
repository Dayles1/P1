/**
 * The shared materials of the scene. Every building, chunk and instance
 * uses these few materials (with vertex colours), so the GPU switches
 * state rarely. A handful of shader patches add what the stock materials
 * lack: snow on upward faces, lit windows at night and waving flags — all
 * driven by uniforms shared between the materials.
 */

import * as THREE from 'three';

export type Bucket =
    'matte' | 'metal' | 'glass' | 'glow' | 'windows' | 'foliage' | 'flag';

export const BUCKETS: Bucket[] = [
    'matte',
    'metal',
    'glass',
    'glow',
    'windows',
    'foliage',
    'flag',
];

/** Uniforms shared by every patched material of one material set. */
export interface SharedUniforms {
    uTime: THREE.IUniform<number>;
    /** 0..1 snow cover on upward faces. */
    uSnow: THREE.IUniform<number>;
    /** Share (0..1) of windows lit right now. */
    uLit: THREE.IUniform<number>;
}

export interface MaterialSet {
    uniforms: SharedUniforms;
    buckets: Record<Bucket, THREE.Material>;
    /** Leafy crowns: vertex colour × this material's colour (season tint). */
    foliage: THREE.MeshStandardMaterial;
    glow: THREE.MeshBasicMaterial;
    /** Semi-transparent tinted look for the building ghost. */
    ghost: THREE.MeshStandardMaterial;
    /** Inverted hull for the selection outline. */
    outline: THREE.MeshBasicMaterial;
    setXray(on: boolean): void;
    dispose(): void;
}

const SNOW_VERTEX_HEAD = /* glsl */ `
varying float vSnowUp;
`;

const SNOW_VERTEX_BODY = /* glsl */ `
{
    #ifdef USE_INSTANCING
        vec3 snowNormal = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
    #else
        vec3 snowNormal = mat3(modelMatrix) * objectNormal;
    #endif
    vSnowUp = normalize(snowNormal).y;
}
`;

const SNOW_FRAGMENT_HEAD = /* glsl */ `
uniform float uSnow;
varying float vSnowUp;
`;

const SNOW_FRAGMENT_BODY = /* glsl */ `
diffuseColor.rgb = mix(
    diffuseColor.rgb,
    vec3(0.9, 0.93, 0.97),
    uSnow * smoothstep(0.45, 0.8, vSnowUp)
);
`;

/** Adds snow on upward faces to a stock material. */
export function patchSnow(
    material: THREE.Material,
    uniforms: SharedUniforms,
    extra?: (shader: THREE.WebGLProgramParametersWithUniforms) => void,
    key = '',
): void {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uSnow = uniforms.uSnow;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\n${SNOW_VERTEX_HEAD}`,
            )
            .replace(
                '#include <beginnormal_vertex>',
                `#include <beginnormal_vertex>\n${SNOW_VERTEX_BODY}`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>\n${SNOW_FRAGMENT_HEAD}`,
            )
            .replace(
                '#include <color_fragment>',
                `#include <color_fragment>\n${SNOW_FRAGMENT_BODY}`,
            );
        extra?.(shader);
    };
    material.customProgramCacheKey = () => `snow${key}`;
}

function patchWindows(
    material: THREE.Material,
    uniforms: SharedUniforms,
): void {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uLit = uniforms.uLit;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                '#include <common>\nattribute vec4 aLit;\nvarying vec4 vLit;',
            )
            .replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nvLit = aLit;',
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                '#include <common>\nuniform float uLit;\nvarying vec4 vLit;',
            )
            .replace(
                '#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\nfloat litOn = step(vLit.a, uLit);\ntotalEmissiveRadiance += vLit.rgb * litOn * 1.8;\ndiffuseColor.rgb *= 1.0 - litOn * 0.5;',
            );
    };
    material.customProgramCacheKey = () => 'windows';
}

function patchFlag(material: THREE.Material, uniforms: SharedUniforms): void {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                '#include <common>\nattribute float aWave;\nuniform float uTime;',
            )
            .replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\ntransformed.z += sin(uTime * 6.0 + aWave * 5.0 + position.x * 9.0 + position.z * 7.0) * 0.03 * aWave;\ntransformed.y -= aWave * aWave * 0.012;',
            );
    };
    material.customProgramCacheKey = () => 'flag';
}

/** Creates one set of materials (one per WebGL renderer). */
export function createMaterials(): MaterialSet {
    const uniforms: SharedUniforms = {
        uTime: { value: 0 },
        uSnow: { value: 0 },
        uLit: { value: 0 },
    };

    const matte = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
        metalness: 0,
    });
    patchSnow(matte, uniforms, undefined, 'matte');

    const metal = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.32,
        metalness: 0.75,
    });
    patchSnow(metal, uniforms, undefined, 'metal');

    const glass = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.08,
        metalness: 0.35,
        transparent: true,
        opacity: 0.8,
    });

    const glow = new THREE.MeshBasicMaterial({
        vertexColors: true,
        toneMapped: false,
    });

    const windows = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.25,
        metalness: 0.25,
        emissive: 0x000000,
    });
    patchWindows(windows, uniforms);

    const foliage = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0,
        color: 0x4f9a4a,
    });
    patchSnow(foliage, uniforms, undefined, 'foliage');

    const flag = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        side: THREE.DoubleSide,
    });
    patchFlag(flag, uniforms);

    const ghost = new THREE.MeshStandardMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        roughness: 0.7,
        emissive: 0x30ff60,
        emissiveIntensity: 0.25,
    });

    const outline = new THREE.MeshBasicMaterial({
        color: 0xffd34d,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
    });

    const buckets: Record<Bucket, THREE.Material> = {
        matte,
        metal,
        glass,
        glow,
        windows,
        foliage,
        flag,
    };
    const opaque: THREE.Material[] = [
        matte,
        metal,
        glow,
        windows,
        foliage,
        flag,
    ];
    let xray = false;

    return {
        uniforms,
        buckets,
        foliage,
        glow,
        ghost,
        outline,
        setXray(on: boolean): void {
            if (on === xray) {
                return;
            }

            xray = on;

            for (const material of opaque) {
                material.transparent = on;
                material.opacity = on ? 0.35 : 1;
                material.depthWrite = !on;
                material.needsUpdate = true;
            }

            glass.opacity = on ? 0.25 : 0.8;
            glass.needsUpdate = true;
        },
        dispose(): void {
            for (const material of [
                ...Object.values(buckets),
                ghost,
                outline,
            ]) {
                material.dispose();
            }
        },
    };
}
