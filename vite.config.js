import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (publicKey && !publicKey.startsWith('sb_publishable_')) {
    let role;
    try { role = JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url').toString()).role; } catch { /* Invalid public key. */ }
    if (role !== 'anon') throw new Error('Use a Supabase publishable or legacy anon key in browser configuration. Server credentials must never use VITE_ variables.');
  }
  let cloudOrigin = '';
  if (env.VITE_SUPABASE_URL) {
    const url = new URL(env.VITE_SUPABASE_URL);
    if (url.protocol !== 'https:') throw new Error('Cloud URLs must use HTTPS.');
    cloudOrigin = url.origin;
  }
  const connections = ["'self'", cloudOrigin, ...(command === 'serve' ? ['ws://127.0.0.1:3000', 'ws://localhost:3000'] : [])].filter(Boolean).join(' ');
  return {
    plugins: [react(), tailwindcss(), { name: 'scoped-cloud-csp', transformIndexHtml: html => html.replace("connect-src 'none'", `connect-src ${connections}`) }],
    server: { host: '127.0.0.1', port: 3000, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
  };
});
