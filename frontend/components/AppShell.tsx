"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "./ui/Toast";
import { removeToken, getUser } from "@/lib/auth";
import { PropertyProvider } from "@/lib/property-context";
import { PermissionsProvider, usePermissions } from "@/lib/permissions";
import { routePermission } from "@/lib/nav";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function ForcePasswordModal({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) { setErr("Minimum 6 characters"); return; }
    if (pw !== pw2) { setErr("Passwords do not match"); return; }
    setSaving(true);
    try {
      await api.changeOwnPassword(pw);
      onDone();
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-6"
      style={{ background: "rgba(10,20,40,0.7)" }}>
      <div className="card w-full max-w-sm" style={{ padding: "32px 28px" }}>
        <h2 className="font-bold text-lg mb-1" style={{ color: "var(--text)" }}>
          {t.change_password}
        </h2>
        <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>{t.must_change_password}</p>
        {err && (
          <div className="rounded-lg px-4 py-3 text-sm mb-4" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">{t.new_password_required}</label>
            <input type="password" required autoFocus value={pw}
              onChange={e => { setPw(e.target.value); setErr(""); }}
              className="field-input" />
          </div>
          <div>
            <label className="field-label">{t.new_password_required} (confirm)</label>
            <input type="password" required value={pw2}
              onChange={e => { setPw2(e.target.value); setErr(""); }}
              className="field-input" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ background: "var(--accent)" }}>
            {saving ? t.loading : t.save}
          </button>
        </form>
      </div>
    </div>
  );
}

function AccessDenied() {
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h2 className="font-bold text-lg mb-2" style={{ color: "var(--text)" }}>
        {t.access_denied_title}
      </h2>
      <p className="text-sm max-w-md" style={{ color: "var(--muted)" }}>
        {t.access_denied_msg}
      </p>
    </div>
  );
}

// Blocks page content the user's role does not permit (deep links, typed
// URLs). The sidebar/palette already hide these entries.
function PageGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, can } = usePermissions();
  const required = routePermission(pathname);
  if (required && !ready) return null; // don't flash restricted content while /me loads
  if (!can(required)) return <AccessDenied />;
  return <>{children}</>;
}

// Thin banner shown when this deployment is the online admin console (VPS
// read-only replica): admin & reports here, business operations at the motel.
function ReadOnlyBanner() {
  const { lang } = useI18n();
  const [readOnly, setReadOnly] = useState(false);
  useEffect(() => {
    api.getHealth().then(h => setReadOnly(!!h.read_only)).catch(() => {});
  }, []);
  if (!readOnly) return null;
  return (
    <div className="px-6 py-1.5 text-center text-xs font-bold"
      style={{ background: "#fef3c7", color: "#92400e", borderBottom: "1px solid #fde68a" }}>
      🛡️ {lang === "fr"
        ? "Console d'administration en ligne — lecture seule. Les opérations (réservations, encaissements…) se font à la réception."
        : "Online admin console — read-only. Operations (reservations, payments…) are done at the reception desk."}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = usePermissions();
  const [mustChange, setMustChange] = useState(false);
  // localStorage fallback for the header while /me loads — read in an effect
  // so the first client render matches the server (hydration).
  const [storedUser, setStoredUser] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setStoredUser(getUser());
  }, []);

  useEffect(() => {
    if (me?.must_change_password) setMustChange(true);
  }, [me]);

  const handleSignOut = () => {
    removeToken();
    router.push("/login");
  };

  const [menuOpen, setMenuOpen] = useState(false);
  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  // Restore the saved theme once, on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ms-theme");
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch { /* blocked */ }
  }, []);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
        <div className={`ms-backdrop ${menuOpen ? "show" : ""}`} onClick={() => setMenuOpen(false)} />
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ReadOnlyBanner />
          <Header user={me ?? storedUser} onSignOut={handleSignOut} onMenu={() => setMenuOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div key={pathname} className="page-enter">
              <PageGuard>{children}</PageGuard>
            </div>
          </main>
        </div>
      </div>
      <CommandPalette />
      {mustChange && <ForcePasswordModal onDone={() => setMustChange(false)} />}
    </ToastProvider>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") return <>{children}</>;

  return (
    <PermissionsProvider>
      <PropertyProvider>
        <Shell>{children}</Shell>
      </PropertyProvider>
    </PermissionsProvider>
  );
}
