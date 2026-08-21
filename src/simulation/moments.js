// Six manually-triggered states, one per moment identified in the song
// analysis. Selecting a moment snaps every listed parameter to its target
// value; nothing here runs on a timer. The system only ever changes state
// because the performer pressed a key or a button.
export const MOMENTS = [
  {
    id: 'intro',
    key: 'Digit1',
    label: '1 · Introducción',
    range: '00:00 – 00:30',
    note: 'Nacimiento y orden: núcleo central orbitando lento.',
    params: {
      centerAttraction: 0.85,
      dispersion: 0.05,
      turbulence: 0.12,
      ring: 0.0,
      bat: 0.0,
      maxSpeed: 0.9,
      damping: 0.35,
      birthRate: 0.12,
      lifetimeRate: 0.0,
      particleSize: 0.028,
      trail: 0.15
    }
  },
  {
    id: 'buildup',
    key: 'Digit2',
    label: '2 · Acumulación',
    range: '00:30 – 01:15',
    note: 'Aceleración y expansión radial, formas tipo vórtice.',
    params: {
      centerAttraction: 0.35,
      dispersion: 0.4,
      turbulence: 0.3,
      ring: 0.25,
      bat: 0.0,
      maxSpeed: 2.0,
      damping: 0.18,
      birthRate: 0.18,
      lifetimeRate: 0.0,
      particleSize: 0.03,
      trail: 0.3
    }
  },
  {
    id: 'climax',
    key: 'Digit3',
    label: '3 · Primer clímax',
    range: '01:15 – 01:58',
    note: 'Dispersión masiva y caos, anillos concéntricos.',
    params: {
      centerAttraction: 0.1,
      dispersion: 0.85,
      turbulence: 0.75,
      ring: 0.85,
      bat: 0.0,
      maxSpeed: 4.6,
      damping: 0.06,
      birthRate: 0.35,
      lifetimeRate: 0.0,
      particleSize: 0.032,
      trail: 0.75
    }
  },
  {
    id: 'breakdown',
    key: 'Digit4',
    label: '4 · Breakdown',
    range: '01:58 – 02:15',
    note: 'Agrupación hacia una forma de murciélago, no estática.',
    params: {
      centerAttraction: 0.4,
      dispersion: 0.0,
      turbulence: 0.12,
      ring: 0.0,
      bat: 0.9,
      maxSpeed: 0.55,
      damping: 0.8,
      birthRate: 0.03,
      lifetimeRate: 0.0,
      particleSize: 0.024,
      trail: 0.4
    }
  },
  {
    id: 'drop',
    key: 'Digit5',
    label: '5 · Drop principal',
    range: '02:15 – 03:45',
    note: 'Explosión errática: bandada saliendo a cazar al anochecer.',
    params: {
      centerAttraction: 0.05,
      dispersion: 1.0,
      turbulence: 1.0,
      ring: 0.15,
      bat: 0.0,
      maxSpeed: 7.5,
      damping: 0.04,
      birthRate: 0.85,
      lifetimeRate: 0.55,
      particleSize: 0.028,
      trail: 0.55
    }
  },
  {
    id: 'outro',
    key: 'Digit6',
    label: '6 · Outro',
    range: '03:45 – 04:43',
    note: 'Disipación: la población envejece y no se repone.',
    params: {
      centerAttraction: 0.55,
      dispersion: 0.0,
      turbulence: 0.08,
      ring: 0.0,
      bat: 0.0,
      maxSpeed: 0.35,
      damping: 0.5,
      birthRate: 0.0,
      lifetimeRate: 0.6,
      particleSize: 0.022,
      trail: 0.5
    }
  }
];
