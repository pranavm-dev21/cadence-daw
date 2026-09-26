import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const P = '33333333-3333-4333-8333-333333333333';
const Q = '44444444-4444-4444-8444-444444444444';
let db: PGlite;
const as = async (role: string, user = '') => { await db.exec(`reset role; set role ${role};`); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]); };
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, storage to authenticated, anon, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select on storage.objects to authenticated;
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/202609150001_cloud.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}');
    insert into projects(id, owner_id, name, document, bundle_path) values
      ('${P}','${A}','A project','{}','${A}/${P}/current'),('${Q}','${B}','B project','{}','${B}/${Q}/current');
    insert into project_versions(project_id, owner_id, bundle_path) values('${P}','${A}','${A}/${P}/old'),('${Q}','${B}','${B}/${Q}/old');
    insert into storage.objects(bucket_id, name) values ('project-audio','${A}/${P}/current'),('project-audio','${B}/${Q}/current'),('project-audio','${A}/${P}/old');`);
}, 30000);
afterEach(async () => { await db.exec('reset role'); });
afterAll(async () => { await db.close(); });
describe('actual Postgres authorization policies', () => {
  it('rejects anonymous project reads', async () => {
    await as('anon'); await expect(db.query('select * from projects')).rejects.toThrow();
  });
  it('only returns owned projects and forbids direct client writes', async () => {
    await as('authenticated', A);
    expect((await db.query<{ id: string }>('select id from projects')).rows.map(row => row.id)).toEqual([P]);
    await expect(db.query("update projects set name = 'tampered'")).rejects.toThrow();
  });
  it('blocks client entitlement changes and the service-only billing function', async () => {
    await as('authenticated', A);
    await expect(db.query('insert into subscriptions(user_id,status) values($1,$2)', [A, 'active'])).rejects.toThrow();
    await expect(db.query("select apply_subscription_event($1,'active','2099-01-01','forged',10)", [A])).rejects.toThrow();
    expect((await db.query<{ has_premium: boolean }>('select has_premium()')).rows[0].has_premium).toBe(false);
  });
  it('gates previous versions and permits only the owner current audio', async () => {
    await as('authenticated', A);
    expect((await db.query('select * from project_versions')).rows).toHaveLength(0);
    expect((await db.query<{ name: string }>('select name from storage.objects')).rows.map(row => row.name)).toEqual([`${A}/${P}/current`]);
  });
  it('grants Premium from a service event without granting access to another user', async () => {
    await as('service_role'); await db.query("select apply_subscription_event($1,'active','2099-01-01','verified_event',100)", [A]);
    await as('authenticated', A);
    expect((await db.query('select * from project_versions')).rows).toHaveLength(1);
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(2);
    expect((await db.query('select * from subscriptions')).rows).toHaveLength(1);
    await as('authenticated', B);
    expect((await db.query('select * from project_versions')).rows).toHaveLength(0);
    expect((await db.query('select * from subscriptions')).rows).toHaveLength(0);
  });
  it('ignores duplicate/older billing events and revokes expired access', async () => {
    await as('service_role');
    await db.query("select apply_subscription_event($1,'canceled','2020-01-01','old_event',50)", [A]);
    await db.query("select apply_subscription_event($1,'canceled','2020-01-01','verified_event',150)", [A]);
    expect((await db.query<{ status: string }>('select status from subscriptions where user_id=$1', [A])).rows[0].status).toBe('active');
    await db.query("select apply_subscription_event($1,'active','2020-01-01','expired_event',200)", [A]);
    await as('authenticated', A);
    expect((await db.query<{ has_premium: boolean }>('select has_premium()')).rows[0].has_premium).toBe(false);
  });
  it('prevents stale writes and atomically saves a new revision with history', async () => {
    await as('service_role');
    const saved = await db.query<{ revision: number }>("select (commit_project_bundle($1,$2,'Saved','{}',$3,0,true)).revision", [P,A,`${A}/${P}/next`]);
    expect(saved.rows[0].revision).toBe(1);
    await expect(db.query("select commit_project_bundle($1,$2,'Stale','{}',$3,0,true)", [P,A,`${A}/${P}/stale`])).rejects.toThrow();
    await expect(db.query("select commit_project_bundle($1,$2,'Wrong owner','{}',$3,1,true)", [P,B,`${B}/${P}/wrong`])).rejects.toThrow();
    expect((await db.query<{ name: string }>('select name from projects where id=$1', [P])).rows[0].name).toBe('Saved');
  });
});
