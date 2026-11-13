-- =====================================================================
-- EL MANDADERO · Esquema inicial
-- Pega este archivo completo en Supabase → SQL Editor → Run
-- (o usa `supabase db push` si trabajas con la CLI)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_usuario    as enum ('usuario', 'repartidor', 'admin');
create type public.vehiculo_tipo  as enum ('patineta_electrica', 'bicicleta_electrica', 'bicicleta');
create type public.estado_pedido  as enum ('buscando', 'asignado', 'comprando', 'en_camino', 'entregado', 'cancelado');

-- ---------------------------------------------------------------------
-- Sectores (comunas) y barrios de Manizales
-- ---------------------------------------------------------------------
create table public.sectores (
  id     smallint generated always as identity primary key,
  nombre text not null unique
);

create table public.barrios (
  id         int generated always as identity primary key,
  nombre     text not null,
  sector_id  smallint references public.sectores(id),
  verificado boolean not null default false,   -- true = viene de la lista oficial
  activo     boolean not null default true,
  unique (nombre, sector_id)
);
create index barrios_sector_idx on public.barrios(sector_id);

-- ---------------------------------------------------------------------
-- Perfiles (1 a 1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  rol                         public.rol_usuario not null default 'usuario',
  nombre_completo             text not null,
  edad                        int  not null check (edad between 18 and 120),
  tipo_documento              text not null check (tipo_documento in ('CC', 'CE')),
  documento                   text not null unique,
  celular                     text not null,
  correo                      text,
  barrio_id                   int references public.barrios(id),
  letra_grande                boolean not null default false,
  saludo_voz                  boolean not null default true,
  contacto_emergencia_nombre  text,
  contacto_emergencia_celular text,
  creado_en                   timestamptz not null default now()
);

create table public.direcciones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  etiqueta    text not null default 'Casa',
  direccion   text not null,
  indicaciones text,
  barrio_id   int references public.barrios(id),
  barrio_texto text,                      -- si el usuario no encontró su barrio
  lat         double precision,
  lng         double precision,
  es_principal boolean not null default false,
  creado_en   timestamptz not null default now()
);
create index direcciones_user_idx on public.direcciones(user_id);

-- Barrios que la gente escribió porque no estaban en la lista (para que los revises)
create table public.barrios_sugeridos (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references public.profiles(id) on delete set null,
  nombre    text not null,
  resuelto  boolean not null default false,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Repartidores: máximo 6 por barrio (cupo 1..6)
-- ---------------------------------------------------------------------
create table public.repartidores (
  id           uuid primary key references public.profiles(id) on delete cascade,
  barrio_id    int not null references public.barrios(id),
  cupo         smallint not null check (cupo between 1 and 6),
  vehiculo     public.vehiculo_tipo not null,
  disponible   boolean not null default false,
  aprobado     boolean not null default false,   -- lo activas tú tras revisar identidad/antecedentes
  calificacion numeric(2,1) not null default 5.0,
  creado_en    timestamptz not null default now(),
  unique (barrio_id, cupo)                        -- ← la base de datos impide el séptimo
);

-- ---------------------------------------------------------------------
-- Verificación de identidad y consentimientos
-- ---------------------------------------------------------------------
create table public.verificaciones (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  ruta_selfie      text,
  ruta_doc_frente  text,
  ruta_doc_reverso text,
  estado           text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  creado_en        timestamptz not null default now()
);

create table public.consentimientos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  version            text not null,
  acepta_datos       boolean not null,
  acepta_biometricos boolean not null,
  acepta_ubicacion   boolean not null default false,
  fecha              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Configuración
-- ---------------------------------------------------------------------
create table public.config (
  clave text primary key,
  valor jsonb not null
);
insert into public.config(clave, valor) values ('costo_domicilio', '3500'::jsonb);

-- ---------------------------------------------------------------------
-- Pedidos (mandados): lista libre, el repartidor compra donde corresponda
-- ---------------------------------------------------------------------
create table public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity,
  tipo             text not null default 'mandado' check (tipo in ('mandado','factura')),
  user_id          uuid not null references public.profiles(id),
  repartidor_id    uuid references public.repartidores(id),
  barrio_id        int  not null references public.barrios(id),
  sector_id        smallint references public.sectores(id),
  estado           public.estado_pedido not null default 'buscando',
  items            jsonb not null,           -- [{producto, cantidad, unidad, nota}]
  transcripcion    text,                     -- lo que dijo el usuario (solo texto, nunca audio)
  sitio_sugerido   text,
  presupuesto_max  int check (presupuesto_max is null or presupuesto_max >= 0),
  direccion_texto  text not null,
  lat              double precision,
  lng              double precision,
  notas            text,
  metodo_pago      text not null default 'efectivo',
  total_productos  int,                      -- lo registra el repartidor tras comprar
  costo_domicilio  int not null,
  -- copias (snapshot) para que cada parte vea lo que necesita sin abrir perfiles ajenos
  cliente_nombre     text,
  cliente_celular    text,
  repartidor_nombre  text,
  repartidor_celular text,
  vehiculo           public.vehiculo_tipo,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50)
);
create index pedidos_user_idx    on public.pedidos(user_id, creado_en desc);
create index pedidos_rep_idx     on public.pedidos(repartidor_id, estado);
create index pedidos_buscando_idx on public.pedidos(barrio_id) where estado = 'buscando';

create table public.ubicaciones_repartidor (
  pedido_id      uuid primary key references public.pedidos(id) on delete cascade,
  repartidor_id  uuid not null references public.repartidores(id),
  lat            double precision not null,
  lng            double precision not null,
  actualizado_en timestamptz not null default now()
);

create table public.solicitudes_acompanamiento (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  tipo      text not null,
  detalle   text,
  barrio_id int references public.barrios(id),
  estado    text not null default 'buscando',
  creado_en timestamptz not null default now()
);

create or replace function public.tocar_actualizado() returns trigger
language plpgsql as $$
begin new.actualizado_en = now(); return new; end $$;

create trigger pedidos_tocar before update on public.pedidos
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'admin');
$$;

-- Cupos libres de repartidores en un barrio (público: se muestra al registrarse)
create or replace function public.cupos_libres(p_barrio int) returns int
language sql stable security definer set search_path = public as $$
  select 6 - count(*)::int from public.repartidores where barrio_id = p_barrio;
$$;

-- Busca un repartidor libre: primero del mismo barrio, luego del mismo sector
create or replace function public.buscar_repartidor(p_barrio int, p_sector smallint) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select r.id into v
  from public.repartidores r
  join public.barrios b on b.id = r.barrio_id
  where r.aprobado and r.disponible
    and (r.barrio_id = p_barrio or (p_sector is not null and b.sector_id = p_sector))
    and not exists (
      select 1 from public.pedidos p
      where p.repartidor_id = r.id and p.estado in ('asignado','comprando','en_camino')
    )
  order by (r.barrio_id = p_barrio) desc, r.calificacion desc
  limit 1
  for update of r skip locked;
  return v;
end $$;

-- ---------------------------------------------------------------------
-- Registro: crea perfil, dirección, consentimiento y (si aplica) cupo de repartidor
-- ---------------------------------------------------------------------
create or replace function public.completar_registro(
  p_rol public.rol_usuario, p_nombre text, p_edad int, p_tipo_doc text, p_documento text,
  p_celular text, p_correo text, p_direccion text, p_barrio_id int, p_barrio_texto text,
  p_indicaciones text, p_lat double precision, p_lng double precision,
  p_vehiculo public.vehiculo_tipo,
  p_acepta_datos boolean, p_acepta_biometricos boolean, p_acepta_ubicacion boolean,
  p_ruta_selfie text, p_ruta_doc_frente text, p_ruta_doc_reverso text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_cupo smallint;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  if p_rol not in ('usuario', 'repartidor') then raise exception 'ROL_INVALIDO'; end if;
  if not (coalesce(p_acepta_datos, false) and coalesce(p_acepta_biometricos, false)) then
    raise exception 'SIN_CONSENTIMIENTO';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then raise exception 'YA_REGISTRADO'; end if;
  if p_edad < 18 then raise exception 'MENOR_DE_EDAD'; end if;

  if p_rol = 'repartidor' then
    if p_vehiculo is null then raise exception 'SIN_VEHICULO'; end if;
    if p_barrio_id is null then raise exception 'SIN_BARRIO'; end if;
    perform pg_advisory_xact_lock(p_barrio_id);      -- evita que dos personas tomen el último cupo
    select s::smallint into v_cupo
    from generate_series(1, 6) s
    where not exists (select 1 from public.repartidores r where r.barrio_id = p_barrio_id and r.cupo = s)
    order by s limit 1;
    if v_cupo is null then raise exception 'BARRIO_LLENO'; end if;
  end if;

  insert into public.profiles(id, rol, nombre_completo, edad, tipo_documento, documento, celular, correo, barrio_id)
  values (v_uid, p_rol, trim(p_nombre), p_edad, p_tipo_doc, regexp_replace(p_documento, '\D', '', 'g'),
          p_celular, nullif(trim(coalesce(p_correo, '')), ''), p_barrio_id);

  insert into public.direcciones(user_id, direccion, indicaciones, barrio_id, barrio_texto, lat, lng, es_principal)
  values (v_uid, trim(p_direccion), p_indicaciones, p_barrio_id, nullif(trim(coalesce(p_barrio_texto, '')), ''), p_lat, p_lng, true);

  if p_barrio_id is null and coalesce(trim(p_barrio_texto), '') <> '' then
    insert into public.barrios_sugeridos(user_id, nombre) values (v_uid, trim(p_barrio_texto));
  end if;

  insert into public.consentimientos(user_id, version, acepta_datos, acepta_biometricos, acepta_ubicacion)
  values (v_uid, 'v1', p_acepta_datos, p_acepta_biometricos, coalesce(p_acepta_ubicacion, false));

  if p_ruta_selfie is not null or p_ruta_doc_frente is not null or p_ruta_doc_reverso is not null then
    insert into public.verificaciones(user_id, ruta_selfie, ruta_doc_frente, ruta_doc_reverso)
    values (v_uid, p_ruta_selfie, p_ruta_doc_frente, p_ruta_doc_reverso);
  end if;

  if p_rol = 'repartidor' then
    insert into public.repartidores(id, barrio_id, cupo, vehiculo) values (v_uid, p_barrio_id, v_cupo, p_vehiculo);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_items jsonb, p_tipo text, p_direccion text, p_lat double precision, p_lng double precision,
  p_barrio_id int, p_notas text, p_presupuesto int, p_transcripcion text, p_sitio text
) returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_perfil public.profiles;
  v_sector smallint;
  v_costo  int;
  v_rep    uuid;
  v_ped    public.pedidos;
begin
  if v_uid is null then raise exception 'NO_AUTENTICADO'; end if;
  select * into v_perfil from public.profiles where id = v_uid and rol = 'usuario';
  if not found then raise exception 'SOLO_USUARIOS'; end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'LISTA_INVALIDA';
  end if;
  if p_tipo not in ('mandado', 'factura') then raise exception 'TIPO_INVALIDO'; end if;
  if coalesce(trim(p_direccion), '') = '' then raise exception 'SIN_DIRECCION'; end if;
  if p_barrio_id is null then raise exception 'SIN_BARRIO'; end if;

  select sector_id into v_sector from public.barrios where id = p_barrio_id and activo;
  if not found then raise exception 'BARRIO_INVALIDO'; end if;

  if (select count(*) from public.pedidos
      where user_id = v_uid and estado in ('buscando','asignado','comprando','en_camino')) >= 3 then
    raise exception 'DEMASIADOS_PEDIDOS';
  end if;

  select (valor #>> '{}')::int into v_costo from public.config where clave = 'costo_domicilio';
  v_costo := coalesce(v_costo, 3500);

  insert into public.pedidos(tipo, user_id, barrio_id, sector_id, items, transcripcion, sitio_sugerido,
    presupuesto_max, direccion_texto, lat, lng, notas, costo_domicilio, cliente_nombre, cliente_celular)
  values (p_tipo, v_uid, p_barrio_id, v_sector, p_items, left(p_transcripcion, 1000), left(p_sitio, 200),
    p_presupuesto, left(trim(p_direccion), 300), p_lat, p_lng, left(p_notas, 500), v_costo,
    v_perfil.nombre_completo, v_perfil.celular)
  returning * into v_ped;

  v_rep := public.buscar_repartidor(p_barrio_id, v_sector);
  if v_rep is not null then
    update public.pedidos set
      repartidor_id = v_rep,
      estado = 'asignado',
      repartidor_nombre  = (select nombre_completo from public.profiles where id = v_rep),
      repartidor_celular = (select celular from public.profiles where id = v_rep),
      vehiculo           = (select vehiculo from public.repartidores where id = v_rep)
    where id = v_ped.id
    returning * into v_ped;
  end if;
  return v_ped;
end $$;

create or replace function public.reclamar_pedido(p_id uuid) returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare
  v_r   public.repartidores;
  v_ped public.pedidos;
  v_sector_rep smallint;
begin
  select * into v_r from public.repartidores where id = auth.uid() and aprobado for update;
  if not found then raise exception 'NO_APROBADO'; end if;
  if exists (select 1 from public.pedidos where repartidor_id = v_r.id and estado in ('asignado','comprando','en_camino')) then
    raise exception 'YA_TIENES_PEDIDO';
  end if;
  select * into v_ped from public.pedidos where id = p_id and estado = 'buscando' for update;
  if not found then raise exception 'PEDIDO_NO_DISPONIBLE'; end if;
  select sector_id into v_sector_rep from public.barrios where id = v_r.barrio_id;
  if not (v_ped.barrio_id = v_r.barrio_id or (v_ped.sector_id is not null and v_ped.sector_id = v_sector_rep)) then
    raise exception 'FUERA_DE_ZONA';
  end if;
  update public.pedidos set
    repartidor_id = v_r.id, estado = 'asignado',
    repartidor_nombre  = (select nombre_completo from public.profiles where id = v_r.id),
    repartidor_celular = (select celular from public.profiles where id = v_r.id),
    vehiculo = v_r.vehiculo
  where id = p_id returning * into v_ped;
  return v_ped;
end $$;

create or replace function public.avanzar_pedido(p_id uuid, p_estado public.estado_pedido, p_total_productos int default null)
returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare v_ped public.pedidos;
begin
  select * into v_ped from public.pedidos where id = p_id and repartidor_id = auth.uid() for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if not ((v_ped.estado = 'asignado'  and p_estado = 'comprando')
       or (v_ped.estado = 'comprando' and p_estado = 'en_camino')
       or (v_ped.estado = 'en_camino' and p_estado = 'entregado')) then
    raise exception 'TRANSICION_INVALIDA';
  end if;
  if p_estado = 'en_camino' then
    if p_total_productos is null or p_total_productos < 0 then raise exception 'SIN_TOTAL'; end if;
    if v_ped.presupuesto_max is not null and p_total_productos > v_ped.presupuesto_max then
      raise exception 'SUPERA_PRESUPUESTO';
    end if;
  end if;
  update public.pedidos
     set estado = p_estado, total_productos = coalesce(p_total_productos, total_productos)
   where id = p_id returning * into v_ped;
  if p_estado = 'entregado' then
    delete from public.ubicaciones_repartidor where pedido_id = p_id;
  end if;
  return v_ped;
end $$;

create or replace function public.cancelar_pedido(p_id uuid) returns public.pedidos
language plpgsql security definer set search_path = public as $$
declare v_ped public.pedidos;
begin
  update public.pedidos set estado = 'cancelado'
   where id = p_id and user_id = auth.uid() and estado in ('buscando', 'asignado')
   returning * into v_ped;
  if not found then raise exception 'NO_SE_PUEDE_CANCELAR'; end if;
  delete from public.ubicaciones_repartidor where pedido_id = p_id;
  return v_ped;
end $$;

create or replace function public.actualizar_ubicacion(p_pedido uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'UBICACION_INVALIDA'; end if;
  if not exists (select 1 from public.pedidos
                 where id = p_pedido and repartidor_id = auth.uid()
                   and estado in ('asignado','comprando','en_camino')) then
    raise exception 'PEDIDO_NO_ENCONTRADO';
  end if;
  insert into public.ubicaciones_repartidor(pedido_id, repartidor_id, lat, lng)
  values (p_pedido, auth.uid(), p_lat, p_lng)
  on conflict (pedido_id) do update set lat = excluded.lat, lng = excluded.lng, actualizado_en = now();
end $$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke all on function public.buscar_repartidor(int, smallint) from public, anon, authenticated;
revoke all on function public.es_admin() from public, anon;
revoke all on function public.completar_registro(public.rol_usuario,text,int,text,text,text,text,text,int,text,text,double precision,double precision,public.vehiculo_tipo,boolean,boolean,boolean,text,text,text) from public, anon;
revoke all on function public.crear_pedido(jsonb,text,text,double precision,double precision,int,text,int,text,text) from public, anon;
revoke all on function public.reclamar_pedido(uuid) from public, anon;
revoke all on function public.avanzar_pedido(uuid, public.estado_pedido, int) from public, anon;
revoke all on function public.cancelar_pedido(uuid) from public, anon;
revoke all on function public.actualizar_ubicacion(uuid, double precision, double precision) from public, anon;

grant execute on function public.cupos_libres(int) to anon, authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.completar_registro(public.rol_usuario,text,int,text,text,text,text,text,int,text,text,double precision,double precision,public.vehiculo_tipo,boolean,boolean,boolean,text,text,text) to authenticated;
grant execute on function public.crear_pedido(jsonb,text,text,double precision,double precision,int,text,int,text,text) to authenticated;
grant execute on function public.reclamar_pedido(uuid) to authenticated;
grant execute on function public.avanzar_pedido(uuid, public.estado_pedido, int) to authenticated;
grant execute on function public.cancelar_pedido(uuid) to authenticated;
grant execute on function public.actualizar_ubicacion(uuid, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.sectores                    enable row level security;
alter table public.barrios                     enable row level security;
alter table public.profiles                    enable row level security;
alter table public.direcciones                 enable row level security;
alter table public.barrios_sugeridos           enable row level security;
alter table public.repartidores                enable row level security;
alter table public.verificaciones              enable row level security;
alter table public.consentimientos             enable row level security;
alter table public.config                      enable row level security;
alter table public.pedidos                     enable row level security;
alter table public.ubicaciones_repartidor      enable row level security;
alter table public.solicitudes_acompanamiento  enable row level security;

-- Lectura pública (el registro necesita la lista de barrios antes de tener sesión)
create policy sectores_leer on public.sectores for select to anon, authenticated using (true);
create policy barrios_leer  on public.barrios  for select to anon, authenticated using (activo);
create policy config_leer   on public.config   for select to authenticated using (true);

-- Perfiles
create policy perfil_leer on public.profiles for select to authenticated using (id = auth.uid() or public.es_admin());
create policy perfil_editar on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (nombre_completo, celular, correo, letra_grande, saludo_voz,
              contacto_emergencia_nombre, contacto_emergencia_celular) on public.profiles to authenticated;

-- Direcciones
create policy dir_todo on public.direcciones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Repartidores: ve lo suyo y solo puede cambiar "disponible" (y únicamente si está aprobado)
create policy rep_leer on public.repartidores for select to authenticated using (id = auth.uid() or public.es_admin());
create policy rep_editar on public.repartidores for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and (disponible = false or aprobado));
revoke update on public.repartidores from anon, authenticated;
grant update (disponible) on public.repartidores to authenticated;

-- Verificaciones / consentimientos / sugerencias: solo lo propio
create policy ver_leer on public.verificaciones for select to authenticated using (user_id = auth.uid() or public.es_admin());
create policy con_leer on public.consentimientos for select to authenticated using (user_id = auth.uid() or public.es_admin());
create policy sug_leer on public.barrios_sugeridos for select to authenticated using (user_id = auth.uid() or public.es_admin());

-- Pedidos: el usuario ve los suyos; el repartidor los asignados y los "buscando" de su barrio/sector
create policy ped_leer on public.pedidos for select to authenticated using (
  user_id = auth.uid()
  or repartidor_id = auth.uid()
  or public.es_admin()
  or (estado = 'buscando' and exists (
        select 1 from public.repartidores r
        join public.barrios b on b.id = r.barrio_id
        where r.id = auth.uid() and r.aprobado
          and (r.barrio_id = pedidos.barrio_id
               or (pedidos.sector_id is not null and b.sector_id = pedidos.sector_id))
  ))
);
-- Sin políticas de insert/update/delete: todo cambio pasa por las funciones de arriba.
revoke insert, update, delete on public.pedidos from anon, authenticated;
revoke insert, update, delete on public.ubicaciones_repartidor from anon, authenticated;

create policy ubic_leer on public.ubicaciones_repartidor for select to authenticated using (
  exists (select 1 from public.pedidos p
          where p.id = pedido_id and (p.user_id = auth.uid() or p.repartidor_id = auth.uid()))
);

create policy acomp_todo on public.solicitudes_acompanamiento for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage: selfie y cédula en bucket PRIVADO, cada quien solo su carpeta
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('verificaciones', 'verificaciones', false)
on conflict (id) do nothing;

create policy verif_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'verificaciones' and (storage.foldername(name))[1] = auth.uid()::text);
create policy verif_ver on storage.objects for select to authenticated
  using (bucket_id = 'verificaciones' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));
create policy verif_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'verificaciones' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Realtime (seguimiento en vivo)
-- ---------------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.pedidos;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ubicaciones_repartidor;
exception when duplicate_object then null; when undefined_object then null; end $$;
