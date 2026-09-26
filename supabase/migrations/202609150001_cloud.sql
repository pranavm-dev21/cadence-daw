-- Optional Supabase cloud backend. Apply once through the Supabase migration tool.
-- Supabase owns auth.users, auth.uid(), storage.buckets and storage.objects.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 8388608),
  bundle_path text,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (bundle_path is null or bundle_path like owner_id::text || '/' || id::text || '/%')
);
create index projects_owner_updated on public.projects(owner_id, updated_at desc);
alter table public.projects enable row level security;
revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant all on public.projects to service_role;
create policy projects_read_own on public.projects for select to authenticated using (owner_id = (select auth.uid()));

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('active','trialing','canceled','past_due','unpaid','incomplete','incomplete_expired','paused')),
  expires_at timestamptz,
  last_event_created bigint not null default 0
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
create policy subscription_read_own on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

create function public.has_premium() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.subscriptions where user_id = auth.uid() and status in ('active','trialing') and expires_at > now());
$$;
revoke all on function public.has_premium() from public;
grant execute on function public.has_premium() to authenticated;

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bundle_path text not null unique,
  created_at timestamptz not null default now(),
  check (bundle_path like owner_id::text || '/' || project_id::text || '/%')
);
create index project_versions_project on public.project_versions(project_id, created_at desc);
alter table public.project_versions enable row level security;
revoke all on public.project_versions from anon, authenticated;
grant select on public.project_versions to authenticated;
grant all on public.project_versions to service_role;
create policy versions_read_premium_owner on public.project_versions for select to authenticated using (owner_id = (select auth.uid()) and (select public.has_premium()) and exists(select 1 from public.projects where id = project_id and owner_id = (select auth.uid())));

create table public.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique
);
create table public.billing_events (id text primary key, created bigint not null);
alter table public.billing_customers enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_customers, public.billing_events from anon, authenticated;
grant all on public.billing_customers, public.billing_events to service_role;

create function public.apply_subscription_event(p_user_id uuid, p_status text, p_expires timestamptz, p_event_id text, p_created bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.billing_events(id, created) values(p_event_id, p_created) on conflict do nothing;
  if not found then return; end if;
  insert into public.subscriptions(user_id, status, expires_at, last_event_created) values(p_user_id, p_status, p_expires, p_created)
  on conflict (user_id) do update set status = excluded.status, expires_at = excluded.expires_at, last_event_created = excluded.last_event_created
  where public.subscriptions.last_event_created <= excluded.last_event_created;
end;
$$;
revoke all on function public.apply_subscription_event(uuid,text,timestamptz,text,bigint) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid,text,timestamptz,text,bigint) to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('project-audio', 'project-audio', false, 67108864, array['application/octet-stream'])
on conflict(id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
-- Only the API's service credential may upload validated bundles.
-- Authenticated owners can retrieve their current bundle; past versions require Premium.
create policy audio_read_own on storage.objects for select to authenticated using (
  bucket_id = 'project-audio' and
  (exists(select 1 from public.projects where owner_id = (select auth.uid()) and bundle_path = storage.objects.name)
   or exists(select 1 from public.project_versions where owner_id = (select auth.uid()) and bundle_path = storage.objects.name and (select public.has_premium())))
);

-- Service-only transaction: upload finishes first; this commits metadata/history
-- together and refuses stale saves from another tab or device.
create function public.commit_project_bundle(p_id uuid, p_owner uuid, p_name text, p_document jsonb, p_path text, p_expected integer, p_history boolean)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare previous public.projects; saved public.projects;
begin
  select * into previous from public.projects where id = p_id for update;
  if found then
    if previous.owner_id <> p_owner or previous.revision <> p_expected then raise exception 'Project changed or is unavailable' using errcode = '40001'; end if;
    if p_history and previous.bundle_path is not null then
      insert into public.project_versions(project_id, owner_id, bundle_path) values(p_id, p_owner, previous.bundle_path) on conflict(bundle_path) do nothing;
    end if;
    update public.projects set name = p_name, document = p_document, bundle_path = p_path, revision = revision + 1, updated_at = now() where id = p_id returning * into saved;
  else
    if p_expected <> 0 then raise exception 'Project is unavailable' using errcode = '40001'; end if;
    insert into public.projects(id, owner_id, name, document, bundle_path, revision) values(p_id, p_owner, p_name, p_document, p_path, 1) returning * into saved;
  end if;
  return saved;
end;
$$;
revoke all on function public.commit_project_bundle(uuid,uuid,text,jsonb,text,integer,boolean) from public, anon, authenticated;
grant execute on function public.commit_project_bundle(uuid,uuid,text,jsonb,text,integer,boolean) to service_role;

