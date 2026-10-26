// Contenido y ajustes del sitio. Edita aquí precios, horarios y contacto.

export const settings = {
  /** Encaja cada sección al hacer scroll (scroll-snap). */
  scrollSnap: true,
  /** Animación de aparición al hacer scroll: 'Subir' | 'Desvanecer' | 'Zoom'. */
  revealStyle: 'Subir' as 'Subir' | 'Desvanecer' | 'Zoom',
};

export const contact = {
  whatsapp: '573212257751',
  whatsappLabel: '+57 321 225 7761',
  email: 'hola@jessicadiaznails.com',
  instagram: 'jessicadiaznails',
  address: ['Diagonal 44 # 29-49, ', 'Itagui, Colombia'],
  hours: ['Lun – Sáb · 9:00 a.m. – 7:00 p.m.', 'Dom · con cita previa'],
};

export const services = [
  {
    name: 'Manicure tradicional',
    desc: 'Limado, cutícula, hidratación y esmalte',
    price: '$35.000',
    duration: 45, // minutos
  },
  {
    name: 'Semipermanente',
    desc: 'Color en gel con brillo hasta por 3 semanas',
    price: '$55.000',
    duration: 60, // minutos
  },
  {
    name: 'Uñas acrílicas',
    desc: 'Extensión y forma a tu gusto',
    price: '$120.000',
    duration: 120, // minutos
  },
  {
    name: 'Polygel',
    desc: 'Extensión liviana y resistente',
    price: '$110.000',
    duration: 90, // minutos
  },
  {
    name: 'Pedicure spa',
    desc: 'Exfoliación, masaje y esmalte',
    price: '$60.000',
    duration: 60, // minutos
  },
  {
    name: 'Nail art',
    desc: 'Diseños a mano alzada, por uña',
    price: 'desde $10.000',
    duration: 30, // minutos
  },
];

/** Reglas del agendamiento online. */
export const booking = {
  openTime: '09:00',
  lastStartTime: '17:00',
  stepMin: 30,
  minLeadHours: 3,
  maxDaysAhead: 30,
  bufferMin: 0,
  /** Días cerrados (0 = domingo). */
  closedWeekdays: [0],
  utcOffset: '-05:00',
  /** Máximo de solicitudes en espera (sin vencer) en total. */
  maxPendingTotal: 30,
  /** Máximo de solicitudes en espera por celular y por correo. */
  maxPendingPerContact: 3,
};

export type BookingConfig = typeof booking;

export const gallery = [
  'foto · semipermanente nude',
  'foto · nail art floral',
  'foto · acrílicas francesas',
  'foto · pedicure spa',
];

export const sections = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'nosotros', label: 'Nosotros' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'galeria', label: 'Galería' },
  { id: 'agendar', label: 'Agendar' },
  { id: 'contacto', label: 'Contacto' },
];
