import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handle as availability } from '../functions/availability';
import { handle as request } from '../functions/request';
import { handle as decision } from '../functions/decision';
import expire, { handle as expireHandle } from '../functions/expire';
import { guard } from '../lib/http';
import { fakeDeps } from '../lib/testing';

// Lunes 26 de octubre, 10:00 a.m. en Bogotá
const NOW = new Date('2026-10-26T15:00:00.000Z');
const DATE = '2026-10-28';
const BASE = 'https://sitio.co';

const input = (over: Record<string, unknown> = {}) => ({
	name: 'Ana Pérez',
	phone: '300 123 4567',
	email: 'ana@correo.com',
	services: ['Semipermanente'],
	date: DATE,
	time: '10:00',
	...over,
});

const post = (path: string, body: unknown, raw = false) =>
	new Request(`${BASE}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: raw ? (body as string) : JSON.stringify(body),
	});
const get = (path: string) => new Request(`${BASE}${path}`);

let f: ReturnType<typeof fakeDeps>;
beforeEach(() => {
	f = fakeDeps(NOW);
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

// La respuesta pública no trae el id: se toma del almacén, como lo haría el correo a Jessica
const crear = async () => {
	const res = await request(post('/api/request', input()), f.deps);
	expect(res.status).toBe(201);
	return [...f.store.data.keys()].at(-1)!;
};

describe('availability', () => {
	it('services vacío → { slots: [] }', async () => {
		const res = await availability(get(`/api/availability?date=${DATE}&services=`), f.deps);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ slots: [] });
	});

	it('sin services ni date → { slots: [] }', async () => {
		const res = await availability(get('/api/availability'), f.deps);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ slots: [] });
	});

	it('fecha inválida → { slots: [] } con 200', async () => {
		const res = await availability(get('/api/availability?date=basura&services=Semipermanente'), f.deps);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ slots: [] });
	});

	it('servicios y fecha válidos → horarios, sin caché', async () => {
		const res = await availability(
			get(`/api/availability?date=${DATE}&services=${encodeURIComponent('Semipermanente')}`),
			f.deps,
		);
		const body = (await res.json()) as { slots: string[] };
		expect(res.status).toBe(200);
		expect(body.slots).toContain('10:00');
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
	});

	it('método distinto de GET → 405 con allow', async () => {
		const res = await availability(post('/api/availability', {}), f.deps);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('GET');
	});
});

describe('request', () => {
	it('JSON inválido → 400', async () => {
		const res = await request(post('/api/request', '{no es json', true), f.deps);
		expect(res.status).toBe(400);
		expect(await res.json()).toHaveProperty('error');
	});

	it('cuerpo que no es un objeto → 400', async () => {
		const res = await request(post('/api/request', [1, 2]), f.deps);
		expect(res.status).toBe(400);
	});

	it('solicitud válida → 201 { ok: true }', async () => {
		const res = await request(post('/api/request', input()), f.deps);
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ ok: true });
	});

	it('la respuesta 201 no trae el id ni ninguna credencial de aprobación', async () => {
		const res = await request(post('/api/request', input()), f.deps);
		const text = await res.text();
		const id = [...f.store.data.keys()].at(-1)!;
		expect(JSON.parse(text)).not.toHaveProperty('id');
		expect(text).not.toContain(id);
		expect(text).not.toContain('aprobar');
		for (const [k, v] of res.headers) {
			expect(`${k}: ${v}`).not.toContain(id);
		}
	});

	it('el id de la respuesta no sirve para aprobar: sin id no hay decisión', async () => {
		const res = await request(post('/api/request', input()), f.deps);
		const body = (await res.json()) as { id?: unknown };
		const r = await decision(post('/api/decision', { id: body.id, action: 'approve' }), f.deps);
		expect(r.status).toBe(400);
		expect(f.calendar.created).toHaveLength(0);
	});

	it('horario ocupado → status del servicio (409) y { error }', async () => {
		await crear();
		const res = await request(post('/api/request', input({ phone: '311 000 0000' })), f.deps);
		expect(res.status).toBe(409);
		expect(await res.json()).toHaveProperty('error');
	});

	it('datos inválidos → 400 del servicio', async () => {
		const res = await request(post('/api/request', input({ email: 'x' })), f.deps);
		expect(res.status).toBe(400);
	});

	it('método distinto de POST → 405 con allow', async () => {
		const res = await request(get('/api/request'), f.deps);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('POST');
	});

	it('cuerpo demasiado grande → 413', async () => {
		const res = await request(post('/api/request', input({ name: 'a'.repeat(20_000) })), f.deps);
		expect(res.status).toBe(413);
	});

	it('cuerpo grande sin content-length fiable → 413 igualmente', async () => {
		const req = new Request(`${BASE}/api/request`, { method: 'POST', body: 'x'.repeat(20_000) });
		req.headers.delete('content-length');
		const res = await request(req, f.deps);
		expect(res.status).toBe(413);
	});
});

describe('decision', () => {
	it('GET devuelve solo el subconjunto público', async () => {
		const id = await crear();
		const res = await decision(get(`/api/decision?id=${id}`), f.deps);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { request: Record<string, unknown> };
		expect(Object.keys(body.request).sort()).toEqual(
			['date', 'durationMin', 'name', 'services', 'status', 'time'].sort(),
		);
		const text = JSON.stringify(body);
		expect(text).not.toContain('300 123 4567');
		expect(text).not.toContain('ana@correo.com');
		expect(text).not.toContain(id);
	});

	it('GET de id inexistente → 404', async () => {
		const res = await decision(get('/api/decision?id=nada'), f.deps);
		expect(res.status).toBe(404);
		expect(await res.json()).toHaveProperty('error');
	});

	it('GET sin id → 400', async () => {
		const res = await decision(get('/api/decision'), f.deps);
		expect(res.status).toBe(400);
	});

	it('POST con acción inválida → 400', async () => {
		const id = await crear();
		const res = await decision(post('/api/decision', { id, action: 'APPROVE' }), f.deps);
		expect(res.status).toBe(400);
		expect((await f.store.get(id))?.status).toBe('pending');
	});

	it('POST con id que no es texto → 400', async () => {
		const res = await decision(post('/api/decision', { id: 5, action: 'approve' }), f.deps);
		expect(res.status).toBe(400);
	});

	it('POST con JSON inválido → 400', async () => {
		const res = await decision(post('/api/decision', 'nope', true), f.deps);
		expect(res.status).toBe(400);
	});

	it('POST approve → 200 con subconjunto público y evento creado', async () => {
		const id = await crear();
		const res = await decision(post('/api/decision', { id, action: 'approve' }), f.deps);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { request: Record<string, unknown> };
		expect(body.request.status).toBe('approved');
		expect(body.request).not.toHaveProperty('phone');
		expect(body.request).not.toHaveProperty('email');
		expect(body.request).not.toHaveProperty('eventId');
		expect(f.calendar.created).toHaveLength(1);
	});

	it('POST reject → 200 rechazada', async () => {
		const id = await crear();
		const res = await decision(post('/api/decision', { id, action: 'reject' }), f.deps);
		expect(res.status).toBe(200);
		expect(((await res.json()) as { request: { status: string } }).request.status).toBe('rejected');
	});

	it('POST sobre solicitud ya decidida → 409 del servicio', async () => {
		const id = await crear();
		await decision(post('/api/decision', { id, action: 'reject' }), f.deps);
		const res = await decision(post('/api/decision', { id, action: 'approve' }), f.deps);
		expect(res.status).toBe(409);
	});

	it('POST de id inexistente → 404', async () => {
		const res = await decision(post('/api/decision', { id: 'nada', action: 'approve' }), f.deps);
		expect(res.status).toBe(404);
	});

	it('método distinto de GET/POST → 405', async () => {
		const res = await decision(new Request(`${BASE}/api/decision`, { method: 'DELETE' }), f.deps);
		expect(res.status).toBe(405);
		expect(res.headers.get('allow')).toBe('GET, POST');
	});
});

describe('expire', () => {
	it('vence las pendientes y devuelve la cuenta', async () => {
		await crear();
		f.setNow(new Date('2026-10-30T15:00:00.000Z'));
		const res = await expireHandle(new Request(`${BASE}/`), f.deps);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ expired: 1 });
	});
});

describe('errores internos', () => {
	it('el default responde 500 genérico si faltan variables de entorno', async () => {
		vi.stubEnv('SITE_URL', '');
		const res = await expire(new Request(`${BASE}/`));
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: 'Error interno' });
		vi.unstubAllEnvs();
	});

	it('un error inesperado en handle → 500 genérico sin detalles', async () => {
		const boom = async () => {
			throw new Error('secreto-interno');
		};
		const res = await guard(new Request(`${BASE}/`), boom, () => f.deps);
		expect(res.status).toBe(500);
		expect(await res.text()).toBe('{"error":"Error interno"}');
	});
});
