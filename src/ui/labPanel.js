function rangeRow(parent, label, min, max, step, getValue, onInput) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('span');
  value.className = 'value';
  name.textContent = label;
  lab.append(name, value);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  const sync = () => {
    const v = getValue();
    input.value = String(v);
    value.textContent = Number(v).toFixed(step < 0.01 ? 3 : 2);
  };
  input.addEventListener('input', () => {
    onInput(Number(input.value));
    sync();
  });
  sync();
  wrap.append(lab, input);
  parent.append(wrap);
  return { refresh: sync };
}

function button(parent, label, note, onClick) {
  const b = document.createElement('button');
  b.textContent = note ? `${label} — ${note}` : label;
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

export function createLabPanel({ params, moments, onReset, onMoment, onModeChange, onPauseChange }) {
  const refreshers = [];
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>Instrumento de partículas</h1>
    <p>Elige un momento y luego modifica los parámetros en vivo. Nada cambia solo — todo lo disparas tú.</p>
  `;

  const momentsGroup = document.createElement('div');
  momentsGroup.className = 'group';
  momentsGroup.innerHTML = '<h2>Momentos de la canción</h2>';
  panel.append(momentsGroup);
  for (const moment of moments) {
    button(momentsGroup, moment.label, moment.range, () => onMoment(moment.id));
  }

  const live = document.createElement('div');
  live.className = 'group';
  live.innerHTML = '<h2>Parámetros en vivo</h2>';
  panel.append(live);

  const liveParams = [
    ['centerAttraction', 'Atracción al centro', 0, 1.5, 0.01],
    ['dispersion', 'Dispersión', 0, 1.5, 0.01],
    ['turbulence', 'Turbulencia', 0, 1.5, 0.01],
    ['ring', 'Anillos', 0, 1.5, 0.01],
    ['bat', 'Formación murciélago', 0, 1.5, 0.01],
    ['maxSpeed', 'Velocidad máxima', 0.1, 10, 0.1],
    ['damping', 'Damping / fricción', 0, 1, 0.01],
    ['birthRate', 'Tasa de nacimiento', 0, 1, 0.01],
    ['lifetimeRate', 'Tasa de envejecimiento', 0, 1, 0.01],
    ['particleSize', 'Tamaño de partícula', 0.005, 0.08, 0.001],
    ['trail', 'Estela (trail)', 0, 0.97, 0.01],
    ['opacity', 'Opacidad general', 0, 1, 0.01]
  ];

  for (const [key, label, min, max, step] of liveParams) {
    refreshers.push(
      rangeRow(live, label, min, max, step, () => params[key].value, (v) => (params[key].value = v))
    );
  }

  const actions = document.createElement('div');
  actions.className = 'group';
  actions.innerHTML = '<h2>Acciones</h2>';
  panel.append(actions);
  button(actions, 'Reset (nacimiento desde cero)', null, onReset);
  button(actions, 'Pausar / continuar', null, () => onPauseChange());
  button(actions, 'LAB / PERFORMANCE', null, () => onModeChange());

  document.body.append(panel);

  return {
    element: panel,
    setVisible(visible) { panel.classList.toggle('hidden', !visible); },
    refresh() { for (const item of refreshers) item.refresh(); }
  };
}
