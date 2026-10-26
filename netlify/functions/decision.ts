import { decide, getRequest } from '../lib/requests';
import { guard, json, methodNotAllowed, publicRequest, readJsonObject } from '../lib/http';
import type { Deps } from '../lib/types';

export async function handle(req: Request, d: Deps): Promise<Response> {
	if (req.method === 'GET') {
		const id = new URL(req.url).searchParams.get('id');
		if (!id) return json(400, { error: 'Falta el id.' });
		const r = await getRequest(d, id);
		if (!r) return json(404, { error: 'No encontramos esa solicitud.' });
		return json(200, { request: publicRequest(r) });
	}
	if (req.method === 'POST') {
		const body = await readJsonObject(req);
		if (!body.ok) return body.response;
		const { id, action } = body.value;
		if (typeof id !== 'string' || !id) return json(400, { error: 'Falta el id.' });
		if (action !== 'approve' && action !== 'reject') {
			return json(400, { error: 'Acción no válida.' });
		}
		const r = await decide(d, id, action);
		return r.ok ? json(200, { request: publicRequest(r.request) }) : json(r.status, { error: r.error });
	}
	return methodNotAllowed('GET, POST');
}

export default (req: Request) => guard(req, handle);

export const config = { path: '/api/decision' };
