// Vencimiento de solicitudes pendientes: el reloj solo corre de 08:00 a 20:00
// hora de Bogotá (UTC−5 fijo, sin horario de verano).
const OFFSET_MIN = -300;
const DAY_START = 8 * 60;
const DAY_END = 20 * 60;
const MIN = 60_000;
const DAY = 86_400_000;

export function expiryDeadline(createdAt: Date, holdMin = 120): Date {
	// Instante desplazado: sus getters UTC equivalen a la hora local de Bogotá
	const local = createdAt.getTime() + OFFSET_MIN * MIN;
	const dayStart = Math.floor(local / DAY) * DAY;
	let day = dayStart;
	// Minutos transcurridos desde la medianoche local, ajustados al tramo diurno
	let cursor = Math.min(Math.max((local - dayStart) / MIN, DAY_START), DAY_END);
	if (local - dayStart >= DAY_END * MIN) {
		day += DAY;
		cursor = DAY_START;
	}
	let remaining = holdMin;
	while (remaining > DAY_END - cursor) {
		remaining -= DAY_END - cursor;
		day += DAY;
		cursor = DAY_START;
	}
	return new Date(day + (cursor + remaining) * MIN - OFFSET_MIN * MIN);
}
