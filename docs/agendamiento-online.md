# Agendamiento online — documentación técnica

Esta guía explica cómo funciona el agendamiento online de JessicaDiaznails, qué se construyó y cómo está organizado el código. La guía de puesta en marcha (Google, correo, variables de Netlify) está en el [README](../README.md#agendamiento-online). El diseño y las decisiones de negocio están en [`superpowers/specs/2026-10-26-agendamiento-online-design.md`](superpowers/specs/2026-10-26-agendamiento-online-design.md).

## 1. Qué hace

1. Una clienta abre el sitio, elige uno o varios servicios, una fecha y un horario, y deja nombre, celular y correo.
2. Los horarios que ve salen del Google Calendar de trabajo de Jessica: solo aparecen los que tienen espacio libre para la duración total de los servicios.
3. Al enviar, la solicitud queda **en espera** y ese horario se bloquea para otras clientas. Jessica recibe un correo con un enlace privado.
4. Jessica abre el enlace y pulsa **Aprobar** o **Rechazar**.
5. Al aprobar se crea el evento en el calendario. En cualquiera de los casos, la clienta recibe un correo con el resultado.
6. Si Jessica no responde, la solicitud vence a las 2 horas y la clienta recibe un correo. El reloj corre solo de 8:00 a.m. a 8:00 p.m. (hora de Bogotá).

## 2. Piezas y cómo se conectan

```
Navegador de la clienta                    Netlify                               Servicios externos
┌────────────────────────┐   GET /api/availability   ┌────────────────────┐
│ Formulario             │ ───────────────────────▶ │ availability.ts    │──▶ Google Calendar (ocupado/libre)
│ (Agendar.astro)        │   POST /api/request       │ request.ts         │──▶ Netlify Blobs (guarda solicitud)
└────────────────────────┘ ───────────────────────▶ │                    │──▶ SMTP (correo a Jessica)
                                                    └────────────────────┘
Navegador de Jessica
┌────────────────────────┐   GET/POST /api/decision  ┌────────────────────┐
│ Página /aprobar        │ ───────────────────────▶ │ decision.ts        │──▶ Google Calendar (crea el evento)
│ (aprobar.astro)        │                           │                    │──▶ SMTP (correo a la clienta)
└────────────────────────┘                           └────────────────────┘
                              cada 15 min            ┌────────────────────┐
                              (programada) ────────▶ │ expire.ts          │──▶ marca vencidas y avisa
                                                    └────────────────────┘
```

El sitio sigue siendo estático (Astro). Lo nuevo es una capa de **funciones de Netlify** que corren en el servidor y hablan con Google, con el almacenamiento y con el correo.

## 3. Cronología: qué se hizo, paso a paso

El trabajo se hizo en la rama `feat/agendamiento-online`, con un diseño aprobado, un plan de 12 tareas y un subagente por tarea con revisión independiente después de cada una.

| # | Qué se hizo | Para qué |
|---|---|---|
| — | **Diseño** (preguntas a Jessica → documento de diseño) | Fijar reglas: duraciones, horarios, aprobación manual, vencimiento de 2 h, correo como canal |
| — | **Plan** de implementación | Dividir en tareas pequeñas y probables |
| 1 | Herramientas de prueba (Vitest), `netlify.toml`, duraciones y objeto `booking` en `site.ts` | Base común |
| 2 | `src/lib/booking.ts`: cálculo de horarios libres | Decidir qué horas ofrecer |
| 3 | `src/lib/expiry.ts`: vencimiento con corte nocturno | Regla de las 2 h (08:00–20:00) |
| 4 | `netlify/lib/types.ts` y `validate.ts` | Tipos compartidos y validación de lo que llega de la clienta |
| 5 | `netlify/lib/emails.ts` | Textos de los correos |
| 6 | `netlify/lib/requests.ts` | Lógica central: crear, aprobar, rechazar, vencer |
| 7 | `netlify/lib/adapters.ts` | Conexión real con Netlify Blobs, Google Calendar y SMTP |
| 8 | `netlify/functions/*` | Las 4 funciones (endpoints) |
| 9 | `Agendar.astro` | Formulario nuevo |
| 10 | `aprobar.astro` | Página de aprobación para Jessica |
| 11 | README, `.env.example`, `.gitignore` | Guía de puesta en marcha |
| 12 | Análisis de WhatsApp | Documento para decidir el aviso por WhatsApp a futuro |
| — | **Revisión final y correcciones** | Cerrar un fallo de seguridad y varios problemas de robustez (ver sección 6) |
| — | **Puesta en marcha** (contigo) | Cuenta de servicio de Google, contraseña de aplicación de Gmail, variables de Netlify, vista previa y prueba real |

Las pruebas pasaron de 0 a 128. El proyecto no tenía pruebas antes.

## 4. El código, archivo por archivo

### 4.1 Reglas y datos — `src/data/site.ts`
Es el único lugar para cambiar reglas de negocio:
- Cada servicio tiene `duration` en minutos.
- El objeto `booking` define: primera hora (`openTime`), última hora de inicio (`lastStartTime`), paso entre horarios (`stepMin: 30`), anticipación mínima (`minLeadHours: 3`), días máximos hacia adelante (`maxDaysAhead: 30`), margen entre citas (`bufferMin: 0`), días cerrados (`closedWeekdays: [0]`, el domingo), zona horaria fija (`utcOffset: '-05:00'`) y los topes anti‑abuso (`maxPendingTotal: 30`, `maxPendingPerContact: 3`).

### 4.2 Horarios libres — `src/lib/booking.ts`
Es código puro: no usa red ni el reloj de la máquina, y se comparte entre el navegador y el servidor.
- `totalDuration(nombres)` suma las duraciones. Devuelve `null` si la lista está vacía o hay un servicio desconocido.
- `slotInterval(fecha, hora, minutos)` convierte "2026-11-09" y "10:00" en un intervalo de tiempo real usando el desfase `-05:00`.
- `computeSlots({ date, durationMin, busy, now })` es el corazón: recorre las horas desde `openTime` hasta `lastStartTime` de 30 en 30 minutos y descarta una hora si (a) la fecha no existe o es domingo, (b) empieza antes de `now + 3 h` o después de `now + 30 días`, o (c) el intervalo `[inicio, inicio + duración)` se cruza con algún evento ocupado. Los intervalos son abiertos al final: una cita que termina a las 11:00 no choca con otra que empieza a las 11:00.
- `formatDuration(90)` → `"1 h 30 min"`.

Para evitar errores por zona horaria, todo se calcula con aritmética sobre el desfase fijo de Colombia, nunca con la zona del computador que ejecute el código.

### 4.3 Vencimiento — `src/lib/expiry.ts`
`expiryDeadline(creadaEn)` devuelve cuándo vence una solicitud. Reparte los 120 minutos solo entre las 8:00 y las 20:00. Una solicitud a las 19:30 gasta 30 minutos ese día y los 90 restantes desde las 8:00 del día siguiente, por lo que vence a las 9:30. Una de las 21:00 vence a las 10:00 del día siguiente.

### 4.4 Tipos — `netlify/lib/types.ts`
Define `BookingRequest` (la solicitud: id, datos de la clienta, servicios, fecha, hora, estado, fechas de creación y vencimiento, id del evento) y cuatro "puertos" (interfaces):
- `RequestStore`: guardar y leer solicitudes.
- `CalendarPort`: consultar horas ocupadas y crear eventos.
- `Mailer`: enviar correos.
- `Deps`: el conjunto de los anteriores más `now()`, `newId()`, el correo de Jessica y la URL del sitio.

La lógica central solo conoce estas interfaces, no a Google ni a Netlify. Por eso se pudo probar con versiones falsas en memoria y por eso, a futuro, cambiar el correo por WhatsApp solo requiere otra implementación.

### 4.5 Validación — `netlify/lib/validate.ts`
`parseRequestInput(raw)` revisa lo que manda el navegador (que nunca es de fiar). Exige nombre, celular con al menos 7 dígitos, un correo válido (sin espacios ni `, ; < > "`), servicios que existan en el catálogo (sin repetidos), fecha real y hora `HH:MM`. Máximo 100 caracteres por texto. Incluye un **campo trampa** (`website`): el formulario lo oculta, así que si llega con contenido, es un robot y se rechaza.

### 4.6 Correos — `netlify/lib/emails.ts`
- `emailForJessica(solicitud, enlace)`: nombre, celular, correo, servicios, fecha legible, hora, duración y el enlace de aprobación.
- `emailForClient(solicitud, resultado)`: aprobada (con fecha y hora), rechazada o vencida (invita a elegir otro horario). **Ninguno incluye el enlace ni el id.**
Los asuntos pasan por un limpiador que elimina saltos de línea, para evitar inyección en las cabeceras del correo.

### 4.7 Lógica central — `netlify/lib/requests.ts`
Todo el flujo de negocio vive aquí.
- `availableSlots(d, fecha, servicios)`: consulta el calendario (desde un día antes, para ver eventos que cruzan la medianoche), suma como ocupadas las solicitudes pendientes vigentes y llama a `computeSlots`.
- `createRequest(d, datos)`: valida → comprueba otra vez que el horario siga libre (si no, 409) → aplica los topes (30 en total, 3 por celular, 3 por correo; si no, 429) → guarda la solicitud como `pending` con su vencimiento → envía el correo a Jessica con el enlace.
- `getRequest`: lee una solicitud y, si ya venció, la marca vencida.
- `decide(d, id, 'approve' | 'reject')`: rechaza si no existe (404) o si ya no está pendiente (409). Si venció, la marca vencida. Si se rechaza, avisa a la clienta. Si se aprueba, **vuelve a consultar el calendario** y las pendientes anteriores; si el horario ya no está libre, cierra la solicitud como rechazada y avisa. Si está libre, **primero crea el evento** y solo entonces cambia el estado a aprobada y avisa a la clienta.
- `expireDue(d)`: recorre las pendientes, marca vencidas las que pasaron su plazo y avisa a cada clienta.
- `vencer`: antes de marcar como vencida, vuelve a leer la solicitud; si otro proceso ya la cerró, no hace nada. Eso evita correos duplicados en casi todos los casos (no en todos: el almacenamiento no tiene transacciones).
- `enviar`: si un correo falla, se registra el error pero no se deshace lo ya guardado.

### 4.8 Conexiones reales — `netlify/lib/adapters.ts`
- `blobStore`: guarda cada solicitud en Netlify Blobs en `req/<id>` y mantiene una marca `pending/<id>` solo mientras está pendiente. Así listar las pendientes cuesta según cuántas hay y no según todo el historial. Lee en tandas de 10.
- `googleCalendarPort`: se autentica con la cuenta de servicio. `busy()` usa la consulta `freebusy` de Google y **lanza error si Google no puede responder** (nunca devuelve "libre" por defecto). `createEvent()` crea el evento con un id derivado del id de la solicitud, de modo que si la aprobación se reintenta, no se duplica el evento.
- `eventPayload`: arma el evento: título `Nombre – servicios`, descripción con celular, correo y servicios, y las horas con desfase `-05:00`.
- `smtpMailer`: envía con `nodemailer` usando `SMTP_URL`.
- `realDeps()`: lee las 6 variables de entorno y, si falta alguna, falla nombrando cuál (sin mostrar valores).

### 4.9 Endpoints — `netlify/functions/*.ts`
Son capas finas: leen la petición, llaman a `requests.ts` y devuelven JSON.
- `availability.ts` — `GET /api/availability?date=…&services=A,B` → `{ slots: [...] }`. Datos inválidos devuelven lista vacía, nunca un error.
- `request.ts` — `POST /api/request` → `201 { ok: true }`. **No devuelve el id**, porque el id es la credencial de aprobación.
- `decision.ts` — `GET /api/decision?id=` (solo lectura, devuelve nombre, servicios, fecha, hora, duración y estado, sin celular ni correo) y `POST /api/decision` con `{ id, action }` (es lo único que cambia el estado).
- `expire.ts` — se ejecuta sola cada 15 minutos (`schedule: '*/15 * * * *'`).
- `netlify/lib/http.ts` — utilidades comunes: respuestas JSON, tope de 10 KB al cuerpo (contado sobre los bytes reales), y `guard`, que convierte cualquier error inesperado en un `500 "Error interno"` genérico y deja el detalle solo en los registros de Netlify.

### 4.10 Interfaz
- `src/components/Agendar.astro`: formulario con casillas de servicios y duración total, fecha limitada a los próximos 30 días (calculada en hora de Colombia), horarios que se cargan al cambiar servicios o fecha (con protección para que una respuesta lenta no pise a una más reciente), validación, bloqueo del botón mientras envía y mensajes de éxito o error.
- `src/pages/aprobar.astro`: lee `?id=` y muestra la solicitud con los botones Aprobar/Rechazar. Cargar la página solo lee; **solo el clic en un botón cambia algo**, para que los escáneres de enlaces de los correos no aprueben nada solos. Lleva `noindex` para que Google no la indexe.
- `src/layouts/Layout.astro`: ahora acepta una propiedad `snap` (por defecto activada) y una ranura `head`, para que `/aprobar` no use el desplazamiento por secciones de la página principal.

## 5. Seguridad: qué protege qué

| Riesgo | Protección |
|---|---|
| Una clienta se aprueba su propia cita | `POST /api/request` no devuelve el id; el id solo va en el correo a Jessica y es aleatorio de 24 bytes |
| Un escáner de enlaces aprueba solo | Abrir el enlace es solo lectura; aprobar exige un `POST` por clic |
| Doble reserva | Cada solicitud bloquea su horario; al aprobar se revisa de nuevo el calendario y las pendientes anteriores |
| Evento creado sin existir | Primero se crea el evento, después se cambia el estado; el id del evento es determinista |
| Fugas de datos | El endpoint público solo devuelve un subconjunto sin celular ni correo; los errores internos son genéricos |
| Secretos | Solo en variables de entorno de Netlify; `.env` está en `.gitignore`; `.env.example` solo tiene valores falsos |
| Spam y relleno de horarios | Campo trampa, tope de 10 KB, 30 pendientes en total y 3 por celular o correo |
| Correos manipulados | Asuntos sin saltos de línea; validación estricta del correo |

## 6. Hallazgos de la revisión final (ya corregidos)

- **Crítico:** `POST /api/request` devolvía el id, con lo que cualquiera con un script podía aprobar su propia cita. Se quitó del response y se añadió una prueba que lo vigila.
- La consulta de solicitudes pendientes leía todo el historial. Se creó el índice `pending/`.
- Solo había un tope de 3 pendientes por celular. Se añadieron los topes global y por correo.
- Podían enviarse dos correos de "venció". Se añadió la relectura previa.

## 7. Limitaciones conocidas

- No hay bloqueo entre dos aprobaciones simultáneas de la misma solicitud: el evento no se duplica, pero podrían enviarse dos correos de confirmación.
- Dos solicitudes enviadas casi a la vez para el mismo horario pueden guardarse las dos; al aprobar, solo una se acepta y la otra se rechaza con aviso. Jessica verá dos correos.
- Cualquiera puede ocupar los 30 cupos de espera durante 2 horas.
- El aviso a Jessica es por correo (los correos de un Gmail personal pueden caer en spam). El análisis para WhatsApp está en [`superpowers/specs/2026-10-26-whatsapp-analysis.md`](superpowers/specs/2026-10-26-whatsapp-analysis.md).
- Pendientes menores de accesibilidad en el formulario y en `/aprobar` (foco tras enviar, CSS sobrante).

## 8. Operación y solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El enlace del correo no abre o da error SSL | `SITE_URL` mal escrita o apunta a un sitio sin la página `/aprobar` | Debe ser exactamente `https://tu-dominio` sin espacios ni barra final; hace falta un deploy nuevo después de cambiarla. En una vista previa, cambia el dominio del enlace a mano |
| `{"error":"Error interno"}` | Variable faltante, calendario no compartido o credenciales mal pegadas | Netlify → Logs → Functions → la función afectada |
| No salen horarios | La consulta al calendario falla, el día es domingo o la fecha está fuera de los 30 días | Comprobar `/api/availability` y los registros |
| No llegan correos | Contraseña de aplicación mal copiada o `SMTP_URL` mal armada (`@` del correo como `%40`) | Registros de `request`; revisar spam |
| Cambié una variable y no pasa nada | Las variables solo se aplican en un deploy nuevo | Volver a desplegar |
| Quiero cambiar el correo que recibe las solicitudes | — | Cambiar `JESSICA_EMAIL` en Netlify y volver a desplegar; no hace falta tocar código |

## 9. Cómo se prueba

- `npm test`: 128 pruebas automáticas (horarios, vencimiento, validación, correos, flujo completo de solicitudes, adaptadores y endpoints).
- `npm run build`: genera el sitio.
- `npx netlify dev`: ejecuta el sitio y las funciones en local (necesita un `.env`, ver `.env.example`).
- La lista de verificación para producción está en el README.
