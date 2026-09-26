import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp, premiumFromRow, type Services } from './app';
import { createProjectBundle } from '../src/core/bundle';
import { buildEmptyProject } from '../src/core/seed';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
function services() {
  const rows: Record<string, Record<string, unknown>[]> = { projects: [{ id: PROJECT, owner_id: OTHER, bundle_path: `${OTHER}/${PROJECT}/private`, revision: 1 }], subscriptions: [], billing_customers: [{ user_id: USER, stripe_customer_id: 'cus_test' }] };
  const upload = vi.fn(); const sign = vi.fn(); const rpc = vi.fn().mockResolvedValue({ error: null });
  const database = {
    auth: { getUser: vi.fn(async (token: string) => token === 'valid' ? { data: { user: { id: USER } }, error: null } : { data: { user: null }, error: { message: 'expired' } }) },
    from: (table: string) => {
      const filters: [string, unknown][] = [];
      const result = () => (rows[table] ?? []).filter(row => filters.every(([key, value]) => row[key] === value));
      const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push([key,value]); return query; }, order: () => query, limit: async () => ({ data: result(), error: null }), maybeSingle: async () => ({ data: result()[0] ?? null, error: null }) };
      return query;
    },
    storage: { from: () => ({ upload, createSignedUrl: sign }) }, rpc,
  } as unknown as SupabaseClient;
  const config: Services = { database, stripe: null, stripePriceId: 'price_server', webhookSecret: 'whsec_testing', siteOrigin: 'http://127.0.0.1:3000' };
  return { config, rows, upload, sign, rpc };
}
describe('API authorization and validation', () => {
  it('rejects missing and invalid credentials', async () => {
    const app = createApp(services().config);
    expect((await request(app).get('/api/projects')).status).toBe(401);
    expect((await request(app).get('/api/projects').set('Authorization','Bearer expired')).status).toBe(401);
  });
  it('does not sign a URL for another user project', async () => {
    const { config, sign } = services();
    expect((await request(createApp(config)).get(`/api/projects/${PROJECT}`).set('Authorization','Bearer valid')).status).toBe(404);
    expect(sign).not.toHaveBeenCalled();
  });
  it('rejects a client-forged premium flag', async () => {
    const app = createApp(services().config);
    expect((await request(app).get(`/api/projects/${PROJECT}/versions?isPremium=true`).set('Authorization','Bearer valid')).status).toBe(403);
  });
  it('rejects malformed uploads before storage and foreign project saves before upload', async () => {
    const { config, upload } = services(); const app = createApp(config);
    expect((await request(app).post('/api/projects').set('Authorization','Bearer valid').set('Content-Type','application/octet-stream').send(Buffer.from('not audio'))).status).toBe(400);
    const bundle = Buffer.from(await (await createProjectBundle(buildEmptyProject())).arrayBuffer());
    expect((await request(app).put(`/api/projects/${PROJECT}`).set('Authorization','Bearer valid').set('If-Match','1').set('Content-Type','application/octet-stream').send(bundle)).status).toBe(404);
    expect(upload).not.toHaveBeenCalled();
  });
  it('restricts origins and fails closed without configuration', async () => {
    const { config } = services();
    expect((await request(createApp(config)).get('/api/projects').set('Origin','https://attacker.example').set('Authorization','Bearer valid')).status).toBe(403);
    expect((await request(createApp({ ...config, database: null })).get('/api/projects')).status).toBe(503);
  });
  it('uses the Stripe SDK to reject unsigned webhooks and accept a valid signed event', async () => {
    const { config, rpc } = services(); const stripe = new Stripe('sk_test_not_a_real_key');
    const app = createApp({ ...config, stripe });
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.created', data: { object: {} } });
    expect((await request(app).post('/api/billing/webhook').set('Content-Type','application/json').send(payload)).status).toBe(400);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret });
    expect((await request(app).post('/api/billing/webhook').set('Content-Type','application/json').set('stripe-signature',signature).send(payload)).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('grants only the configured price from a signed subscription event', async () => {
    const { config, rpc } = services(); const stripe = new Stripe('sk_test_not_a_real_key');
    vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue({ id: 'sub_1', customer: 'cus_test', status: 'active', items: { data: [{ price: { id: 'wrong_price' }, current_period_end: 4102444800 }] } } as unknown as Stripe.Response<Stripe.Subscription>);
    const payload = JSON.stringify({ id: 'evt_sub', created: 100, type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: config.webhookSecret });
    const response = await request(createApp({ ...config, stripe })).post('/api/billing/webhook').set('Content-Type','application/json').set('stripe-signature',signature).send(payload);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('apply_subscription_event', expect.objectContaining({ p_user_id: USER, p_status: 'canceled', p_expires: null }));
  });
  it('treats expired, unknown and delinquent entitlements as free', () => {
    expect(premiumFromRow({ status: 'active', expires_at: '2099-01-01' })).toBe(true);
    for (const row of [null, { status: 'active', expires_at: '2000-01-01' }, { status: 'past_due', expires_at: '2099-01-01' }, { status: 'active', expires_at: 'bad' }]) expect(premiumFromRow(row)).toBe(false);
  });
});
