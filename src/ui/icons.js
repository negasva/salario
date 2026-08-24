const PATHS = {
  dashboard: 'M4 4h7v9H4zM13 4h7v5h-7zM13 12h7v8h-7zM4 16h7v4H4z',
  categorias: 'M4 6h16M4 12h16M4 18h10',
  metas: 'M12 3v6M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8Z',
  movimientos: 'M7 17H3l4-4M3 17h14a4 4 0 0 0 0-8h-1M17 7h4l-4-4M21 7H7a4 4 0 0 0 0 8h1',
  historial: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2',
  ajustes: 'M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6ZM19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3a1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9a1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  paleta: 'M4 5h4v14H4zM10 5h4v14h-4zM16 5h4v14h-4z',
  salir: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5l-5-5M21 12H9',
  mas: 'M12 5v14M5 12h14',
  cerrar: 'M18 6L6 18M6 6l12 12',
  candado: 'M6 11V7a6 6 0 1 1 12 0v4M5 11h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z',
  alerta: 'M12 3l10 18H2zM12 10v4M12 17h.01',
  check: 'M4 12l6 6L20 6',
  'flecha-arriba': 'M12 19V5M5 12l7-7l7 7',
  'flecha-abajo': 'M12 5v14M5 12l7 7l7-7',
  buscar: 'M11 19a8 8 0 1 0 0-16a8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
};

let mounted = false;

export function mountIconSprite() {
  if (mounted) return;
  mounted = true;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'display:none');
  svg.innerHTML = Object.entries(PATHS)
    .map(([id, d]) => `<symbol id="ic-${id}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`)
    .join('');
  document.body.prepend(svg);
}

export function icon(name, cls = '') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round"><use href="#ic-${name}"/></svg>`;
}
