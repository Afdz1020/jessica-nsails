import { randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { auth, calendar as googleCalendar } from '@googleapis/calendar';
import nodemailer from 'nodemailer';
import { booking } from '../../src/data/site';
import { slotInterval, type Interval } from '../../src/lib/booking';
import type { BookingRequest, CalendarPort, Deps, Mailer, RequestStore } from './types';

const TIME_ZONE = 'America/Bogota';

const pad = (n: number) => String(n).padStart(2, '0');

// Convierte '-05:00' a minutos (-300)
const offsetMinutes = (offset: string): number => {
	const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
	if (!m) return 0;
	return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
};

// Formatea un instante como hora local con desfase fijo, sin depender de la zona de la máquina
const toLocalIso = (d: Date, offset: string): string => {
	const l = new Date(d.getTime() + offsetMinutes(offset) * 60_000);
	return (
		`${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}` +
		`T${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}:${pad(l.getUTCSeconds())}${offset}`
	);
};

export function eventPayload(r: BookingRequest) {
	const { start, end } = slotInterval(r.date, r.time, r.durationMin);
	const services = r.services.join(', ');
	return {
		summary: `${r.name} – ${services}`,
		description: `Celular: ${r.phone}\nCorreo: ${r.email}\nServicios: ${services}`,
		start: { dateTime: toLocalIso(start, booking.utcOffset), timeZone: TIME_ZONE },
		end: { dateTime: toLocalIso(end, booking.utcOffset), timeZone: TIME_ZONE },
	};
}

// Lo mínimo que se usa de un store de Netlify Blobs (se inyecta para probar sin red)
export interface BlobsApi {
	setJSON(key: string, value: unknown): Promise<unknown>;
	get(key: string, opts: { type: 'json' }): Promise<unknown>;
	delete(key: string): Promise<unknown>;
	list(opts: { prefix: string; paginate: true }): AsyncIterable<{ blobs: { key: string }[] }>;
}

const REQ = 'req/';
const PENDING = 'pending/';
const TANDA = 10;

// Almacén de solicitudes en Netlify Blobs.
// El registro vive en req/<id>; la marca pending/<id> existe solo mientras está pendiente, así
// listar cuesta según las pendientes y no según todo el historial.
// Aún no hay datos en producción, así que no hace falta migrar claves antiguas.
export function blobStore(store: BlobsApi = getStore('solicitudes')): RequestStore {
	const get = async (id: string): Promise<BookingRequest | null> =>
		((await store.get(REQ + id, { type: 'json' })) as BookingRequest | null) ?? null;
	return {
		// Orden pensado para fallos a medias: una marca sobrante se filtra al listar, en cambio
		// una pendiente sin marca quedaría invisible
		async put(r) {
			if (r.status === 'pending') {
				await store.setJSON(PENDING + r.id, {});
				await store.setJSON(REQ + r.id, r);
			} else {
				await store.setJSON(REQ + r.id, r);
				await store.delete(PENDING + r.id);
			}
		},
		get,
		async listPending() {
			const ids: string[] = [];
			for await (const page of store.list({ prefix: PENDING, paginate: true })) {
				for (const b of page.blobs) ids.push(b.key.slice(PENDING.length));
			}
			// Lecturas en tandas para no disparar cientos de peticiones a la vez
			const out: BookingRequest[] = [];
			for (let i = 0; i < ids.length; i += TANDA) {
				const tanda = await Promise.all(ids.slice(i, i + TANDA).map(get));
				for (const r of tanda) if (r && r.status === 'pending') out.push(r);
			}
			return out;
		},
	};
}

// Calendario de Google con cuenta de servicio
function googleCalendarPort(serviceAccountJson: string, calendarId: string): CalendarPort {
	let credentials: { private_key?: string };
	try {
		credentials = JSON.parse(serviceAccountJson);
	} catch {
		// No se incluye el contenido para no filtrar secretos
		throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido');
	}
	if (credentials.private_key) {
		credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
	}
	const cal = googleCalendar({
		version: 'v3',
		auth: new auth.GoogleAuth({
			credentials,
			scopes: ['https://www.googleapis.com/auth/calendar'],
		}),
	});
	return {
		async busy(from, to): Promise<Interval[]> {
			const res = await cal.freebusy.query({
				requestBody: {
					timeMin: from.toISOString(),
					timeMax: to.toISOString(),
					timeZone: TIME_ZONE,
					items: [{ id: calendarId }],
				},
			});
			const entry = res.data.calendars?.[calendarId];
			// Nunca devolver "libre" si Google no pudo responder por este calendario
			if (!entry || (entry.errors && entry.errors.length > 0)) {
				const reason = entry?.errors?.map((e) => e.reason).join(', ') ?? 'sin datos';
				throw new Error(`No se pudo consultar la disponibilidad del calendario: ${reason}`);
			}
			return (entry.busy ?? []).map((b) => ({
				start: new Date(b.start as string),
				end: new Date(b.end as string),
			}));
		},
		async createEvent(r) {
			// Id determinista: un reintento de aprobación no duplica el evento (hex minúscula, válido para Google)
			const id = Buffer.from(r.id).toString('hex');
			try {
				await cal.events.insert({
					calendarId,
					requestBody: { id, ...eventPayload(r) },
				});
			} catch (e) {
				const err = e as { code?: number | string; status?: number };
				if (err.code === 409 || err.code === '409' || err.status === 409) return id;
				throw e;
			}
			return id;
		},
	};
}

function smtpMailer(smtpUrl: string, from: string): Mailer {
	const transport = nodemailer.createTransport(smtpUrl);
	return {
		async send(m) {
			await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text });
		},
	};
}

const REQUIRED_ENV = [
	'GOOGLE_SERVICE_ACCOUNT_JSON',
	'GOOGLE_CALENDAR_ID',
	'SMTP_URL',
	'MAIL_FROM',
	'JESSICA_EMAIL',
	'SITE_URL',
] as const;

export function realDeps(): Deps {
	const env = process.env;
	const missing = REQUIRED_ENV.filter((n) => !env[n]?.trim());
	if (missing.length > 0) {
		throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
	}
	return {
		store: blobStore(),
		calendar: googleCalendarPort(env.GOOGLE_SERVICE_ACCOUNT_JSON!, env.GOOGLE_CALENDAR_ID!),
		mailer: smtpMailer(env.SMTP_URL!, env.MAIL_FROM!),
		now: () => new Date(),
		newId: () => randomBytes(24).toString('base64url'),
		jessicaEmail: env.JESSICA_EMAIL!,
		siteUrl: env.SITE_URL!,
	};
}
