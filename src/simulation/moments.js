// Manually-triggered states along the song's timeline. Selecting one snaps
// every listed parameter to its target value; nothing here runs on a timer.
// The system only ever changes state because the performer pressed a key
// or a button. The intro is split into two states (planet / eruption) at
// the performer's request — both share the "ring" mechanic, just at a
// different target radius (ringSpacing), so the eruption is literally the
// planet's shell being told to expand outward into the orbit radius.
export const MOMENTS = [
  {
    id: 'intro-planet',
    key: 'Digit1',
    label: '1 · Planeta',
    range: '00:00 – 00:15',
    note: 'Las partículas se condensan en una esfera densa y compacta.',
    params: {
      centerAttraction: 0.3,
      dispersion: 0.0,
      turbulence: 0.1,
      ring: 1.3,
      ringSpacing: 0.4,
      bat: 0.0,
      maxSpeed: 1.2,
      damping: 0.5,
      birthRate: 0.15,
      lifetimeRate: 0.0,
      particleSize: 0.012,
      trail: 0.1
    }
  },
  {
    id: 'intro-eruption',
    key: 'Digit2',
    label: '1 · Expulsión a órbita',
    range: '00:15 – 00:30',
    note: 'El planeta expulsa partículas hacia su órbita, como un volcán.',
    params: {
      centerAttraction: 0.0,
      dispersion: 0.15,
      turbulence: 0.35,
      ring: 1.0,
      ringSpacing: 1.6,
      bat: 0.0,
      maxSpeed: 2.5,
      damping: 0.15,
      birthRate: 0.2,
      lifetimeRate: 0.0,
      particleSize: 0.016,
      trail: 0.3
    }
  },
  {
    id: 'buildup',
    key: 'Digit3',
    label: '2 · Acumulación',
    range: '00:30 – 01:15',
    note: 'Aceleración y expansión radial, formas tipo vórtice.',
    params: {
      centerAttraction: 0.35,
      dispersion: 0.4,
      turbulence: 0.3,
      ring: 0.25,
      ringSpacing: 1.6,
      bat: 0.0,
      maxSpeed: 2.0,
      damping: 0.18,
      birthRate: 0.18,
      lifetimeRate: 0.0,
      particleSize: 0.018,
      trail: 0.3
    }
  },
  {
    id: 'climax',
    key: 'Digit4',
    label: '3 · Primer clímax',
    range: '01:15 – 01:58',
    note: 'Dispersión masiva y caos, anillos concéntricos.',
    params: {
      centerAttraction: 0.1,
      dispersion: 0.85,
      turbulence: 0.75,
      ring: 0.85,
      ringSpacing: 1.6,
      bat: 0.0,
      maxSpeed: 4.6,
      damping: 0.06,
      birthRate: 0.35,
      lifetimeRate: 0.0,
      particleSize: 0.02,
      trail: 0.75
    }
  },
  {
    id: 'breakdown',
    key: 'Digit5',
    label: '4 · Breakdown',
    range: '01:58 – 02:15',
    note: 'Agrupación hacia una forma de murciélago, no estática.',
    params: {
      centerAttraction: 0.4,
      dispersion: 0.0,
      turbulence: 0.12,
      ring: 0.0,
      ringSpacing: 1.6,
      bat: 0.9,
      maxSpeed: 0.55,
      damping: 0.8,
      birthRate: 0.03,
      lifetimeRate: 0.0,
      particleSize: 0.016,
      trail: 0.4
    }
  },
  {
    id: 'drop',
    key: 'Digit6',
    label: '5 · Drop principal',
    range: '02:15 – 03:45',
    note: 'Explosión errática: bandada saliendo a cazar al anochecer.',
    params: {
      centerAttraction: 0.05,
      dispersion: 1.0,
      turbulence: 1.0,
      ring: 0.15,
      ringSpacing: 1.6,
      bat: 0.0,
      maxSpeed: 7.5,
      damping: 0.04,
      birthRate: 0.85,
      lifetimeRate: 0.55,
      particleSize: 0.018,
      trail: 0.55
    }
  },
  {
    id: 'outro',
    key: 'Digit7',
    label: '6 · Outro',
    range: '03:45 – 04:43',
    note: 'Disipación: la población envejece y no se repone.',
    params: {
      centerAttraction: 0.55,
      dispersion: 0.0,
      turbulence: 0.08,
      ring: 0.0,
      ringSpacing: 1.6,
      bat: 0.0,
      maxSpeed: 0.35,
      damping: 0.5,
      birthRate: 0.0,
      lifetimeRate: 0.6,
      particleSize: 0.014,
      trail: 0.5
    }
  }
];
