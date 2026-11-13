-- =====================================================================
-- CARGA DE BARRIOS OFICIALES
-- 1) Llena datos/barrios_manizales.csv  (columnas: sector,barrio)
-- 2) En Supabase → Table Editor → crea la tabla "barrios_import" (sector text, barrio text)
--    e impórtale el CSV con el botón "Import data from CSV".
-- 3) Ejecuta este archivo.
-- =====================================================================
insert into public.sectores (nombre)
select distinct trim(sector) from public.barrios_import
where coalesce(trim(sector), '') <> ''
on conflict (nombre) do nothing;

insert into public.barrios (nombre, sector_id, verificado)
select distinct trim(i.barrio), s.id, true
from public.barrios_import i
left join public.sectores s on s.nombre = trim(i.sector)
where coalesce(trim(i.barrio), '') <> ''
on conflict (nombre, sector_id) do nothing;

drop table public.barrios_import;
