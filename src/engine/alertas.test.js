import { expect, it } from 'vitest';
import { renglonesQueCrecieron } from './alertas.js';

it('detecta renglones que crecieron más del umbral', () => {
  const cierres = [
    { periodo: '2023-01', snapshot: { version: 2, lineas: { 'l1': { nombre: 'Mercado', itemId: 'i1', real: 800000 } } } },
    { periodo: '2023-02', snapshot: { version: 2, lineas: { 'l1': { nombre: 'Mercado', itemId: 'i1', real: 800000 } } } },
    { periodo: '2023-03', snapshot: { version: 2, lineas: { 'l1': { nombre: 'Mercado', itemId: 'i1', real: 1100000 } } } },
  ];
  
  const res = renglonesQueCrecieron(cierres, '2023-04', 15);
  expect(res).toEqual([
    { lineId: 'l1', nombre: 'Mercado', itemId: 'i1', promedioAnterior: 800000, actual: 1100000, deltaPct: 38, meses: 2 }
  ]);
});

it('ignora renglones con crecimiento menor al umbral', () => {
  const cierres = [
    { periodo: '2023-01', snapshot: { version: 2, lineas: { 'l1': { nombre: 'Mercado', itemId: 'i1', real: 800000 } } } },
    { periodo: '2023-02', snapshot: { version: 2, lineas: { 'l1': { nombre: 'Mercado', itemId: 'i1', real: 850000 } } } },
  ];
  
  const res = renglonesQueCrecieron(cierres, '2023-03', 15);
  expect(res).toHaveLength(0); // 850000 / 800000 = 6.25%
});
