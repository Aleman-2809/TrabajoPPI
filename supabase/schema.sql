-- =====================================================================
-- Zona Impacto — Esquema completo (roles, historial, reservas, soporte)
-- Ejecutar UNA VEZ en Supabase → SQL Editor → New query → Run
-- =====================================================================

-- 1) PERFILES (uno por cada usuario de auth.users) ---------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  email text,
  rol text not null default 'usuario' check (rol in ('usuario','soporte','administrador')),
  descuento int not null default 0,
  codigo_descuento text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) HISTORIAL DE REGISTROS ------------------------------------------
create table if not exists public.historial_registros (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  nombre text,
  email text,
  codigo_descuento text,
  created_at timestamptz not null default now()
);

-- 3) RESERVAS (se amplía la tabla existente) -------------------------
create table if not exists public.reservas (
  id bigserial primary key,
  cliente text, telefono text, campo text, fecha date, hora text,
  jugadores int, modalidad text, paquete text, total numeric, mensaje text
);
alter table public.reservas add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.reservas add column if not exists estado text not null default 'pendiente';
alter table public.reservas add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.reservas add constraint reservas_estado_chk
    check (estado in ('pendiente','confirmada','cancelada','aplazada','completada'));
exception when duplicate_object then null; end $$;

-- 4) TICKETS DE SOPORTE ------------------------------------------------
create table if not exists public.tickets (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  nombre text,
  email text,
  asunto text not null,
  mensaje text not null,
  estado text not null default 'abierto' check (estado in ('abierto','en_proceso','resuelto')),
  respuesta text,
  atendido_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) FUNCIONES AUXILIARES (security definer evita recursión en RLS) ------
create or replace function public.mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid() and activo = true
$$;
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() = 'administrador', false)
$$;
create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.mi_rol() in ('administrador','soporte'), false)
$$;

-- 6) TRIGGER: al registrarse -> crea perfil + historial ----------------
create or replace function public.al_registrar_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nombre text := coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1));
  v_codigo text := new.raw_user_meta_data->>'codigo_descuento';
  v_desc   int  := coalesce((new.raw_user_meta_data->>'descuento')::int, 0);
begin
  insert into public.perfiles (id, nombre, email, descuento, codigo_descuento)
  values (new.id, v_nombre, new.email, v_desc, v_codigo)
  on conflict (id) do nothing;

  insert into public.historial_registros (user_id, nombre, email, codigo_descuento)
  values (new.id, v_nombre, new.email, v_codigo);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.al_registrar_usuario();

-- Perfiles/historial para usuarios que YA existían antes de este script
insert into public.perfiles (id, nombre, email, descuento, codigo_descuento)
select u.id, coalesce(u.raw_user_meta_data->>'nombre', split_part(u.email,'@',1)), u.email,
       coalesce((u.raw_user_meta_data->>'descuento')::int,0), u.raw_user_meta_data->>'codigo_descuento'
from auth.users u on conflict (id) do nothing;

insert into public.historial_registros (user_id, nombre, email, codigo_descuento, created_at)
select u.id, coalesce(u.raw_user_meta_data->>'nombre', split_part(u.email,'@',1)), u.email,
       u.raw_user_meta_data->>'codigo_descuento', u.created_at
from auth.users u
where not exists (select 1 from public.historial_registros h where h.user_id = u.id);

-- 7) TRIGGER: updated_at en tickets -------------------------------------
create or replace function public.tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists tickets_updated on public.tickets;
create trigger tickets_updated before update on public.tickets
  for each row execute function public.tocar_updated_at();

-- 8) SEGURIDAD A NIVEL DE FILA (RLS) -----------------------------------
alter table public.perfiles            enable row level security;
alter table public.historial_registros enable row level security;
alter table public.reservas            enable row level security;
alter table public.tickets             enable row level security;

-- perfiles
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles for select
  using (id = auth.uid() or public.es_staff());
drop policy if exists perfiles_update_admin on public.perfiles;
create policy perfiles_update_admin on public.perfiles for update
  using (public.es_admin()) with check (public.es_admin());

-- historial (solo staff lo ve; nadie lo edita desde el cliente)
drop policy if exists historial_select on public.historial_registros;
create policy historial_select on public.historial_registros for select
  using (public.es_staff());
drop policy if exists historial_delete on public.historial_registros;
create policy historial_delete on public.historial_registros for delete
  using (public.es_admin());

-- reservas
drop policy if exists reservas_insert on public.reservas;
create policy reservas_insert on public.reservas for insert
  with check (user_id is null or user_id = auth.uid());
drop policy if exists reservas_select on public.reservas;
create policy reservas_select on public.reservas for select
  using (user_id = auth.uid() or public.es_staff());
drop policy if exists reservas_update on public.reservas;
create policy reservas_update on public.reservas for update
  using (public.es_staff() or (user_id = auth.uid() and estado in ('pendiente','aplazada')))
  with check (public.es_staff() or user_id = auth.uid());
drop policy if exists reservas_delete on public.reservas;
create policy reservas_delete on public.reservas for delete
  using (public.es_admin() or (user_id = auth.uid() and estado = 'pendiente'));

-- tickets
drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets for insert
  with check (user_id = auth.uid());
drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets for select
  using (user_id = auth.uid() or public.es_staff());
drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets for update
  using (public.es_staff() or (user_id = auth.uid() and estado = 'abierto'))
  with check (public.es_staff() or user_id = auth.uid());
drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets for delete
  using (public.es_admin() or (user_id = auth.uid() and estado = 'abierto'));

-- 9) CREAR TU PRIMER ADMINISTRADOR ---------------------------------------
-- Primero regístrate en la web con tu correo y luego ejecuta (cambia el correo):
--   update public.perfiles set rol = 'administrador' where email = 'TU_CORREO@ejemplo.com';
-- Para crear un agente de soporte, el administrador cambia el rol desde el panel,
-- o con SQL:
--   update public.perfiles set rol = 'soporte' where email = 'soporte@ejemplo.com';
