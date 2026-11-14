
-- EL MANDADERO
-- Corrección: los repartidores solo ocupan cupo cuando el administrador los aprueba.
-- Puede aplicarse después de la migración inicial y de la migración de lista de espera.

-- 1. Tabla de solicitudes.
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

grant select on public.solicitudes_repartidor to authenticated;


-- 2. Corregir el registro:
-- Todo aspirante a repartidor queda en solicitudes_repartidor.
-- Ningún cupo se reserva durante el registro.

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
begin
  if v_uid is null then
    raise exception 'NO_AUTENTICADO';
  end if;

  if p_rol is null or p_rol not in ('usuario', 'repartidor') then
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

  if p_edad is null or p_edad < 18 then
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
    insert into public.solicitudes_repartidor(
      id, barrio_id, vehiculo
    )
    values (
      v_uid, p_barrio_id, p_vehiculo
    );
  end if;
end;
$$;


-- 3. Aprobar una solicitud específica.
-- Solo un administrador puede hacerlo.
-- El cupo se asigna únicamente en este momento.

create or replace function public.aprobar_solicitud_repartidor(
  p_solicitud_id uuid
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

  select s.* into v_solicitud
  from public.solicitudes_repartidor s
  where s.id = p_solicitud_id
    and s.estado = 'esperando'
  for update;

  if not found then
    raise exception 'SOLICITUD_NO_DISPONIBLE';
  end if;

  -- Evita que dos aprobaciones ocupen el mismo cupo.
  perform pg_advisory_xact_lock(v_solicitud.barrio_id);

  -- Antes de aprobar, deben existir los tres documentos.
  if not exists (
    select 1
    from public.verificaciones v
    where v.user_id = v_solicitud.id
      and v.ruta_selfie is not null
      and v.ruta_doc_frente is not null
      and v.ruta_doc_reverso is not null
  ) then
    raise exception 'DOCUMENTOS_INCOMPLETOS';
  end if;

  select n::smallint into v_cupo
  from generate_series(1, 6) n
  where not exists (
    select 1
    from public.repartidores r
    where r.barrio_id = v_solicitud.barrio_id
      and r.cupo = n
  )
  order by n
  limit 1;

  if v_cupo is null then
    raise exception 'BARRIO_LLENO';
  end if;

  insert into public.repartidores(
    id, barrio_id, cupo, vehiculo, aprobado, disponible
  )
  values (
    v_solicitud.id,
    v_solicitud.barrio_id,
    v_cupo,
    v_solicitud.vehiculo,
    true,
    false
  );

  update public.solicitudes_repartidor
  set estado = 'aprobado',
      resuelto_en = now()
  where id = v_solicitud.id;

  update public.verificaciones
  set estado = 'aprobada'
  where user_id = v_solicitud.id;

  return v_solicitud.id;
end;
$$;


-- 4. Rechazar una solicitud específica.

create or replace function public.rechazar_solicitud_repartidor(
  p_solicitud_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.es_admin() then
    raise exception 'NO_AUTORIZADO';
  end if;

  update public.solicitudes_repartidor
  set estado = 'rechazado',
      resuelto_en = now()
  where id = p_solicitud_id
    and estado = 'esperando'
  returning id into v_id;

  if v_id is null then
    raise exception 'SOLICITUD_NO_DISPONIBLE';
  end if;

  update public.verificaciones
  set estado = 'rechazada'
  where user_id = v_id;

  return v_id;
end;
$$;


-- 5. Permisos de las funciones.

revoke all on function public.aprobar_solicitud_repartidor(uuid)
  from public, anon;

grant execute on function public.aprobar_solicitud_repartidor(uuid)
  to authenticated;

revoke all on function public.rechazar_solicitud_repartidor(uuid)
  from public, anon;

grant execute on function public.rechazar_solicitud_repartidor(uuid)
  to authenticated;

revoke all on function public.completar_registro(
  public.rol_usuario, text, int, text, text, text, text,
  text, int, text, text, double precision, double precision,
  public.vehiculo_tipo, boolean, boolean, boolean, text, text, text
) from public, anon;

grant execute on function public.completar_registro(
  public.rol_usuario, text, int, text, text, text, text,
  text, int, text, text, double precision, double precision,
  public.vehiculo_tipo, boolean, boolean, boolean, text, text, text
) to authenticated;
