# Zona Impacto — versión React

Conversión a React (Vite) del sitio de reservas de paintball, manteniendo el
mismo diseño y la misma lógica de reserva (guardado en Supabase + envío del
resumen por WhatsApp).

## Cómo correrlo

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Copia el archivo `.env.example` a `.env` y confirma tus credenciales de Supabase:
   ```bash
   cp .env.example .env
   ```

3. Levanta el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Para generar la versión de producción:
   ```bash
   npm run build
   ```
   Los archivos quedan listos en la carpeta `dist/`.

## Estructura

```
src/
  components/
    Header.jsx        Barra de navegación + menú móvil
    Hero.jsx           Sección principal
    ComoFunciona.jsx    Pasos del proceso
    Campos.jsx          Los 3 terrenos de juego
    Paquetes.jsx        Precios y paquetes
    Impacto.jsx         Franja de "marcas de la jornada"
    Testimonios.jsx      Opiniones de clientes
    Reserva.jsx          Formulario de reserva (Supabase + WhatsApp)
    Footer.jsx
  supabaseClient.js    Cliente de Supabase y función de guardado
  App.jsx              Ensambla todas las secciones
  styles.css           Mismos estilos del sitio original
```

## Notas de la conversión

- El formulario ahora vive en el estado de React (`useState`) en vez de leer
  el DOM con `document.getElementById`.
- La generación del mensaje de WhatsApp y el guardado en Supabase se movieron
  a `src/components/Reserva.jsx` y `src/supabaseClient.js`, con la misma
  lógica que tenía tu `main.js`.
- Las credenciales de Supabase ahora se leen de variables de entorno
  (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) en vez de estar escritas
  directo en el código. Esto es más seguro si vas a subir el proyecto a un
  repositorio público.
- En el HTML original había dos botones en el formulario (uno tipo
  `button` para WhatsApp y otro tipo `submit` sin acción real). Los unifiqué
  en un solo botón de envío para evitar el comportamiento duplicado/confuso.
- Agregué al `:root` las variables de color `--paint-magenta`, `--paint-cyan`,
  `--paint-yellow` y `--mud`, que el CSS original usaba pero no estaban
  definidas.

---

## Roles, panel y base de datos

Ejecuta en Supabase → **SQL Editor** estos tres archivos, **en este orden** (cada uno se puede repetir sin problema):

1. `supabase/schema.sql` — usuarios, perfiles, historial de registros, reservas y tickets.
2. `supabase/inventario_contabilidad.sql` — inventario y contabilidad.
3. `supabase/roles_whatsapp.sql` — rol **cajera**, soporte solo para errores y cola de WhatsApp.

Después regístrate en la web y hazte administrador:
```sql
update public.perfiles set rol = 'administrador' where email = 'TU_CORREO@ejemplo.com';
```
Desde **Panel → Usuarios y roles** el administrador asigna los demás roles (y el WhatsApp de la cajera).

| Rol | Qué puede hacer |
|---|---|
| **usuario** | Sus reservas (crear, editar, cancelar) y reportar errores en **Soporte** |
| **cajera** | Gestiona **todas las reservas** (confirmar, editar, crear presenciales), usa el **inventario** y recibe por WhatsApp los avisos de nuevas reservas. También puede reportar errores. No ve contabilidad, usuarios ni historial |
| **soporte** | **Solo** atiende los reportes de errores técnicos de la página. No ve reservas ni inventario |
| **administrador** | Todo: reservas, errores, inventario, contabilidad, WhatsApp, historial de registros y usuarios |

El panel está en `#/panel` (ej.: `http://localhost:5173/#/panel`) y también se abre desde el menú del usuario.

## Reservas y WhatsApp automático

Al reservar, el cliente recibe la confirmación por WhatsApp y la cajera recibe el aviso, sin intervención manual.
La guía completa está en [`whatsapp-bot/README.md`](whatsapp-bot/README.md). Resumen:
1. Ejecuta `roles_whatsapp.sql` en Supabase.
2. En el panel crea la cajera (rol **cajera** + su número de WhatsApp).
3. En la carpeta `whatsapp-bot`: `npm install`, completa `.env` y `npm start`; escanea el QR.
4. Pon el número del negocio en el `.env` de la página: `VITE_WHATSAPP_NEGOCIO=57300XXXXXXX` (se usa en los enlaces "Escribir a caja").

## Recuperar contraseña ("Olvidé mi contraseña")

Funciona con el correo de Supabase. Configuración obligatoria en Supabase:

1. **Authentication → URL Configuration**
   - *Site URL*: la dirección de tu web (en desarrollo `http://localhost:5173`).
   - *Redirect URLs*: agrega `http://localhost:5173` y, cuando publiques, la URL real de tu sitio.
   Si la dirección no está en esa lista, el enlace del correo no vuelve a tu web.
2. El plan gratuito envía pocos correos por hora. Para producción conecta tu propio SMTP en
   *Authentication → SMTP Settings*.
3. Opcional: personaliza el correo en *Authentication → Email Templates → Reset Password*.

## Inventario y contabilidad

Requiere haber ejecutado `supabase/inventario_contabilidad.sql` (paso 2 de la sección anterior). Como administrador aparecen las pestañas **Inventario** y **Contabilidad**.

| Rol | Inventario | Contabilidad |
|---|---|---|
| administrador | Crear/editar/desactivar/eliminar productos y registrar movimientos | Todo: ingresos, gastos, reportes y exportar CSV |
| cajera | Ver productos y registrar entradas, salidas y ajustes | Sin acceso |
| soporte | Sin acceso | Sin acceso |
| usuario | Sin acceso | Sin acceso |

- Cada **entrada, salida o ajuste** queda en el kardex (no se puede editar ni borrar) y actualiza el stock automáticamente.
- No se permite una salida mayor al stock disponible.
- Una **entrada con costo** puede registrarse sola como gasto ("Compra de inventario").
- Las **reservas confirmadas o completadas** se registran como ingreso con un clic (una reserva solo puede registrarse una vez).
