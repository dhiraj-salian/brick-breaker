import * as THREE from 'three';
import { WORLD } from '../core/constants.js';
import { REQUIRED_WORLD_WIDTH } from '../core/game-state.js';

/**
 * Scene factory — creates renderer, scene, orthographic camera.
 * Handles resize, DPR, and mobile GPU preferences safely.
 *
 * Mobile quirks addressed:
 *   - devicePixelRatio is clamped to [1, 2] and sanitized (Infinity/NaN → 1).
 *     Headless or buggy browsers can report Infinity, which would make
 *     setSize() blow up to absurd pixel buffer dimensions.
 *   - canvas.clientWidth/Height can be 0 right after page load; we fall back
 *     to window.innerWidth/Height with DPR-adjusted units so the first frame
 *     renders even before CSS layout settles.
 *   - powerPreference: 'high-performance' hints mobile GPUs to pick the
 *     discrete/perf path over battery-saving.
 */

function safePixelRatio() {
  const dpr = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  return Math.min(Math.max(1, dpr), 2);
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
  });
  renderer.setPixelRatio(safePixelRatio());
  renderer.setClearColor(0x0a0a14, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);
  scene.fog = new THREE.Fog(0x0a0a14, 18, 35);

  // Lights — 3-point setup for better depth on flat 2D-ish scene.
  const ambient = new THREE.AmbientLight(0xa0b4ff, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(3, 6, 8);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x4ade80, 0.25);
  fillLight.position.set(-5, 2, 4);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xf472b6, 0.3);
  rimLight.position.set(0, -3, -5);
  scene.add(rimLight);

  // Subtle moving point light over the play area for life.
  const playLight = new THREE.PointLight(0xffffff, 0.6, 25, 2);
  playLight.position.set(0, 2, 6);
  scene.add(playLight);

  // Camera (orthographic, set in resize).
  const frustumHeight = WORLD.HEIGHT;
  const camera = new THREE.OrthographicCamera(
    (-frustumHeight * (16 / 9)) / 2,
    (frustumHeight * (16 / 9)) / 2,
    frustumHeight / 2,
    -frustumHeight / 2,
    0.1,
    100
  );
  camera.position.z = 10;

  function resize() {
    // Fall back to window dimensions if canvas client size is not yet known.
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    // Guard against pathological 0 dimensions.
    const safeW = Math.max(1, w);
    const safeH = Math.max(1, h);
    renderer.setSize(safeW, safeH, false);
    const aspect = safeW / safeH;

    // Choose the larger of the two candidate frustum heights so the brick
    // grid + paddle always fits with a margin, regardless of orientation:
    //   - width-driven: fit the brick grid horizontally
    //     (BRICK_COLS * (BRICK_WIDTH + BRICK_GAP) + 2 * HORIZONTAL_MARGIN)
    //   - height-driven: keep WORLD.HEIGHT as the vertical span
    // The frustum height (Y axis) is the max; world width derives from it.
    const requiredWorldWidth = REQUIRED_WORLD_WIDTH;
    const fhByWidth = requiredWorldWidth / aspect; // Y span needed if world width = required
    const fh = Math.max(WORLD.HEIGHT, fhByWidth);

    camera.left = (-fh * aspect) / 2;
    camera.right = (fh * aspect) / 2;
    camera.top = fh / 2;
    camera.bottom = -fh / 2;
    camera.updateProjectionMatrix();
    return { width: safeW, height: safeH, worldWidth: fh * aspect, frustumHeight: fh };
  }

  return {
    renderer,
    scene,
    camera,
    resize,
    playLight,
    setPlaying(active) {
      playLight.intensity = active ? 0.9 : 0.4;
    },
  };
}
