import * as THREE from 'three';
import { WORLD } from '../core/constants.js';

/**
 * Mesh factories — pure consumers of game state.
 * Each factory returns a THREE.Object3D that main.js adds to the scene.
 * main.js calls mesh.position.set(x, y, z) each frame from state.
 */

const PADDLE_HEIGHT = WORLD.PADDLE_HEIGHT;
const BALL_RADIUS = WORLD.BALL_RADIUS;
const BRICK_W = WORLD.BRICK_WIDTH;
const BRICK_H = WORLD.BRICK_HEIGHT;

export function createPaddleMesh() {
  const geom = new THREE.BoxGeometry(1, PADDLE_HEIGHT, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0e7490,
    emissiveIntensity: 0.4,
  });
  const mesh = new THREE.Mesh(geom, mat);
  return mesh;
}

export function createBallMesh() {
  const geom = new THREE.SphereGeometry(BALL_RADIUS, 16, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
  });
  return new THREE.Mesh(geom, mat);
}

export function createBrickMeshes(bricks) {
  // InstancedMesh for performance.
  const geom = new THREE.BoxGeometry(BRICK_W, BRICK_H, 0.4);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: false });
  const mesh = new THREE.InstancedMesh(geom, mat, bricks.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const colors = new Float32Array(bricks.length * 3);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    dummy.position.set(b.x, b.y, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    const c = new THREE.Color(b.color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = bricks.length;
  return mesh;
}

export function updateBrickMesh(mesh, bricks) {
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (b.broken) {
      // Hide by zero-scale matrix (instanced)
      dummy.position.set(0, 0, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      continue;
    }
    // ARMORED dim when HP=1
    let scaleY = 1;
    if (b.type === 'armored' && b.hp === 1) scaleY = 0.7;
    dummy.position.set(b.x, b.y, 0);
    dummy.scale.set(1, scaleY, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function createPowerUpMesh(type, color) {
  const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
  return new THREE.Mesh(geom, mat);
}
