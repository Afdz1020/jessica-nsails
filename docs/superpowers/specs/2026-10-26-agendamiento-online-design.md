# Agendamiento online con Google Calendar — Diseño

Fecha: 2026-10-26
Sitio: https://jsdiaznsails.netlify.app/ (Astro 7, estático, publicado en Netlify)

## Intención y por qué

Jessica atiende sola y hoy agenda a mano: cuando una clienta le escribe, revisa su Google Calendar y le responde. Quiere compartir un link y que cualquier persona pueda pedir su cita sin escribirle primero, viendo solo los horarios realmente disponibles. Jessica conserva el control: ninguna cita queda confirmada sin su aprobación.

El formulario actual (`src/components/Agendar.astro`) solo arma un mensaje de WhatsApp que la clienta debe enviar; no consulta disponibilidad ni guarda nada.

## Objetivos

- Cualquier persona con el link agenda una solicitud de cita desde la página.
- Los horarios mostrados salen de la agenda real de Jessica en Google Calendar.
- Jessica recibe un aviso por WhatsApp por cada solicitud y la aprueba o rechaza.
- Al aprobar, la cita aparece en su Google Calendar.
- Los horarios en espera de aprobación no se pueden pedir por otra clienta.

## No objetivos

- Pagos o anticipos en línea.
- Cuentas de usuario para las clientas.
- Varias profesionales o varios calendarios (Jessica atiende sola).
- Reagendar o cancelar desde la página.
- Implementar el aviso automático por WhatsApp en esta primera entrega (solo se analiza, ver sección WhatsApp).

## Anti-objetivos (sería un fracaso aunque funcione)

- Que dos clientas queden con el mismo horario.
- Que se confirme una cita sin que Jessica la haya aprobado.
- Que la página muestre horarios ocupados, o que oculte horarios que sí están libres.
- Que las credenciales de Google queden expuestas en el navegador o en el repositorio.

## Reglas de negocio (decididas por Jessica)

**Calendario.** Un calendario de Google dedicado solo al trabajo. Cualquier evento en él cuenta como espacio ocupado.

**Servicios y duraciones.**

| Servicio | Duración |
|---|---|
| Manicure tradicional | 45 min |
| Semipermanente | 1 h |
| Acrílicas | 2 h |
| Polygel | 1 h 30 min |
| Pedicure spa | 1 h |
| Nail art | 30 min |

La clienta puede elegir varios servicios en la misma solicitud; la duración de la cita es la suma. Estas duraciones viven en `src/data/site.ts` junto a los servicios.

**Horarios ofrecidos.**
- Lunes a sábado. Los domingos no se pueden reservar desde el link.
- Ventana de reserva: solo citas que empiecen con al menos **3 horas de anticipación**, y hasta **30 días** hacia adelante (el máximo se definirá más adelante; debe ser una constante configurable).
- Inicios cada 30 minutos, desde las 9:00 a.m. hasta las 5:00 p.m. como última hora de inicio.
- La cita puede terminar después de las 7:00 p.m. si el servicio es largo.
- Un inicio se ofrece solo si el servicio completo cabe en un espacio libre.
- Sin margen entre citas por ahora (debe ser un ajuste de una sola constante).

**Aprobación.**
- Una solicitud queda "en espera" y su horario se bloquea para otras clientas.
- Jessica recibe un aviso con el enlace de aprobación. En la primera versión es **por correo** (temporal); el objetivo final es WhatsApp (ver sección WhatsApp). Puede llegar a cualquier hora del día, menos de noche.
- Jessica tiene 2 horas para aprobar o rechazar. Si no responde, la solicitud expira y el horario se libera.
- Si la solicitud llega de noche, las 2 horas empiezan a contar a las 8:00 a.m. del día siguiente (**mi suposición**; Jessica no fijó la hora exacta). La hora de corte nocturna tampoco la fijó: **mi suposición** es 8:00 p.m. a 8:00 a.m.
- Aprobada: se crea el evento en Google Calendar. Rechazada o expirada: el horario se libera.
- La clienta recibe el resultado **por correo**: aprobada, rechazada o vencida. La página no confirma nada por su cuenta. (Interpretación mía de "la clienta recibe aviso por correo": el formulario pide su correo y se le escribe en esos tres casos. Jessica puede además escribirle por WhatsApp si quiere.)

## Arquitectura propuesta (decisión mía, no acordada)

Netlify ya hospeda el sitio, así que se usan sus funciones de servidor en lugar de cambiar de plataforma.

- **Frontend:** el formulario de `Agendar.astro` pasa a seleccionar uno o varios servicios, fecha y horario. Pide los horarios libres a un endpoint.
- **Servidor:** funciones de Netlify (o el adaptador de Netlify para Astro) con tres tareas:
  1. Calcular disponibilidad: leer eventos del calendario con la API de Google Calendar (consulta de ocupado/libre) y restar las solicitudes en espera.
  2. Registrar una solicitud en espera.
  3. Aprobar, rechazar y expirar solicitudes.
- **Credenciales:** cuenta de servicio de Google con acceso al calendario de Jessica, guardada como variables de entorno en Netlify. Nunca en el cliente ni en el repositorio.
- **Estado de solicitudes en espera:** necesitan almacenamiento persistente (Netlify Blobs es la opción natural). Alternativa: guardarlas como eventos "tentativos" en el propio calendario, lo que evita otra base de datos. Se deja al constructor, con la restricción de que las dos reglas anti-doble-reserva deben cumplirse.
- **Aprobar/rechazar:** un enlace seguro (con token no adivinable) que Jessica abre desde el aviso de WhatsApp y le muestra la solicitud con botones Aprobar y Rechazar.
- **Expiración:** una tarea programada (Netlify scheduled function) o comprobación al consultar disponibilidad, que libere solicitudes vencidas.
- **Zona horaria:** America/Bogota para todo cálculo de horarios y del corte nocturno.

## WhatsApp (solo análisis; implementación posterior)

Se necesita que llegue un aviso a Jessica sin que ella haga nada. Opciones a evaluar en la fase de análisis:

1. **WhatsApp Business Platform (API oficial de Meta):** mensajes automáticos con plantilla aprobada, con botones de respuesta. Exige cuenta de negocio verificada, número dedicado y tiene costo por conversación.
2. **Proveedor intermedio** (por ejemplo Twilio u otro): menos trámite técnico, costo adicional.
3. **Primera entrega (decidido por Jessica):** aviso por correo a Jessica con el enlace de aprobación, y correo a la clienta con el resultado. El WhatsApp automático se agrega después.

El diseño debe aislar el envío de avisos detrás de una función (`notificarJessica`) para cambiar de canal sin tocar el resto.

El resultado de este análisis (costos, requisitos, recomendación) se entrega antes de implementar.

## Datos que se recogen de la clienta

Nombre, celular, correo, servicios, fecha y hora. Se guardan solo mientras la solicitud está en espera y en el evento aprobado. Se debe validar en el servidor (el cliente no es de confianza), y limitar solicitudes repetidas para evitar abuso del link.

## Decisiones del autor (a revisar por Jessica)

Son llamadas mías tras la revisión; no las dijo Jessica.

- **Aprobación tardía:** si Jessica abre el enlace con la solicitud ya expirada, rechazada o con el horario ocupado, no se aprueba. Se le muestra el estado. Antes de crear el evento siempre se vuelve a consultar el calendario.
- **Aviso a la clienta (corregido por Jessica):** recibe correo cuando su solicitud se aprueba, se rechaza o vence. Al enviar, la página le dice que recibirá la respuesta por correo.
- **Eventos del calendario:** cualquier evento cuenta como ocupado, incluidos los de todo el día. Así Jessica cierra un día o vacaciones creando un evento en ese calendario.
- **Solicitudes en espera:** no aparecen en el calendario de Jessica; se guardan aparte (Netlify Blobs) y se descuentan de la disponibilidad. La comprobación final contra el calendario al aprobar cubre la carrera entre solicitudes simultáneas.
- **Evento creado:** título "Nombre – servicios"; el celular y los servicios van en la descripción.
- **Sitio:** se mantiene estático y se añaden funciones de Netlify (sin el adaptador SSR), para no alterar el sitio ya publicado.

## Pendiente de datos

- Correo temporal de Jessica para recibir las solicitudes: hallpipe10@gmail.com (se cambiará después; debe ser una variable de entorno, no estar escrito en el código).
- Remitente y servicio de envío de correos (por ejemplo Resend o similar): lo propone el constructor.

## Lo que queda al constructor

- Almacenamiento de solicitudes en espera (Blobs, eventos tentativos u otro).
- Detalles de la interfaz de selección de múltiples servicios.
- Forma exacta del enlace de aprobación y su vencimiento.
- Mecanismo de expiración.
- Protección contra abuso (límite de solicitudes, campo trampa u otro).
- Pruebas y estructura de archivos, siguiendo el estilo actual del proyecto.
