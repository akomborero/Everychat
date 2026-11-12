import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Me } from "./types";

export interface RegisterInput {
  name: string;
  businessName: string;
  industry?: string;
  email: string;
  phone?: string;
  timezone?: string;
  password: string;
}
interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // The session is a cookie we cannot see, so the only way to know if we're signed in is to ask the server.
  const loadMe = useCallback(async () => {
    try { setMe(await api<Me>("/auth/me")); }
    catch { setMe(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadMe(); }, [loadMe]);
  useEffect(() => {
    const onExpired = () => setMe(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = async (email: string, password: string) => {
    await api("/auth/login", { method: "POST", body: { email, password } });
    await loadMe();
  };
  const register = async (input: RegisterInput) => {
    await api("/auth/register", { method: "POST", body: input });
    await loadMe();
  };
  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setMe(null);
  };

  return <Ctx.Provider value={{ me, loading, login, register, logout, refresh: loadMe }}>{children}</Ctx.Provider>;
}
