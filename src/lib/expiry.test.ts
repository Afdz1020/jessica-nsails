import { describe, it, expect } from 'vitest';
import { expiryDeadline } from './expiry';

const at = (s: string) => new Date(`${s}-05:00`);
const cases: [string, string, string][] = [
	['10:00 mismo día', '2026-11-02T10:00:00', '2026-11-02T12:00:00'],
	['18:00 llega justo a las 20:00', '2026-11-02T18:00:00', '2026-11-02T20:00:00'],
	['19:30 vence 09:30 del día siguiente', '2026-11-02T19:30:00', '2026-11-03T09:30:00'],
	['21:00 vence 10:00 del día siguiente', '2026-11-02T21:00:00', '2026-11-03T10:00:00'],
	['03:00 vence 10:00 del mismo día', '2026-11-02T03:00:00', '2026-11-02T10:00:00'],
	['08:00 vence 10:00', '2026-11-02T08:00:00', '2026-11-02T10:00:00'],
];

describe('expiryDeadline', () => {
	for (const [name, created, expected] of cases) {
		it(name, () => {
			expect(expiryDeadline(at(created)).toISOString()).toBe(at(expected).toISOString());
		});
	}

	it('cruza fin de mes', () => {
		expect(expiryDeadline(at('2026-11-30T19:30:00')).toISOString()).toBe(
			at('2026-12-01T09:30:00').toISOString(),
		);
	});

	it('respeta holdMin personalizado y varios días', () => {
		// 12 h de reloj diurno completo: 08:00 -> 20:00
		expect(expiryDeadline(at('2026-11-02T08:00:00'), 720).toISOString()).toBe(
			at('2026-11-02T20:00:00').toISOString(),
		);
		expect(expiryDeadline(at('2026-11-02T08:00:00'), 780).toISOString()).toBe(
			at('2026-11-03T09:00:00').toISOString(),
		);
	});
});
