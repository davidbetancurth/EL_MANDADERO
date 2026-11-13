-- =====================================================================
-- DATOS DE PRUEBA (DEMO) — bórralos antes de salir a producción.
-- Son barrios reales de Manizales que aparecieron en las fuentes que revisé,
-- pero SIN sector asignado y marcados como no verificados.
-- La lista completa y oficial se carga con importar_barrios.sql
-- =====================================================================
insert into public.barrios (nombre, verificado) values
  ('Palermo', false), ('Milán', false), ('Chipre', false), ('San Cayetano', false),
  ('Viveros', false), ('Cervantes', false), ('San Joaquín', false), ('Pío XII', false),
  ('La Sultana', false), ('Baja Suiza', false)
on conflict do nothing;

-- Para probar un repartidor: regístralo desde la app y luego apruébalo así:
--   update public.repartidores set aprobado = true
--   where id = (select id from public.profiles where documento = 'TU_DOCUMENTO');
