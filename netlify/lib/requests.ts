import { booking } from '../../src/data/site';
import { computeSlots, slotInterval, totalDuration, type Interval } from '../../src/lib/booking';
import { expiryDeadline } from '../../src/lib/expiry';
import { emailForClient, emailForJessica } from './emails';
import type { BookingRequest, Deps, RequestStatus } from './types';
import { parseRequestInput } from './validate';

const DAY = 86_400_000;

type Fail<S> = { ok: false; status: S; error: string };

const MENSAJE_ESTADO: Record<Exclude<RequestStatus, 'pending'>, string> = {
	approved: 'Esta solicitud ya fue aprobada.',
	rejected: 'Esta solicitud ya fue rechazada.',
	expired: 'Esta solicitud ya venció.',
};

const digitos = (s: string) => s.replace(/\D/g, '');
const correoNormal = (s: string) => s.trim().toLowerCase();

const vencida = (r: BookingRequest, now: Date) =>
	new Date(r.expiresAt).getTime() <= now.getTime();

const choca = (a: Interval, b: Interval) =>
	a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();

// Pendientes que todavía bloquean su horario
async function pendientesVigentes(d: Deps, now: Date): Promise<BookingRequest[]> {
	return (await d.store.listPending()).filter((r) => !vencida(r, now));
}

// Envía un correo sin dejar que un fallo revierta lo ya guardado
async function enviar(d: Deps, to: string, m: { subject: string; text: string }, id: string) {
	try {
		await d.mailer.send({ to, subject: m.subject, text: m.text });
	} catch (e) {
		console.error(`No se pudo enviar el correo de la solicitud ${id}:`, e);
	}
}

// Marca la solicitud como vencida y avisa a la clienta (una sola vez: la transición).
// Se vuelve a leer justo antes de guardar: si otro proceso (el cron o una página abierta) ya la
// cerró, no se guarda ni se envía nada. Esto achica la ventana de carrera pero no la elimina,
// porque Netlify Blobs no tiene transacciones.
async function vencer(
	d: Deps,
	r: BookingRequest,
): Promise<{ request: BookingRequest; vencio: boolean }> {
	const actual = await d.store.get(r.id);
	if (!actual || actual.status !== 'pending') return { request: actual ?? r, vencio: false };
	const actualizada: BookingRequest = { ...actual, status: 'expired' };
	await d.store.put(actualizada);
	await enviar(d, actualizada.email, emailForClient(actualizada, 'expired'), actualizada.id);
	return { request: actualizada, vencio: true };
}

// Cierra la solicitud como rechazada y avisa a la clienta
async function rechazar(d: Deps, r: BookingRequest, now: Date): Promise<BookingRequest> {
	const actualizada: BookingRequest = { ...r, status: 'rejected', decidedAt: now.toISOString() };
	await d.store.put(actualizada);
	await enviar(d, r.email, emailForClient(actualizada, 'rejected'), r.id);
	return actualizada;
}

export async function availableSlots(
	d: Deps,
	date: string,
	serviceNames: string[],
): Promise<string[]> {
	const durationMin = totalDuration(serviceNames);
	// computeSlots no protege contra duraciones inválidas
	if (durationMin === null || !Number.isFinite(durationMin) || durationMin <= 0) return [];
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
	const midnight = new Date(`${date}T00:00:00${booking.utcOffset}`).getTime();
	if (Number.isNaN(midnight)) return [];

	const now = d.now();
	// Desde un día antes para incluir eventos que cruzan la medianoche
	const busy = await d.calendar.busy(new Date(midnight - DAY), new Date(midnight + DAY));
	for (const r of await pendientesVigentes(d, now)) {
		busy.push(slotInterval(r.date, r.time, r.durationMin));
	}
	return computeSlots({ date, durationMin, busy, now });
}

export async function createRequest(
	d: Deps,
	raw: unknown,
): Promise<{ ok: true; id: string } | Fail<400 | 409 | 429>> {
	const parsed = parseRequestInput(raw);
	if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
	const v = parsed.value;

	const durationMin = totalDuration(v.services);
	if (durationMin === null) return { ok: false, status: 400, error: 'Servicio desconocido.' };

	const slots = await availableSlots(d, v.date, v.services);
	if (!slots.includes(v.time)) {
		return { ok: false, status: 409, error: 'Ese horario se acaba de ocupar. Elige otro, por favor.' };
	}

	// Límites contra abuso: en total, por celular (solo dígitos) y por correo (sin mayúsculas)
	const now = d.now();
	const pendientes = await pendientesVigentes(d, now);
	if (pendientes.length >= booking.maxPendingTotal) {
		return {
			ok: false,
			status: 429,
			error: 'Hay muchas solicitudes en espera. Intenta de nuevo en un rato.',
		};
	}
	const tel = digitos(v.phone);
	const correo = correoNormal(v.email);
	const max = booking.maxPendingPerContact;
	const delMismoCelular = pendientes.filter((r) => digitos(r.phone) === tel).length;
	const delMismoCorreo = pendientes.filter((r) => correoNormal(r.email) === correo).length;
	if (delMismoCelular >= max || delMismoCorreo >= max) {
		return {
			ok: false,
			status: 429,
			error: `Ya tienes ${max} solicitudes en espera. Espera la respuesta antes de pedir otra.`,
		};
	}

	const r: BookingRequest = {
		id: d.newId(),
		...v,
		durationMin,
		status: 'pending',
		createdAt: now.toISOString(),
		expiresAt: expiryDeadline(now).toISOString(),
	};
	await d.store.put(r);

	const approveUrl = `${d.siteUrl.replace(/\/+$/, '')}/aprobar?id=${encodeURIComponent(r.id)}`;
	await enviar(d, d.jessicaEmail, emailForJessica(r, approveUrl), r.id);
	return { ok: true, id: r.id };
}

export async function getRequest(d: Deps, id: string): Promise<BookingRequest | null> {
	const r = await d.store.get(id);
	if (!r) return null;
	if (r.status === 'pending' && vencida(r, d.now())) return (await vencer(d, r)).request;
	return r;
}

// ¿Sigue libre el horario de r? Se vuelve a consultar el calendario y las pendientes anteriores
async function horarioLibre(d: Deps, r: BookingRequest, now: Date): Promise<boolean> {
	const propio = slotInterval(r.date, r.time, r.durationMin + booking.bufferMin);
	const eventos = await d.calendar.busy(propio.start, propio.end);
	if (eventos.some((e) => choca(e, propio))) return false;

	const antes = (o: BookingRequest) =>
		o.createdAt < r.createdAt || (o.createdAt === r.createdAt && o.id < r.id);
	return !(await pendientesVigentes(d, now)).some(
		(o) => o.id !== r.id && antes(o) && choca(slotInterval(o.date, o.time, o.durationMin), propio),
	);
}

export async function decide(
	d: Deps,
	id: string,
	action: 'approve' | 'reject',
): Promise<{ ok: true; request: BookingRequest } | Fail<404 | 409>> {
	const r = await d.store.get(id);
	if (!r) return { ok: false, status: 404, error: 'No encontramos esa solicitud.' };
	if (r.status !== 'pending') return { ok: false, status: 409, error: MENSAJE_ESTADO[r.status] };

	const now = d.now();
	if (vencida(r, now)) {
		await vencer(d, r);
		return { ok: false, status: 409, error: MENSAJE_ESTADO.expired };
	}

	if (action === 'reject') return { ok: true, request: await rechazar(d, r, now) };

	if (!(await horarioLibre(d, r, now))) {
		// No se puede agendar: se cierra para que no siga bloqueando y se avisa a la clienta
		await rechazar(d, r, now);
		return {
			ok: false,
			status: 409,
			error: 'Ese horario ya está ocupado. La solicitud no se aprobó y se le avisó a la clienta.',
		};
	}

	// Primero el evento; el estado solo cambia si el evento existe. Si createEvent falla, se propaga.
	const eventId = await d.calendar.createEvent(r);
	const aprobada: BookingRequest = {
		...r,
		status: 'approved',
		eventId,
		decidedAt: now.toISOString(),
	};
	await d.store.put(aprobada);
	await enviar(d, r.email, emailForClient(aprobada, 'approved'), r.id);
	return { ok: true, request: aprobada };
}

export async function expireDue(d: Deps): Promise<number> {
	const now = d.now();
	let n = 0;
	for (const r of await d.store.listPending()) {
		if (!vencida(r, now)) continue;
		if ((await vencer(d, r)).vencio) n++;
	}
	return n;
}
