create table if not exists public.planner_state (
  user_id text primary key,
  week_plan jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  overrides jsonb not null default '[]'::jsonb,
  planned jsonb not null default '[]'::jsonb,
  recipe_ratings jsonb not null default '{}'::jsonb,
  shopping_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.planner_state
  add column if not exists shopping_list jsonb not null default '[]'::jsonb;

create index if not exists planner_state_updated_at_idx
  on public.planner_state (updated_at desc);
