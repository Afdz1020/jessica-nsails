import { services as catalogo } from '../../src/data/site';

export type ParsedInput = {
	name: string;
	phone: string;
	email: string;
	services: string[];
	date: string;
	time: string;
};

export type ParseResult = { ok: true; value: ParsedInput } | { ok: false; error: string };

const MAX = 100;
const MIN_DIGITOS = 7;

const fail = (error: string): ParseResult => ({ ok: false, error });

// Devuelve el texto recortado, o null si no es string
const texto = (v: unknown): string | null => (typeof v === 'string' ? v.trim() : null);

// Comprueba que la fecha exista en el calendario (rechaza 2026-13-45, 2026-02-30)
const fechaValida = (s: string): boolean => {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return false;
	const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
	const dt = new Date(Date.UTC(y, mo - 1, d));
	return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
};

export function parseRequestInput(raw: unknown): ParseResult {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return fail('Solicitud inválida.');
	}
	const r = raw as Record<string, unknown>;

	// Campo trampa: los humanos no lo ven ni lo llenan
	if (r.website !== undefined && r.website !== null && r.website !== '') {
		return fail('Solicitud inválida.');
	}

	const name = texto(r.name);
	if (!name) return fail('Escribe tu nombre.');
	if (name.length > MAX) return fail('El nombre es demasiado largo (máximo 100 caracteres).');

	const phone = texto(r.phone);
	if (!phone) return fail('Escribe tu celular.');
	if (phone.length > MAX) return fail('El celular es demasiado largo (máximo 100 caracteres).');
	if (phone.replace(/\D/g, '').length < MIN_DIGITOS) {
		return fail('El celular debe tener al menos 7 dígitos.');
	}

	const email = texto(r.email);
	if (!email) return fail('Escribe tu correo.');
	if (email.length > MAX) return fail('El correo es demasiado largo (máximo 100 caracteres).');
	if (!/^[^\s@]+@[^\s@]+$/.test(email)) return fail('El correo no es válido.');

	if (!Array.isArray(r.services) || r.services.length === 0) {
		return fail('Elige al menos un servicio.');
	}
	const conocidos = new Set<string>(catalogo.map((s) => s.name));
	const servicios: string[] = [];
	for (const s of r.services) {
		if (typeof s !== 'string') return fail('Servicio inválido.');
		const limpio = s.trim();
		if (limpio.length > MAX || !conocidos.has(limpio)) return fail('Servicio desconocido.');
		// Sin duplicados
		if (!servicios.includes(limpio)) servicios.push(limpio);
	}

	const date = texto(r.date);
	if (!date || !fechaValida(date)) return fail('La fecha no es válida.');

	const time = texto(r.time);
	if (!time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail('La hora no es válida.');

	return { ok: true, value: { name, phone, email, services: servicios, date, time } };
}
