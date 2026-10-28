-- =====================================================================
-- Zona Impacto — Inventario + Contabilidad
-- Ejecutar DESPUÉS de schema.sql (usa public.es_admin() y public.es_staff()).
-- Supabase → SQL Editor → New query → pegar todo → Run. Es seguro repetirlo.
-- =====================================================================

-- 1) PRODUCTOS -----------------------------------------------------------
create table if not exists public.productos (
  id bigserial primary key,
  nombre text not null,
  categoria text not null default 'Otros',
  unidad text not null default 'unidad',
  stock numeric(12,2) not null default 0 check (stock >= 0),
  stock_minimo numeric(12,2) not null default 0 check (stock_minimo >= 0),
  costo_unitario numeric(12,2) not null default 0 check (costo_unitario >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists productos_nombre_uq on public.productos (lower(nombre));

-- 2) MOVIMIENTOS DE INVENTARIO (kardex: no se editan ni se borran) ---------
create table if not exists public.movimientos_inventario (
  id bigserial primary key,
  producto_id bigint not null references public.productos(id) on delete restrict,
  tipo text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad numeric(12,2) not null check (cantidad >= 0),
  stock_anterior numeric(12,2),
  stock_resultante numeric(12,2),
  costo_unitario numeric(12,2),
  genera_gasto boolean not null default false,
  motivo text,
  user_id uuid references auth.users(id) on delete set null,
  usuario text,
  created_at timestamptz not null default now()
);
create index if not exists mov_producto_idx on public.movimientos_inventario (producto_id);
create index if not exists mov_fecha_idx on public.movimientos_inventario (created_at desc);

-- 3) TRANSACCIONES CONTABLES (ingresos y gastos) ---------------------------
-- reserva_id es texto (sin FK) para funcionar con cualquier tipo de id de `reservas`
-- y para que el ingreso se conserve aunque la reserva se elimine.
create table if not exists public.transacciones (
  id bigserial primary key,
  tipo text not null check (tipo in ('ingreso','gasto')),
  categoria text not null,
  descripcion text,
  monto numeric(14,2) not null check (monto > 0),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  metodo_pago text,
  reserva_id text,
  movimiento_id bigint references public.movimientos_inventario(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists transacciones_reserva_uq
  on public.transacciones (reserva_id) where reserva_id is not null;
create index if not exists trans_fecha_idx on public.transacciones (fecha desc);

-- 4) TRIGGER: cada movimiento actualiza el stock (y valida) -----------------
create or replace function public.aplicar_movimiento_inventario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_prod public.productos%rowtype;
  v_nuevo numeric(12,2);
begin
  select * into v_prod from public.productos where id = new.producto_id for update;
  if not found then raise exception 'El producto no existe'; end if;
  if not v_prod.activo then raise exception 'El producto "%" está desactivado', v_prod.nombre; end if;

  if new.tipo in ('entrada','salida') and new.cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0';
  end if;

  if new.tipo = 'entrada' then
    v_nuevo := v_prod.stock + new.cantidad;
  elsif new.tipo = 'salida' then
    if v_prod.stock < new.cantidad then
      raise exception 'Stock insuficiente: solo quedan % % de %', v_prod.stock, v_prod.unidad, v_prod.nombre;
    end if;
    v_nuevo := v_prod.stock - new.cantidad;
  else
    v_nuevo := new.cantidad;          -- ajuste: la cantidad es el conteo físico real
  end if;

  new.stock_anterior   := v_prod.stock;
  new.stock_resultante := v_nuevo;
  new.user_id := auth.uid();
  new.usuario := coalesce(nullif(new.usuario,''), (select nombre from public.perfiles where id = auth.uid()));
  -- solo el administrador puede generar el gasto contable automático
  new.genera_gasto := coalesce(new.genera_gasto,false)
                      and new.tipo = 'entrada'
                      and coalesce(new.costo_unitario,0) > 0
                      and public.es_admin();

  update public.productos
     set stock = v_nuevo,
         costo_unitario = case when new.tipo = 'entrada' and coalesce(new.costo_unitario,0) > 0
                               then new.costo_unitario else costo_unitario end
   where id = new.producto_id;
  return new;
end $$;

drop trigger if exists trg_aplicar_movimiento on public.movimientos_inventario;
create trigger trg_aplicar_movimiento before insert on public.movimientos_inventario
  for each row execute function public.aplicar_movimiento_inventario();

-- 5) TRIGGER: una compra de inventario crea su gasto en contabilidad --------
create or replace function public.gasto_por_compra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.genera_gasto then
    insert into public.transacciones (tipo, categoria, descripcion, monto, fecha, movimiento_id, user_id)
    select 'gasto', 'Compra de inventario',
           'Compra: ' || p.nombre || ' (' || new.cantidad || ' ' || p.unidad || ')',
           greatest(round(new.cantidad * new.costo_unitario, 2), 0.01),
           (now() at time zone 'America/Bogota')::date, new.id, auth.uid()
      from public.productos p where p.id = new.producto_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_gasto_por_compra on public.movimientos_inventario;
create trigger trg_gasto_por_compra after insert on public.movimientos_inventario
  for each row execute function public.gasto_por_compra();

-- 6) SEGURIDAD (RLS) -----------------------------------------------------------
alter table public.productos              enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.transacciones          enable row level security;

-- productos: staff ve; solo admin crea/edita/elimina
drop policy if exists productos_select on public.productos;
create policy productos_select on public.productos for select using (public.es_staff());
drop policy if exists productos_insert on public.productos;
create policy productos_insert on public.productos for insert with check (public.es_admin());
drop policy if exists productos_update on public.productos;
create policy productos_update on public.productos for update
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists productos_delete on public.productos;
create policy productos_delete on public.productos for delete using (public.es_admin());

-- movimientos: staff ve y registra; nadie edita ni borra (el kardex es histórico)
drop policy if exists mov_select on public.movimientos_inventario;
create policy mov_select on public.movimientos_inventario for select using (public.es_staff());
drop policy if exists mov_insert on public.movimientos_inventario;
create policy mov_insert on public.movimientos_inventario for insert with check (public.es_staff());

-- transacciones: SOLO administrador
drop policy if exists trans_all on public.transacciones;
create policy trans_all on public.transacciones for all
  using (public.es_admin()) with check (public.es_admin());
