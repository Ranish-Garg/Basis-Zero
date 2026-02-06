create table public.positions (
  id uuid not null default gen_random_uuid (),
  user_id text not null,
  market_id text not null,
  outcome text not null,
  shares text not null default '0'::text,
  average_entry_price numeric(10, 6) not null,
  created_at timestamp with time zone null default now(),
  constraint positions_pkey primary key (id),
  constraint positions_user_id_market_id_outcome_key unique (user_id, market_id, outcome),
  constraint positions_market_id_fkey foreign KEY (market_id) references markets (market_id),
  constraint positions_user_id_fkey foreign KEY (user_id) references sessions (session_id),
  constraint positions_outcome_check check ((outcome = any (array['YES'::text, 'NO'::text])))
) TABLESPACE pg_default;

create index IF not exists idx_positions_user on public.positions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_positions_market on public.positions using btree (market_id) TABLESPACE pg_default;
