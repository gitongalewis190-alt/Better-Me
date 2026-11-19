// Theme definitions shared by the app and the PDF report.
export const ACCENTS = {
  ember: { name: 'Ember', a: '#ff5a36', b: '#ff9a3c' },
  violet: { name: 'Violet', a: '#7c5cff', b: '#c05cff' },
  ocean: { name: 'Ocean', a: '#1f8fff', b: '#22d3ee' },
  forest: { name: 'Forest', a: '#16a861', b: '#8fd14f' },
  rose: { name: 'Rose', a: '#ec4f7a', b: '#ff8fb1' },
  gold: { name: 'Gold', a: '#e0a10b', b: '#ffcf4d' },
  mint: { name: 'Mint', a: '#0fae9c', b: '#5eead4' },
  savanna: { name: 'Savanna', a: '#c2410c', b: '#facc15' },
  mono: { name: 'Mono', a: '#3f3f46', b: '#71717a', da: '#e4e4e7', db: '#a1a1aa' }
};

export const BGS = { aurora: 'Aurora', mesh: 'Mesh', grain: 'Paper', plain: 'Plain' };

export const LIGHT = { bg: '#f5f4f0', card: '#ffffff', ink: '#15151b', mut: '#5d5d68', line: '#e8e6ee', track: '#ecebf0', soft: '#efeee9' };
export const DARK = { bg: '#0b0b10', card: '#15151d', ink: '#f4f4f8', mut: '#a3a3b2', line: '#262632', track: '#23232d', soft: '#1b1b24' };

export function resolveMode(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function accentOf(key, mode) {
  const x = ACCENTS[key] || ACCENTS.ember;
  return mode === 'dark' && x.da ? { a: x.da, b: x.db } : { a: x.a, b: x.b };
}

// The app icon, drawn in the person's own accent colours.
export function iconSvg(a = '#ff5a36', b = '#ff9a3c', size = 64, id = 'ic') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="512" height="512" rx="120" fill="#121218"/><circle cx="256" cy="256" r="150" fill="none" stroke="#2a2a35" stroke-width="44"/><path d="M256 106a150 150 0 1 1-150 150" fill="none" stroke="url(#${id})" stroke-width="44" stroke-linecap="round"/><path d="M196 262l44 44 84-96" fill="none" stroke="#fff" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
