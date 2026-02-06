-- Trades table: records every buy/sell trade for PnL tracking
create table public.trades (
  id uuid not null default gen_random_uuid(),
  session_id text not null,
  user_address text not null,
  market_id text not null,
  trade_type text not null,          -- 'BUY' or 'SELL'
  outcome text not null,             -- 'YES' or 'NO'
  shares text not null default '0',  -- number of shares traded
  price numeric(10, 6) not null,     -- effective price per share
  cost_basis text not null default '0', -- total USDC spent (BUY) or received (SELL)
  realized_pnl text not null default '0', -- PnL realized on this trade (for sells and claims)
  market_title text null,            -- denormalized for easy display
  created_at timestamp with time zone null default now(),
  constraint trades_pkey primary key (id),
  constraint trades_session_id_fkey foreign key (session_id) references sessions (session_id),
  constraint trades_market_id_fkey foreign key (market_id) references markets (market_id),
  constraint trades_trade_type_check check ((trade_type = any (array['BUY'::text, 'SELL'::text, 'CLAIM'::text]))),
  constraint trades_outcome_check check ((outcome = any (array['YES'::text, 'NO'::text])))
) tablespace pg_default;

create index if not exists idx_trades_session on public.trades using btree (session_id) tablespace pg_default;
create index if not exists idx_trades_user on public.trades using btree (user_address) tablespace pg_default;
create index if not exists idx_trades_market on public.trades using btree (market_id) tablespace pg_default;
create index if not exists idx_trades_created on public.trades using btree (created_at desc) tablespace pg_default;
