import { describe, it, expect, afterEach } from 'vitest';
import { blobStore, eventPayload, realDeps, type BlobsApi } from './adapters';
import type { BookingRequest } from './types';

const req: BookingRequest = {
	id: 'abc',
	name: 'Ana',
	phone: '300 123 4567',
	email: 'ana@correo.com',
	services: ['Semipermanente', 'Nail art'],
	date: '2026-11-09',
	time: '10:00',
	durationMin: 90,
	status: 'approved',
	createdAt: '2026-10-26T15:00:00.000Z',
	expiresAt: '2026-10-27T05:00:00.000Z',
};

describe('eventPayload', () => {
	const p = eventPayload(req);
	it('arma el resumen con nombre y servicios', () => {
		expect(p.summary).toBe('Ana – Semipermanente, Nail art');
	});
	it('la descripción incluye celular, correo y servicios', () => {
		expect(p.description).toContain('300 123 4567');
		expect(p.description).toContain('ana@correo.com');
		expect(p.description).toContain('Semipermanente, Nail art');
	});
	it('usa hora de Bogotá con inicio y fin', () => {
		expect(p.start).toEqual({ dateTime: '2026-11-09T10:00:00-05:00', timeZone: 'America/Bogota' });
		expect(p.end).toEqual({ dateTime: '2026-11-09T11:30:00-05:00', timeZone: 'America/Bogota' });
	});
	it('el fin cruza la medianoche correctamente', () => {
		const q = eventPayload({ ...req, time: '23:30', durationMin: 60 });
		expect(q.end.dateTime).toBe('2026-11-10T00:30:00-05:00');
	});
});

describe('realDeps', () => {
	const saved = { ...process.env };
	afterEach(() => {
		for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
		Object.assign(process.env, saved);
	});
	const names = ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_CALENDAR_ID', 'SMTP_URL', 'MAIL_FROM', 'JESSICA_EMAIL', 'SITE_URL'];

	it('lanza un error que nombra las variables faltantes', () => {
		for (const n of names) delete process.env[n];
		expect(() => realDeps()).toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON/);
		expect(() => realDeps()).toThrow(/SITE_URL/);
	});
	it('solo nombra la que falta y no filtra valores', () => {
		for (const n of names) process.env[n] = 'secreto-xyz';
		process.env.MAIL_FROM = '  ';
		let msg = '';
		try {
			realDeps();
		} catch (e) {
			msg = (e as Error).message;
		}
		expect(msg).toContain('MAIL_FROM');
		expect(msg).not.toContain('SMTP_URL');
		expect(msg).not.toContain('secreto-xyz');
	});
});

// Fake mínimo de la API de Netlify Blobs: guarda JSON en memoria y cuenta las lecturas
class FakeBlobs implements BlobsApi {
	readonly data = new Map<string, unknown>();
	readonly reads: string[] = [];
	readonly lists: string[] = [];
	enVuelo = 0;
	maxEnVuelo = 0;
	pageSize = 4;
	async setJSON(key: string, value: unknown) {
		this.data.set(key, structuredClone(value));
	}
	async get(key: string, _opts: { type: 'json' }) {
		this.reads.push(key);
		this.enVuelo++;
		this.maxEnVuelo = Math.max(this.maxEnVuelo, this.enVuelo);
		await new Promise((r) => setTimeout(r, 0));
		this.enVuelo--;
		return this.data.has(key) ? structuredClone(this.data.get(key)) : null;
	}
	async delete(key: string) {
		this.data.delete(key);
	}
	async *list(opts: { prefix: string; paginate: true }) {
		this.lists.push(opts.prefix);
		const keys = [...this.data.keys()].filter((k) => k.startsWith(opts.prefix));
		for (let i = 0; i < keys.length; i += this.pageSize) {
			yield { blobs: keys.slice(i, i + this.pageSize).map((key) => ({ key })) };
		}
	}
}

describe('blobStore', () => {
	const pend = (id: string): BookingRequest => ({ ...req, id, status: 'pending' });

	it('guarda el registro en req/<id> y la marca pending/<id> mientras está pendiente', async () => {
		const b = new FakeBlobs();
		const s = blobStore(b);
		await s.put(pend('a'));
		expect([...b.data.keys()].sort()).toEqual(['pending/a', 'req/a']);
		expect(await s.get('a')).toEqual(pend('a'));
		expect(b.reads).toEqual(['req/a']);
	});

	it.each(['approved', 'rejected', 'expired'] as const)('al pasar a %s borra la marca', async (status) => {
		const b = new FakeBlobs();
		const s = blobStore(b);
		await s.put(pend('a'));
		await s.put({ ...pend('a'), status });
		expect([...b.data.keys()]).toEqual(['req/a']);
		expect((await s.get('a'))?.status).toBe(status);
	});

	it('get de un id inexistente → null', async () => {
		expect(await blobStore(new FakeBlobs()).get('nada')).toBeNull();
	});

	it('listPending lista solo pending/ y lee solo las pendientes, con paginación', async () => {
		const b = new FakeBlobs();
		const s = blobStore(b);
		for (let i = 0; i < 6; i++) await s.put(pend(`p${i}`));
		for (let i = 0; i < 20; i++) await s.put({ ...pend(`h${i}`), status: 'approved' });
		b.reads.length = 0;
		const lista = await s.listPending();
		expect(b.lists).toEqual(['pending/']);
		expect(lista.map((r) => r.id).sort()).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
		// El costo depende solo de las pendientes, no del historial
		expect(b.reads.sort()).toEqual(['req/p0', 'req/p1', 'req/p2', 'req/p3', 'req/p4', 'req/p5']);
	});

	it('listPending lee en tandas de a lo sumo 10', async () => {
		const b = new FakeBlobs();
		const s = blobStore(b);
		for (let i = 0; i < 25; i++) await s.put(pend(`p${i}`));
		b.reads.length = 0;
		expect(await s.listPending()).toHaveLength(25);
		expect(b.reads).toHaveLength(25);
		expect(b.maxEnVuelo).toBeLessThanOrEqual(10);
		expect(b.maxEnVuelo).toBeGreaterThan(1);
	});

	it('listPending ignora marcas huérfanas o de registros ya cerrados', async () => {
		const b = new FakeBlobs();
		const s = blobStore(b);
		await s.put(pend('ok'));
		await b.setJSON('pending/huerfana', {});
		await b.setJSON('pending/cerrada', {});
		await b.setJSON('req/cerrada', { ...pend('cerrada'), status: 'approved' });
		expect((await s.listPending()).map((r) => r.id)).toEqual(['ok']);
	});

	it('funciona con los métodos sueltos (sin depender de this)', async () => {
		const b = new FakeBlobs();
		const { put, listPending } = blobStore(b);
		await put(pend('a'));
		expect((await listPending()).map((r) => r.id)).toEqual(['a']);
	});
});
