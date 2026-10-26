# Agendamiento online con Google Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier clienta pida una cita desde el link del sitio viendo solo horarios libres de Google Calendar, y que Jessica la apruebe o rechace antes de que se cree el evento.

**Architecture:** El sitio Astro sigue estático. La lógica de horarios y vencimiento es código puro en `src/lib/` (probado con Vitest). Las funciones de Netlify en `netlify/functions/` son capas finas sobre un servicio con dependencias inyectadas (`netlify/lib/`): Google Calendar, Netlify Blobs y correo SMTP. Las solicitudes en espera viven en Blobs; el calendario solo recibe el evento al aprobar.

**Tech Stack:** Astro 7, TypeScript, Vitest, Netlify Functions v2 (`export default (req: Request) => Response`), `@netlify/blobs`, `@googleapis/calendar`, `nodemailer`.

**Spec:** `docs/superpowers/specs/2026-10-26-agendamiento-online-design.md`

## Global Constraints

- Servicios y duraciones: Manicure tradicional 45 min, Semipermanente 60, Uñas acrílicas 120, Polygel 90, Pedicure spa 60, Nail art 30. Varios servicios por solicitud; la duración es la suma.
- Lunes a sábado; domingos no se reservan desde el link.
- Inicios cada 30 min, de 09:00 a 17:00 (último inicio 17:00); la cita puede terminar después de las 19:00.
- Solo citas que empiecen con ≥ 3 h de anticipación y ≤ 30 días hacia adelante (`maxDaysAhead` configurable).
- Margen entre citas: 0 min, en una sola constante (`bufferMin`).
- Zona horaria America/Bogota (UTC−5 fijo, sin horario de verano). Se usa el offset `-05:00`.
- Solicitud en espera bloquea el horario; vence a las 2 h. Corte nocturno 20:00–08:00: el reloj de 2 h solo corre de 08:00 a 20:00 (decisión del autor, ver Task 3).
- Aviso a Jessica y a la clienta por **correo**; WhatsApp automático queda fuera de este plan.
- Correo de Jessica (temporal) `hallpipe10@gmail.com`: solo en la variable de entorno `JESSICA_EMAIL`, nunca en el código ni en git.
- Credenciales de Google y SMTP solo en variables de entorno de Netlify; jamás en el cliente ni en el repositorio.
- Textos de la interfaz y correos en español, tono del sitio. Código y comentarios siguen el estilo del repo (tabs, comentarios en español, sin dependencias de UI).
- Toda validación se repite en el servidor. Antes de crear un evento siempre se vuelve a consultar el calendario.

## Review Focus

1. Fecha pasada, domingo, con formato inválido o a más de 30 días → cero horarios, nunca error 500 (Task 2).
2. Lista de servicios vacía o con un nombre desconocido → 400, no se crea nada (Task 4).
3. Evento de todo el día o que cruza medianoche en el calendario → bloquea todos los horarios que toca (Task 2).
4. Aprobar dos veces, aprobar tras vencer o con el horario ya ocupado → no crea evento ni duplicado (Task 7).
5. Dos clientas piden el mismo horario casi a la vez → la segunda recibe 409 (Task 7).

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/data/site.ts` (modificar) | `duration` por servicio, objeto `booking` con las reglas |
| `src/lib/booking.ts` | Cálculo de duración y de horarios libres (puro) |
| `src/lib/expiry.ts` | Cálculo del vencimiento con corte nocturno (puro) |
| `netlify/lib/types.ts` | Tipos y puertos (`RequestStore`, `CalendarPort`, `Mailer`, `Deps`) |
| `netlify/lib/validate.ts` | Validación de la entrada de una solicitud |
| `netlify/lib/emails.ts` | Plantillas de correo (texto) |
| `netlify/lib/requests.ts` | Servicio: disponibilidad, crear, decidir, vencer |
| `netlify/lib/adapters.ts` | Implementaciones reales: Blobs, Google Calendar, SMTP; `realDeps()` |
| `netlify/functions/*.ts` | `availability`, `request`, `decision`, `expire` |
| `src/components/Agendar.astro` (modificar) | Formulario nuevo |
| `src/pages/aprobar.astro` | Página de Jessica para aprobar/rechazar |
| `netlify.toml`, `vitest.config.ts`, `README.md` | Configuración y guía de despliegue |

---

### Task 1: Tooling y reglas en `site.ts`

**Files:**
- Modify: `package.json`, `src/data/site.ts`
- Create: `vitest.config.ts`, `netlify.toml`

**Interfaces:**
- Produces: `services[i].duration: number` (minutos); `export const booking: BookingConfig` con
  `{ openTime: '09:00', lastStartTime: '17:00', stepMin: 30, minLeadHours: 3, maxDaysAhead: 30, bufferMin: 0, closedWeekdays: [0], utcOffset: '-05:00' }`; `export type BookingConfig = typeof booking`.

- [ ] **Step 1:** `npm i @netlify/blobs @googleapis/calendar nodemailer` y `npm i -D vitest @types/nodemailer`. Agregar script `"test": "vitest run"`.
- [ ] **Step 2:** `vitest.config.ts` con `test.include = ['src/**/*.test.ts', 'netlify/**/*.test.ts']`, entorno node.
- [ ] **Step 3:** `netlify.toml` con `[build] command = "npm run build"`, `publish = "dist"` y `[functions] directory = "netlify/functions"`.
- [ ] **Step 4:** Añadir `duration` a cada servicio de `services` con los valores de Global Constraints y exportar `booking`.
- [ ] **Step 5:** Run `npm run build` → éxito (el formulario actual sigue funcionando).
- [ ] **Step 6:** Commit `chore: tooling de pruebas y reglas de agendamiento`.

### Task 2: Cálculo de horarios libres

**Files:**
- Create: `src/lib/booking.ts`, `src/lib/booking.test.ts`

**Interfaces:**
- Consumes: `services`, `booking`, `BookingConfig` de `src/data/site.ts`.
- Produces:
  - `type Interval = { start: Date; end: Date }`
  - `totalDuration(names: string[]): number | null` — suma; `null` si la lista está vacía o hay un nombre desconocido.
  - `slotInterval(date: string, time: string, durationMin: number): Interval` — `date` `YYYY-MM-DD`, `time` `HH:MM`, interpretados en `-05:00`.
  - `computeSlots(p: { date: string; durationMin: number; busy: Interval[]; now: Date; config?: BookingConfig }): string[]` — devuelve `HH:MM` ordenados.
  - `formatDuration(min: number): string` — `45` → `"45 min"`, `90` → `"1 h 30 min"`, `120` → `"2 h"`.

- [ ] **Step 1: Pruebas que fallan** en `booking.test.ts`, con `now = 2026-11-02T08:00:00-05:00` (lunes):
  - lunes 2026-11-09, 60 min, sin ocupados → primer `'09:00'`, último `'17:00'`, 17 elementos.
  - domingo 2026-11-08 → `[]`; formato `'09/11/2026'` → `[]`; fecha pasada → `[]`; 2026-12-10 (a más de 30 días) → `[]`.
  - mismo día 2026-11-02, `now` 08:00 → primer horario `'11:00'` (3 h de anticipación).
  - ocupado 10:00–11:00 y servicio de 60 min → no contiene `'09:30'`, `'10:00'`, `'10:30'`; sí `'09:00'` y `'11:00'`.
  - servicio de 120 min y ocupado 12:00–13:00 → no contiene `'10:30'`; sí contiene `'10:00'`.
  - evento de todo el día (00:00 del 9 a 00:00 del 10, −05:00) → `[]`.
  - evento que cruza medianoche (2026-11-08 22:00 – 2026-11-09 10:00, −05:00) bloquea `'09:00'` y `'09:30'`.
  - 120 min en `'17:00'` se permite (termina 19:00); 180 min en `'17:00'` también (puede terminar tarde).
  - `totalDuration(['Semipermanente','Nail art'])` → 90; `([])` → `null`; `(['X'])` → `null`.
  - `formatDuration` con los tres ejemplos.
- [ ] **Step 2:** `npx vitest run src/lib/booking.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `src/lib/booking.ts`. Un inicio es válido si: la fecha es un día real, no es domingo, está entre `now + minLeadHours` y `now + maxDaysAhead`, y `[inicio, inicio + duración + bufferMin)` no se cruza con ningún intervalo ocupado. Evitar `Date` locales: construir con `new Date(\`${date}T${time}:00${utcOffset}\`)` y obtener el día de la semana desde ese instante en `-05:00`.
- [ ] **Step 4:** Mismo comando → PASS.
- [ ] **Step 5:** Commit `feat: cálculo de horarios libres`.

### Task 3: Vencimiento con corte nocturno

**Files:**
- Create: `src/lib/expiry.ts`, `src/lib/expiry.test.ts`

**Interfaces:**
- Produces: `expiryDeadline(createdAt: Date, holdMin = 120): Date`. El reloj solo avanza de 08:00 a 20:00 (−05:00).
  *Decisión del autor:* una solicitud a las 19:30 vence a las 09:30 del día siguiente (30 min de día + 90 tras las 08:00).

- [ ] **Step 1: Pruebas que fallan:** creada 10:00 → 12:00 mismo día; 18:00 → 20:00; 19:30 → 09:30 siguiente; 21:00 → 10:00 siguiente; 03:00 → 10:00 mismo día; 08:00 → 10:00. Todas en `-05:00`.
- [ ] **Step 2:** Run `npx vitest run src/lib/expiry.test.ts` → FAIL.
- [ ] **Step 3:** Implementar avanzando por tramos diurnos restantes hasta consumir `holdMin`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: vencimiento de solicitudes con corte nocturno`.

### Task 4: Tipos, puertos y validación

**Files:**
- Create: `netlify/lib/types.ts`, `netlify/lib/validate.ts`, `netlify/lib/validate.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'`
  - `interface BookingRequest { id: string; name: string; phone: string; email: string; services: string[]; date: string; time: string; durationMin: number; status: RequestStatus; createdAt: string; expiresAt: string; decidedAt?: string; eventId?: string }` (fechas ISO)
  - `interface RequestStore { put(r: BookingRequest): Promise<void>; get(id: string): Promise<BookingRequest | null>; listPending(): Promise<BookingRequest[]> }`
  - `interface CalendarPort { busy(from: Date, to: Date): Promise<Interval[]>; createEvent(r: BookingRequest): Promise<string> }`
  - `interface Mailer { send(m: { to: string; subject: string; text: string }): Promise<void> }`
  - `interface Deps { store: RequestStore; calendar: CalendarPort; mailer: Mailer; now: () => Date; newId: () => string; jessicaEmail: string; siteUrl: string }`
- Produces (`validate.ts`): `parseRequestInput(raw: unknown): { ok: true; value: { name: string; phone: string; email: string; services: string[]; date: string; time: string } } | { ok: false; error: string }`.

- [ ] **Step 1: Pruebas que fallan:** entrada válida pasa (recortando espacios); falla con nombre vacío, celular con menos de 7 dígitos, correo sin `@`, `services: []`, servicio desconocido, `date` mal formada, `time` fuera de `HH:MM`, y con el campo trampa `website` no vacío; falla si `raw` no es objeto.
- [ ] **Step 2:** `npx vitest run netlify/lib/validate.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `types.ts` y `validate.ts` (sin librerías; longitud máxima de 100 caracteres por texto).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: tipos y validación de solicitudes`.

### Task 5: Plantillas de correo

**Files:**
- Create: `netlify/lib/emails.ts`, `netlify/lib/emails.test.ts`

**Interfaces:**
- Produces: `emailForJessica(r: BookingRequest, approveUrl: string): { subject: string; text: string }`; `emailForClient(r: BookingRequest, outcome: 'approved' | 'rejected' | 'expired'): { subject: string; text: string }`.

- [ ] **Step 1: Pruebas que fallan:** el correo a Jessica contiene nombre, celular, servicios, fecha legible en es-CO, hora y la URL; el de la clienta contiene el nombre y para `approved` la fecha y hora, y para `rejected`/`expired` invita a elegir otro horario en el sitio.
- [ ] **Step 2:** `npx vitest run netlify/lib/emails.test.ts` → FAIL.
- [ ] **Step 3:** Implementar con texto plano en español.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: plantillas de correo`.

### Task 6: Servicio de solicitudes

**Files:**
- Create: `netlify/lib/requests.ts`, `netlify/lib/requests.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5. Las pruebas usan fakes en memoria de `RequestStore`, `CalendarPort` y `Mailer`.
- Produces:
  - `availableSlots(d: Deps, date: string, serviceNames: string[]): Promise<string[]>` — `[]` si los servicios no son válidos; descuenta los ocupados del calendario y las solicitudes `pending` con `expiresAt > now`.
  - `createRequest(d: Deps, raw: unknown): Promise<{ ok: true; id: string } | { ok: false; status: 400 | 409 | 429; error: string }>` — valida, comprueba que el horario sigue en `availableSlots` (409 si no), limita a 3 pendientes por celular (429), guarda, envía `emailForJessica` con `${siteUrl}/aprobar?id=${id}`.
  - `getRequest(d: Deps, id: string): Promise<BookingRequest | null>` — marca `expired` al leer si venció.
  - `decide(d: Deps, id: string, action: 'approve' | 'reject'): Promise<{ ok: true; request: BookingRequest } | { ok: false; status: 404 | 409; error: string }>`.
  - `expireDue(d: Deps): Promise<number>` — vence las `pending` pasadas de `expiresAt` y avisa a cada clienta.

- [ ] **Step 1: Pruebas que fallan** (una por línea):
  - crear con datos válidos guarda `pending`, con `expiresAt = expiryDeadline(now)`, y manda 1 correo a `jessicaEmail`.
  - segunda solicitud al mismo horario → `{ ok: false, status: 409 }`.
  - solicitud a un horario ocupado en el calendario → 409.
  - cuarta solicitud pendiente del mismo celular → 429.
  - entrada inválida → 400 y no se guarda nada.
  - `availableSlots` no ofrece el horario de una `pending` vigente, y sí el de una vencida.
  - `decide('approve')` crea exactamente un evento, pasa a `approved`, guarda `eventId` y manda correo `approved` a la clienta.
  - `decide('reject')` pasa a `rejected`, no crea evento, manda correo `rejected`.
  - aprobar dos veces → segunda `{ ok: false, status: 409 }` y sigue habiendo 1 evento.
  - aprobar vencida → 409, queda `expired`, sin evento.
  - aprobar cuando el calendario ya tiene ese tiempo ocupado → 409, sin evento.
  - id inexistente → 404.
  - `expireDue` vence solo las pasadas, devuelve cuántas y manda un correo `expired` por cada una.
- [ ] **Step 2:** `npx vitest run netlify/lib/requests.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Para el rango de `busy()` consultar de `00:00 del día` a `00:00 del día siguiente`, ampliando 1 día antes para eventos que cruzan medianoche. Los errores del mailer no deben revertir un estado ya guardado (registrar con `console.error`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: servicio de solicitudes de cita`.

### Task 7: Adaptadores reales y `realDeps()`

**Files:**
- Create: `netlify/lib/adapters.ts`, `netlify/lib/adapters.test.ts`

**Interfaces:**
- Produces: `eventPayload(r: BookingRequest): { summary: string; description: string; start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }` — `summary` = `"Nombre – servicios"`, `description` con celular, correo y servicios, zona `America/Bogota`; `realDeps(): Deps`.
- Variables de entorno que lee `realDeps()`: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `SMTP_URL`, `MAIL_FROM`, `JESSICA_EMAIL`, `SITE_URL`. Si falta alguna, lanza un error que nombra la variable.

- [ ] **Step 1: Prueba que falla:** `eventPayload` para "Ana" con Semipermanente + Nail art el 2026-11-09 a las 10:00 → `summary` `"Ana – Semipermanente, Nail art"`, `start.dateTime` `"2026-11-09T10:00:00-05:00"`, `end.dateTime` `"2026-11-09T11:30:00-05:00"`; `realDeps()` sin variables lanza error que contiene `GOOGLE_CALENDAR_ID` o la primera que falte.
- [ ] **Step 2:** `npx vitest run netlify/lib/adapters.test.ts` → FAIL.
- [ ] **Step 3:** Implementar: `RequestStore` con `getStore('solicitudes')` de `@netlify/blobs` (clave = id, JSON); `CalendarPort` con `@googleapis/calendar` y autenticación de cuenta de servicio (`freebusy.query` para `busy`, `events.insert` para `createEvent`); `Mailer` con `nodemailer.createTransport(SMTP_URL)`. `newId` = `crypto.randomBytes(24).toString('base64url')`. Estos tres adaptadores no se prueban con mocks; se comprueban en Task 11.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: adaptadores de Google Calendar, Blobs y correo`.

### Task 8: Funciones de Netlify

**Files:**
- Create: `netlify/functions/availability.ts`, `request.ts`, `decision.ts`, `expire.ts`, `netlify/functions/handlers.test.ts`
- Create: `netlify/lib/http.ts` (helper `json(status, body): Response`)

**Interfaces:**
- Consumes: `realDeps()` y el servicio de Task 6.
- Produces (cada función exporta `default` y `config`):
  - `GET /api/availability?date=YYYY-MM-DD&services=A,B` → `200 { slots: string[] }`.
  - `POST /api/request` (JSON) → `201 { id }` o el `status` y `{ error }` del servicio.
  - `GET /api/decision?id=` → `200 { request }` (sin celular ni correo expuestos más allá de lo que Jessica necesita: nombre, servicios, fecha, hora, estado) o 404.
  - `POST /api/decision` `{ id, action }` → `200 { request }` o error del servicio.
  - `expire` con `config = { schedule: '*/15 * * * *' }` llama `expireDue`.
- Para poder probarlas, cada archivo exporta además un `handle(req: Request, d: Deps): Promise<Response>`; el `default` solo llama `handle(req, realDeps())`.

- [ ] **Step 1: Pruebas que fallan** sobre `handle` con los fakes de Task 6: availability con `services` vacío → `{ slots: [] }`; request con JSON inválido → 400; request válido → 201; método incorrecto → 405; decision POST con acción distinta de `approve|reject` → 400.
- [ ] **Step 2:** `npx vitest run netlify/functions/handlers.test.ts` → FAIL.
- [ ] **Step 3:** Implementar las cuatro funciones. Ningún error interno devuelve detalles al cliente (500 con mensaje genérico).
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: funciones de agendamiento`.

### Task 9: Formulario de la clienta

**Files:**
- Modify: `src/components/Agendar.astro` (marcado, script y estilos del formulario)

**Interfaces:**
- Consumes: `GET /api/availability`, `POST /api/request`; `services`, `booking`, `formatDuration` de `src/lib/booking.ts`.

- [ ] **Step 1:** Reemplazar el `<select>` de servicio por casillas (una por servicio, con precio y `formatDuration`), y mostrar "Duración total" al marcar. Agregar campo `email` (`type="email"`, `autocomplete="email"`) y un campo trampa `website` oculto con CSS.
- [ ] **Step 2:** La fecha usa `min` = hoy y `max` = hoy + `booking.maxDaysAhead` (en hora de Colombia). Al cambiar servicios o fecha, pedir `/api/availability` y pintar los horarios como los `.slot` actuales; mostrar "No hay horarios disponibles ese día" si viene vacío y "Cargando horarios…" durante la consulta; descartar respuestas de consultas antiguas.
- [ ] **Step 3:** Al enviar, validar en el cliente (mantener el patrón `showError`) y hacer `POST /api/request`. Éxito → pantalla "¡Gracias, {nombre}! Te responderemos por correo cuando Jessica confirme tu cita." 409 → mensaje "Ese horario se acaba de ocupar, elige otro" y recargar horarios. Eliminar el enlace a WhatsApp de la pantalla final; `times` y `ampm` de `site.ts` pueden quitarse si ya nadie los usa.
- [ ] **Step 4:** Run `npx netlify dev` (con las variables de Task 11 en `.env`) y comprobar en el navegador: marcar dos servicios suma la duración; un domingo no ofrece horarios; un horario ocupado en el calendario no aparece; enviar crea la solicitud y llega el correo a Jessica.
- [ ] **Step 5:** Commit `feat: formulario de agendamiento con horarios del calendario`.

### Task 10: Página de aprobación

**Files:**
- Create: `src/pages/aprobar.astro`

**Interfaces:**
- Consumes: `GET/POST /api/decision`; recibe `?id=` en la URL.

- [ ] **Step 1:** Página con `<meta name="robots" content="noindex">`, sin `Header`, que lee `id`, consulta la solicitud y muestra nombre, servicios, fecha, hora y estado. Si `pending`: botones "Aprobar" y "Rechazar". Si ya fue decidida o venció: solo el estado ("Aprobada", "Rechazada", "Venció"). Id inexistente: "Solicitud no encontrada".
- [ ] **Step 2:** Tras pulsar un botón, mostrar el resultado; si el servicio responde 409, mostrar el motivo devuelto (ya aprobada, vencida o horario ocupado).
- [ ] **Step 3:** Run `npx netlify dev` y probar con una solicitud real los cuatro estados.
- [ ] **Step 4:** Commit `feat: página de aprobación de citas`.

### Task 11: Despliegue y verificación

**Files:**
- Modify: `README.md` (sección "Agendamiento")

- [ ] **Step 1:** Documentar en el README: crear cuenta de servicio en Google Cloud, habilitar Google Calendar API, compartir el calendario de trabajo con el correo de la cuenta de servicio ("Hacer cambios en eventos"), copiar el ID del calendario; crear una contraseña de aplicación del Gmail emisor para `SMTP_URL` (`smtps://usuario:clave@smtp.gmail.com`); lista de las 6 variables para Netlify (valor temporal de `JESSICA_EMAIL`: `hallpipe10@gmail.com`).
- [ ] **Step 2:** Pedir a Jessica (o a quien administre Netlify) que cargue las variables y haga el deploy; no cargarlas desde el repositorio.
- [ ] **Step 3: Verificación en producción**, con evidencia de cada punto: (a) `/api/availability` devuelve horarios y respeta un evento de prueba; (b) enviar una solicitud real manda correo a Jessica; (c) aprobar crea el evento en el calendario con título `Nombre – servicios` y manda correo a la clienta; (d) rechazar y dejar vencer mandan sus correos; (e) el horario en espera no aparece en una segunda pestaña.
- [ ] **Step 4:** Run `npm test && npm run build` → todo pasa.
- [ ] **Step 5:** Commit `docs: guía de despliegue del agendamiento`.

### Task 12: Análisis de WhatsApp (entregable aparte)

**Files:**
- Create: `docs/superpowers/specs/2026-10-26-whatsapp-analysis.md`

- [ ] **Step 1:** Investigar en la documentación vigente: WhatsApp Business Platform (requisitos, verificación, plantillas, costo en Colombia) frente a un proveedor intermedio; qué cambiaría en `Deps.mailer` (propuesta: un puerto `Notifier` con una implementación por canal).
- [ ] **Step 2:** Escribir el documento con recomendación, costos y pasos de Jessica. No implementar nada.
- [ ] **Step 3:** Commit `docs: análisis de avisos por WhatsApp`.
