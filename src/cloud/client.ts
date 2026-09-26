import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const configured = !!url && !!key && (() => { try { return new URL(url).protocol === 'https:'; } catch { return false; } })();
export const cloud = configured ? createClient(url!, key!) : null;
export async function cloudRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!cloud) throw new Error('Cloud accounts are not connected. Your local project remains available.');
  const { data } = await cloud.auth.getSession();
  if (!data.session) throw new Error('Sign in to access your cloud projects.');
  const headers = new Headers(options.headers); headers.set('Authorization', `Bearer ${data.session.access_token}`);
  const response = await fetch(`/api${path}`, { ...options, headers });
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error('Cloud service is unavailable. Please retry later.'); }
  if (!response.ok) throw new Error((result as { error?: string })?.error ?? 'Cloud request failed.');
  return result as T;
}
export async function downloadCloudBundle(url: string): Promise<ArrayBuffer> {
  if (!cloud || !import.meta.env.VITE_SUPABASE_URL || new URL(url).origin !== new URL(import.meta.env.VITE_SUPABASE_URL).origin) throw new Error('The download location is not trusted.');
  const response = await fetch(url, { credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error('The download link expired. Open the project again.');
  const length = Number(response.headers.get('content-length'));
  if (length > 64 * 1024 * 1024) throw new Error('Cloud project exceeds the supported size.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('This browser cannot download the project.');
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const result = await reader.read(); if (result.done) break;
    total += result.value.byteLength;
    if (total > 64 * 1024 * 1024) { await reader.cancel(); throw new Error('Cloud project exceeds the supported size.'); }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
