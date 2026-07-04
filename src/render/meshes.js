import * as THREE from 'three';
import { WORLD } from '../core/constants.js';

/**
 * Mesh factories — pure consumers of game state.
 * Each factory returns a THREE.Object3D that main.js adds to the scene.
 * main.js calls mesh.position.set(x, y, z) each frame from state.
 *
 * Visuals:
 *   - Paddle: rounded look via slight emissive + cyan glow
 *   - Ball: white emissive sphere with a halo sprite
 *   - Bricks: instance-coloured, with HP-driven emissive intensity
 *   - Power-ups: rotating cube with strong emissive
 */

const PADDLE_HEIGHT = WORLD.PADDLE_HEIGHT;
const BALL_RADIUS = WORLD.BALL_RADIUS;
const BRICK_W = WORLD.BRICK_WIDTH;
const BRICK_H = WORLD.BRICK_HEIGHT;

/** Returns a shared circular halo texture for sprites. */
let haloTex = null;
function getHaloTexture() {
  if (haloTex) return haloTex;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  haloTex = new THREE.CanvasTexture(c);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

export function createPaddleMesh() {
  const geom = new THREE.BoxGeometry(1, PADDLE_HEIGHT, 0.5);
  // Slight bevel via a slim emissive trim (visual approximation).
  const mat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geom, mat);

  // Soft glow halo behind paddle.
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(2.0, PADDLE_HEIGHT * 3, 1);
  mesh.add(halo);
  return mesh;
}

export function createBallMesh() {
  const group = new THREE.Group();

  const geom = new THREE.SphereGeometry(BALL_RADIUS, 20, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.0,
  });
  const core = new THREE.Mesh(geom, mat);
  group.add(core);

  // Halo sprite for glow effect.
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(BALL_RADIUS * 5, BALL_RADIUS * 5, 1);
  group.add(halo);

  // Tag the group so callers can read its inner mesh.
  group.userData.core = core;
  group.userData.halo = halo;
  return group;
}

export function createBrickMeshes(bricks) {
  // Slightly inset + bevelled look via BoxGeometry.
  const geom = new THREE.BoxGeometry(BRICK_W, BRICK_H, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // base white — per-instance colors multiply this
    roughness: 0.4,
    metalness: 0.15,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.InstancedMesh(geom, mat, bricks.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const colors = new Float32Array(bricks.length * 3);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    dummy.position.set(b.x, b.y, 0);
    dummy.scale.set(1, 1, 1);
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

  // Add a shared glow sprite behind all bricks for ambient warmth.
  // (Single sprite, scaled to play area, behind brick layer in render order.)
  return mesh;
}

export function updateBrickMesh(mesh, bricks) {
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (b.broken) {
      dummy.position.set(0, 0, -100);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      continue;
    }
    // ARMORED bricks pulse slightly when at full HP.
    let scaleY = 1;
    if (b.type === 'armored' && b.hp >= 2) {
      const t = performance.now() / 1000;
      scaleY = 1 + Math.sin(t * 4 + i) * 0.04;
    } else if (b.type === 'armored' && b.hp === 1) {
      scaleY = 0.75;
    }
    dummy.position.set(b.x, b.y, 0);
    dummy.scale.set(1, scaleY, 1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

export function createPowerUpMesh(type, color) {
  const group = new THREE.Group();

  const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.2,
  });
  const core = new THREE.Mesh(geom, mat);
  group.add(core);

  // Halo for power-up.
  const haloMat = new THREE.SpriteMaterial({
    map: getHaloTexture(),
    color,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(1.4, 1.4, 1);
  group.add(halo);

  // Rotate per frame in main.js for visual life.
  group.userData.core = core;
  group.userData.halo = halo;
  return group;
}

/**
 * Background grid plane — adds depth to an otherwise flat orthographic scene.
 * Returns a Mesh to add behind everything else (z = -5).
 */
export function createBackgroundGrid(worldWidth, worldHeight) {
  const geom = new THREE.PlaneGeometry(worldWidth, worldHeight);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x0a0a14,
    transparent: true,
    opacity: 0.0, // invisible — just for depth layer
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.z = -5;
  return mesh;
}
