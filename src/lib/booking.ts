import { services, booking, type BookingConfig } from '../data/site';

export type Interval = { start: Date; end: Date };

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// Convierte '-05:00' a minutos (-300)
const offsetMinutes = (offset: string): number => {
	const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
	if (!m) return 0;
	return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
};

const toMinutes = (hhmm: string): number => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function totalDuration(names: string[]): number | null {
	if (names.length === 0) return null;
	let total = 0;
	for (const name of names) {
		const s = services.find((x) => x.name === name);
		if (!s) return null;
		total += s.duration;
	}
	return total;
}

export function slotInterval(
	date: string,
	time: string,
	durationMin: number,
	config: BookingConfig = booking,
): Interval {
	const start = new Date(`${date}T${time}:00${config.utcOffset}`);
	return { start, end: new Date(start.getTime() + durationMin * MIN) };
}

// Valida que la fecha YYYY-MM-DD sea un día real del calendario
const isRealDate = (date: string, config: BookingConfig): boolean => {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const t = new Date(`${date}T00:00:00${config.utcOffset}`).getTime();
	if (Number.isNaN(t)) return false;
	return localDate(t, config) === date;
};

// Fecha YYYY-MM-DD de un instante en la zona configurada
const localDate = (t: number, config: BookingConfig): string => {
	const d = new Date(t + offsetMinutes(config.utcOffset) * MIN);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export function computeSlots(p: {
	date: string;
	durationMin: number;
	busy: Interval[];
	now: Date;
	config?: BookingConfig;
}): string[] {
	const config = p.config ?? booking;
	if (!isRealDate(p.date, config)) return [];

	const midnight = new Date(`${p.date}T00:00:00${config.utcOffset}`).getTime();
	const weekday = new Date(midnight + offsetMinutes(config.utcOffset) * MIN).getUTCDay();
	if (config.closedWeekdays.includes(weekday)) return [];

	const earliest = p.now.getTime() + config.minLeadHours * HOUR;
	const latest = p.now.getTime() + config.maxDaysAhead * DAY;

	const slots: string[] = [];
	const first = toMinutes(config.openTime);
	const last = toMinutes(config.lastStartTime);
	for (let m = first; m <= last; m += config.stepMin) {
		const time = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
		const { start, end } = slotInterval(p.date, time, p.durationMin + config.bufferMin, config);
		if (start.getTime() < earliest || start.getTime() > latest) continue;
		// Intervalos [inicio, fin): eventos contiguos no chocan
		const conflict = p.busy.some(
			(b) => start.getTime() < b.end.getTime() && b.start.getTime() < end.getTime(),
		);
		if (!conflict) slots.push(time);
	}
	return slots;
}

export function formatDuration(min: number): string {
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
