# Bot de WhatsApp de Zona Impacto

Envía **automáticamente y sin costo por mensaje** los avisos de las reservas:

| Cuándo | A quién | Mensaje |
|---|---|---|
| El cliente hace una reserva en la página | Cliente | "Recibimos tu solicitud…" |
| El cliente hace una reserva en la página | **Cajera(s)** | "🆕 Nueva reserva #12 …" con enlace al panel |
| La cajera confirma / aplaza / completa / cancela | Cliente | Mensaje según el estado |
| La cajera cambia fecha, hora o campo de una reserva confirmada | Cliente | "Actualizamos tu reserva" |
| El cliente cancela desde su panel | Cajera(s) | "❌ El cliente canceló…" |
| El día anterior (entre 8 a. m. y 8 p. m.) | Cliente | Recordatorio |

Usa la librería gratuita **[Baileys](https://github.com/WhiskeySockets/Baileys)** (licencia MIT): se conecta a tu WhatsApp como un "dispositivo vinculado", igual que WhatsApp Web.

## ⚠️ Léelo antes de empezar

- **Baileys no es oficial.** WhatsApp no la autoriza y, en teoría, puede bloquear el número. El riesgo baja mucho si: usas un **número dedicado al negocio** (no tu número personal), solo escribes a personas que **acaban de reservar contigo** (como hace este bot), y no envías cientos de mensajes. El bot ya incluye protecciones: pausas aleatorias entre mensajes, "escribiendo…", máximo de mensajes por hora y verificación de que el número tiene WhatsApp.
- **La alternativa oficial** es la *WhatsApp Business Platform (Cloud API)* de Meta: es 100 % legítima pero **cobra por cada mensaje** de confirmación que se envía a un cliente que no te ha escrito primero (la tarifa depende del país). Si el negocio crece, es la opción recomendada.
- **Tiene que estar encendido.** El bot es un programa que debe estar corriendo para enviar. Si se apaga, los mensajes **no se pierden**: quedan en cola y salen cuando vuelva a encender.

## Qué necesitas

1. **Node.js 20 o superior** → https://nodejs.org (versión LTS).
2. Un **celular con WhatsApp** (de preferencia WhatsApp Business) con el número del negocio.
3. Un computador que pueda quedar encendido (el de caja sirve para empezar).
4. Haber ejecutado en Supabase los tres archivos SQL: `schema.sql`, `inventario_contabilidad.sql` y `roles_whatsapp.sql` (en ese orden).

## Instalación (una sola vez)

1. Abre una terminal en esta carpeta (`whatsapp-bot`).
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Copia `.env.example` como `.env` (en Windows: `copy .env.example .env`) y ábrelo.
4. Completa **tres datos**:
   - `SUPABASE_URL` → la misma URL del `.env` de la página.
   - `SUPABASE_ANON_KEY` → la misma clave pública (publishable/anon) de la página.
   - `BOT_SECRET` → entra a la página como administrador → **WhatsApp → "Datos para conectar el bot"** → *Mostrar* → *Copiar*.
   
   Y ajusta los datos del negocio (nombre, ubicación, teléfono, `PANEL_URL`).
5. Inicia el bot:
   ```bash
   npm start
   ```
6. Aparece un **código QR** en la terminal. En el celular del negocio: **WhatsApp → Dispositivos vinculados → Vincular un dispositivo** y escanéalo.
7. Cuando veas `🟢 WhatsApp conectado`, listo. En el panel (**WhatsApp**) verás el estado "Conectado".

> La sesión queda guardada en la carpeta `sesion/`. No hay que volver a escanear el QR cada vez. **No compartas esa carpeta ni el `.env`.**

## Cajeras: quién recibe los avisos

En el panel, como administrador: **Usuarios y roles → Editar** a la persona → rol **cajera** → escribe su **número de WhatsApp**. Cada cajera activa con número recibe el aviso de cada nueva reserva. Si no hay ninguna, el panel te lo advierte.

> Puedes usar el mismo número del bot como número de la cajera: WhatsApp lo muestra en "Mensajes contigo mismo".

## Dejarlo funcionando siempre

- **Windows:** crea un acceso directo a un archivo `iniciar-bot.bat` con `cd /d C:\ruta\whatsapp-bot` y `npm start`, y ponlo en la carpeta de *Inicio* (`Win + R` → `shell:startup`).
- **Servidor o Linux/Mac:** usa [pm2](https://pm2.keymetrics.io): `npm i -g pm2`, luego `pm2 start src/index.js --name bot-zona-impacto` y `pm2 save && pm2 startup`.
- Hosting gratis con disco persistente: Oracle Cloud *Always Free*, o un Raspberry Pi. En hostings gratuitos que borran el disco en cada reinicio tendrías que escanear el QR de nuevo cada vez.

## Apagar o probar

- **Interruptor en el panel** (WhatsApp → "Envío automático"): pausa todos los mensajes sin apagar el bot.
- Los mensajes con error (por ejemplo, un número sin WhatsApp) aparecen en el registro con el motivo y un botón **Reintentar**.
- Pruebas automáticas del bot: `npm test`.

## Cómo funciona por dentro

```
Página / Panel ──► Supabase (tabla reservas)
                       │ trigger SQL
                       ▼
              notificaciones_whatsapp  (cola)
                       ▲
        el bot pregunta cada 5 s ──┘ ──► WhatsApp (Baileys) ──► cliente / cajera
```
El bot **no usa la clave `service_role`** de Supabase: solo la clave pública más su `BOT_SECRET`, y únicamente puede ejecutar 5 funciones (tomar pendientes, reportar resultado, recordatorios, latido). Si alguien obtuviera el `BOT_SECRET`, no podría leer ni modificar el resto de tu base de datos.

## Problemas comunes

| Síntoma | Solución |
|---|---|
| `Falta configurar en el archivo .env` | Copia `.env.example` como `.env` y complétalo. |
| `No pude contactar a Supabase…` / `No autorizado` | Revisa `SUPABASE_URL`, la clave y que `BOT_SECRET` sea idéntico al del panel. Verifica que ejecutaste `roles_whatsapp.sql`. |
| El panel dice "Bot apagado" | El programa no está corriendo. Ejecuta `npm start`. |
| Pide el QR otra vez | Cerraste la sesión desde el celular. Vuelve a escanear. |
| "Ese número no tiene WhatsApp" | El cliente escribió mal el número o no usa WhatsApp. Contáctalo por otro medio. |
| No llega el aviso a la cajera | Revisa que su rol sea **cajera**, esté activa y tenga número en *Usuarios y roles*. |
