import { describe, it, expect, beforeEach, vi } from 'vitest';
import { availableSlots, createRequest, decide, expireDue, getRequest } from './requests';
import { fakeDeps } from './testing';
import { expiryDeadline } from '../../src/lib/expiry';
import { booking } from '../../src/data/site';
import type { BookingRequest } from './types';

// Lunes 26 de octubre, 10:00 a.m. en Bogotá
const NOW = new Date('2026-10-26T15:00:00.000Z');
const DATE = '2026-10-28';

const input = (over: Record<string, unknown> = {}) => ({
	name: 'Ana Pérez',
	phone: '300 123 4567',
	email: 'ana@correo.com',
	services: ['Semipermanente'],
	date: DATE,
	time: '10:00',
	...over,
});

let f: ReturnType<typeof fakeDeps>;
beforeEach(() => {
	f = fakeDeps(NOW);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

const crear = async (over: Record<string, unknown> = {}) => {
	const r = await createRequest(f.deps, input(over));
	if (!r.ok) throw new Error(`no se creó: ${r.error}`);
	return r.id;
};

describe('createRequest', () => {
	it('guarda pending con su vencimiento y avisa a Jessica', async () => {
		const id = await crear();
		const r = await f.store.get(id);
		expect(r?.status).toBe('pending');
		expect(r?.durationMin).toBe(60);
		expect(r?.createdAt).toBe(NOW.toISOString());
		expect(r?.expiresAt).toBe(expiryDeadline(NOW).toISOString());
		expect(f.mailer.sent).toHaveLength(1);
		expect(f.mailer.sent[0].to).toBe('jessica@correo.com');
		expect(f.mailer.sent[0].text).toContain(`https://sitio.co/aprobar?id=${id}`);
	});

	it('segunda solicitud al mismo horario → 409', async () => {
		await crear();
		const r = await createRequest(f.deps, input({ phone: '311 000 0000' }));
		expect(r).toMatchObject({ ok: false, status: 409 });
	});

	it('horario ocupado en el calendario → 409', async () => {
		f.calendar.events.push({
			start: new Date(`${DATE}T10:30:00-05:00`),
			end: new Date(`${DATE}T11:30:00-05:00`),
		});
		const r = await createRequest(f.deps, input());
		expect(r).toMatchObject({ ok: false, status: 409 });
		expect(f.store.data.size).toBe(0);
	});

	it('cuarta solicitud pendiente del mismo celular → 429', async () => {
		await crear({ time: '09:00' });
		await crear({ time: '11:00', phone: '3001234567' });
		await crear({ time: '13:00', phone: '(300) 123-4567' });
		const r = await createRequest(f.deps, input({ time: '15:00' }));
		expect(r).toMatchObject({ ok: false, status: 429 });
		expect(f.store.data.size).toBe(3);
	});

	it('cuarta solicitud pendiente del mismo correo → 429, sin importar mayúsculas', async () => {
		await crear({ time: '09:00', phone: '311 000 0001' });
		await crear({ time: '11:00', phone: '311 000 0002', email: 'ANA@Correo.com' });
		await crear({ time: '13:00', phone: '311 000 0003', email: ' Ana@correo.COM ' });
		const r = await createRequest(f.deps, input({ time: '15:00', phone: '311 000 0004' }));
		expect(r).toMatchObject({ ok: false, status: 429 });
		expect(f.store.data.size).toBe(3);
	});

	it('las vencidas no cuentan para el límite por correo', async () => {
		const id = await crear({ time: '09:00', phone: '311 000 0001' });
		await crear({ time: '11:00', phone: '311 000 0002' });
		await crear({ time: '13:00', phone: '311 000 0003' });
		f.setNow(new Date(new Date((await f.store.get(id))!.expiresAt).getTime() + 1));
		const r = await createRequest(f.deps, input({ date: '2026-10-29', time: '15:00', phone: '311 000 0004' }));
		expect(r.ok).toBe(true);
	});

	it('límite global de pendientes vigentes → 429 con mensaje en español', async () => {
		expect(booking.maxPendingTotal).toBe(30);
		// Pendientes de otras clientas en otra fecha, para no ocupar el horario pedido
		const base = (await f.store.get(await crear({ date: '2026-11-05', time: '09:00' })))!;
		for (let i = 1; i < booking.maxPendingTotal; i++) {
			const otra: BookingRequest = { ...base, id: `x-${i}`, phone: `31100${String(i).padStart(5, '0')}`, email: `c${i}@correo.com` };
			await f.store.put(otra);
		}
		const r = await createRequest(f.deps, input({ phone: '322 999 9999', email: 'nueva@correo.com' }));
		expect(r).toEqual({
			ok: false,
			status: 429,
			error: 'Hay muchas solicitudes en espera. Intenta de nuevo en un rato.',
		});
		expect(f.store.data.size).toBe(booking.maxPendingTotal);
	});

	it('con una menos del límite global sí se acepta', async () => {
		const base = (await f.store.get(await crear({ date: '2026-11-05', time: '09:00' })))!;
		for (let i = 1; i < booking.maxPendingTotal - 1; i++) {
			await f.store.put({ ...base, id: `x-${i}`, phone: `31100${String(i).padStart(5, '0')}`, email: `c${i}@correo.com` });
		}
		const r = await createRequest(f.deps, input({ phone: '322 999 9999', email: 'nueva@correo.com' }));
		expect(r.ok).toBe(true);
	});

	it('el límite por contacto sale de booking.maxPendingPerContact', () => {
		expect(booking.maxPendingPerContact).toBe(3);
	});

	it('entrada inválida → 400 y no guarda nada', async () => {
		const r = await createRequest(f.deps, input({ email: 'no-es-correo' }));
		expect(r).toEqual({ ok: false, status: 400, error: 'El correo no es válido.' });
		expect(f.store.data.size).toBe(0);
		expect(f.mailer.sent).toHaveLength(0);
	});

	it('si falla el correo a Jessica la solicitud queda guardada', async () => {
		f.mailer.fail = true;
		const r = await createRequest(f.deps, input());
		expect(r.ok).toBe(true);
		expect(f.store.data.size).toBe(1);
		expect(console.error).toHaveBeenCalled();
	});
});

describe('availableSlots', () => {
	it('no ofrece el horario de una pending vigente, y sí el de una vencida', async () => {
		const id = await crear();
		expect(await availableSlots(f.deps, DATE, ['Semipermanente'])).not.toContain('10:00');
		// Más tarde, ya vencida aunque nadie la haya barrido
		const r = (await f.store.get(id))!;
		f.setNow(new Date(new Date(r.expiresAt).getTime() + 1));
		expect(await availableSlots(f.deps, DATE, ['Semipermanente'])).toContain('10:00');
	});

	it('servicios inválidos → []', async () => {
		expect(await availableSlots(f.deps, DATE, ['Inventado'])).toEqual([]);
		expect(await availableSlots(f.deps, DATE, [])).toEqual([]);
	});

	it('consulta el calendario desde el día anterior hasta el día siguiente', async () => {
		await availableSlots(f.deps, DATE, ['Semipermanente']);
		expect(f.calendar.busyCalls[0].from.toISOString()).toBe('2026-10-27T05:00:00.000Z');
		expect(f.calendar.busyCalls[0].to.toISOString()).toBe('2026-10-29T05:00:00.000Z');
	});

	it('un evento que cruza la medianoche bloquea la mañana', async () => {
		f.calendar.events.push({
			start: new Date('2026-10-27T20:00:00-05:00'),
			end: new Date(`${DATE}T10:00:00-05:00`),
		});
		const slots = await availableSlots(f.deps, DATE, ['Semipermanente']);
		expect(slots).not.toContain('09:00');
		expect(slots).toContain('10:00');
	});
});

describe('decide', () => {
	it('approve crea un evento, guarda eventId y avisa a la clienta', async () => {
		const id = await crear();
		const res = await decide(f.deps, id, 'approve');
		expect(res.ok).toBe(true);
		expect(f.calendar.created).toHaveLength(1);
		const r = (await f.store.get(id))!;
		expect(r.status).toBe('approved');
		expect(r.eventId).toBe('evt-1');
		expect(r.decidedAt).toBe(NOW.toISOString());
		const last = f.mailer.sent.at(-1)!;
		expect(last.to).toBe('ana@correo.com');
		expect(last.subject).toContain('confirmada');
	});

	it('reject pasa a rejected, sin evento, y avisa a la clienta', async () => {
		const id = await crear();
		const res = await decide(f.deps, id, 'reject');
		expect(res.ok).toBe(true);
		expect(f.calendar.created).toHaveLength(0);
		expect((await f.store.get(id))!.status).toBe('rejected');
		const last = f.mailer.sent.at(-1)!;
		expect(last.to).toBe('ana@correo.com');
		expect(last.text).toContain('no pudimos confirmar');
	});

	it('aprobar dos veces → 409 y un solo evento', async () => {
		const id = await crear();
		await decide(f.deps, id, 'approve');
		const res = await decide(f.deps, id, 'approve');
		expect(res).toMatchObject({ ok: false, status: 409 });
		expect(f.calendar.created).toHaveLength(1);
	});

	it('aprobar vencida → 409, queda expired, sin evento', async () => {
		const id = await crear();
		const r = (await f.store.get(id))!;
		f.setNow(new Date(r.expiresAt));
		const res = await decide(f.deps, id, 'approve');
		expect(res).toMatchObject({ ok: false, status: 409 });
		expect((await f.store.get(id))!.status).toBe('expired');
		expect(f.calendar.created).toHaveLength(0);
	});

	it('aprobar con el calendario ya ocupado → 409, sin evento, deja de bloquear', async () => {
		const id = await crear();
		f.calendar.events.push({
			start: new Date(`${DATE}T10:30:00-05:00`),
			end: new Date(`${DATE}T11:00:00-05:00`),
		});
		const res = await decide(f.deps, id, 'approve');
		expect(res).toMatchObject({ ok: false, status: 409 });
		expect(f.calendar.created).toHaveLength(0);
		expect((await f.store.get(id))!.status).toBe('rejected');
	});

	it('aprobar cuando otra pending anterior tiene el mismo horario → 409', async () => {
		// Carrera: dos solicitudes simultáneas pasaron la comprobación
		const a = await crear();
		const b = 'req-99';
		const ra = (await f.store.get(a))!;
		await f.store.put({ ...ra, id: b, createdAt: new Date(NOW.getTime() + 1000).toISOString() });
		expect(await decide(f.deps, b, 'approve')).toMatchObject({ ok: false, status: 409 });
		expect((await decide(f.deps, a, 'approve')).ok).toBe(true);
		expect(f.calendar.created).toHaveLength(1);
	});

	it('si falla crear el evento, no queda aprobada', async () => {
		const id = await crear();
		f.calendar.fail = true;
		await expect(decide(f.deps, id, 'approve')).rejects.toThrow();
		expect((await f.store.get(id))!.status).toBe('pending');
	});

	it('si falla el correo a la clienta, la aprobación se mantiene', async () => {
		const id = await crear();
		f.mailer.fail = true;
		expect((await decide(f.deps, id, 'approve')).ok).toBe(true);
		expect((await f.store.get(id))!.status).toBe('approved');
	});

	it('id inexistente → 404', async () => {
		expect(await decide(f.deps, 'nada', 'approve')).toMatchObject({ ok: false, status: 404 });
	});
});

describe('getRequest', () => {
	it('null si no existe', async () => {
		expect(await getRequest(f.deps, 'nada')).toBeNull();
	});

	it('marca expired al leer si venció', async () => {
		const id = await crear();
		const r = (await f.store.get(id))!;
		f.setNow(new Date(new Date(r.expiresAt).getTime() + 1));
		expect((await getRequest(f.deps, id))?.status).toBe('expired');
		expect((await f.store.get(id))!.status).toBe('expired');
		// La clienta recibe el aviso una sola vez: expireDue ya no la ve pendiente
		const avisos = () => f.mailer.sent.filter((m) => m.to === 'ana@correo.com').length;
		expect(avisos()).toBe(1);
		expect(await expireDue(f.deps)).toBe(0);
		expect(avisos()).toBe(1);
	});
});

describe('vencimiento concurrente', () => {
	// Simula la carrera: alguien leyó la solicitud pendiente justo antes de que el cron la venciera
	const conLecturaVieja = (vieja: BookingRequest) => {
		const get = f.store.get.bind(f.store);
		let primera = true;
		f.store.get = async (id: string) => {
			if (primera && id === vieja.id) {
				primera = false;
				return structuredClone(vieja);
			}
			return get(id);
		};
	};
	const avisos = () => f.mailer.sent.filter((m) => m.to === 'ana@correo.com').length;

	it('getRequest con lectura vieja no envía un segundo correo de vencida', async () => {
		const id = await crear();
		const vieja = (await f.store.get(id))!;
		f.setNow(new Date(new Date(vieja.expiresAt).getTime() + 1));
		expect(await expireDue(f.deps)).toBe(1);
		expect(avisos()).toBe(1);
		conLecturaVieja(vieja);
		expect((await getRequest(f.deps, id))?.status).toBe('expired');
		expect(avisos()).toBe(1);
	});

	it('decide con lectura vieja no envía un segundo correo de vencida', async () => {
		const id = await crear();
		const vieja = (await f.store.get(id))!;
		f.setNow(new Date(new Date(vieja.expiresAt).getTime() + 1));
		await expireDue(f.deps);
		conLecturaVieja(vieja);
		expect(await decide(f.deps, id, 'approve')).toMatchObject({ ok: false, status: 409 });
		expect(avisos()).toBe(1);
		expect(f.calendar.created).toHaveLength(0);
	});

	it('expireDue con listado viejo no reenvía ni cuenta la ya vencida', async () => {
		const id = await crear();
		const vieja = (await f.store.get(id))!;
		f.setNow(new Date(new Date(vieja.expiresAt).getTime() + 1));
		await getRequest(f.deps, id);
		expect(avisos()).toBe(1);
		f.store.listPending = async () => [structuredClone(vieja)];
		expect(await expireDue(f.deps)).toBe(0);
		expect(avisos()).toBe(1);
	});
});

describe('expireDue', () => {
	it('vence solo las pasadas, devuelve cuántas y avisa a cada una', async () => {
		const viejas = [await crear({ time: '09:00' }), await crear({ time: '11:00', email: 'b@c.co' })];
		const t2 = new Date(new Date((await f.store.get(viejas[0]))!.expiresAt).getTime() + 1);
		f.setNow(t2);
		const nueva = await crear({ time: '15:00', phone: '311 222 3333' });
		const antes = f.mailer.sent.length;
		expect(await expireDue(f.deps)).toBe(2);
		for (const id of viejas) expect((await f.store.get(id))!.status).toBe('expired');
		expect((await f.store.get(nueva))!.status).toBe('pending');
		const enviados = f.mailer.sent.slice(antes);
		expect(enviados.map((m) => m.to).sort()).toEqual(['ana@correo.com', 'b@c.co']);
		expect(enviados.every((m) => m.text.includes('a tiempo'))).toBe(true);
	});

	it('un correo que falla no detiene a los demás', async () => {
		await crear({ time: '09:00' });
		await crear({ time: '11:00' });
		f.setNow(new Date(NOW.getTime() + 7 * 86_400_000));
		const send = f.mailer.send.bind(f.mailer);
		let calls = 0;
		f.mailer.send = async (m) => {
			if (calls++ === 0) throw new Error('falla');
			return send(m);
		};
		expect(await expireDue(f.deps)).toBe(2);
		expect([...f.store.data.values()].every((r) => r.status === 'expired')).toBe(true);
		expect(console.error).toHaveBeenCalled();
	});
});
