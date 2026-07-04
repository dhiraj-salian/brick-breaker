import * as THREE from 'three';

/**
 * Particle pool — InstancedMesh of small cubes for brick-break debris.
 * Pool size: 240 particles. Each particle has its own color, life, velocity.
 *
 * Improvements:
 *   - Pool size bumped 200 → 240 for bigger bursts.
 *   - Each particle has its own color (instanceColor).
 *   - Slight sparkle via alpha/scale curve.
 *   - Lower gravity (4 vs 9.8) — feels less like sand, more like sparks.
 *   - Burst count bumped from 6 → 10 per call.
 */

const POOL_SIZE = 240;
const PARTICLE_LIFE = 0.7; // seconds

export function createParticleSystem() {
  const geom = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
  });
  const mesh = new THREE.InstancedMesh(geom, mat, POOL_SIZE);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const colors = new Float32Array(POOL_SIZE * 3);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  const particles = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    particles.push({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: PARTICLE_LIFE,
      color: new THREE.Color(0xffffff),
    });
  }

  const dummy = new THREE.Object3D();

  function emit(x, y, color, count = 10) {
    let emitted = 0;
    for (let i = 0; i < POOL_SIZE && emitted < count; i++) {
      if (!particles[i].active) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 5;
        particles[i].active = true;
        particles[i].x = x;
        particles[i].y = y;
        particles[i].vx = Math.cos(angle) * speed;
        particles[i].vy = Math.sin(angle) * speed + 2.5;
        particles[i].life = PARTICLE_LIFE * (0.7 + Math.random() * 0.5);
        particles[i].maxLife = particles[i].life;
        particles[i].color.setHex(color);
        emitted++;
      }
    }
  }

  function update(dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = particles[i];
      if (!p.active) {
        dummy.position.set(0, 0, -100);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        dummy.scale.set(0, 0, 0);
        dummy.position.set(0, 0, -100);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      // Light gravity for spark-like feel.
      p.vy -= 4.0 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Air drag.
      p.vx *= 0.985;
      // Sparkle: scale curve from 0 → 1.2 → 0 across life.
      const t = p.life / p.maxLife;
      const scale = t < 0.2 ? t * 5 * 0.8 : (1 - t) * 1.2;
      dummy.position.set(p.x, p.y, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, 0, p.life * 4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Color fade to white-ish as it cools.
      const c = p.color;
      const fade = 0.4 + t * 0.6;
      colors[i * 3] = c.r * fade + (1 - fade);
      colors[i * 3 + 1] = c.g * fade + (1 - fade);
      colors[i * 3 + 2] = c.b * fade + (1 - fade);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  function reset() {
    for (let i = 0; i < POOL_SIZE; i++) {
      particles[i].active = false;
      dummy.position.set(0, 0, -100);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, emit, update, reset };
}
