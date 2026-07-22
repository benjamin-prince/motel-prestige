"use client";
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api } from "./api";
import { isAuthenticated } from "./auth";

export interface Me {
  id?: number;
  email?: string;
  full_name?: string;
  role?: string;
  must_change_password?: boolean;
  permissions?: string[];
  [key: string]: unknown;
}

interface PermissionsContext {
  me: Me | null;
  /** True once /auth/me has resolved (success or failure). */
  ready: boolean;
  /** Does the current user hold (any of) the given permission key(s)? */
  can: (perm?: string | string[]) => boolean;
  reload: () => void;
}

const Ctx = createContext<PermissionsContext>({
  me: null,
  ready: false,
  can: () => false,
  reload: () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const load = () => {
    if (!isAuthenticated()) { setReady(true); return; }
    api.getMe()
      .then(setMe)
      .catch(() => setMe(null)) // backend offline — fail open, API enforcement is the real boundary
      .finally(() => setReady(true));
  };

  useEffect(load, []);

  const value = useMemo<PermissionsContext>(() => {
    const perms = new Set(me?.permissions ?? []);
    const can = (perm?: string | string[]) => {
      if (!perm) return true;                 // unmapped page — visible to all signed-in users
      if (!ready) return false;
      if (!me) return true;                   // /me failed — don't brick the UI
      if (me.role === "superadmin" || perms.has("*")) return true;
      const keys = Array.isArray(perm) ? perm : [perm];
      return keys.some(k => perms.has(k));
    };
    return { me, ready, can, reload: load };
  }, [me, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePermissions() {
  return useContext(Ctx);
}
