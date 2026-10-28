-- =====================================================================
-- Zona Impacto — Rol CAJERA, soporte solo para errores y WhatsApp automático
-- Orden de ejecución:  1) schema.sql   2) inventario_contabilidad.sql   3) ESTE archivo
-- Supabase → SQL Editor → New query → pegar todo → Run. Es seguro repetirlo.
-- =====================================================================

-- 1) ROLES Y COLUMNAS NUEVAS ---------------------------------------------
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('usuario','cajera','soporte','administrador'));
alter table public.perfiles add column if not exists telefono text;          -- WhatsApp de la cajera
alter table public.tickets  add column if not exists categoria text not null default 'Otro error';

create or replace function public.es_caja() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('administrador','cajera'), false)
$$;
create or replace function public.es_soporte() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('administrador','soporte'), false)
$$;

-- 2) PERMISOS (RLS) REDEFINIDOS ---------------------------------------------
-- Perfiles: cada quien ve el suyo; el administrador ve todos
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select
  using (id = auth.uid() or public.es_admin());

-- Historial de registros: solo administrador
drop policy if exists historial_select on public.historial_registros;
create policy historial_select on public.historial_registros for select using (public.es_admin());

-- Reservas: las gestiona CAJA (cajera + administrador). Soporte ya no las ve.
-- Un cliente solo puede dejar su reserva en pendiente / aplazada / cancelada (no auto-confirmarla).
drop policy if exists reservas_select on public.reservas;
create policy reservas_select on public.reservas for select
  using (user_id = auth.uid() or public.es_caja());
drop policy if exists reservas_update on public.reservas;
create policy reservas_update on public.reservas for update
  using (public.es_caja() or (user_id = auth.uid() and estado in ('pendiente','aplazada')))
  with check (public.es_caja() or (user_id = auth.uid() and estado in ('pendiente','aplazada','cancelada')));

-- Tickets: los atiende SOPORTE (soporte + administrador). Cajera y clientes solo ven los suyos.
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select
  using (user_id = auth.uid() or public.es_soporte());
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update
  using (public.es_soporte() or (user_id = auth.uid() and estado = 'abierto'))
  with check (public.es_soporte() or (user_id = auth.uid() and estado = 'abierto'));

-- Inventario: lo usa CAJA
drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos for select using (public.es_caja());
drop policy if exists mov_select on public.movimientos_inventario;
create policy mov_select on public.movimientos_inventario for select using (public.es_caja());
drop policy if exists mov_insert on public.movimientos_inventario;
create policy mov_insert on public.movimientos_inventario for insert with check (public.es_caja());

-- 3) CONFIGURACIÓN ----------------------------------------------------------
create table if not exists public.configuracion (
  clave text primary key,
  valor text,
  updated_at timestamptz not null default now()
);
insert into public.configuracion (clave, valor) values ('whatsapp_activo', 'true')
  on conflict (clave) do nothing;
-- Contraseña propia del bot de WhatsApp (se genera sola; la ves en Panel → WhatsApp)
insert into public.configuracion (clave, valor)
  values ('bot_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (clave) do nothing;

alter table public.configuracion enable row level security;
drop policy if exists config_admin on public.configuracion;
create policy config_admin on public.configuracion for all
  using (public.es_admin()) with check (public.es_admin());

-- 4) COLA DE MENSAJES DE WHATSAPP -----------------------------------------------
create table if not exists public.notificaciones_whatsapp (
  id bigserial primary key,
  reserva_id text,
  tipo text not null,             -- nueva | confirmada | cancelada | aplazada | completada | actualizada | recordatorio
  para text not null check (para in ('cliente','caja')),
  destinatario text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','procesando','enviado','error')),
  intentos int not null default 0,
  error text,
  proximo_intento timestamptz not null default now(),
  ultimo_intento timestamptz,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notif_cola_idx on public.notificaciones_whatsapp (estado, proximo_intento);
create unique index if not exists notif_recordatorio_uq
  on public.notificaciones_whatsapp (reserva_id) where tipo = 'recordatorio' and para = 'cliente';

alter table public.notificaciones_whatsapp enable row level security;
drop policy if exists notif_admin on public.notificaciones_whatsapp;
create policy notif_admin on public.notificaciones_whatsapp for all
  using (public.es_admin()) with check (public.es_admin());

create or replace function public.wa_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select valor from public.configuracion where clave = 'whatsapp_activo'), 'true') = 'true'
$$;

-- 5) TRIGGER: cada cambio importante en una reserva encola sus mensajes --------------
create or replace function public.trg_reserva_whatsapp() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tel text := nullif(trim(coalesce(new.telefono, '')), '');
  v_staff boolean := public.es_caja();          -- ¿quien hace el cambio es cajera/administrador?
  v_tipo text;
begin
  if not public.wa_activo() then return new; end if;

  if tg_op = 'INSERT' then
    -- al cliente: confirmación de recibido (o de confirmada si caja la crea ya confirmada)
    if v_tel is not null then
      v_tipo := case when new.estado = 'confirmada' then 'confirmada' else 'nueva' end;
      insert into public.notificaciones_whatsapp (reserva_id, tipo, para, destinatario)
      values (new.id::text, v_tipo, 'cliente', v_tel);
    end if;
    -- a la(s) cajera(s): aviso de nueva reserva (solo si no la creó ella misma)
    if not v_staff then
      insert into public.notificaciones_whatsapp (reserva_id, tipo, para, destinatario)
      select new.id::text, 'nueva', 'caja', trim(p.telefono)
        from public.perfiles p
       where p.rol = 'cajera' and p.activo and nullif(trim(coalesce(p.telefono, '')), '') is not null;
    end if;

  elsif tg_op = 'UPDATE' then
    if new.estado is distinct from old.estado then
      if v_tel is not null and new.estado in ('confirmada','cancelada','aplazada','completada') then
        insert into public.notificaciones_whatsapp (reserva_id, tipo, para, destinatario)
        values (new.id::text, new.estado, 'cliente', v_tel);
      end if;
      -- el cliente canceló desde su panel: avisar a caja
      if new.estado = 'cancelada' and not v_staff then
        insert into public.notificaciones_whatsapp (reserva_id, tipo, para, destinatario)
        select new.id::text, 'cancelada', 'caja', trim(p.telefono)
          from public.perfiles p
         where p.rol = 'cajera' and p.activo and nullif(trim(coalesce(p.telefono, '')), '') is not null;
      end if;
    elsif v_tel is not null and new.estado = 'confirmada'
          and (new.fecha::text, new.hora::text, new.campo)
              is distinct from (old.fecha::text, old.hora::text, old.campo) then
      insert into public.notificaciones_whatsapp (reserva_id, tipo, para, destinatario)
      values (new.id::text, 'actualizada', 'cliente', v_tel);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_reserva_whatsapp on public.reservas;
create trigger trg_reserva_whatsapp after insert or update on public.reservas
  for each row execute function public.trg_reserva_whatsapp();

-- 6) FUNCIONES PARA EL BOT (se protegen con la contraseña `bot_secret`) -------------------
-- El bot usa la clave pública (anon) + su contraseña; no necesita la clave service_role.
create or replace function public.bot_verificar(p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select valor into v from public.configuracion where clave = 'bot_secret';
  if v is null or p_secret is distinct from v then
    raise exception 'No autorizado' using errcode = '28000';
  end if;
end $$;

-- Toma los mensajes pendientes (los marca "procesando") y devuelve cada uno con los datos de su reserva
create or replace function public.bot_tomar_pendientes(p_secret text, p_limite int default 10) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ids bigint[]; v_res jsonb;
begin
  perform public.bot_verificar(p_secret);

  -- si el bot se cayó a mitad de un envío, vuelve a ponerlo en cola tras 5 minutos
  update public.notificaciones_whatsapp set estado = 'pendiente'
   where estado = 'procesando' and ultimo_intento < now() - interval '5 minutes';

  with tomar as (
    select id from public.notificaciones_whatsapp
     where estado = 'pendiente' and proximo_intento <= now()
     order by id limit greatest(p_limite, 1)
     for update skip locked
  ), marcadas as (
    update public.notificaciones_whatsapp n
       set estado = 'procesando', intentos = n.intentos + 1, ultimo_intento = now()
      from tomar where n.id = tomar.id
    returning n.id
  )
  select array_agg(id) into v_ids from marcadas;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'tipo', n.tipo, 'para', n.para, 'destinatario', n.destinatario,
           'intentos', n.intentos,
           'reserva', (select to_jsonb(r) from public.reservas r where r.id::text = n.reserva_id)
         ) order by n.id), '[]'::jsonb)
    into v_res
    from public.notificaciones_whatsapp n
   where n.id = any(coalesce(v_ids, '{}'));
  return v_res;
end $$;

-- Resultado de un envío. Si falla, reintenta (2 min, 4 min, 6 min) hasta 4 intentos.
create or replace function public.bot_resultado(
  p_secret text, p_id bigint, p_ok boolean, p_error text default null, p_reintentar boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.bot_verificar(p_secret);
  if p_ok then
    update public.notificaciones_whatsapp
       set estado = 'enviado', enviado_at = now(), error = null where id = p_id;
  else
    update public.notificaciones_whatsapp
       set estado = case when p_reintentar and intentos < 4 then 'pendiente' else 'error' end,
           proximo_intento = now() + (intentos * interval '2 minutes'),
           error = left(coalesce(p_error, 'Error desconocido'), 300)
     where id = p_id;
  end if;
end $$;

-- Recordatorio el día anterior (8:00 a.m. – 8:00 p.m. hora Colombia), una sola vez por reserva confirmada
create or replace function public.bot_recordatorios(p_secret text) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  perform public.bot_verificar(p_secret);
  if not public.wa_activo() then return 0; end if;
  if (now() at time zone 'America/Bogota')::time not between time '08:00' and time '20:00' then return 0; end if;

  with ins as (
    insert into public.notificaciones_whatsapp (reserva_id, tipo, para, destinatario)
    select r.id::text, 'recordatorio', 'cliente', trim(r.telefono)
      from public.reservas r
     where r.estado = 'confirmada'
       and r.fecha::text = to_char((now() at time zone 'America/Bogota')::date + 1, 'YYYY-MM-DD')
       and nullif(trim(coalesce(r.telefono, '')), '') is not null
    on conflict do nothing
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;

-- Latido: el panel muestra si el bot está conectado
create or replace function public.bot_latido(p_secret text, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.bot_verificar(p_secret);
  insert into public.configuracion (clave, valor, updated_at)
    values ('bot_latido', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
    on conflict (clave) do update set valor = excluded.valor, updated_at = now();
  insert into public.configuracion (clave, valor, updated_at) values ('bot_estado', left(coalesce(p_estado, ''), 40), now())
    on conflict (clave) do update set valor = excluded.valor, updated_at = now();
end $$;

-- Diagnóstico: resume el estado de todo el sistema de avisos (lo usa `npm run diagnostico`)
create or replace function public.bot_diagnostico(p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.bot_verificar(p_secret);
  return jsonb_build_object(
    'whatsapp_activo', public.wa_activo(),
    'trigger_instalado', exists (select 1 from pg_trigger where tgname = 'trg_reserva_whatsapp' and not tgisinternal),
    'cajeras_con_telefono', (select count(*) from public.perfiles
                              where rol = 'cajera' and activo and nullif(trim(coalesce(telefono, '')), '') is not null),
    'cajeras_sin_telefono', (select count(*) from public.perfiles
                              where rol = 'cajera' and activo and nullif(trim(coalesce(telefono, '')), '') is null),
    'cola', (select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
               from (select estado, count(*) n from public.notificaciones_whatsapp group by estado) x),
    'reservas_24h', (select count(*) from public.reservas where created_at > now() - interval '24 hours'),
    'reservas_24h_con_aviso', (select count(*) from public.reservas r
                                where r.created_at > now() - interval '24 hours'
                                  and exists (select 1 from public.notificaciones_whatsapp n where n.reserva_id = r.id::text)),
    'ultimas', (select coalesce(jsonb_agg(to_jsonb(y)), '[]'::jsonb)
                  from (select id, tipo, para, destinatario, estado, intentos, error, created_at
                          from public.notificaciones_whatsapp order by id desc limit 6) y)
  );
end $$;

grant execute on function public.bot_verificar(text)                         to anon, authenticated;
grant execute on function public.bot_tomar_pendientes(text, int)              to anon, authenticated;
grant execute on function public.bot_resultado(text, bigint, boolean, text, boolean) to anon, authenticated;
grant execute on function public.bot_recordatorios(text)                      to anon, authenticated;
grant execute on function public.bot_latido(text, text)                       to anon, authenticated;
grant execute on function public.bot_diagnostico(text)                        to anon, authenticated;

-- 7) CÓMO CREAR A LA CAJERA -----------------------------------------------------------
-- Desde el panel (Usuarios y roles → Editar → Rol "cajera" + su número de WhatsApp), o con SQL:
--   update public.perfiles set rol = 'cajera', telefono = '3001234567' where email = 'cajera@ejemplo.com';
