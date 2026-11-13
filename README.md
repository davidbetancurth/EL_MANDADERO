# El Mandadero · conectado con Supabase

App de mandados por barrio para Manizales: usuarios piden por voz (IA), un repartidor de su barrio compra y entrega
(máx. **6 repartidores por barrio**, en bicicleta, bicicleta eléctrica o patineta eléctrica).

## 1. Puesta en marcha

```bash
pnpm install            # instala @supabase/supabase-js y leaflet (ya están en package.json)
cp .env.example .env    # y llena URL y ANON KEY de Supabase → Project Settings → API
pnpm dev
```

## 2. Configurar Supabase (en este orden)

1. **SQL Editor** → pega y ejecuta `supabase/migrations/20261110000000_el_mandadero.sql`.
2. **Authentication → Providers → Email**: desactiva **"Confirm email"** (el correo interno es ficticio: `documento@elmandadero.app`).
   Activa también protección contra fuerza bruta / CAPTCHA si tu plan lo permite: el PIN es de solo 4 dígitos.
3. **Barrios**: para probar, ejecuta `supabase/seed_demo.sql` (10 barrios DEMO).
   Para producción: llena `datos/barrios_manizales.csv` (`sector,barrio`) con la lista oficial de Planeación Municipal
   y sigue las instrucciones de `supabase/importar_barrios.sql`.
4. **Asistente de voz (IA)**:
   ```bash
   supabase login && supabase link --project-ref TU_REF
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy interpretar-pedido
   ```
5. **Aprobar repartidores** (ven pedidos solo cuando `aprobado = true`; hazlo tras verificar identidad y antecedentes):
   ```sql
   update public.repartidores set aprobado = true
   where id = (select id from public.profiles where documento = 'DOCUMENTO');
   ```
   Las fotos de selfie y cédula quedan en el bucket privado `verificaciones` (Storage → verificaciones → carpeta del usuario).

## 3. Cómo funciona

| Pieza | Dónde |
|---|---|
| Barrios y sectores (comunas) | tablas `sectores`, `barrios` |
| 6 repartidores por barrio | `repartidores` con `unique (barrio_id, cupo)` y cupo 1–6; la función `completar_registro` toma el primer cupo libre y devuelve `BARRIO_LLENO` si no hay |
| Asignación de pedidos | `crear_pedido` → `buscar_repartidor`: primero mismo barrio, luego mismo sector; si nadie está libre queda en `buscando` y cualquier repartidor de la zona puede tomarlo (`reclamar_pedido`) |
| Seguimiento en vivo | Realtime sobre `pedidos` y `ubicaciones_repartidor` + ruta en el mapa |
| Voz | micrófono (solo al tocarlo) → texto → Edge Function → Claude devuelve el pedido estructurado → se confirma en voz alta → pantalla de pedido |
| Pagos | efectivo: el repartidor adelanta la compra, registra el total y cobra compras + domicilio (`config.costo_domicilio`, $3.500 por defecto) |
| Seguridad | RLS en todas las tablas; los pedidos solo se crean/modifican con funciones `security definer` |

## 4. Cosas que debes saber (límites actuales)

- **Barrios:** no incluí una lista de barrios "oficial" porque no encontré una descargable con nombres. La Alcaldía reporta 12 comunas y 131 barrios urbanos con junta comunal; verifica contra Planeación antes de cargar.
- **Login documento + PIN:** funciona sobre email+contraseña de Supabase (contraseña = `mandadero-` + PIN). Un PIN de 4 dígitos es débil. Recomendado a futuro: OTP por celular.
- **Mapa:** usa OpenStreetMap + Nominatim (direcciones) + OSRM demo (rutas). Son servicios gratuitos de **demostración**, con límites de uso. Para producción cambia `src/lib/geo.ts` por Google Maps Platform o Mapbox. La ruta de OSRM demo es en auto; el tiempo estimado se calcula con la velocidad del vehículo (`VEHICULOS` en `src/lib/types.ts`).
- **Voz en el navegador:** el dictado usa `SpeechRecognition`. En Chrome el audio lo procesa Google. En la app nativa usa un plugin de reconocimiento de voz en el dispositivo y actualiza el texto de consentimiento si cambias de proveedor.
- **Barrio por dirección:** hoy el barrio lo elige la persona de una lista (la dirección escrita no identifica el barrio por sí sola). Para asignarlo automáticamente se necesitan los polígonos de barrios (PostGIS).
- **No probado:** el código no se pudo compilar ni ejecutar contra un Supabase real en mi entorno (sin red). Pasó la revisión de sintaxis; faltan `pnpm install`, `pnpm build` y una prueba de punta a punta.
- **Pendiente:** panel para que tú apruebes repartidores y revises fotos (por ahora es por SQL/Dashboard), calificaciones, pago de facturas más allá del flujo de pedido, "recuperar PIN".

## 5. App nativa (Capacitor)

```bash
pnpm add @capacitor/core @capacitor/geolocation && pnpm add -D @capacitor/cli
pnpm build && npx cap add android && npx cap add ios && npx cap sync
```

- Recomendado: **dos apps** (usuario y repartidor) con este mismo código. La del usuario no pide ubicación en segundo plano.
- Repartidor: la ubicación con la pantalla apagada requiere un plugin de *background geolocation* (en Android, notificación fija obligatoria; en iOS, justificación para la revisión de Apple). Verifica el plugin vigente antes de elegirlo.
- Las pantallas ya envían la posición con `actualizar_ubicacion`; solo hay que reemplazar `vigilarPosicion` en `src/lib/geo.ts` por el plugin.
