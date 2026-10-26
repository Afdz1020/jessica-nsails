# Configuración de Google Calendar y del correo (Gmail)

Esta guía explica cómo conseguir cada dato que necesita el agendamiento online y qué valor va en cada variable de entorno. Para el funcionamiento general del sistema, ver [`agendamiento-online.md`](agendamiento-online.md).

> **Regla de oro:** estos valores son secretos. Van únicamente en las variables de entorno de Netlify (y, para pruebas locales, en un archivo `.env` que no se sube a git). Nunca en el código, en el README ni en chats.

## Resumen: las 6 variables

| Variable | Qué es | De dónde sale | Ejemplo (falso) |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | La llave de un "usuario robot" de Google que puede leer y escribir en el calendario | Archivo `.json` que descargas de Google Cloud (sección 1) | `{"type":"service_account","project_id":"mi-proyecto","private_key":"-----BEGIN PRIVATE KEY-----\n...","client_email":"agenda-web@mi-proyecto.iam.gserviceaccount.com", ...}` |
| `GOOGLE_CALENDAR_ID` | Identificador del calendario de trabajo | Configuración del calendario en Google Calendar (sección 2) | `abc123def456@group.calendar.google.com` |
| `SMTP_URL` | Dirección del servidor de correo con el usuario y la contraseña | La armas con tu Gmail y una contraseña de aplicación (sección 3) | `smtps://usuario%40gmail.com:abcdefghijklmnop@smtp.gmail.com:465` |
| `MAIL_FROM` | Nombre y correo que verán las clientas como remitente | Lo defines tú; el correo debe ser la cuenta de `SMTP_URL` | `JessicaDiaznails <usuario@gmail.com>` |
| `JESSICA_EMAIL` | Correo donde llegan las solicitudes con el enlace de aprobación | Lo defines tú | `jessica@ejemplo.com` |
| `SITE_URL` | Dirección pública del sitio, para armar el enlace de aprobación | La del sitio publicado | `https://jsdiaznsails.netlify.app` |

---

## 1. Google Cloud: cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_JSON`)

Una **cuenta de servicio** es un usuario automático. El sitio la usa para ver si hay horas ocupadas y para crear las citas aprobadas, sin que nadie inicie sesión.

### 1.1 Crear el proyecto
1. Entra a <https://console.cloud.google.com> con una cuenta de Google.
2. Arriba, abre el selector de proyectos → **Proyecto nuevo**.
3. Nombre: `jessicadiaznails` → **Crear**. Selecciónalo al terminar.

### 1.2 Activar la API de Calendar
1. Menú ☰ → **APIs y servicios** → **Biblioteca**.
2. Busca **Google Calendar API** → **Habilitar**.

### 1.3 Crear la cuenta de servicio
1. Menú ☰ → **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**.
2. Nombre: `agenda-web` → **Crear y continuar**.
3. Omite los pasos de roles y de acceso de usuarios (**Continuar**, luego **Listo**). No necesita roles del proyecto.
4. Abre la cuenta creada y **copia su correo** (termina en `.iam.gserviceaccount.com`). Lo necesitas en la sección 2.

### 1.4 Descargar la llave
1. En la cuenta, pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → **Crear**.
2. Se descarga un archivo `.json`. Ábrelo con un editor de texto: tiene campos como `type`, `project_id`, `private_key`, `client_email`.
3. Guárdalo en un lugar privado. Quien lo tenga puede escribir en el calendario.

### 1.5 Valor de `GOOGLE_SERVICE_ACCOUNT_JSON`
**El contenido completo del archivo `.json`**, desde la primera `{` hasta la última `}`.

- **En Netlify:** pega todo el contenido tal cual; aceptar varias líneas no es problema.
- **En un `.env` local:** debe ir en **una sola línea**. Si copias el archivo con saltos de línea, el `.env` se rompe.
- Dentro de `private_key` hay secuencias `\n` (barra invertida y n). **No las cambies**: el código las convierte solo.
- No lo envuelvas entre comillas ni le agregues texto antes o después.

---

## 2. Google Calendar (`GOOGLE_CALENDAR_ID`)

### 2.1 Compartir el calendario con la cuenta de servicio
La cuenta de servicio no ve ningún calendario hasta que se le comparte.
1. Abre <https://calendar.google.com>.
2. En el panel izquierdo, busca el **calendario de trabajo** → pasa el mouse → ⋮ → **Configuración y uso compartido**.
3. En **Compartir con determinadas personas o grupos** → **Agregar personas y grupos**.
4. Pega el correo de la cuenta de servicio (el `client_email` del JSON, que copiaste en 1.3).
5. Permiso: **Hacer cambios en eventos** → **Enviar**.

Con permiso de solo lectura el sistema podría ver horarios, pero **no podría crear las citas aprobadas**.

### 2.2 Valor de `GOOGLE_CALENDAR_ID`
En esa misma pantalla de configuración, baja a **Integrar el calendario** y copia el **ID del calendario**.

- Un calendario creado aparte se ve como `abc123...@group.calendar.google.com`.
- Si usas el calendario principal de la cuenta, el ID es el correo de esa cuenta.

Este debe ser el calendario donde Jessica guarda todo lo que ocupa su tiempo. **Cualquier evento en él cuenta como ocupado**, incluidos los de todo el día: así se cierran días o vacaciones.

---

## 3. Gmail para el envío de correos (`SMTP_URL` y `MAIL_FROM`)

El sistema envía los correos usando el servidor de Gmail con una **contraseña de aplicación**: una clave especial de 16 letras que sirve solo para este uso y que se puede revocar sin cambiar la contraseña real de la cuenta.

### 3.1 Elegir la cuenta remitente
Los correos saldrán desde la cuenta que elijas; Gmail solo permite enviar con su propia dirección. Para la prueba se usa un Gmail personal. Cuando el negocio tenga su propio correo, se cambia el valor de las variables.

### 3.2 Activar la verificación en dos pasos
Google no ofrece contraseñas de aplicación sin ella.
1. <https://myaccount.google.com> → **Seguridad** → **Verificación en dos pasos** → actívala.

### 3.3 Crear la contraseña de aplicación
1. Abre <https://myaccount.google.com/apppasswords> (si no carga, búscala en el buscador de la cuenta como "Contraseñas de aplicaciones").
2. Nombre: `web jessicadiaznails` → **Crear**.
3. Google muestra 16 letras, normalmente en 4 grupos con espacios. **Cópialas sin los espacios.** Solo se muestran una vez; si la pierdes, crea otra.

### 3.4 Valor de `SMTP_URL`
Formato:

```
smtps://CORREO:CONTRASEÑA@smtp.gmail.com:465
```

| Parte | Qué poner |
|---|---|
| `smtps://` | Se deja igual |
| `CORREO` | El Gmail del paso 3.1 **con el `@` escrito como `%40`** (`usuario@gmail.com` → `usuario%40gmail.com`) |
| `:` | Separa el usuario de la contraseña |
| `CONTRASEÑA` | Los 16 caracteres del paso 3.3, sin espacios |
| `@smtp.gmail.com:465` | Servidor y puerto de Gmail; se dejan igual |

Resultado de ejemplo (todo inventado):

```
smtps://usuario%40gmail.com:abcdefghijklmnop@smtp.gmail.com:465
```

Hay dos `@` distintos: el del correo va como `%40` y el que va justo antes de `smtp.gmail.com` es el normal.

### 3.5 Valor de `MAIL_FROM`
El remitente que verán las clientas, con el formato `Nombre <correo>`:

```
JessicaDiaznails <usuario@gmail.com>
```

El correo debe ser **el mismo Gmail del `SMTP_URL`**; si es otro, Gmail lo reemplaza por el de la cuenta.

### 3.6 Qué esperar de Gmail
- Límite de unos 500 correos por día: de sobra para este uso.
- Al principio los correos pueden caer en **spam**, porque salen de un Gmail personal. Pedirle a la clienta que revise esa carpeta ayuda; con un dominio propio mejora.
- Con otro proveedor SMTP funciona igual: solo cambia la dirección del servidor y el puerto en `SMTP_URL`.

---

## 4. Las dos variables restantes

### `JESSICA_EMAIL`
El correo donde llegarán las solicitudes con el enlace para aprobar. Es **temporal** (en la primera versión se usa `hallpipe10@gmail.com`) y se cambia aquí sin tocar el código. Puede ser distinto del remitente.

### `SITE_URL`
La dirección pública del sitio. Con ella se arma el enlace del correo: `SITE_URL/aprobar?id=...`.

| Dónde | Valor |
|---|---|
| Producción en Netlify | `https://jsdiaznsails.netlify.app` (o el dominio propio, si lo hay) |
| Pruebas locales con `netlify dev` | `http://localhost:8888` |

Debe ir **sin espacios y sin barra al final**. Si se escribe mal, el enlace del correo no abre. Si solo se publicó una vista previa, el sitio principal aún no tiene la página `/aprobar`: ese enlace dará error hasta que se publique.

---

## 5. Cargar las variables en Netlify

1. Netlify → tu sitio → **Site configuration** → **Environment variables**.
2. **Add a variable** y crea las 6, con el nombre exacto. Asegúrate de que apliquen a **Functions** (el alcance por defecto suele servir; si eliges alcances a mano, incluye Functions y Scheduled functions).
3. **Haz un deploy nuevo.** Las variables solo se aplican en despliegues posteriores a haberlas guardado.

Netlify limita el tamaño total de las variables de las funciones (cerca de 4 KB), y la llave JSON ocupa casi la mitad. Si el deploy falla con un error de tamaño de variables, avisar.

Para pruebas locales, copia `.env.example` a `.env` y reemplaza los valores. `.env` está en `.gitignore`.

---

## 6. Cómo comprobar que quedó bien

| Prueba | Resultado esperado |
|---|---|
| Abrir `/api/availability?date=<un lunes futuro>&services=Semipermanente` | `{"slots":["09:00","09:30", ...]}` |
| Crear un evento de prueba ese lunes de 10:00 a 11:00 y recargar | Ya no aparecen 09:30, 10:00 ni 10:30 |
| Enviar una solicitud desde el formulario | Llega un correo a `JESSICA_EMAIL` con el enlace |
| Aprobar desde el enlace | Aparece el evento `Nombre – servicios` en el calendario y la clienta recibe un correo |

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `{"error":"Error interno"}` en la API | Variable faltante o con un valor mal pegado | Netlify → **Logs → Functions** muestra cuál; el mensaje dice "Faltan variables de entorno: …" |
| Los registros dicen "GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido" | La llave se copió incompleta, con comillas de más o con saltos de línea en un `.env` | Volver a copiar el archivo completo; en `.env` local, en una sola línea |
| Error al consultar disponibilidad (`notFound` u otro motivo de Google) | El calendario no se compartió con la cuenta de servicio, el `GOOGLE_CALENDAR_ID` está mal o la Calendar API no está habilitada | Repetir 1.2 y 2.1; revisar el ID |
| Se ven horarios pero al aprobar falla | La cuenta de servicio solo tiene permiso de lectura | Cambiar a **Hacer cambios en eventos** |
| No llegan los correos | Contraseña de aplicación mal copiada, `SMTP_URL` mal armada o la verificación en dos pasos desactivada | Revisar `%40`, que no haya espacios en la clave; crear otra contraseña |
| El correo llega con otro remitente | `MAIL_FROM` no coincide con la cuenta de `SMTP_URL` | Usar el mismo correo |
| El enlace del correo no abre | `SITE_URL` mal escrita, o el sitio principal aún no tiene `/aprobar` | Corregirla (sin espacios ni barra final), publicar y volver a desplegar |
| Cambié una variable y no se nota | Falta un deploy nuevo | Volver a desplegar |

## 8. Seguridad y mantenimiento

- Si crees que la llave JSON o la contraseña de aplicación se filtraron: en Google Cloud, **Claves** de la cuenta de servicio → eliminar la clave y crear otra; en la cuenta de Google, eliminar la contraseña de aplicación y crear una nueva. Después, actualizar las variables en Netlify y volver a desplegar.
- La cuenta de servicio solo puede tocar los calendarios que se le compartan. Para revocar su acceso, quítala de **Configuración y uso compartido** del calendario.
- No pegues estos valores en chats, correos ni capturas de pantalla.
