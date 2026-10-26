import { availableSlots } from '../lib/requests';
import { guard, json, methodNotAllowed } from '../lib/http';
import type { Deps } from '../lib/types';

export async function handle(req: Request, d: Deps): Promise<Response> {
	if (req.method !== 'GET') return methodNotAllowed('GET');
	const url = new URL(req.url);
	const date = url.searchParams.get('date') ?? '';
	const services = (url.searchParams.get('services') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	// Entradas vacías o inválidas no son un error: simplemente no hay horarios
	if (!date || services.length === 0) return json(200, { slots: [] });
	return json(200, { slots: await availableSlots(d, date, services) });
}

export default (req: Request) => guard(req, handle);

export const config = { path: '/api/availability' };
