// Fakes en memoria para pruebas: se comportan como los adaptadores reales
import type { Interval } from '../../src/lib/booking';
import type { BookingRequest, CalendarPort, Deps, Mailer, RequestStore } from './types';

export class MemoryStore implements RequestStore {
	readonly data = new Map<string, BookingRequest>();
	async put(r: BookingRequest): Promise<void> {
		// Copia para que nadie modifique lo guardado por referencia
		this.data.set(r.id, structuredClone(r));
	}
	async get(id: string): Promise<BookingRequest | null> {
		const r = this.data.get(id);
		return r ? structuredClone(r) : null;
	}
	async listPending(): Promise<BookingRequest[]> {
		return [...this.data.values()].filter((r) => r.status === 'pending').map((r) => structuredClone(r));
	}
}

export class MemoryCalendar implements CalendarPort {
	readonly events: Interval[] = [];
	readonly created: BookingRequest[] = [];
	readonly busyCalls: { from: Date; to: Date }[] = [];
	fail = false;
	private seq = 0;
	async busy(from: Date, to: Date): Promise<Interval[]> {
		this.busyCalls.push({ from, to });
		// Solo los intervalos que se cruzan con el rango [from, to)
		return this.events
			.filter((e) => e.start.getTime() < to.getTime() && from.getTime() < e.end.getTime())
			.map((e) => ({ start: new Date(e.start), end: new Date(e.end) }));
	}
	async createEvent(r: BookingRequest): Promise<string> {
		if (this.fail) throw new Error('calendario caído');
		this.created.push(structuredClone(r));
		const end = new Date(new Date(`${r.date}T${r.time}:00-05:00`).getTime() + r.durationMin * 60_000);
		this.events.push({ start: new Date(`${r.date}T${r.time}:00-05:00`), end });
		return `evt-${++this.seq}`;
	}
}

export class MemoryMailer implements Mailer {
	readonly sent: { to: string; subject: string; text: string }[] = [];
	fail = false;
	async send(m: { to: string; subject: string; text: string }): Promise<void> {
		if (this.fail) throw new Error('smtp caído');
		this.sent.push({ ...m });
	}
}

export function fakeDeps(now: Date) {
	let clock = now;
	let n = 0;
	const store = new MemoryStore();
	const calendar = new MemoryCalendar();
	const mailer = new MemoryMailer();
	const deps: Deps = {
		store,
		calendar,
		mailer,
		now: () => new Date(clock),
		newId: () => `req-${++n}`,
		jessicaEmail: 'jessica@correo.com',
		siteUrl: 'https://sitio.co/',
	};
	return {
		deps,
		store,
		calendar,
		mailer,
		setNow: (d: Date) => {
			clock = d;
		},
	};
}
