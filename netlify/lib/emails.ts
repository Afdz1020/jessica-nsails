import { formatDuration } from '../../src/lib/booking';
import type { BookingRequest } from './types';

type Email = { subject: string; text: string };

// Quita saltos de línea para evitar inyección de cabeceras
const linea = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

// Fecha legible, anclada al mediodía de Bogotá para que el día no cambie con la zona de la máquina
function fechaLegible(date: string): string {
	return new Date(`${date}T12:00:00-05:00`).toLocaleDateString('es-CO', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: 'America/Bogota',
	});
}

// 'HH:MM' -> '10:00 a.m.' / '3:00 p.m.'
function horaLegible(time: string): string {
	const [h, m] = time.split(':').map(Number);
	const h12 = h % 12 === 0 ? 12 : h % 12;
	return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
}

export function emailForJessica(r: BookingRequest, approveUrl: string): Email {
	const fecha = fechaLegible(r.date);
	const hora = horaLegible(r.time);
	return {
		subject: linea(`Nueva solicitud de cita: ${r.name} - ${fecha} ${hora}`),
		text: [
			'Hola Jessica,',
			'',
			'Tienes una nueva solicitud de cita:',
			'',
			`Nombre: ${r.name}`,
			`Celular: ${r.phone}`,
			`Correo: ${r.email}`,
			`Servicios: ${r.services.join(', ')}`,
			`Fecha: ${fecha}`,
			`Hora: ${hora}`,
			`Duración total: ${formatDuration(r.durationMin)}`,
			'',
			'Para aprobarla y agendarla en tu calendario, abre este enlace:',
			approveUrl,
			'',
			'Si no la aprobaste a tiempo, la solicitud vence sola y le avisamos a la clienta.',
		].join('\n'),
	};
}

export function emailForClient(
	r: BookingRequest,
	outcome: 'approved' | 'rejected' | 'expired',
): Email {
	if (outcome === 'approved') {
		return {
			subject: 'Tu cita está confirmada - JessicaDiaznails',
			text: [
				`Hola ${r.name},`,
				'',
				'¡Tu cita quedó confirmada! Te esperamos con mucho gusto.',
				'',
				`Fecha: ${fechaLegible(r.date)}`,
				`Hora: ${horaLegible(r.time)}`,
				`Servicios: ${r.services.join(', ')}`,
				'',
				'Un abrazo,',
				'JessicaDiaznails',
			].join('\n'),
		};
	}
	const motivo =
		outcome === 'rejected'
			? 'Lamentablemente no pudimos confirmar la cita que solicitaste.'
			: 'No alcanzamos a confirmar la cita que solicitaste a tiempo.';
	return {
		subject: 'Sobre tu solicitud de cita - JessicaDiaznails',
		text: [
			`Hola ${r.name},`,
			'',
			motivo,
			'',
			'Te invitamos a elegir otro horario en nuestro sitio web, con gusto te atendemos.',
			'',
			'Un abrazo,',
			'JessicaDiaznails',
		].join('\n'),
	};
}
