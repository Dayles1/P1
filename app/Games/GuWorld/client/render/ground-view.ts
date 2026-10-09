/**
 * The picture of a location's ground: one mesh over its bounds, its
 * heights from the location's ground, with a faint metre grid (a bolder
 * line every ten) so distances and slopes can be judged. Fine for a small
 * location; large ones will be drawn in chunks (stage 3).
 */

import * as THREE from 'three';
import type { Location } from '../world/locations';

/** Squares per metre. */
const DETAIL = 1;

function gridTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;

    context.fillStyle = '#d6d6d0';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#b6b6ae';

    for (let line = 0; line < 10; line++) {
        const at = (line * size) / 10;
        context.fillRect(at, 0, 1, size);
        context.fillRect(0, at, size, 1);
    }

    context.fillStyle = '#8e8e86';
    context.fillRect(0, 0, 3, size);
    context.fillRect(0, 0, size, 3);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;

    return texture;
}

export function groundMesh(location: Location): THREE.Mesh {
    const { bounds, ground } = location;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const geometry = new THREE.PlaneGeometry(
        width,
        depth,
        Math.ceil(width * DETAIL),
        Math.ceil(depth * DETAIL),
    );

    geometry.rotateX(-Math.PI / 2);
    geometry.translate(
        (bounds.minX + bounds.maxX) / 2,
        0,
        (bounds.minZ + bounds.maxZ) / 2,
    );

    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        position.setY(i, ground.heightAt(x, z));
        // The texture covers ten metres.
        uv.setXY(i, x / 10, z / 10);
    }

    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
            color: 0x8c9478,
            map: gridTexture(),
            roughness: 0.95,
        }),
    );
    mesh.receiveShadow = true;

    return mesh;
}
