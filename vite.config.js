import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  build: { sourcemap: true },
  // solo las pruebas de la app: los ejemplos de las skills (specs de Playwright) no son suyas
  test: { include: ['src/**/*.test.js'] },
});
