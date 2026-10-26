import type { Interval } from '../../src/lib/booking';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// Fechas en formato ISO
export interface BookingRequest {
	id: string;
	name: string;
	phone: string;
	email: string;
	services: string[];
	date: string;
	time: string;
	durationMin: number;
	status: RequestStatus;
	createdAt: string;
	expiresAt: string;
	decidedAt?: string;
	eventId?: string;
}

export interface RequestStore {
	put(r: BookingRequest): Promise<void>;
	get(id: string): Promise<BookingRequest | null>;
	listPending(): Promise<BookingRequest[]>;
}

export interface CalendarPort {
	busy(from: Date, to: Date): Promise<Interval[]>;
	createEvent(r: BookingRequest): Promise<string>;
}

export interface Mailer {
	send(m: { to: string; subject: string; text: string }): Promise<void>;
}

export interface Deps {
	store: RequestStore;
	calendar: CalendarPort;
	mailer: Mailer;
	now: () => Date;
	newId: () => string;
	jessicaEmail: string;
	siteUrl: string;
}
