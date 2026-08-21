import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { MOMENTS } from './moments.js';

// Uniforms are CPU-side values that TSL exposes to the GPU.
// Changing .value does not rebuild the compute shader.
export function createParameters() {
  const boot = MOMENTS[0].params;

  return {
    frameDt: uniform(1 / 60),
    timeScale: uniform(1.0),
    boundsSize: uniform(12.0),
    maxSpeed: uniform(boot.maxSpeed),
    particleSize: uniform(boot.particleSize),

    // Interactive attractor, driven by the pointer.
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // LIVE PERFORMANCE PARAMETERS ------------------------------------------
    // These are the knobs the performer rides in real time; a moment preset
    // just sets a starting point for them.
    centerAttraction: uniform(boot.centerAttraction),
    dispersion: uniform(boot.dispersion),
    turbulence: uniform(boot.turbulence),
    ring: uniform(boot.ring),
    ringSpacing: uniform(boot.ringSpacing),
    ringLevels: uniform(boot.ringLevels),
    bat: uniform(boot.bat),
    damping: uniform(boot.damping),
    birthRate: uniform(boot.birthRate),
    lifetimeRate: uniform(boot.lifetimeRate),
    trail: uniform(boot.trail),
    opacity: uniform(1.0),

    // MAGNETAR (moment 1): a fraction of particles (magnetarRatio) leave
    // the turbulent core and trace looping "field line" arcs instead.
    // magnetarRatio/magnetar are per-moment (0 everywhere except moment 1);
    // the loop's own geometry (radius/speed/count) rarely needs to change
    // per moment, so it's just a shared, live-tunable shape.
    magnetar: uniform(boot.magnetar),
    magnetarRatio: uniform(boot.magnetarRatio),
    magnetarRadius: uniform(2.5),
    magnetarSpeed: uniform(1.0),
    magnetarLoops: uniform(7),

    // INFINITY CURVE (drop): a school of particles chasing a point that
    // travels a figure-8. Same pattern — curve/strength is per-moment,
    // the curve's own shape is a shared, live-tunable constant.
    curve: uniform(boot.curve),
    curveScale: uniform(3.0),
    curveSpeed: uniform(1.2),

    // Per-moment color gradient (cold -> mid -> hot, driven by speed).
    colorCold: uniform(new THREE.Color(boot.colorCold)),
    colorMid: uniform(new THREE.Color(boot.colorMid)),
    colorHot: uniform(new THREE.Color(boot.colorHot)),

    // One-shot manual "hit" (space bar), decayed from JS each frame.
    impulse: uniform(0.0),

    // Advances every frame in the render loop; used as a changing seed so
    // the birth/death roll isn't the same result forever for a given index.
    frame: uniform(0.0)
  };
}
