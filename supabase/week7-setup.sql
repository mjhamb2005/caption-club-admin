-- Backstage, Week 7: the AI pipeline moves into the database, and every run is logged.
-- Run supabase/admin-setup.sql first (Week 6). Then paste this whole file into
-- Supabase → SQL Editor → Run. Safe to re-run: it never deletes your data.
--
-- What it adds
--   Configuration (superadmins edit it in Backstage, Caption Club reads it on every meme):
--     llm_providers, llm_models, prompt_chains, prompt_chain_steps, prompt_chain_mix,
--     terms, ai_generation_examples
--   Observability (Caption Club writes one row per meme attempt and one per AI call):
--     generation_requests, llm_responses
--   Access (checked whenever a brand-new account is created):
--     allowed_signup_domains, whitelisted_emails
--
-- Nothing here changes what Caption Club does today: the seeded "classic" chain is the exact
-- prompt chain the app already runs, at 100% of the mix.

set client_min_messages = warning;

-- ---------------------------------------------------------------- helpers
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- LLM providers
create table if not exists public.llm_providers (
  id            bigint generated always as identity primary key,
  name          text not null unique check (char_length(name) between 1 and 80),
  api_style     text not null default 'gemini' check (api_style in ('gemini', 'openai_compatible')),
  api_base_url  text not null check (api_base_url ~ '^https://[^\s]+$' and char_length(api_base_url) <= 300),
  -- The NAME of the environment variable that holds the key (e.g. GEMINI_API_KEY), never the key itself.
  -- Must end in _API_KEY, so a provider can never be pointed at the app's Supabase secrets.
  api_key_env   text not null check (api_key_env ~ '^[A-Z][A-Z0-9_]{0,55}_API_KEY$' and api_key_env !~ 'SUPABASE'),
  is_active     boolean not null default true,
  notes         text check (char_length(notes) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- LLM models
create table if not exists public.llm_models (
  id               bigint generated always as identity primary key,
  provider_id      bigint not null references public.llm_providers(id) on delete restrict,
  name             text not null check (char_length(name) between 1 and 80),
  api_model_id     text not null check (api_model_id ~ '^[A-Za-z0-9._:/-]{1,120}$'),
  supports_images  boolean not null default true,
  is_active        boolean not null default true,
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (provider_id, api_model_id)
);
create index if not exists llm_models_provider_idx on public.llm_models (provider_id);

-- ---------------------------------------------------------------- Prompt chains
create table if not exists public.prompt_chains (
  id           bigint generated always as identity primary key,
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name         text not null check (char_length(name) between 1 and 80),
  description  text check (char_length(description) <= 1000),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Step 1 always gets the photo. Later steps get text: {{description}} is step 1's output,
-- {{previous}} is the step before. The last step must return {"captions": [...]}.
-- Other placeholders: {{caption_count}}, {{examples}} (active AI generation examples), {{terms}} (active terms).
create table if not exists public.prompt_chain_steps (
  id                 bigint generated always as identity primary key,
  chain_id           bigint not null references public.prompt_chains(id) on delete cascade,
  step_order         int not null check (step_order between 1 and 10),
  name               text not null check (char_length(name) between 1 and 80),
  model_id           bigint references public.llm_models(id) on delete set null,
  fallback_model_id  bigint references public.llm_models(id) on delete set null,
  prompt_template    text not null check (char_length(prompt_template) between 1 and 8000),
  temperature        numeric(3,2) check (temperature between 0 and 2),
  json_output        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (chain_id, step_order)
);
create index if not exists prompt_chain_steps_model_idx on public.prompt_chain_steps (model_id);
create index if not exists prompt_chain_steps_fallback_idx on public.prompt_chain_steps (fallback_model_id);

-- How often each chain is picked for a new meme (its weight ÷ the total), and how many captions it writes.
create table if not exists public.prompt_chain_mix (
  chain_id       bigint primary key references public.prompt_chains(id) on delete cascade,
  weight         int not null default 0 check (weight between 0 and 100),
  caption_count  int not null default 5 check (caption_count between 3 and 10),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------- Terms (comedy glossary fed into {{terms}})
create table if not exists public.terms (
  id          bigint generated always as identity primary key,
  term        text not null check (char_length(term) between 1 and 60 and term = btrim(term)),
  definition  text not null check (char_length(definition) between 1 and 500),
  example     text check (char_length(example) <= 300),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists terms_term_unique on public.terms (lower(term));

-- ---------------------------------------------------------------- AI generation examples (few-shot, fed into {{examples}})
create table if not exists public.ai_generation_examples (
  id                 bigint generated always as identity primary key,
  chain_id           bigint references public.prompt_chains(id) on delete cascade, -- null = every chain
  photo_description  text not null check (char_length(photo_description) between 1 and 1000),
  caption            text not null check (char_length(caption) between 1 and 200),
  notes              text check (char_length(notes) <= 500),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists ai_generation_examples_chain_idx on public.ai_generation_examples (chain_id);

-- ---------------------------------------------------------------- Generation requests (one per meme attempt)
create table if not exists public.generation_requests (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz,
  user_id        uuid references auth.users(id) on delete set null,
  source         text not null default 'caption_club' check (source in ('caption_club', 'backstage')),
  chain_id       bigint references public.prompt_chains(id) on delete set null,
  chain_slug     text check (char_length(chain_slug) <= 60),     -- kept even if the chain is deleted later
  storage_path   text check (char_length(storage_path) <= 300),
  meme_image_id  bigint references public.meme_images(id) on delete set null,
  caption_count  int check (caption_count between 1 and 10),
  status         text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  failed_step    int,
  error          text check (char_length(error) <= 1000),
  total_ms       int check (total_ms >= 0)
);
create index if not exists generation_requests_created_idx on public.generation_requests (created_at desc);
create index if not exists generation_requests_user_idx on public.generation_requests (user_id);
create index if not exists generation_requests_chain_idx on public.generation_requests (chain_id);
create index if not exists generation_requests_meme_idx on public.generation_requests (meme_image_id);

-- ---------------------------------------------------------------- LLM responses (one per AI call)
create table if not exists public.llm_responses (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  request_id     bigint not null references public.generation_requests(id) on delete cascade,
  step_id        bigint references public.prompt_chain_steps(id) on delete set null,
  step_order     int not null,
  step_name      text check (char_length(step_name) <= 80),
  provider       text check (char_length(provider) <= 80),
  model          text check (char_length(model) <= 120),          -- the model that actually answered
  used_fallback  boolean not null default false,
  attempts       int not null default 1 check (attempts between 1 and 20),
  status         text not null check (status in ('ok', 'error')),
  http_status    int,
  prompt         text check (char_length(prompt) <= 20000),
  response       text check (char_length(response) <= 20000),
  error          text check (char_length(error) <= 1000),
  latency_ms     int check (latency_ms >= 0),
  input_tokens   int,
  output_tokens  int
);
create index if not exists llm_responses_request_idx on public.llm_responses (request_id);
create index if not exists llm_responses_created_idx on public.llm_responses (created_at desc);
create index if not exists llm_responses_step_idx on public.llm_responses (step_id);

-- ---------------------------------------------------------------- Who can create an account
create table if not exists public.allowed_signup_domains (
  id          bigint generated always as identity primary key,
  domain      text not null unique check (domain = lower(domain) and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null
);

create table if not exists public.whitelisted_emails (
  id          bigint generated always as identity primary key,
  email       text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  note        text check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null
);

-- updated_at bookkeeping
do $$
declare t text;
begin
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix','terms','ai_generation_examples'] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- Sign-up gate
-- A brand-new account is created only if its email is whitelisted or its domain is allowed.
-- If BOTH lists are empty, anyone can sign up (so emptying them can never lock everyone out).
-- Existing accounts are never affected.
create or replace function public.enforce_signup_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e text := lower(coalesce(new.email, ''));
begin
  if not exists (select 1 from public.allowed_signup_domains) and not exists (select 1 from public.whitelisted_emails) then
    return new;
  end if;
  if exists (select 1 from public.whitelisted_emails w where w.email = e) then
    return new;
  end if;
  if exists (select 1 from public.allowed_signup_domains d where d.domain = split_part(e, '@', 2)) then
    return new;
  end if;
  raise exception 'signup_not_allowed' using detail = 'This email is not on the allowed sign-up list.';
end;
$$;
revoke all on function public.enforce_signup_allowlist() from public;
drop trigger if exists enforce_signup_allowlist on auth.users;
create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

-- ---------------------------------------------------------------- Row-level security
alter table public.llm_providers          enable row level security;
alter table public.llm_models             enable row level security;
alter table public.prompt_chains          enable row level security;
alter table public.prompt_chain_steps     enable row level security;
alter table public.prompt_chain_mix       enable row level security;
alter table public.terms                  enable row level security;
alter table public.ai_generation_examples enable row level security;
alter table public.generation_requests    enable row level security;
alter table public.llm_responses          enable row level security;
alter table public.allowed_signup_domains enable row level security;
alter table public.whitelisted_emails     enable row level security;

-- Pipeline configuration: every signed-in user can read it (Caption Club needs it to make memes);
-- only superadmins can change it.
do $$
declare t text;
begin
  foreach t in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix','terms','ai_generation_examples'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_superadmin()))', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_superadmin()))', t || '_admin_delete', t);
  end loop;
end $$;

-- Prompt chains and their steps are read-only in Backstage (edit them here in SQL).
-- Mix: superadmins update weights and caption counts; rows exist one per chain.
drop policy if exists "prompt_chains_admin_insert" on public.prompt_chains;
drop policy if exists "prompt_chains_admin_update" on public.prompt_chains;
drop policy if exists "prompt_chains_admin_delete" on public.prompt_chains;
drop policy if exists "prompt_chain_steps_admin_insert" on public.prompt_chain_steps;
drop policy if exists "prompt_chain_steps_admin_update" on public.prompt_chain_steps;
drop policy if exists "prompt_chain_steps_admin_delete" on public.prompt_chain_steps;
drop policy if exists "prompt_chain_mix_admin_delete" on public.prompt_chain_mix;  -- insert stays, so a new chain can join the mix

-- Generation requests: people log their own attempts and read only their own; superadmins read everything
-- and can link a Backstage-made meme to its request.
drop policy if exists "generation_requests_own_insert" on public.generation_requests;
drop policy if exists "generation_requests_own_update" on public.generation_requests;
drop policy if exists "generation_requests_read" on public.generation_requests;
create policy "generation_requests_own_insert" on public.generation_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'running' and (source = 'caption_club' or (select public.is_superadmin())));
create policy "generation_requests_own_update" on public.generation_requests
  for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_superadmin()))
  with check (user_id = (select auth.uid()) or (select public.is_superadmin()));
create policy "generation_requests_read" on public.generation_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_superadmin()));

-- LLM responses: written for your own requests only; read by superadmins.
drop policy if exists "llm_responses_own_insert" on public.llm_responses;
drop policy if exists "llm_responses_admin_read" on public.llm_responses;
create policy "llm_responses_own_insert" on public.llm_responses
  for insert to authenticated
  with check (exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid())));
create policy "llm_responses_admin_read" on public.llm_responses
  for select to authenticated using ((select public.is_superadmin()));

-- Sign-up lists: superadmins only, all four operations.
do $$
declare t text;
begin
  foreach t in array array['allowed_signup_domains','whitelisted_emails'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t || '_admin_all', t);
  end loop;
end $$;

-- Superadmins can read every meme's AI media (already true for regular reads, kept explicit for the logs join)
-- and every profile (from admin-setup.sql). Nothing else changes for regular users.

-- ---------------------------------------------------------------- Seed: today's pipeline, exactly
insert into public.llm_providers (name, api_style, api_base_url, api_key_env, notes)
values ('Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta', 'GEMINI_API_KEY', 'Free tier. Key is set in Vercel.')
on conflict (name) do nothing;

insert into public.llm_models (provider_id, name, api_model_id, supports_images, notes)
select p.id, m.name, m.api_model_id, true, m.notes
from public.llm_providers p
cross join (values
  ('Gemini 3.8 Flash', 'gemini-3.8-flash', 'Main model for both steps.'),
  ('Gemini 3.5 Flash-Lite', 'gemini-3.5-flash-lite', 'Backup when the main model is overloaded.')
) as m(name, api_model_id, notes)
where p.name = 'Google Gemini'
on conflict (provider_id, api_model_id) do nothing;

insert into public.prompt_chains (slug, name, description, is_active) values
  ('classic', 'Caption Club classic', 'Describe the photo, then write captions from five different comedic angles. The chain Caption Club has always used.', true),
  ('deadpan', 'Deadpan only', 'Same description step, but every caption is dry understatement. Off by default; raise its weight in the mix to try it.', true)
on conflict (slug) do nothing;

with ids as (
  select
    (select id from public.prompt_chains where slug = 'classic') as classic,
    (select id from public.prompt_chains where slug = 'deadpan') as deadpan,
    (select id from public.llm_models where api_model_id = 'gemini-3.8-flash') as main,
    (select id from public.llm_models where api_model_id = 'gemini-3.5-flash-lite') as lite
),
describe as (
  select $p$Describe this photo for someone who can't see it, so they could write a funny meme caption about it.
Cover the main subject, what they're doing, facial expressions or body language, the setting, and any odd or funny small details.
Be concrete and literal. 3 to 5 sentences of plain prose, no lists.$p$ as t
)
insert into public.prompt_chain_steps (chain_id, step_order, name, model_id, fallback_model_id, prompt_template, temperature, json_output)
select ids.classic, 1, 'Describe the photo', ids.main, ids.lite, describe.t, null::numeric, false from ids, describe
union all
select ids.classic, 2, 'Write captions', ids.main, ids.lite, $p$You write captions for a meme app. Here is a description of a photo:

{{description}}

Write exactly {{caption_count}} funny meme captions for this photo.
Rules:
- Each caption is at most 12 words.
- Each takes a different comedic angle: a relatable everyday struggle, an absurd overreaction, the subject's inner monologue, a "when you..." scenario, and deadpan understatement.
- Ground every joke in specific details from the description.
- Keep it kind: no jokes about anyone's body, race, ethnicity, gender, sexuality, age, religion or disability. No slurs.
- No real song lyrics and no quotes from movies or TV shows.
{{examples}}
{{terms}}
Return only JSON in this shape: {"captions": ["...", "...", "...", "...", "..."]}$p$, null, true from ids
union all
select ids.deadpan, 1, 'Describe the photo', ids.main, ids.lite, describe.t, null, false from ids, describe
union all
select ids.deadpan, 2, 'Write deadpan captions', ids.main, ids.lite, $p$You write captions for a meme app. Here is a description of a photo:

{{description}}

Write exactly {{caption_count}} deadpan meme captions for this photo.
Rules:
- Each caption is at most 12 words.
- Every caption is dry understatement: describe something absurd as if it were completely ordinary.
- Ground every joke in specific details from the description.
- Keep it kind: no jokes about anyone's body, race, ethnicity, gender, sexuality, age, religion or disability. No slurs.
- No real song lyrics and no quotes from movies or TV shows.
{{examples}}
{{terms}}
Return only JSON in this shape: {"captions": ["...", "..."]}$p$, 0.9, true from ids
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_mix (chain_id, weight, caption_count)
select id, case slug when 'classic' then 100 else 0 end, 5 from public.prompt_chains
on conflict (chain_id) do nothing;

-- Starter glossary. Seeded OFF so today's captions don't change; switch one on in Backstage → Terms
-- and it's added to the caption prompt.
insert into public.terms (term, definition, example, is_active) values
  ('Deadpan', 'Delivering something absurd in a flat, matter-of-fact way.', 'Dog wearing sunglasses: "He has a 2pm."', false),
  ('Callback', 'A joke that refers back to something set up earlier.', null, false),
  ('Rule of three', 'List two normal things, then a third that breaks the pattern.', '"Coffee, keys, existential dread."', false)
on conflict do nothing;

-- Who can create a new account. Delete both rows (and leave the whitelist empty) to let anyone sign up.
insert into public.allowed_signup_domains (domain, note, created_by) values
  ('columbia.edu', 'Columbia students and staff', null),
  ('barnard.edu', 'Barnard students and staff', null)
on conflict (domain) do nothing;

-- ---------------------------------------------------------------- Check
select
  (select count(*) from public.prompt_chains)       as chains,
  (select count(*) from public.prompt_chain_steps)  as steps,
  (select count(*) from public.llm_models)          as models,
  (select string_agg(domain, ', ') from public.allowed_signup_domains) as allowed_domains;
