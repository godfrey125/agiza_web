-- Agiza Admin restaurant workspace schema.
-- Lives in its own schema so it never collides with the existing public CMS tables.
create schema if not exists restaurant;

create table if not exists restaurant.roles (
  id text primary key,
  name text not null,
  description text not null default '',
  permissions text not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.users (
  id bigserial primary key,
  name text not null,
  email text not null unique,
  phone text not null default '',
  password_hash text not null default '',
  role_id text not null references restaurant.roles(id),
  avatar_url text not null default '',
  status text not null default 'ACTIVE',
  supabase_uid uuid unique,
  totp_secret text,
  two_factor_enabled integer not null default 0,
  created_at timestamptz not null default now(),
  last_login timestamptz
);

create table if not exists restaurant.sessions (
  token_hash text primary key,
  user_id bigint not null references restaurant.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text not null default '',
  revoked integer not null default 0
);

create table if not exists restaurant.login_history (
  id bigserial primary key,
  user_id bigint references restaurant.users(id) on delete set null,
  email text not null,
  ip text not null default 'local',
  user_agent text not null default '',
  success integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.categories (
  id bigserial primary key,
  name text not null unique,
  description text not null default '',
  image_url text not null default '',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.menu_items (
  id bigserial primary key,
  name text not null,
  description text not null default '',
  category_id bigint references restaurant.categories(id) on delete set null,
  price double precision not null,
  cost_price double precision not null default 0,
  image_url text not null default '',
  ingredients text not null default '',
  preparation_time integer not null default 20,
  available integer not null default 1,
  featured integer not null default 0,
  recipe_json text not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.customers (
  id bigserial primary key,
  name text not null,
  email text not null default '',
  phone text not null default '',
  image_url text not null default '',
  type text not null default 'NEW',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.suppliers (
  id bigserial primary key,
  name text not null,
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  products text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.inventory_items (
  id bigserial primary key,
  name text not null,
  sku text not null unique,
  category text not null default 'Ingredients',
  quantity double precision not null default 0,
  unit text not null default 'kg',
  min_stock double precision not null default 0,
  unit_cost double precision not null default 0,
  supplier_id bigint references restaurant.suppliers(id) on delete set null,
  image_url text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.orders (
  id bigserial primary key,
  order_number text not null unique,
  customer_id bigint references restaurant.customers(id) on delete set null,
  status text not null default 'PENDING',
  payment_method text not null default 'Cash',
  payment_status text not null default 'PENDING',
  subtotal double precision not null default 0,
  discount double precision not null default 0,
  tax double precision not null default 0,
  total double precision not null default 0,
  staff_id bigint references restaurant.users(id) on delete set null,
  notes text not null default '',
  inventory_consumed integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists restaurant.order_items (
  id bigserial primary key,
  order_id bigint not null references restaurant.orders(id) on delete cascade,
  menu_item_id bigint references restaurant.menu_items(id) on delete set null,
  name text not null,
  price double precision not null,
  quantity integer not null,
  subtotal double precision not null
);

create table if not exists restaurant.order_status_history (
  id bigserial primary key,
  order_id bigint not null references restaurant.orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  staff_id bigint references restaurant.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.stock_movements (
  id bigserial primary key,
  inventory_item_id bigint not null references restaurant.inventory_items(id) on delete cascade,
  type text not null,
  quantity double precision not null,
  previous_quantity double precision not null,
  new_quantity double precision not null,
  reason text not null default '',
  staff_id bigint references restaurant.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.promotions (
  id bigserial primary key,
  name text not null,
  type text not null default 'PERCENTAGE',
  value double precision not null default 0,
  scope text not null default 'ALL_ORDERS',
  scope_id bigint,
  min_order double precision not null default 0,
  start_date timestamptz not null,
  end_date timestamptz not null,
  active integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.coupons (
  id bigserial primary key,
  name text not null,
  code text not null unique,
  discount_type text not null default 'PERCENTAGE',
  value double precision not null default 0,
  expiry_date timestamptz not null,
  usage_limit integer not null default 100,
  used_count integer not null default 0,
  min_purchase double precision not null default 0,
  active integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.campaigns (
  id bigserial primary key,
  name text not null,
  audience text not null default 'All customers',
  type text not null default 'EMAIL',
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text not null default 'DRAFT',
  reached integer not null default 0,
  clicks integer not null default 0,
  conversions integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.reviews (
  id bigserial primary key,
  customer_id bigint references restaurant.customers(id) on delete set null,
  menu_item_id bigint references restaurant.menu_items(id) on delete set null,
  order_id bigint references restaurant.orders(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  title text not null,
  message text not null,
  response text not null default '',
  response_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.expenses (
  id bigserial primary key,
  title text not null,
  category text not null,
  amount double precision not null,
  expense_date timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.notifications (
  id bigserial primary key,
  title text not null,
  message text not null,
  type text not null default 'INFO',
  read integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.audit_logs (
  id bigserial primary key,
  user_id bigint references restaurant.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  details text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists restaurant.reports (
  id bigserial primary key,
  report_type text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  filters_json text not null default '{}',
  columns_json text not null default '[]',
  rows_json text not null default '[]',
  totals_json text not null default '{}',
  generated_by bigint references restaurant.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists restaurant.settings (
  key text primary key,
  value text not null
);

create index if not exists idx_orders_created on restaurant.orders(created_at);
create index if not exists idx_orders_status on restaurant.orders(status);
create index if not exists idx_order_items_order on restaurant.order_items(order_id);
create index if not exists idx_menu_category on restaurant.menu_items(category_id);
create index if not exists idx_movements_item on restaurant.stock_movements(inventory_item_id);
create index if not exists idx_audit_created on restaurant.audit_logs(created_at);
create index if not exists idx_login_history_created on restaurant.login_history(created_at);

-- Small SQLite-compatibility helpers. The existing route queries were written
-- for SQLite date functions; these keep the query text unchanged while using
-- proper Postgres timestamps.
create or replace function restaurant.substr(value timestamptz, start integer, length integer)
returns text
language sql
immutable
as $$
  select substr(to_char(value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), start, length)
$$;

create or replace function restaurant.strftime(fmt text, value timestamptz)
returns text
language plpgsql
immutable
as $$
begin
  if fmt = '%H' then
    return to_char(value at time zone 'UTC', 'HH24');
  elsif fmt = '%w' then
    return extract(dow from value at time zone 'UTC')::int::text;
  elsif fmt = '%Y-%m' then
    return to_char(value at time zone 'UTC', 'YYYY-MM');
  elsif fmt = '%Y-%m-%d' then
    return to_char(value at time zone 'UTC', 'YYYY-MM-DD');
  end if;
  return to_char(value at time zone 'UTC', fmt);
end
$$;

create or replace function restaurant.round2(value double precision, scale integer)
returns double precision
language sql
immutable
as $$
  select round(value::numeric, scale)::double precision
$$;

-- Required configuration, not demo data: one platform-owner role and the single
-- platform administrator who is allowed into /admin.
insert into restaurant.roles (id, name, description, permissions)
values ('owner', 'Owner', 'Full access to the restaurant workspace', '["*"]')
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    permissions = excluded.permissions;

insert into restaurant.users (name, email, phone, password_hash, role_id, status)
values ('Platform Admin', 'shorahgodfrey12@gmail.com', '+255700000001', '', 'owner', 'ACTIVE')
on conflict (email) do update
set role_id = 'owner',
    status = 'ACTIVE';
