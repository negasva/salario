export const DEFAULT_PALETA = 'chicle';

export const PALETAS = {
  chicle: {
    label: 'Rosa chicle',
    background: '#FFF1F7',
    swatches: ['#FC90B6', '#F870A0', '#1A1A1A'],
  },
  coral: {
    label: 'Coral & azul',
    background: '#F9F5EB',
    swatches: ['#EA5455', '#F07B3F', '#2D4059', '#002B5B'],
  },
  pizarra: {
    label: 'Pizarra',
    background: '#EDEDED',
    swatches: ['#9CA3AF', '#4B5563', '#1F2937', '#111827'],
  },
  vivo: {
    label: 'Vivo',
    background: '#FFF7E5',
    swatches: ['#FF5A5F', '#FFB400', '#3DDC84', '#00A6ED', '#8B5CF6'],
  },
};

export function normalizarPaleta(id) {
  return PALETAS[id] ? id : DEFAULT_PALETA;
}

export function aplicarPaleta(id) {
  const paleta = normalizarPaleta(id);
  document.documentElement.dataset.paleta = paleta;
  document.documentElement.style.colorScheme = 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETAS[paleta].background);
  return paleta;
}
