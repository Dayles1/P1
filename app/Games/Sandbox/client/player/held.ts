/**
 * What the figure holds in its right hand: tools, weapons, a staff, a
 * torch, an artifact. Built along the hand's +Z (forward when the arm
 * hangs), with the grip at the origin.
 */

import * as THREE from 'three';
import { ITEMS } from '../items';
import type { ItemId } from '../items';

const WOOD = new THREE.MeshStandardMaterial({
    color: 0x9c7e5f,
    roughness: 0.85,
});
const STONE = new THREE.MeshStandardMaterial({
    color: 0xa7a6a2,
    roughness: 0.9,
    flatShading: true,
});
const IRON = new THREE.MeshStandardMaterial({
    color: 0xc9d0d6,
    roughness: 0.35,
    metalness: 0.6,
});
const LIGHT_WOOD = new THREE.MeshStandardMaterial({
    color: 0xc7ab86,
    roughness: 0.8,
});
const FLAME = new THREE.MeshBasicMaterial({ color: 0xffc06a });
const DARK_WOOD = new THREE.MeshStandardMaterial({
    color: 0x6f4a2c,
    roughness: 0.85,
});
const CRYSTAL = new THREE.MeshStandardMaterial({
    color: 0x9fd7f2,
    emissive: 0x5fb6e6,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    flatShading: true,
});

function box(
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;

    return mesh;
}

function handle(length: number, material: THREE.Material = WOOD): THREE.Mesh {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.024, length, 6),
        material,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = length / 2 - 0.08;
    mesh.castShadow = true;

    return mesh;
}

export function createHeld(item: ItemId): THREE.Group | null {
    const group = new THREE.Group();
    const iron = item.startsWith('iron_');
    const head = iron ? IRON : STONE;

    switch (item) {
        case 'stone_axe':
        case 'iron_axe':
            group.add(
                handle(0.62),
                box(0.035, 0.2, 0.13, head, 0, -0.07, 0.46),
            );
            break;
        case 'stone_pickaxe':
        case 'iron_pickaxe':
            group.add(handle(0.62), box(0.04, 0.5, 0.05, head, 0, 0, 0.48));
            break;
        case 'wood_sword':
        case 'stone_sword':
        case 'iron_sword': {
            const blade = item === 'wood_sword' ? LIGHT_WOOD : head;
            group.add(
                handle(0.2),
                box(0.18, 0.035, 0.035, WOOD, 0, 0, 0.1),
                box(0.022, 0.07, 0.7, blade, 0, 0, 0.47),
            );
            break;
        }
        case 'shovel':
            group.add(handle(0.7), box(0.16, 0.025, 0.2, STONE, 0, 0, 0.66));
            break;
        case 'dagger':
            group.add(
                handle(0.14, DARK_WOOD),
                box(0.12, 0.03, 0.03, IRON, 0, 0, 0.07),
                box(0.03, 0.018, 0.3, IRON, 0, 0, 0.24),
            );
            break;
        case 'war_hammer':
            group.add(handle(0.72), box(0.12, 0.12, 0.26, IRON, 0, 0.0, 0.6));
            group.children[1].rotation.x = Math.PI / 2;
            break;
        case 'staff': {
            const pole = handle(1.25, DARK_WOOD);
            pole.position.z = 0.35;
            const gem = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.06, 0),
                CRYSTAL,
            );
            gem.position.z = 1.02;
            gem.name = 'flame';
            group.add(pole, gem);
            break;
        }
        case 'torch': {
            const stick = handle(0.5);
            const flame = new THREE.Mesh(
                new THREE.ConeGeometry(0.06, 0.18, 6),
                FLAME,
            );
            flame.position.set(0, 0.06, 0.44);
            flame.name = 'flame';
            group.add(stick, flame);
            group.rotation.x = -0.6;
            break;
        }
        default:
            if (!ITEMS[item].artifact) {
                return null;
            }

            group.add(
                new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.07, 0),
                    new THREE.MeshStandardMaterial({
                        color: 0xf2e2a8,
                        emissive: 0xf2c55a,
                        emissiveIntensity: 0.7,
                        flatShading: true,
                    }),
                ),
            );
            group.position.z = 0.06;
    }

    return group;
}
