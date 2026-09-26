import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { decodeProjectBundle } from '../src/core/bundle';
import { serialize } from '../src/core/format';

export interface Services {
  database: SupabaseClient | null;
  stripe: Stripe | null;
  stripePriceId: string;
  webhookSecret: string;
  siteOrigin: string;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (res: Response, status: number, message: string) => { res.status(status).json({ error: message }); };
export function premiumFromRow(row: { status?: string; expires_at?: string | null } | null, now = Date.now()): boolean {
  return !!row && ['active', 'trialing'].includes(row.status ?? '') && typeof row.expires_at === 'string' && Date.parse(row.expires_at) > now;
}
export function createApp(services: Services) {
  const app = express();
  app.disable('x-powered-by'); app.use(helmet());
  app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== services.siteOrigin) return fail(res, 403, 'This origin is not allowed.');
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ accounts: !!services.database, billing: !!services.database && !!services.stripe && !!services.stripePriceId && !!services.webhookSecret }));

  // Stripe requires the unchanged body for its SDK signature verification.
  app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const { stripe, database } = services;
    if (!stripe || !database || !services.webhookSecret) return fail(res, 503, 'Billing is not configured.');
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature') ?? '', services.webhookSecret); }
    catch { return fail(res, 400, 'Invalid webhook signature.'); }
    if (!['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) { res.json({ received: true }); return; }
    const notification = event.data.object as Stripe.Subscription;
    // Fetch current truth: webhook deliveries may arrive out of order.
    const subscription = await stripe.subscriptions.retrieve(notification.id);
    const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const owner = await database.from('billing_customers').select('user_id').eq('stripe_customer_id', customer).maybeSingle();
    if (owner.error) throw owner.error;
    if (!owner.data) return fail(res, 400, 'Subscription customer is not linked.');
    const item = subscription.items.data.find(item => item.price.id === services.stripePriceId);
    const expires = item?.current_period_end;
    const status = item ? subscription.status : 'canceled';
    const result = await database.rpc('apply_subscription_event', {
      p_user_id: owner.data.user_id, p_status: status, p_expires: expires ? new Date(expires * 1000).toISOString() : null,
      p_event_id: event.id, p_created: event.created,
    });
    if (result.error) throw result.error;
    res.json({ received: true });
  });

  app.use('/api', async (req, res, next) => {
    if (!services.database) return fail(res, 503, 'Cloud services are not configured. Local recording and saving remain available.');
    const header = req.get('authorization') ?? '';
    if (!header.startsWith('Bearer ') || header.length > 8192) return fail(res, 401, 'Sign in to continue.');
    const result = await services.database.auth.getUser(header.slice(7));
    if (result.error || !result.data.user) return fail(res, 401, 'Your session has expired. Sign in again.');
    res.locals.userId = result.data.user.id;
    next();
  });
  const entitlement = async (userId: string) => {
    const result = await services.database!.from('subscriptions').select('status,expires_at').eq('user_id', userId).maybeSingle();
    if (result.error) throw result.error;
    return { isPremium: premiumFromRow(result.data), expiresAt: result.data?.expires_at ?? null };
  };
  app.get('/api/entitlement', async (_req, res) => { res.json(await entitlement(res.locals.userId)); });
  app.get('/api/projects', async (_req, res) => {
    const result = await services.database!.from('projects').select('id,name,revision,updated_at').eq('owner_id', res.locals.userId).order('updated_at', { ascending: false }).limit(100);
    if (result.error) throw result.error; res.json(result.data);
  });
  app.get('/api/projects/:id', async (req, res) => {
    if (!uuid.test(String(req.params.id))) return fail(res, 400, 'Invalid project ID.');
    const result = await services.database!.from('projects').select('id,name,revision,bundle_path').eq('id', req.params.id).eq('owner_id', res.locals.userId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data?.bundle_path) return fail(res, 404, 'Project not found.');
    const url = await services.database!.storage.from('project-audio').createSignedUrl(result.data.bundle_path, 60);
    if (url.error) throw url.error;
    res.json({ ...result.data, downloadUrl: url.data.signedUrl });
  });
  app.get('/api/projects/:id/versions', async (req, res) => {
    if (!(await entitlement(res.locals.userId)).isPremium) return fail(res, 403, 'Premium is required for cloud version history.');
    if (!uuid.test(String(req.params.id))) return fail(res, 400, 'Invalid project ID.');
    const versions = await services.database!.from('project_versions').select('id,created_at').eq('project_id', req.params.id).eq('owner_id', res.locals.userId).order('created_at', { ascending: false }).limit(50);
    if (versions.error) throw versions.error; res.json(versions.data);
  });
  app.get('/api/versions/:id', async (req, res) => {
    if (!(await entitlement(res.locals.userId)).isPremium) return fail(res, 403, 'Premium is required for cloud version history.');
    if (!uuid.test(String(req.params.id))) return fail(res, 400, 'Invalid version ID.');
    const version = await services.database!.from('project_versions').select('bundle_path').eq('id', req.params.id).eq('owner_id', res.locals.userId).maybeSingle();
    if (version.error) throw version.error;
    if (!version.data) return fail(res, 404, 'Version not found.');
    const url = await services.database!.storage.from('project-audio').createSignedUrl(version.data.bundle_path, 60);
    if (url.error) throw url.error; res.json({ downloadUrl: url.data.signedUrl });
  });

  const uploadLimit = rateLimit({ windowMs: 15 * 60_000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false });
  const save = async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body)) return fail(res, 415, 'Upload a Cadence project backup.');
    let decoded: ReturnType<typeof decodeProjectBundle>;
    try { decoded = decodeProjectBundle(req.body.buffer.slice(req.body.byteOffset, req.body.byteOffset + req.body.byteLength) as ArrayBuffer); }
    catch { return fail(res, 400, 'The project backup is malformed or contains unsupported audio.'); }
    const userId = res.locals.userId as string;
    const projectId = req.params.id ? String(req.params.id) : randomUUID();
    if (!uuid.test(projectId)) return fail(res, 400, 'Invalid project ID.');
    const expected = req.params.id ? Number(req.get('if-match')) : 0;
    if (!Number.isSafeInteger(expected) || expected < 0 || (req.params.id && !req.get('if-match'))) return fail(res, 400, 'A valid project revision is required.');
    if (req.params.id) {
      const owner = await services.database!.from('projects').select('revision').eq('id', projectId).eq('owner_id', userId).maybeSingle();
      if (owner.error) throw owner.error;
      if (!owner.data) return fail(res, 404, 'Project not found.');
      if (owner.data.revision !== expected) return fail(res, 409, 'This project changed on another device. Open the latest copy before saving.');
    }
    const path = `${userId}/${projectId}/${randomUUID()}.cadenceproject`;
    const upload = await services.database!.storage.from('project-audio').upload(path, req.body, { contentType: 'application/octet-stream', upsert: false });
    if (upload.error) throw upload.error;
    const premium = await entitlement(userId);
    const saved = await services.database!.rpc('commit_project_bundle', { p_id: projectId, p_owner: userId, p_name: decoded.project.name, p_document: JSON.parse(serialize(decoded.project)), p_path: path, p_expected: expected, p_history: premium.isPremium });
    if (saved.error?.code === '40001') return fail(res, 409, 'This project changed on another device. Open the latest copy before saving.');
    if (saved.error) throw saved.error;
    res.status(req.params.id ? 200 : 201).json({ id: saved.data.id, name: saved.data.name, revision: saved.data.revision });
  };
  app.post('/api/projects', uploadLimit, express.raw({ type: 'application/octet-stream', limit: '64mb' }), save);
  app.put('/api/projects/:id', uploadLimit, express.raw({ type: 'application/octet-stream', limit: '64mb' }), save);

  app.post('/api/billing/checkout', async (_req, res) => {
    const { stripe, database, stripePriceId } = services;
    if (!stripe || !stripePriceId) return fail(res, 503, 'Billing is not configured.');
    const userId = res.locals.userId as string;
    const existing = await database!.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
    if (existing.error) throw existing.error;
    let customerId = existing.data?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata: { userId } }, { idempotencyKey: `cadence-customer-${userId}` });
      const saved = await database!.from('billing_customers').upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: 'user_id' });
      if (saved.error) throw saved.error; customerId = customer.id;
    }
    const liveSubscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    const alreadySubscribed = liveSubscriptions.data.some(subscription => ['active', 'trialing', 'past_due'].includes(subscription.status) && subscription.items.data.some(item => item.price.id === stripePriceId));
    if (alreadySubscribed || (await entitlement(userId)).isPremium) {
      const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: services.siteOrigin });
      res.json({ url: portal.url }); return;
    }
    const checkout = await stripe.checkout.sessions.create({ mode: 'subscription', customer: customerId, line_items: [{ price: stripePriceId, quantity: 1 }], success_url: `${services.siteOrigin}/?billing=success`, cancel_url: `${services.siteOrigin}/?billing=canceled` }, { idempotencyKey: `cadence-checkout-${userId}-${Math.floor(Date.now() / 1800000)}` });
    res.json({ url: checkout.url });
  });
  app.use((error: { status?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (error.status === 413) { fail(res, 413, 'Cloud uploads are limited to 64 MB. Keep a local backup for larger projects.'); return; }
    console.error(JSON.stringify({ event: 'api_failure', code: error.code ?? 'internal' }));
    fail(res, 500, 'The service could not complete this request. Your local project is unchanged.');
  });
  return app;
}
