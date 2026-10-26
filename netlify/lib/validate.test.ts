import { describe, it, expect } from 'vitest';
import { parseRequestInput } from './validate';

const valido = {
	name: 'Ana Pérez',
	phone: '300 123 4567',
	email: 'ana@correo.com',
	services: ['Semipermanente'],
	date: '2026-11-03',
	time: '10:30',
};

const falla = (raw: unknown) => {
	const r = parseRequestInput(raw);
	expect(r.ok).toBe(false);
	if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
};

describe('parseRequestInput', () => {
	it('acepta una entrada válida recortando espacios', () => {
		const r = parseRequestInput({
			...valido,
			name: '  Ana Pérez  ',
			email: ' ana@correo.com ',
			date: ' 2026-11-03 ',
			time: ' 10:30 ',
			website: '',
		});
		expect(r).toEqual({
			ok: true,
			value: { ...valido, phone: '300 123 4567' },
		});
	});

	it('falla con nombre vacío', () => falla({ ...valido, name: '   ' }));
	it('falla con nombre de más de 100 caracteres', () => falla({ ...valido, name: 'a'.repeat(101) }));
	it('falla con celular de menos de 7 dígitos', () => falla({ ...valido, phone: '12-34 5' }));
	it('falla con correo sin @', () => falla({ ...valido, email: 'ana.correo.com' }));
	it('falla con correo sin punto en el dominio (antes se aceptaba a@b)', () => {
		falla({ ...valido, email: 'a@b' });
		falla({ ...valido, email: 'a@b.' });
		falla({ ...valido, email: 'a@.b' });
	});
	it('falla con más de una @', () => falla({ ...valido, email: 'a@b@c.co' }));
	it.each(['ana @correo.com', 'ana@cor\treo.com', 'ana,x@correo.com', 'ana;x@correo.com', 'ana<x@correo.com', 'ana>x@correo.com', 'ana"x@correo.com'])(
		'falla con espacio o caracter prohibido: %s',
		(email) => falla({ ...valido, email }),
	);
	it('falla con correo de más de 100 caracteres', () => {
		falla({ ...valido, email: `${'a'.repeat(96)}@b.co` });
	});
	it('acepta correos normales', () => {
		for (const email of ['a@b.co', 'ana.perez+citas@correo.com.co', `${'a'.repeat(94)}@b.co`]) {
			expect(parseRequestInput({ ...valido, email }).ok).toBe(true);
		}
	});
	it('falla con services vacío', () => falla({ ...valido, services: [] }));
	it('falla con servicio desconocido', () => falla({ ...valido, services: ['Inexistente'] }));
	it('falla si services no son strings', () => falla({ ...valido, services: [1] }));
	it('falla con date mal formada', () => {
		falla({ ...valido, date: '03/11/2026' });
		falla({ ...valido, date: '2026-13-45' });
	});
	it('falla con time fuera de HH:MM', () => {
		falla({ ...valido, time: '25:00' });
		falla({ ...valido, time: '9:30' });
		falla({ ...valido, time: '10:60' });
	});
	it('falla con el campo trampa website no vacío', () => falla({ ...valido, website: 'http://spam' }));
	it('falla si raw no es objeto, sin lanzar', () => {
		for (const raw of [null, undefined, 42, 'x', [], [valido]]) falla(raw);
	});
	it('no lanza con campos de tipo inesperado', () => {
		falla({ name: {}, phone: [], email: null, services: 'a', date: 1, time: {} });
	});
	it('elimina servicios duplicados', () => {
		const r = parseRequestInput({ ...valido, services: ['Semipermanente', 'Semipermanente'] });
		expect(r.ok && r.value.services).toEqual(['Semipermanente']);
	});
});
