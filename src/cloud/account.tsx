import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloud, cloudRequest } from './client';
interface Entitlement { isPremium: boolean; expiresAt: string | null; }
interface AccountState { session: Session | null; loading: boolean; entitlement: Entitlement; refreshEntitlement: () => Promise<void>; }
const free: Entitlement = { isPremium: false, expiresAt: null };
const AccountContext = createContext<AccountState>({ session: null, loading: false, entitlement: free, refreshEntitlement: async () => {} });
export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!cloud);
  const [entitlement, setEntitlement] = useState<Entitlement>(free);
  const user = useRef<string | undefined>(); user.current = session?.user.id;
  const refreshEntitlement = async () => {
    const requestedUser = user.current;
    if (!requestedUser) { setEntitlement(free); return; }
    try {
      const result = await cloudRequest<Entitlement>('/entitlement');
      if (user.current === requestedUser) setEntitlement(result);
    } catch { if (user.current === requestedUser) setEntitlement(free); }
  };
  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    let authEvents = 0;
    void cloud.auth.getSession().then(({ data }) => { if (alive && authEvents === 0) { setSession(data.session); setLoading(false); } }).catch(() => { if (alive) setLoading(false); });
    const { data } = cloud.auth.onAuthStateChange((_event, next) => { authEvents++; setSession(next); setEntitlement(free); setLoading(false); });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    void refreshEntitlement();
    const timer = window.setInterval(() => void refreshEntitlement(), 60000);
    return () => window.clearInterval(timer);
  }, [session?.user.id]);
  const active = entitlement.isPremium && !!entitlement.expiresAt && Date.parse(entitlement.expiresAt) > Date.now();
  return <AccountContext.Provider value={{ session, loading, entitlement: { ...entitlement, isPremium: active }, refreshEntitlement }}>{children}</AccountContext.Provider>;
}
export const useAccount = () => useContext(AccountContext);
export function PremiumGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return <>{useAccount().entitlement.isPremium ? children : fallback}</>;
}
