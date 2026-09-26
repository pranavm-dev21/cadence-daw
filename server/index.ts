import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { createApp } from './app';

const siteOrigin = process.env.SITE_ORIGIN ?? 'http://127.0.0.1:3000';
const origin = new URL(siteOrigin);
if (origin.origin !== siteOrigin || (origin.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(origin.hostname))) throw new Error('SITE_ORIGIN must be an HTTPS origin, or localhost for development.');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if ((url && !key) || (key && !url)) throw new Error('Configure both server Supabase variables.');
if (url && new URL(url).protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');
const database = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const app = createApp({ database, stripe, siteOrigin, stripePriceId: process.env.STRIPE_PRICE_ID ?? '', webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '' });
const port = Number(process.env.API_PORT ?? 8787);
app.listen(port, process.env.API_HOST ?? '127.0.0.1', () => console.info(JSON.stringify({ event: 'api_started', port, cloudConfigured: !!database, billingConfigured: !!stripe })));
