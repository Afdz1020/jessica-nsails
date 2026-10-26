import { createRequest } from '../lib/requests';
import { guard, json, methodNotAllowed, readJsonObject } from '../lib/http';
import type { Deps } from '../lib/types';

export async function handle(req: Request, d: Deps): Promise<Response> {
	if (req.method !== 'POST') return methodNotAllowed('POST');
	const body = await readJsonObject(req);
	if (!body.ok) return body.response;
	const r = await createRequest(d, body.value);
	// Nunca devolver el id: es la credencial de aprobación y solo la conoce el correo de Jessica
	return r.ok ? json(201, { ok: true }) : json(r.status, { error: r.error });
}

export default (req: Request) => guard(req, handle);

export const config = { path: '/api/request' };
