import type { BookingRequest, Deps } from './types';
import { realDeps } from './adapters';

export const MAX_BODY_BYTES = 10 * 1024;

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			...headers,
		},
	});
}

export const methodNotAllowed = (allow: string): Response =>
	json(405, { error: 'Método no permitido' }, { allow });

type Body = { ok: true; value: Record<string, unknown> } | { ok: false; response: Response };

// Lee el cuerpo JSON con tope de tamaño (también si no trae content-length) y exige un objeto
export async function readJsonObject(req: Request): Promise<Body> {
	const tooBig = { ok: false as const, response: json(413, { error: 'Solicitud demasiado grande' }) };
	const declared = Number(req.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return tooBig;

	let text = '';
	if (req.body) {
		const reader = req.body.getReader();
		const decoder = new TextDecoder();
		let total = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > MAX_BODY_BYTES) {
				await reader.cancel();
				return tooBig;
			}
			text += decoder.decode(value, { stream: true });
		}
		text += decoder.decode();
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, response: json(400, { error: 'El cuerpo debe ser JSON válido.' }) };
	}
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return { ok: false, response: json(400, { error: 'El cuerpo debe ser un objeto JSON.' }) };
	}
	return { ok: true, value: parsed as Record<string, unknown> };
}

// Solo lo que necesita la página de aprobación: sin celular, correo, id ni evento
export function publicRequest(r: BookingRequest) {
	return {
		name: r.name,
		services: r.services,
		date: r.date,
		time: r.time,
		durationMin: r.durationMin,
		status: r.status,
	};
}

// Cualquier error inesperado (incluidas variables de entorno faltantes) → 500 genérico
export async function guard(
	req: Request,
	handle: (req: Request, d: Deps) => Promise<Response>,
	makeDeps: () => Deps = realDeps,
): Promise<Response> {
	try {
		return await handle(req, makeDeps());
	} catch (e) {
		console.error('Error en la función:', e);
		return json(500, { error: 'Error interno' });
	}
}
