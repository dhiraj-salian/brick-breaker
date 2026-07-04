/**
 * Camera controller — applies shake offset to camera position.
 * Pure function over state.
 */

export function applyCameraShake(camera, shake) {
  if (!shake || shake.intensity < 0.001) {
    camera.position.x = 0;
    camera.position.y = 0;
    return;
  }
  const t = performance.now() / 1000;
  camera.position.x = Math.sin(t * 60) * shake.intensity * 0.3;
  camera.position.y = Math.cos(t * 53) * shake.intensity * 0.3;
}
