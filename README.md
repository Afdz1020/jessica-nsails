# JessicaDiaznails

Sitio de una sola página para el nail spa JessicaDiaznails, hecho con [Astro](https://astro.build).

## Comandos

| Comando           | Acción                                     |
| :---------------- | :----------------------------------------- |
| `npm install`     | Instala las dependencias                   |
| `npm run dev`     | Servidor local en `localhost:4321`         |
| `npm run build`   | Genera el sitio estático en `./dist/`      |
| `npm run preview` | Previsualiza el build antes de publicarlo  |
| `npm test`        | Corre las pruebas (Vitest)                 |
| `npx netlify dev` | Sitio + funciones de agendamiento en local |

## Dónde editar

- `src/data/site.ts`: servicios y precios, duración de cada servicio, reglas del agendamiento (`booking`), horarios, contacto, WhatsApp (solo como contacto directo) y ajustes de scroll (`scrollSnap`, `revealStyle`).
- `src/components/`: una sección por archivo (Hero, Nosotros, Servicios, Galería, Agendar, Footer). `Agendar` contiene el formulario de solicitud de cita.
- `src/scripts/scroll.ts`: animaciones de aparición, puntos de navegación y desplazamiento suave.
- `public/assets/logo-jd.png`: logo usado en el sitio (600 px). El original en alta resolución está en `design-src/`.
- `src/lib/`: lógica pura del agendamiento (horarios libres, vencimiento de solicitudes), con sus pruebas.
- `netlify/functions/`: funciones del servidor (`availability`, `request`, `decision`, `expire`). `netlify/lib/` tiene su lógica compartida (validación, correos, Google Calendar) y `netlify/tests/` las pruebas de los handlers.
- `src/pages/aprobar.astro`: página donde Jessica aprueba o rechaza una solicitud.

## Agendamiento online

**Cómo funciona**

1. La clienta elige servicios, fecha y hora en el sitio y envía una solicitud.
2. Jessica recibe un correo con un enlace `/aprobar?id=…`.
3. Ahí aprueba o rechaza la solicitud.
4. Si aprueba, se crea el evento en Google Calendar (título `Nombre – servicios`) y la clienta recibe un correo; si rechaza, también se le avisa.
5. La solicitud vence a las 2 h sin respuesta. El reloj corre solo entre las 8:00 a.m. y las 8:00 p.m.; fuera de ese rango se detiene. Mientras está en espera, el horario no se ofrece a otras clientas.

Para evitar abuso, se aceptan como máximo 30 solicitudes en espera en total y 3 por celular o por correo (`booking.maxPendingTotal` y `booking.maxPendingPerContact`).

### Reglas editables (`src/data/site.ts`)

| Dónde                    | Qué controla                                                        |
| :----------------------- | :------------------------------------------------------------------ |
| `services[].duration`    | Duración en minutos de cada servicio (la cita suma los elegidos)    |
| `booking.openTime`       | Hora de apertura (`09:00`)                                          |
| `booking.lastStartTime`  | Última hora de inicio de una cita (`17:00`)                         |
| `booking.stepMin`        | Cada cuántos minutos se ofrece un horario (`30`)                    |
| `booking.minLeadHours`   | Anticipación mínima para agendar (`3` h)                            |
| `booking.maxDaysAhead`   | Días máximos hacia adelante (`30`)                                  |
| `booking.bufferMin`      | Margen entre citas, en minutos (`0`)                                |
| `booking.closedWeekdays` | Días cerrados; `0` = domingo (`[0]`)                                |

### Configuración de Google (calendario)

1. En [Google Cloud Console](https://console.cloud.google.com) crea un proyecto nuevo.
2. En "APIs y servicios", habilita **Google Calendar API**.
3. En "IAM y administración" > "Cuentas de servicio", crea una cuenta de servicio.
4. Dentro de la cuenta, en "Claves", crea una llave nueva de tipo **JSON** y descárgala. Su contenido completo es el valor de `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. En Google Calendar, abre el calendario de trabajo > "Configuración y uso compartido" > "Compartir con personas o grupos" y agrega el correo de la cuenta de servicio (termina en `iam.gserviceaccount.com`) con el permiso **Hacer cambios en eventos**.
6. En esa misma configuración, en "Integrar el calendario", copia el **ID del calendario**: es el valor de `GOOGLE_CALENDAR_ID`.

### Configuración del correo (SMTP)

Los correos salen por SMTP. Ejemplo con Gmail y una contraseña de aplicación (requiere verificación en dos pasos; se crea en la cuenta de Google > Seguridad > "Contraseñas de aplicaciones"):

```
SMTP_URL=smtps://usuario%40gmail.com:CLAVE@smtp.gmail.com:465
```

Recuerda codificar el `@` del usuario como `%40`. Cualquier otro proveedor SMTP funciona igual, con su propio servidor y puerto.

### Variables de entorno (Netlify)

Se cargan en Netlify > "Site configuration" > "Environment variables". **Nunca las subas al repositorio.**

| Variable                      | Qué es                                                                                       |
| :---------------------------- | :------------------------------------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Contenido completo de la llave JSON de la cuenta de servicio                                 |
| `GOOGLE_CALENDAR_ID`          | ID del calendario de trabajo                                                                 |
| `SMTP_URL`                    | URL SMTP del correo que envía los avisos (ver ejemplo arriba)                                |
| `MAIL_FROM`                   | Remitente de los correos, p. ej. `JessicaDiaznails <correo@ejemplo.com>`                     |
| `JESSICA_EMAIL`               | Correo que recibe las solicitudes. Temporal: `hallpipe10@gmail.com`; se cambia aquí sin tocar código |
| `SITE_URL`                    | URL pública del sitio: `https://jsdiaznsails.netlify.app` (se usa en los enlaces de los correos) |

### Desarrollo local

Crea un archivo `.env` en la raíz con las variables (puedes partir de `.env.example`) y corre `npx netlify dev`. El archivo `.env` está en `.gitignore` y no se versiona.

### Checklist de verificación en producción

- [ ] `/api/availability?date=<un lunes futuro>&services=Semipermanente` devuelve horarios y respeta un evento de prueba creado en el calendario.
- [ ] Enviar una solicitud real manda el correo a Jessica.
- [ ] Aprobar crea el evento con título `Nombre – servicios` y manda correo a la clienta.
- [ ] Rechazar y dejar vencer una solicitud mandan sus correos respectivos.
- [ ] El horario en espera no aparece en una segunda pestaña u otro navegador.
- [ ] Un domingo no ofrece horarios.
- [ ] Probar en celular el formulario y la página `/aprobar`.
- [ ] El sitio principal conserva el snap-scroll.
- [ ] Un evento de todo el día en el calendario bloquea ese día.

### Limitaciones conocidas

- No hay bloqueo para aprobaciones simultáneas: si dos solicitudes del mismo horario se aprueban casi a la vez, podrían quedar dos eventos.
- En esta primera versión los avisos a Jessica son por correo; el aviso automático por WhatsApp queda para después.
