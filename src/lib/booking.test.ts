import { describe, it, expect } from 'vitest';
import { totalDuration, slotInterval, computeSlots, formatDuration } from './booking';

const now = new Date('2026-11-02T08:00:00-05:00'); // lunes
const iv = (s: string, e: string) => ({ start: new Date(s), end: new Date(e) });

describe('computeSlots', () => {
	it('lunes libre: 09:00 a 17:00, 17 horarios', () => {
		const r = computeSlots({ date: '2026-11-09', durationMin: 60, busy: [], now });
		expect(r[0]).toBe('09:00');
		expect(r[r.length - 1]).toBe('17:00');
		expect(r).toHaveLength(17);
	});

	it('domingo, formato inválido, fecha inexistente, pasada y lejana devuelven []', () => {
		const p = { durationMin: 60, busy: [], now };
		expect(computeSlots({ ...p, date: '2026-11-08' })).toEqual([]);
		expect(computeSlots({ ...p, date: '09/11/2026' })).toEqual([]);
		expect(computeSlots({ ...p, date: '2026-02-30' })).toEqual([]);
		expect(computeSlots({ ...p, date: '2026-10-26' })).toEqual([]);
		expect(computeSlots({ ...p, date: '2026-12-10' })).toEqual([]);
	});

	it('mismo día respeta 3 h de anticipación', () => {
		const r = computeSlots({ date: '2026-11-02', durationMin: 60, busy: [], now });
		expect(r[0]).toBe('11:00');
	});

	it('ocupado 10:00-11:00 con servicio de 60 min', () => {
		const busy = [iv('2026-11-09T10:00:00-05:00', '2026-11-09T11:00:00-05:00')];
		const r = computeSlots({ date: '2026-11-09', durationMin: 60, busy, now });
		expect(r).not.toContain('09:30');
		expect(r).not.toContain('10:00');
		expect(r).not.toContain('10:30');
		expect(r).toContain('09:00');
		expect(r).toContain('11:00');
	});

	it('servicio de 120 min antes de un ocupado', () => {
		const busy = [iv('2026-11-09T12:00:00-05:00', '2026-11-09T13:00:00-05:00')];
		const r = computeSlots({ date: '2026-11-09', durationMin: 120, busy, now });
		expect(r).not.toContain('10:30');
		expect(r).toContain('10:00');
	});

	it('evento de todo el día bloquea todo', () => {
		const busy = [iv('2026-11-09T00:00:00-05:00', '2026-11-10T00:00:00-05:00')];
		expect(computeSlots({ date: '2026-11-09', durationMin: 30, busy, now })).toEqual([]);
	});

	it('evento que cruza medianoche bloquea la mañana siguiente', () => {
		const busy = [iv('2026-11-08T22:00:00-05:00', '2026-11-09T10:00:00-05:00')];
		const r = computeSlots({ date: '2026-11-09', durationMin: 30, busy, now });
		expect(r).not.toContain('09:00');
		expect(r).not.toContain('09:30');
		expect(r).toContain('10:00');
	});

	it('permite empezar a las 17:00 aunque termine tarde', () => {
		expect(computeSlots({ date: '2026-11-09', durationMin: 120, busy: [], now })).toContain('17:00');
		expect(computeSlots({ date: '2026-11-09', durationMin: 180, busy: [], now })).toContain('17:00');
	});
});

describe('totalDuration', () => {
	it('suma, o null si vacío o desconocido', () => {
		expect(totalDuration(['Semipermanente', 'Nail art'])).toBe(90);
		expect(totalDuration([])).toBeNull();
		expect(totalDuration(['X'])).toBeNull();
	});
});

describe('slotInterval', () => {
	it('interpreta en -05:00', () => {
		const i = slotInterval('2026-11-09', '09:00', 60);
		expect(i.start.toISOString()).toBe('2026-11-09T14:00:00.000Z');
		expect(i.end.toISOString()).toBe('2026-11-09T15:00:00.000Z');
	});
});

describe('formatDuration', () => {
	it('formatea', () => {
		expect(formatDuration(45)).toBe('45 min');
		expect(formatDuration(90)).toBe('1 h 30 min');
		expect(formatDuration(120)).toBe('2 h');
	});
});
