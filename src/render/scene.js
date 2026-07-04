import * as THREE from 'three';
import { WORLD } from '../core/constants.js';

/**
 * Scene factory — creates renderer, scene, orthographic camera.
 * Handles resize and DPR.
 */

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a14, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(2, 5, 5);
  scene.add(dir);

  // Camera (orthographic, set in resize)
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const frustumHeight = WORLD.HEIGHT;
  const camera = new THREE.OrthographicCamera(
    (-frustumHeight * aspect) / 2,
    (frustumHeight * aspect) / 2,
    frustumHeight / 2,
    -frustumHeight / 2,
    0.1,
    100
  );
  camera.position.z = 10;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    const newAspect = w / h;
    const fh = WORLD.HEIGHT;
    camera.left = (-fh * newAspect) / 2;
    camera.right = (fh * newAspect) / 2;
    camera.top = fh / 2;
    camera.bottom = -fh / 2;
    camera.updateProjectionMatrix();
    return { width: w, height: h, worldWidth: fh * newAspect };
  }

  return { renderer, scene, camera, resize };
}
