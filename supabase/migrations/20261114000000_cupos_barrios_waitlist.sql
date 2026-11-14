
-- EL MANDADERO
-- Cupos estrictos por barrio y lista de espera.
-- Ejecutar una sola vez después de la migración inicial.

-- 1. Lista de espera de aspirantes a repartidor.
create table if not exists public.solicitudes_repartidor (
  id uuid primary key references public.profiles(id) on delete cascade,
  barrio_id int not null references public.barrios(id),
  vehiculo public.vehiculo_tipo not null,
  estado text not null default 'esperando'
    check (estado in ('esperando', 'aprobado', 'rechazado')),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

create index if not exists solicitudes_repartidor_turno_idx
  on public.solicitudes_repartidor(barrio_id, creado_en)
  where estado = 'esperando';

alter table public.solicitudes_repartidor enable row level security;

drop policy if exists solicitudes_repartidor_leer
  on public.solicitudes_repartidor;

create policy solicitudes_repartidor_leer
  on public.solicitudes_repartidor
  for select to authenticated
  using (id = auth.uid() or public.es_admin());

-- 2. El registro crea el perfil y, si no hay cupo,
-- deja al aspirante esperando sin crear un repartidor activo.
create or replace function public.completar_registro(
  p_rol public.rol_usuario,
  p_nombre text,
  p_edad int,
  p_tipo_doc text,
  p_documento text,
  p_celular text,
  p_correo text,
  p_direccion text,
  p_barrio_id int,
  p_barrio_texto text,
  p_indicaciones text,
  p_lat double precision,
  p_lng double precision,
  p_vehiculo public.vehiculo_tipo,
  p_acepta_datos boolean,
  p_acepta_biometricos boolean,
  p_acepta_ubicacion boolean,
  p_ruta_selfie text,
  p_ruta_doc_frente text,
  p_ruta_doc_reverso text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cupo smallint;
begin
  if v_uid is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  if p_rol not in ('usuario', 'repartidor') then
    raise exception 'ROL_INVALIDO';
  end if;

  if not (
    coalesce(p_acepta_datos, false)
    and coalesce(p_acepta_biometricos, false)
  ) then
    raise exception 'SIN_CONSENTIMIENTO';
  end if;

  if exists (
    select 1 from public.profiles where id = v_uid
  ) then
    raise exception 'YA_REGISTRADO';
  end if;

  if p_edad < 18 then
    raise exception 'MENOR_DE_EDAD';
  end if;

  if p_rol = 'repartidor' then
    if p_vehiculo is null then
      raise exception 'SIN_VEHICULO';
    end if;

    if p_barrio_id is null then
      raise exception 'SIN_BARRIO';
    end if;

    if not exists (
      select 1 from public.barrios
      where id = p_barrio_id and activo
    ) then
      raise exception 'BARRIO_INVALIDO';
    end if;

    -- Serializa registros del mismo barrio.
    perform pg_advisory_xact_lock(p_barrio_id);

    select s::smallint into v_cupo
    from generate_series(1, 6) s
    where not exists (
      select 1
      from public.repartidores r
      where r.barrio_id = p_barrio_id
        and r.cupo = s
    )
    order by s
    limit 1;
  end if;

  insert into public.profiles(
    id, rol, nombre_completo, edad, tipo_documento,
    documento, celular, correo, barrio_id
  )
  values (
    v_uid, p_rol, trim(p_nombre), p_edad, p_tipo_doc,
    regexp_replace(p_documento, '\D', '', 'g'),
    p_celular, nullif(trim(coalesce(p_correo, '')), ''),
    p_barrio_id
  );

  insert into public.direcciones(
    user_id, direccion, indicaciones, barrio_id,
    barrio_texto, lat, lng, es_principal
  )
  values (
    v_uid, trim(p_direccion), p_indicaciones, p_barrio_id,
    nullif(trim(coalesce(p_barrio_texto, '')), ''),
    p_lat, p_lng, true
  );

  if p_barrio_id is null
     and coalesce(trim(p_barrio_texto), '') <> '' then
    insert into public.barrios_sugeridos(user_id, nombre)
    values (v_uid, trim(p_barrio_texto));
  end if;

  insert into public.consentimientos(
    user_id, version, acepta_datos,
    acepta_biometricos, acepta_ubicacion
  )
  values (
    v_uid, 'v1', p_acepta_datos,
    p_acepta_biometricos, coalesce(p_acepta_ubicacion, false)
  );

  if p_ruta_selfie is not null
     or p_ruta_doc_frente is not null
     or p_ruta_doc_reverso is not null then
    insert into public.verificaciones(
      user_id, ruta_selfie, ruta_doc_frente, ruta_doc_reverso
    )
    values (
      v_uid, p_ruta_selfie, p_ruta_doc_frente, p_ruta_doc_reverso
    );
  end if;

  if p_rol = 'repartidor' then
    if v_cupo is not null then
      insert into public.repartidores(
        id, barrio_id, cupo, vehiculo
      )
      values (v_uid, p_barrio_id, v_cupo, p_vehiculo);
    else
      insert into public.solicitudes_repartidor(
        id, barrio_id, vehiculo
      )
      values (v_uid, p_barrio_id, p_vehiculo);
    end if;
  end if;
end;
$$;

-- 3. Buscar repartidores únicamente en el mismo barrio.
create or replace function public.buscar_repartidor(
  p_barrio int,
  p_sector smallint
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid;
begin
  select r.id into v
  from public.repartidores r
  where r.barrio_id = p_barrio
    and r.aprobado
    and r.disponible
    and not exists (
      select 1
      from public.pedidos p
      where p.repartidor_id = r.id
        and p.estado in ('asignado', 'comprando', 'en_camino')
    )
  order by r.calificacion desc
  limit 1
  for update of r skip locked;

  return v;
end;
$$;

-- 4. Reclamar pedidos únicamente del barrio propio.
create or replace function public.reclamar_pedido(p_id uuid)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.repartidores;
  v_ped public.pedidos;
begin
  select * into v_r
  from public.repartidores
  where id = auth.uid()
    and aprobado
  for update;

  if not found then
    raise exception 'NO_APROBADO';
  end if;

  if exists (
    select 1 from public.pedidos
    where repartidor_id = v_r.id
      and estado in ('asignado', 'comprando', 'en_camino')
  ) then
    raise exception 'YA_TIENES_PEDIDO';
  end if;

  select * into v_ped
  from public.pedidos
  where id = p_id
    and estado = 'buscando'
  for update;

  if not found then
    raise exception 'PEDIDO_NO_DISPONIBLE';
  end if;

  if v_ped.barrio_id <> v_r.barrio_id then
    raise exception 'FUERA_DE_ZONA';
  end if;

  update public.pedidos
  set repartidor_id = v_r.id,
      estado = 'asignado',
      repartidor_nombre = (
        select nombre_completo
        from public.profiles
        where id = v_r.id
      ),
      repartidor_celular = (
        select celular
        from public.profiles
        where id = v_r.id
      ),
      vehiculo = v_r.vehiculo
  where id = p_id
  returning * into v_ped;

  return v_ped;
end;
$$;

-- 5. Lectura de pedidos: solo los del barrio del repartidor.
drop policy if exists ped_leer on public.pedidos;

create policy ped_leer on public.pedidos
for select to authenticated
using (
  user_id = auth.uid()
  or repartidor_id = auth.uid()
  or public.es_admin()
  or (
    estado = 'buscando'
    and exists (
      select 1
      from public.repartidores r
      where r.id = auth.uid()
        and r.aprobado
        and r.barrio_id = pedidos.barrio_id
    )
  )
);

-- 6. Aprobar al siguiente aspirante de un barrio.
-- Solo puede ejecutarlo un administrador.
create or replace function public.aprobar_siguiente_repartidor(
  p_barrio_id int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_repartidor;
  v_cupo smallint;
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  perform pg_advisory_xact_lock(p_barrio_id);

  select s.* into v_solicitud
  from public.solicitudes_repartidor s
  where s.barrio_id = p_barrio_id
    and s.estado = 'esperando'
  order by s.creado_en, s.id
  limit 1
  for update;

  if not found then
    raise exception 'LISTA_ESPERA_VACIA';
  end if;

  select n::smallint into v_cupo
  from generate_series(1, 6) n
  where not exists (
    select 1 from public.repartidores r
    where r.barrio_id = p_barrio_id
      and r.cupo = n
  )
  order by n
  limit 1;

  if v_cupo is null then
    raise exception 'BARRIO_LLENO';
  end if;

  insert into public.repartidores(
    id, barrio_id, cupo, vehiculo
  )
  values (
    v_solicitud.id,
    v_solicitud.barrio_id,
    v_cupo,
    v_solicitud.vehiculo
  );

  update public.solicitudes_repartidor
  set estado = 'aprobado',
      resuelto_en = now()
  where id = v_solicitud.id;

  return v_solicitud.id;
end;
$$;

revoke all on function public.aprobar_siguiente_repartidor(int)
  from public, anon;

grant execute on function public.aprobar_siguiente_repartidor(int)
  to authenticated;

revoke all on function public.buscar_repartidor(int, smallint)
  from public, anon, authenticated;

grant execute on function public.buscar_repartidor(int, smallint)
  to authenticated;

revoke all on function public.reclamar_pedido(uuid)
  from public, anon;

grant execute on function public.reclamar_pedido(uuid)
  to authenticated;
