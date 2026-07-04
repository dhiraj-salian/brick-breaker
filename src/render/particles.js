import * as THREE from 'three';

/**
 * Particle pool — InstancedMesh of small cubes for brick-break debris.
 * Pool size: 200 particles.
 */

const POOL_SIZE = 200;
const PARTICLE_LIFE = 0.6; // seconds

export function createParticleSystem() {
  const geom = new THREE.BoxGeometry(0.15, 0.15, 0.15);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
  const mesh = new THREE.InstancedMesh(geom, mat, POOL_SIZE);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

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

  function emit(x, y, color, count = 6) {
    let emitted = 0;
    for (let i = 0; i < POOL_SIZE && emitted < count; i++) {
      if (!particles[i].active) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        particles[i].active = true;
        particles[i].x = x;
        particles[i].y = y;
        particles[i].vx = Math.cos(angle) * speed;
        particles[i].vy = Math.sin(angle) * speed + 2;
        particles[i].life = PARTICLE_LIFE;
        particles[i].maxLife = PARTICLE_LIFE;
        particles[i].color.setHex(color);
        emitted++;
      }
    }
  }

  function update(dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = particles[i];
      if (!p.active) {
        dummy.position.set(0, 0, -100); // off-screen
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
      p.vy -= 9.8 * dt; // gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.maxLife;
      const scale = 0.5 + t * 0.5;
      dummy.position.set(p.x, p.y, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { mesh, emit, update };
}
