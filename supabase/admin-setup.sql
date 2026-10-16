-- Backstage (Caption Club admin) setup.
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
--
-- How this avoids locking yourself out: the admin area only lets in people whose
-- profiles.is_superadmin is TRUE, and nobody can flip that flag from inside the apps.
-- The SQL Editor runs as the database owner, which bypasses those rules, so step 2 below
-- grants the very first admin directly. Promote anyone else the same way.

-- 1. The flag
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

-- 2. Make Maya the first superadmin (bootstrap from the SQL Editor)
update public.profiles set is_superadmin = true
where id = (select id from auth.users where lower(email) = 'mj3164@columbia.edu');
-- To add another admin later:
--   update public.profiles set is_superadmin = true
--   where id = (select id from auth.users where lower(email) = 'their@email.com');

-- 3. Nobody can make themselves an admin from an app.
--    Users may edit their own profile row, so this trigger rejects any change to the flag
--    unless it comes from the database owner (the SQL Editor) or the service role.
create or replace function public.protect_superadmin_flag()
returns trigger language plpgsql set search_path = public as $$  -- runs as the caller on purpose
begin
  if current_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_superadmin := false;
  elsif new.is_superadmin is distinct from old.is_superadmin then
    raise exception 'is_superadmin can only be changed by a database owner';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

-- 4. "Is the signed-in person a superadmin?" (used by every rule below and by the app)
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

-- 5. Superadmin-only access. These add to the existing rules; regular users keep exactly what they had.

-- READ users/profiles
drop policy if exists "profiles_superadmin_read" on public.profiles;
create policy "profiles_superadmin_read" on public.profiles
  for select to authenticated using ((select public.is_superadmin()));

-- CREATE/READ/UPDATE/DELETE AI-generated media (memes and their captions)
drop policy if exists "meme_images_superadmin_update" on public.meme_images;
drop policy if exists "meme_images_superadmin_delete" on public.meme_images;
create policy "meme_images_superadmin_update" on public.meme_images
  for update to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
create policy "meme_images_superadmin_delete" on public.meme_images
  for delete to authenticated using ((select public.is_superadmin()));

drop policy if exists "meme_captions_superadmin_insert" on public.meme_captions;
drop policy if exists "meme_captions_superadmin_update" on public.meme_captions;
drop policy if exists "meme_captions_superadmin_delete" on public.meme_captions;
create policy "meme_captions_superadmin_insert" on public.meme_captions
  for insert to authenticated with check ((select public.is_superadmin()));
create policy "meme_captions_superadmin_update" on public.meme_captions
  for update to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()));
create policy "meme_captions_superadmin_delete" on public.meme_captions
  for delete to authenticated using ((select public.is_superadmin()));

-- READ upvotes/downvotes
drop policy if exists "meme_votes_superadmin_read" on public.meme_votes;
create policy "meme_votes_superadmin_read" on public.meme_votes
  for select to authenticated using ((select public.is_superadmin()));

-- Photos: superadmins can remove any meme photo when deleting a meme
drop policy if exists "memes_bucket_superadmin_delete" on storage.objects;
create policy "memes_bucket_superadmin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'memes' and (select public.is_superadmin()));

-- 6. User list with emails and activity (emails live in auth.users, which apps can't read directly)
create or replace function public.admin_users()
returns table (
  id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz,
  first_name text, last_name text, profile_photo_url text, is_superadmin boolean,
  memes_made bigint, votes_cast bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'superadmins only';
  end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           p.first_name, p.last_name, p.profile_photo_url, coalesce(p.is_superadmin, false),
           (select count(*) from public.meme_images m where m.user_id = u.id),
           (select count(*) from public.meme_votes v where v.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

-- 7. Check: should return your email with is_superadmin = true
select u.email, p.is_superadmin from public.profiles p join auth.users u on u.id = p.id where p.is_superadmin;
