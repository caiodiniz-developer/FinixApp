import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Small WebGL centerpiece for the dashboard hero: a wireframe icosahedron
 * with a soft inner core and a drifting particle halo, colored by the
 * financial health score and gently rotating. Fails silently (renders
 * nothing) if WebGL isn't available, and respects prefers-reduced-motion.
 */
export function HealthOrb({ score, size = 84 }: { score: number; size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = score >= 70 ? 0x22c55e : score >= 40 ? 0xf59e0b : 0xef4444;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4.4;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    const wireGeo = new THREE.IcosahedronGeometry(1.35, 1);
    const wireMat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.85 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    const coreGeo = new THREE.IcosahedronGeometry(0.85, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    const count = 70;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.75 + Math.random() * 0.45;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particlesMat = new THREE.PointsMaterial({ color, size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    let raf = 0;
    let alive = true;
    const clock = new THREE.Clock();

    const render = () => {
      if (!alive) return;
      const t = clock.getElapsedTime();
      if (!reduceMotion) {
        wire.rotation.y = t * 0.3;
        wire.rotation.x = Math.sin(t * 0.22) * 0.35;
        core.rotation.y = -t * 0.2;
        core.scale.setScalar(1 + Math.sin(t * 1.7) * 0.035);
        particles.rotation.y = t * 0.14;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      wireGeo.dispose();
      wireMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      particlesGeo.dispose();
      particlesMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [score, size]);

  return <div ref={mountRef} style={{ width: size, height: size }} className="shrink-0" aria-hidden="true" />;
}
