import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../state/store';
import { cloud, cloudRequest, downloadCloudBundle } from '../cloud/client';
import { PremiumGate, useAccount } from '../cloud/account';
import { createProjectBundle, openProjectBundle } from '../core/bundle';
import { audio } from '../core/audio';
interface CloudProject { id: string; name: string; revision: number; updated_at?: string; }
interface Version { id: string; created_at: string; }
export default function CloudProjects() {
  const { session, loading, entitlement, refreshEntitlement } = useAccount();
  const store = useStore();
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [linked, setLinked] = useState<(CloudProject & { createdAt: number }) | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const currentUser = useRef(session?.user.id); currentUser.current = session?.user.id;
  const button = 'rounded-lg border border-ink-600 bg-ink-750 px-4 py-2 text-sm disabled:opacity-40 hover:border-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal';
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'The request failed. Please retry.'); } finally { setBusy(false); }
  };
  const list = async () => {
    const user = currentUser.current;
    const rows = await cloudRequest<CloudProject[]>('/projects');
    if (currentUser.current === user) setProjects(rows);
  };
  useEffect(() => {
    setProjects([]); setLinked(null); setVersions([]); setError('');
    if (session) void run(list);
  }, [session?.user.id]);
  const authenticate = (event: FormEvent) => {
    event.preventDefault(); if (!cloud) return;
    void run(async () => {
      const result = creating ? await cloud!.auth.signUp({ email, password }) : await cloud!.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword('');
      if (creating && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    });
  };
  const save = () => run(async () => {
    const user = currentUser.current;
    const project = store.state.project;
    const bundle = await createProjectBundle(project);
    if (bundle.size > 64 * 1024 * 1024) throw new Error('Cloud saves support projects up to 64 MB. Save file keeps larger projects locally.');
    if (currentUser.current !== user) throw new Error('Your account changed. Please retry.');
    const target = linked?.createdAt === project.createdAt ? linked : null;
    const result = await cloudRequest<CloudProject>(target ? `/projects/${target.id}` : '/projects', { method: target ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/octet-stream', ...(target ? { 'If-Match': String(target.revision) } : {}) }, body: bundle });
    if (currentUser.current !== user) return;
    setLinked({ ...result, createdAt: project.createdAt }); setMessage('Your project and recordings are saved privately in your cloud account.'); await list();
  });
  const open = (id: string, version = false) => run(async () => {
    const user = currentUser.current;
    const result = await cloudRequest<CloudProject & { downloadUrl: string }>(version ? `/versions/${id}` : `/projects/${id}`);
    const bytes = await downloadCloudBundle(result.downloadUrl);
    if (currentUser.current !== user) throw new Error('Your account changed. Please reopen the project.');
    const project = await openProjectBundle(bytes);
    if (currentUser.current !== user) return;
    audio.stop(); store.loadProject(project);
    setLinked(version ? null : { ...result, createdAt: project.createdAt });
    setMessage(version ? 'Opened a previous version as a separate local copy.' : 'Cloud project opened with its recordings.');
  });
  const upgrade = () => run(async () => {
    const result = await cloudRequest<{ url: string }>('/billing/checkout', { method: 'POST' });
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(url.hostname)) throw new Error('The billing destination could not be verified.');
    window.location.assign(url.toString());
  });
  return <section className="flex-1 min-h-0 overflow-auto rounded-xl border border-ink-700 bg-ink-900 p-4 md:p-6" aria-label="Cloud projects">
    <p className="text-teal text-xs uppercase tracking-widest">Your projects</p><h1 className="text-2xl font-semibold mt-1">Create here. Pick up anywhere.</h1>
    <p className="text-sm text-ink-400 mt-3 mb-6">Recording and device saves are always free. A cloud save uploads your project and all its takes only when you choose Save to cloud.</p>
    {!cloud ? <div className="border border-ink-700 rounded-lg p-5"><h2 className="font-semibold">Cloud accounts are not connected yet</h2><p className="text-sm text-ink-400 mt-2">You can record, process, save portable project backups, and export audio on this device.</p><button className={button + ' mt-4'} onClick={() => store.setWorkspaceView('vocal')}>Go to Vocal / Rap Studio</button></div>
    : loading ? <p role="status">Checking your account…</p>
    : !session ? <form className="max-w-md flex flex-col gap-4" onSubmit={authenticate}>
      <h2 className="text-lg font-semibold">{creating ? 'Create your account' : 'Sign in'}</h2>
      <label className="text-sm">Email<input className="mt-1 block w-full bg-ink-800 rounded border border-ink-700 p-3" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="text-sm">Password<input className="mt-1 block w-full bg-ink-800 rounded border border-ink-700 p-3" type="password" autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 12 : 1} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button className={button} disabled={busy}>{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</button>
      <button type="button" className="text-sm text-teal underline" onClick={() => setCreating(!creating)}>{creating ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
    </form>
    : <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center"><span className="text-sm">{session.user.email} · {entitlement.isPremium ? 'Premium' : 'Free'}</span><button className={button} disabled={busy} onClick={() => void run(async () => { const result = await cloud!.auth.signOut(); if (result.error) throw result.error; })}>Sign out</button></div>
      <div className="flex flex-wrap gap-3"><button className={button + ' text-teal'} disabled={busy} onClick={() => void save()}>Save to cloud</button><button className={button} disabled={busy} onClick={() => void run(list)}>Refresh projects</button><button className={button} disabled={busy} onClick={() => void upgrade()}>{entitlement.isPremium ? 'Manage subscription' : 'Explore Premium'}</button><button className={button} disabled={busy} onClick={() => void run(refreshEntitlement)}>Refresh subscription</button></div>
      <p className="text-xs text-ink-400">The device workspace stays here after sign-out. Use a private device for sensitive recordings.</p>
      {!projects.length && <p className="text-sm text-ink-400">No cloud projects yet. Save your current project to get started.</p>}
      <div className="space-y-2">{projects.map(project => <div key={project.id} className="flex flex-wrap gap-3 items-center border border-ink-700 rounded-lg p-3"><div className="flex-1 min-w-0"><h2 className="font-semibold truncate">{project.name}</h2><p className="text-xs text-ink-400">Revision {project.revision}{project.updated_at ? ` · ${new Date(project.updated_at).toLocaleString()}` : ''}</p></div><button className={button} disabled={busy} onClick={() => void open(project.id)}>Open</button><PremiumGate fallback={<span className="text-xs text-ink-400">History · Premium</span>}><button className={button} disabled={busy} onClick={() => void run(async () => { setVersions(await cloudRequest<Version[]>(`/projects/${project.id}/versions`)); })}>Version history</button></PremiumGate></div>)}</div>
      <PremiumGate fallback={<div className="border border-ink-700 rounded-lg p-4"><h2 className="font-semibold">Premium adds cloud version history</h2><p className="text-sm text-ink-400 mt-2">Keep earlier cloud saves and reopen a previous version. Recording, playback, local saving and WAV export remain free. Pricing is shown at checkout.</p></div>}><div>{versions.length ? <h2 className="font-semibold mb-2">Previous versions</h2> : <p className="text-xs text-ink-400">Previous versions appear after another cloud save while Premium is active.</p>}{versions.map(version => <button className={button + ' mr-2 mb-2'} key={version.id} disabled={busy} onClick={() => void open(version.id, true)}>{new Date(version.created_at).toLocaleString()}</button>)}</div></PremiumGate>
    </div>}
    {busy && <p role="status" className="text-sm mt-4">Working… Keep this window open.</p>}
    {message && <p role="status" className="text-teal text-sm mt-4">{message}</p>}
    {error && <p role="alert" className="text-rec text-sm mt-4">{error}</p>}
  </section>;
}

