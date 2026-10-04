import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const cabeceras = JSON.parse(leer('vercel.json')).headers;
const csp = cabeceras[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

describe('política de contenido (vercel.json)', () => {
  it('permite el script inline del tema solo por su hash: si se edita index.html, esto avisa', () => {
    const inline = leer('index.html').match(/<script>(.*?)<\/script>/s)[1];
    const hash = createHash('sha256').update(inline).digest('base64');
    expect(csp).toContain(`'sha256-${hash}'`);
  });

  it('no permite eval ni scripts inline sin hash, ni ser embebida, ni plugins', () => {
    expect(csp).not.toMatch(/script-src[^;]*('unsafe-inline'|'unsafe-eval')/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it('solo se conecta a la propia app y a Supabase', () => {
    const conectar = csp.match(/connect-src ([^;]*)/)[1].split(' ');
    expect(conectar).toEqual(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co']);
  });

  it('el service worker no se queda en caché del navegador', () => {
    expect(cabeceras.find((h) => h.source === '/sw.js').headers[0]).toEqual({ key: 'Cache-Control', value: 'no-cache' });
  });
});
