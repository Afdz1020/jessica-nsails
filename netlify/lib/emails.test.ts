import { describe, it, expect } from 'vitest';
import { emailForJessica, emailForClient } from './emails';
import type { BookingRequest } from './types';

const req: BookingRequest = {
	id: 'abc',
	name: 'Ana Pérez',
	phone: '300 123 4567',
	email: 'ana@correo.com',
	services: ['Semipermanente', 'Pedicure'],
	date: '2026-11-03',
	time: '10:00',
	durationMin: 150,
	status: 'pending',
	createdAt: '2026-10-26T15:00:00.000Z',
	expiresAt: '2026-10-27T05:00:00.000Z',
};
const url = 'https://sitio.co/.netlify/functions/approve?id=abc&t=xyz';

describe('emailForJessica', () => {
	const m = emailForJessica(req, url);
	it('incluye los datos de la solicitud', () => {
		expect(m.text).toContain('Ana Pérez');
		expect(m.text).toContain('300 123 4567');
		expect(m.text).toContain('Semipermanente');
		expect(m.text).toContain('Pedicure');
		expect(m.text).toContain('martes, 3 de noviembre');
		expect(m.text).toContain('10:00 a.m.');
		expect(m.text).toContain('2 h 30 min');
		expect(m.text).toContain(url);
	});
	it('el asunto no tiene saltos de línea', () => {
		const s = emailForJessica({ ...req, name: 'Ana\r\nBcc: x@y.com' }, url).subject;
		expect(s).not.toMatch(/[\r\n]/);
	});
});

describe('emailForClient', () => {
	it('approved muestra fecha y hora', () => {
		const m = emailForClient({ ...req, time: '15:00' }, 'approved');
		expect(m.text).toContain('Ana Pérez');
		expect(m.text).toContain('martes, 3 de noviembre');
		expect(m.text).toContain('3:00 p.m.');
	});
	it.each(['rejected', 'expired'] as const)('%s invita a elegir otro horario', (o) => {
		const m = emailForClient(req, o);
		expect(m.text).toContain('Ana Pérez');
		expect(m.text).toContain('en nuestro sitio web');
		expect(m.text).toContain('otro horario');
		expect(m.subject).not.toMatch(/[\r\n]/);
	});
	it.each(['approved', 'rejected', 'expired'] as const)(
		'%s no filtra el id ni el enlace de aprobación',
		(o) => {
			const secreto = 'TOKEN-secreto-123';
			const m = emailForClient({ ...req, id: secreto }, o);
			expect(m.text + m.subject).not.toContain(secreto);
			expect(m.text + m.subject).not.toContain('aprobar');
		},
	);
	it('mediodía y medianoche', () => {
		expect(emailForClient({ ...req, time: '12:30' }, 'approved').text).toContain('12:30 p.m.');
		expect(emailForClient({ ...req, time: '00:05' }, 'approved').text).toContain('12:05 a.m.');
	});
});
