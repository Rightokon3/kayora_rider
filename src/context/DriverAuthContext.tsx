import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { hasValidSession, clearSession } from "../services/api";

/* ============================================================
   DRIVER AUTH CONTEXT
   ------------------------------------------------------------
   Why this exists: the route guard in app/driver/_layout.tsx
   used to check storage exactly once on mount and cache the
   result in local state. But navigating between sibling screens
   in the same layout (e.g. login -> dashboard) does NOT remount
   the layout, so that cached status went stale the instant a
   login succeeded — the guard kept thinking "guest" even after
   a valid token was saved, which caused an infinite
   login <-> dashboard redirect loop (the "page not responsive"
   freeze).

   Fix: status now lives here, in a context that persists across
   the whole driver route tree, and login.tsx calls signIn()
   directly the moment a login succeeds — no re-reading storage,
   no stale cache, no loop. account.tsx's sign-out calls signOut()
   for the same reason in reverse.
============================================================ */

type AuthStatus = "checking" | "authed" | "guest";

interface DriverAuthContextValue {
  status: AuthStatus;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const DriverAuthContext = createContext<DriverAuthContextValue | undefined>(undefined);

export function DriverAuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");

  useEffect(() => {
    (async () => {
      const valid = await hasValidSession();
      if (!valid) await clearSession();
      setStatus(valid ? "authed" : "guest");
    })();
  }, []);

  const signIn = useCallback(() => {
    // Called synchronously right after saveSession() succeeds at login.
    // No storage re-read needed — we already know it's valid because we
    // just wrote it.
    setStatus("authed");
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setStatus("guest");
  }, []);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);

  return <DriverAuthContext.Provider value={value}>{children}</DriverAuthContext.Provider>;
}

export function useDriverAuth(): DriverAuthContextValue {
  const ctx = useContext(DriverAuthContext);
  if (!ctx) throw new Error("useDriverAuth must be used within a DriverAuthProvider");
  return ctx;
}