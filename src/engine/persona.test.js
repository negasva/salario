import { describe, it, expect } from 'vitest';
import { normalizarPersona, nombreVisible, iniciales, textoSobre, saludo, desde, fuerzaClave, problemaClave, mensajeClave, mensajeEnlace, enlaceDeCorreo, COLORES_AVATAR } from './persona.js';

describe('persona', () => {
  it('normaliza nombre y color', () => {
    expect(normalizarPersona({ nombre: '  Camila  ', color: 3 })).toEqual({ nombre: 'Camila', color: 3 });
    expect(normalizarPersona({ nombre: 'x'.repeat(80), color: 99 })).toEqual({ nombre: 'x'.repeat(40), color: 0 });
    expect(normalizarPersona(undefined)).toEqual({ nombre: '', color: 0 });
  });
  it('sin nombre usa el correo, bien escrito', () => {
    expect(nombreVisible('', 'camila.perez@correo.co')).toBe('Camila Perez');
    expect(nombreVisible('Ana', 'x@y.co')).toBe('Ana');
  });
  it('iniciales: dos letras con nombre y apellido, una con un solo nombre', () => {
    expect(iniciales('Camila Pérez Gómez')).toBe('CG');
    expect(iniciales('camila')).toBe('C');
    expect(iniciales('', 'andres_ruiz@x.co')).toBe('AR');
    expect(iniciales('', '')).toBe('?');
  });
  it('el texto del avatar siempre tiene contraste', () => {
    COLORES_AVATAR.forEach((c) => expect(['#0A0A0A', '#FFFFFF']).toContain(textoSobre(c)));
    expect(textoSobre('#FFFFFF')).toBe('#0A0A0A');
    expect(textoSobre('#000000')).toBe('#FFFFFF');
  });
  it('saludo por hora y fecha de alta', () => {
    expect([saludo(7), saludo(15), saludo(21)]).toEqual(['Buenos días', 'Buenas tardes', 'Buenas noches']);
    expect(desde('2026-03-02T10:00:00Z')).toBe('marzo de 2026');
    expect(desde(undefined)).toBe('');
  });
  it('fuerza y problemas de una contraseña', () => {
    expect(fuerzaClave('').nivel).toBe(0);
    expect(fuerzaClave('abc12345').nivel).toBeLessThan(fuerzaClave('Abc12345!xyz9').nivel);
    expect(fuerzaClave('Abc12345!xyz9').texto).toBe('Fuerte');
    expect(problemaClave('corta1', 'corta1')).toBe('Mínimo 8 caracteres.');
    expect(problemaClave('sololetras', 'sololetras')).toBe('Mezcla letras y números.');
    expect(problemaClave('clave12345', 'clave1234')).toBe('Las dos no coinciden.');
    expect(problemaClave('clave12345', 'clave12345')).toBe('');
  });

  it('traduce los errores de la clave y del enlace', () => {
    expect(mensajeClave({ message: 'New password should be different from the old password.' })).toBe('Usa una contraseña distinta a la actual.');
    expect(mensajeClave({ message: 'Password is too weak' })).toBe('Esa contraseña es muy débil.');
    expect(mensajeClave({ message: 'Auth session missing!' })).toBe('Vuelve a entrar y prueba de nuevo.');
    expect(mensajeClave({ message: 'Auth session missing!' }, true)).toBe('El enlace venció. Pide otro.');
    expect(mensajeClave({ message: 'boom' })).toBe('No se pudo cambiar. Intenta de nuevo.');
    expect(mensajeEnlace({ message: 'email rate limit exceeded' })).toMatch(/Espera/);
    expect(mensajeEnlace({ message: 'Unable to validate email address: invalid format' })).toMatch(/correo/);
    expect(mensajeEnlace(null)).toMatch(/No pudimos/);
  });
  it('reconoce el enlace del correo', () => {
    expect(enlaceDeCorreo('#access_token=a&refresh_token=b&type=recovery')).toBe('nueva');
    expect(enlaceDeCorreo('#error=access_denied&error_code=otp_expired&error_description=x')).toBe('vencido');
    expect(enlaceDeCorreo('', '?error=access_denied&error_code=otp_expired')).toBe('vencido');
    expect(enlaceDeCorreo('#perfil')).toBe('');
    expect(enlaceDeCorreo('')).toBe('');
  });
});
