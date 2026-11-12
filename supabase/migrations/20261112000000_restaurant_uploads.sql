-- Menu images are stored in Postgres so uploads work on Vercel without a
-- writable filesystem or a Supabase Storage service-role key.
create table if not exists restaurant.uploads (
  id bigserial primary key,
  filename text not null,
  mime_type text not null,
  byte_size integer not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_uploads_created on restaurant.uploads(created_at);
