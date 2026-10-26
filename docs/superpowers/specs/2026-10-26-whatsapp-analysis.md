# Análisis: avisos por WhatsApp para JessicaDiaznails

Fecha de la investigación: 2026-10-26. Es solo análisis; no se cambió código.
Primero va lo que Jessica necesita para decidir; al final, lo técnico.

Convención: **[Verificado]** = lo leí en la fuente citada hoy. **[Criterio]** = mi opinión. **[No verificado]** = no pude confirmarlo; hay que revisarlo antes de decidir.

## 1. Resumen para Jessica

- Hoy el aviso a Jessica llega por **correo** y funciona. Se puede dejar así mientras se decide.
- Enviar WhatsApp **automático** (sin que nadie lo escriba a mano) solo se puede hacer bien por la **API oficial de Meta (WhatsApp Business Platform)**, directamente o a través de un proveedor intermedio.
- Para ~30 avisos al día el **costo en mensajes es bajo** (provisional: unos 5 a 15 USD al mes, ver sección 5; la tarifa de Colombia no está confirmada). Lo pesado es el **trámite**: cuenta de empresa en Meta, verificación, número dedicado y plantillas aprobadas.
- **Recomendación [Criterio]:** (1) seguir con correo ahora; (2) agregar ya un aviso gratuito y casi instantáneo al celular de Jessica por otro canal (bot de Telegram, ver 4); (3) si Jessica quiere WhatsApp de verdad, hacerlo por la API oficial con un proveedor intermedio (Twilio o 360dialog) en una segunda fase, aceptando el trámite.
- **No usar** programas "no oficiales" que manejan WhatsApp Web: pueden hacer que Meta bloquee el número de Jessica.

## 2. WhatsApp Business Platform (API oficial de Meta)

### Qué exige
- **[Verificado]** Un portafolio de negocio de Meta, verificación de la empresa, y un número de teléfono que **no esté ya registrado en la app de WhatsApp**. Hasta verificar, solo hay un número de prueba con límites. Fuente: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started (consultada 2026-10-26).
- **[Verificado]** Para escribir a alguien fuera de una conversación abierta solo se pueden enviar **plantillas** con estado `APPROVED`. La revisión es automática y puede tardar hasta 24 horas. Categorías: autenticación, marketing, utilidad (la categoría afecta el precio). Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview (2026-10-26).
- **[Verificado]** Mensajes no-plantilla (texto libre) solo dentro de la "ventana de atención al cliente" de 24 h, que se abre cuando el usuario escribe y se reinicia con cada mensaje suyo. Fuente: https://developers.facebook.com/docs/whatsapp/pricing (2026-10-26).

### ¿Se puede usar el número actual de Jessica?
- **[Verificado, pero solo por proveedores, no por Meta]** El modo "Coexistence" permite conectar un número que **ya usa la app WhatsApp Business** (no la WhatsApp normal) y seguir usando la app a la vez. Exige app actualizada (versión 2.24.17 o superior según varios proveedores), actividad previa del número (los proveedores dicen entre "sin restricciones" y "al menos 7 días", no coinciden), y un Facebook Page con administrador. Limita funciones de la app (listas de difusión, mensajes temporales, etc.). Fuentes: https://help.seven.io/en/whatsapp/whatsapp-coexistence , https://docs.360dialog.com/docs/waba-management/embedded-signup/whatsapp-coexistence/coexistence-onboarding
- **[No verificado]** Si Meta exige verificación de empresa también en Coexistence, y si Colombia tiene alguna restricción. Confirmar con el proveedor elegido.
- **[Criterio]** Si el número personal de Jessica es WhatsApp **normal** (no Business), no sirve tal cual. La opción más limpia y barata de riesgo es un **número nuevo dedicado** (una SIM prepago) para el "remitente" del negocio. Jessica seguiría recibiendo los avisos en su número personal de siempre, que solo es el destinatario y no requiere ningún trámite.

### Costos de Meta
- **[Verificado]** Desde 1-jul-2025 Meta cobra **por mensaje entregado** (ya no por conversación) según categoría y país del destinatario. Los mensajes de usuario a empresa no se cobran. Desde 1-oct-2026 cada número recibe 1.000 mensajes de servicio gratis al mes (solo respuestas, no plantillas). Colombia (+57) tiene tarifa propia y se puede facturar en COP (desde 1-abr-2026, solo para cuentas WhatsApp Business nuevas con esa moneda elegida; no se puede cambiar después). Fuente: https://developers.facebook.com/docs/whatsapp/pricing
- **[Verificado]** Las plantillas de utilidad enviadas dentro de una ventana de 24 h abierta fueron gratis desde 1-jul-2025, pero **desde 1-oct-2026 su tipo de precio pasa de `free_customer_service` a `regular`, es decir, se cobran** (hoy es 2026-10-26). La excepción son las ventanas de "punto de entrada gratuito" (cuando el cliente escribe desde un anuncio de Click to WhatsApp), donde Meta no cobra plantillas por hasta 7 días. Lo único gratis de forma general son los mensajes de servicio (respuestas libres, no plantillas): 1.000 al mes por número. Fuente: https://developers.facebook.com/docs/whatsapp/pricing (consultada 2026-10-26). **Consecuencia:** cada aviso por plantilla se cobra aunque Jessica haya escrito antes; abrir la ventana no ahorra costo.
- **[No verificado, importante]** La tarifa oficial de Colombia no pude leerla (está en archivos de tarifas que mi herramienta no abrió). Cifras de terceros, contradictorias: utilidad 0,0009 USD (Gallabox, vigente 1-oct-2026, https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card.md), 0,00024 USD (tabla de 2025) o 0,01 USD (Edna); marketing ~0,0125 a 0,0144 USD. **Hay que leer la tarifa de Colombia en el panel de Meta o pedirla al proveedor antes de presupuestar.**
- **[Criterio]** Los avisos de aprobación son de categoría **utilidad** (no marketing): son transaccionales, ligados a una solicitud que la clienta hizo. No incluir promociones en la plantilla o Meta puede reclasificarla como marketing (más cara).

### Botones y el enlace de aprobación
- **[Verificado]** Una plantilla puede tener un botón de **enlace (URL)** con etiqueta de hasta 25 caracteres; la URL admite **una variable al final** (ej. `https://sitio.com/aprobar?id={{1}}`), con valor de ejemplo al crear la plantilla. Hasta 2 botones URL y hasta 10 botones de respuesta rápida. Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components (2026-10-26).
- **[Criterio]** Encaja con el flujo actual: el botón "Revisar solicitud" abre `/aprobar?id=…`, tal cual el correo hoy. La decisión sigue en la página; no hace falta que Jessica responda dentro de WhatsApp. Ojo: la variable va **al final** de la URL, así que `id` debe ser lo último (hoy el enlace lleva el id; hay que revisar que no lleve otros parámetros después).
- Cuidado con el id/token en la URL: la plantilla lo enviaría a Meta/proveedor. Es el mismo secreto que hoy va por correo; aceptable, pero Jessica debe saberlo.

## 3. Proveedores intermedios

| | Twilio | 360dialog | Otros (Gupshup, Infobip, Wati, etc.) |
|---|---|---|---|
| Costo extra | **[Verificado]** 0,005 USD por mensaje (entrante y saliente) sobre la tarifa de Meta; 0,001 por mensaje fallido. https://www.twilio.com/en-us/whatsapp/pricing (2026-10-26) | **[Verificado]** Licencia mensual por número: plan regular 49 EUR (o 59 USD), plan premium 99 EUR (o 119 USD), sin recargo sobre Meta. https://docs.360dialog.com/docs/360dialog/prices-plans-and-payment-options | **[No verificado]** No los investigué |
| Para ~900 avisos/mes | ≈ 4,5 USD de Twilio + Meta | 49 EUR (59 USD) fijos + Meta | — |
| Ventaja | Pago por uso, SDK conocido, fácil de probar | Tarifa fija, cercano a la API de Meta | Algunos traen bandeja de chat |
| Desventaja | Costo por mensaje crece con el volumen | 49 EUR (59 USD) al mes es mucho para este volumen | Variable |

- **[Criterio]** Por volumen tan bajo, **Twilio** sale más barato (pago por uso) y 360dialog solo conviene si hay mucho más volumen. Hablar directo con la Cloud API de Meta evita el recargo, pero exige que el desarrollador mantenga más cosas (tokens, webhooks, verificación) sin soporte.
- Todos requieren igualmente cuenta de Meta, verificación y plantillas aprobadas: el intermediario reduce trabajo técnico, no el trámite del negocio.

## 4. Rutas rápidas y alternativas

### Enlaces `wa.me` (click to chat)
- **[Criterio, conocimiento general; no lo verifiqué hoy]** Un enlace `https://wa.me/57…?text=…` solo abre una conversación con texto prellenado y **la persona debe tocar "enviar"**. No sirve para avisos automáticos. Sí sirve para: botón en la página para que la clienta escriba a Jessica, o que Jessica le escriba a la clienta con un toque tras aprobar (un enlace en la página `/aprobar` tras decidir). Es gratis y sin riesgo. Esto cubre "el resultado también por WhatsApp" de forma manual.

### Librerías no oficiales (simulan WhatsApp Web)
- **[Verificado parcialmente]** Varias fuentes (todas de proveedores, no de Meta) coinciden: el envío automatizado con herramientas no oficiales va contra los términos de WhatsApp y suele terminar en suspensión temporal y luego bloqueo permanente. Fuentes: https://www.bot.space/blog/whatsapp-api-vs-unofficial-tools-a-complete-risk-reward-analysis-for-2025 , https://ninjateam.org/why-whatsapp-blocked-my-number-and-how-to-fix-it/ . No pude abrir el texto de los términos de WhatsApp: **[No verificado]** la cláusula exacta.
- **[Criterio]** Aunque el volumen sea pequeño, el riesgo no vale la pena: se pondría en juego el número con el que Jessica habla con sus clientas, y además exige un servidor siempre encendido con una sesión de WhatsApp (Netlify Functions no sirve para eso). **No recomendado.**

### Alternativa provisional: bot de Telegram (o similar) para Jessica
- **[Criterio, no verificado hoy]** Un bot de Telegram envía un mensaje con el enlace de aprobación al celular de Jessica, es gratis, no requiere verificación de empresa y se crea en minutos. El mensaje llega como notificación del celular. Telegram no publica límites exactos pero 30 mensajes al día es muy poco (fuente sobre límites, de terceros: https://grammy.dev/advanced/flood). Exige que Jessica instale Telegram, lo cual puede no gustarle.
- Otra opción: correo con notificación push en el celular (ya existe) y, en el celular, activar alertas prioritarias para el remitente. Costo cero y sin código.

## 5. Comparación de opciones (≈30 avisos/día ≈ 900/mes)

| Opción | Esfuerzo de Jessica | Costo mensual | Confiabilidad | Riesgos |
|---|---|---|---|---|
| A. Correo (hoy) | Ninguno | 0 | Buena; depende de que lea el correo | Puede quedar en spam / leerse tarde |
| B. Telegram bot a Jessica | Bajo (instalar app, iniciar el bot) | 0 | Buena | Un canal más; solo para Jessica, no clientas |
| C. API oficial vía Twilio | Alto una vez (Meta, verificación, número, plantilla) | ≈ 4,5 USD Twilio + Meta (cada aviso por plantilla se cobra; si utilidad ~0,001 USD: ≈ 1 USD; si fuera 0,01: ≈ 9 USD), total ≈ 5 a 14 USD. **Provisional: tarifa Colombia sin confirmar** | Alta | Rechazo de plantilla o verificación; demoras de trámite |
| D. API oficial vía 360dialog | Igual que C | 49 EUR (59 USD) + Meta | Alta | Caro para este volumen |
| E. API oficial directa a Meta | Igual que C | Solo Meta | Alta | Más trabajo técnico sin soporte |
| F. Librería no oficial | Medio (escanear QR, servidor) | Servidor propio | Frágil | **Bloqueo del número**; viola términos |
| G. Enlace `wa.me` manual | Un toque por mensaje | 0 | Depende de Jessica | Solo manual |

**Recomendación [Criterio]:** A ahora + B (opcional, para recibir al instante) + C como objetivo, con G para avisar a la clienta con un toque mientras tanto. Elegir C sobre D/E por costo y soporte; reevaluar si el volumen supera ~300 mensajes al día.

## 6. Qué cambiaría en el código (no implementado)

Hoy `Deps.mailer: Mailer` (`netlify/lib/types.ts`) y `requests.ts` arma correos con `emailForJessica` / `emailForClient` y los envía con una función interna `enviar(d, to, m, id)` (líneas ~35, 45, 53, 116, 176). Dirección propuesta:

```ts
// netlify/lib/types.ts (propuesta)
export interface Notice { subject: string; text: string; link?: { label: string; url: string } }
export type Recipient = { kind: 'jessica' } | { kind: 'client'; email: string; phone: string };
export interface Notifier { notify(to: Recipient, n: Notice, requestId: string): Promise<void> }
// Deps: mailer -> notifier (la implementación elegida; puede combinar varias)
```

- Una implementación por canal: `emailNotifier` (envuelve el `Mailer` actual), `whatsappNotifier` (plantilla con el enlace como variable del botón), `telegramNotifier` (opcional). Un `composeNotifier(...[])` envía por varios y **no falla si uno falla** (hoy `enviar` ya aísla errores; mantener esa regla: un fallo de aviso no debe bloquear aprobar/rechazar).
- Archivos a tocar: `netlify/lib/types.ts` (puerto), `netlify/lib/requests.ts` (usar `notifier`; cambiar `enviar`), `netlify/lib/emails.ts` (devolver un `Notice` neutro; el correo lo formatea), `netlify/lib/adapters.ts` (nuevas implementaciones), `netlify/lib/http.ts` y las funciones en `netlify/functions/` donde se construyen las `Deps`, tests en `netlify/lib/adapters.test.ts` y `netlify/tests/` (fake `Notifier`), `.env.example`, `README.md`.
- Variables de entorno nuevas (nombres propuestos): `WHATSAPP_PROVIDER` (`twilio`|`meta`), `WHATSAPP_ACCOUNT_SID` / `WHATSAPP_TOKEN` (según proveedor), `WHATSAPP_FROM` (número remitente), `JESSICA_WHATSAPP` (destino, formato internacional `+57…`), `WHATSAPP_TEMPLATE_JESSICA` (nombre/SID de la plantilla), y para avisos a la clienta `WHATSAPP_TEMPLATE_CLIENT`. Opcional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTIFY_CHANNELS` (ej. `email,whatsapp`).
- El flujo del enlace **no cambia**: la plantilla lleva `…/aprobar?id={{1}}` y la página y funciones de aprobación siguen igual. El corte nocturno ya lo decide `requests.ts`; el canal no interviene.
- **Fuera del alcance de WhatsApp-a-Jessica:** para avisos a la clienta hacen falta su consentimiento y teléfono con indicativo de país; el formulario hoy pide `phone` (revisar que se normalice a `+57…`) y conviene una casilla de consentimiento para WhatsApp. **[Criterio]**; los requisitos de opt-in de Meta no los verifiqué hoy.
- Plantillas nuevas por cada mensaje de la clienta (aprobada, rechazada, vencida) = 3 plantillas más, cada una con revisión de hasta 24 h.

## 7. Pasos de Jessica (para la opción recomendada, WhatsApp oficial vía Twilio)

1. Decidir qué número será el remitente: **un número nuevo** (SIM prepago, que no esté en WhatsApp) o el actual si es WhatsApp Business (Coexistence; confirmar condiciones con Twilio).
2. Crear o tener una cuenta de **Facebook** personal y un **portafolio comercial de Meta** (business.facebook.com) a nombre del negocio.
3. Tener a mano datos de la empresa para la **verificación de Meta**: nombre legal, dirección, teléfono, sitio web, y documento (RUT/cámara de comercio o equivalente si trabaja como persona natural). **[No verificado]** qué documentos acepta Meta en Colombia para persona natural; preguntar al proveedor.
4. Crear cuenta en Twilio, agregar tarjeta de pago y conectar el número a WhatsApp (el asistente lo guía; quizá deba recibir un código por SMS o llamada en el número remitente).
5. Dar al desarrollador acceso a las credenciales (como variables en Netlify, nunca por chat ni en el repositorio).
6. Aprobar el texto de las plantillas (el desarrollador las propone, Meta las revisa, hasta 24 h; si las rechazan se ajustan y se reenvían).
7. Probar con una solicitud real de prueba; confirmar que el botón abre la página de aprobación en su celular.
8. Mientras tanto: activar el aviso por correo con notificación prioritaria en el celular.

## 8. Preguntas abiertas para la dueña

1. ¿Su número actual es WhatsApp **Business** o WhatsApp normal? ¿Está dispuesta a comprar un número nuevo solo para el negocio?
2. ¿Trabaja como persona natural o tiene empresa registrada (RUT, cámara de comercio)? Define la verificación.
3. ¿Cuánto está dispuesta a pagar al mes (lo previsto es provisional: unos 5 a 15 USD, porque la tarifa de Colombia no está confirmada; 59 USD de 360dialog no)?
4. ¿Quiere recibir los avisos de **nuevas** solicitudes por WhatsApp solamente, o también algo para la clienta (aprobada/rechazada/vencida)?
5. ¿Las clientas aceptan recibir mensajes de WhatsApp del negocio (consentimiento)? ¿Se agrega la casilla al formulario?
6. ¿Instalaría Telegram como solución provisional, o prefiere solo correo hasta tener WhatsApp?
7. ¿Hora exacta del corte nocturno? (Pendiente desde el diseño; afecta cuándo se pueden enviar avisos.)

## Fuentes consultadas (2026-10-26)
- https://developers.facebook.com/docs/whatsapp/pricing
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components
- https://www.twilio.com/en-us/whatsapp/pricing
- https://docs.360dialog.com/docs/360dialog/prices-plans-and-payment-options
- https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card.md (tercero)
- https://help.seven.io/en/whatsapp/whatsapp-coexistence , https://docs.360dialog.com/docs/waba-management/embedded-signup/whatsapp-coexistence/coexistence-onboarding
- https://www.bot.space/blog/whatsapp-api-vs-unofficial-tools-a-complete-risk-reward-analysis-for-2025 , https://ninjateam.org/why-whatsapp-blocked-my-number-and-how-to-fix-it/ (terceros)
