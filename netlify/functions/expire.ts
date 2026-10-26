import { expireDue } from '../lib/requests';
import { guard, json } from '../lib/http';
import type { Deps } from '../lib/types';

export async function handle(_req: Request, d: Deps): Promise<Response> {
	return json(200, { expired: await expireDue(d) });
}

export default (req: Request) => guard(req, handle);

export const config = { schedule: '*/15 * * * *' };
