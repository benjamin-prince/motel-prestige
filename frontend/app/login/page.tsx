"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { setToken, setUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [appName, setAppName] = useState("Hotel PMS");

  useEffect(() => {
    api.getAppInfo().then(info => { if (info.name) setAppName(info.name); }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(form.email, form.password);
      setToken(data.access_token);
      setUser(data.user);
      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message || t.invalid_credentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1100px 700px at 50% -10%, var(--gold-soft) 0%, transparent 60%)," +
          "radial-gradient(900px 600px at 85% 110%, var(--blue-light) 0%, transparent 55%)," +
          "var(--bg)",
      }}>
      {/* Faint hairline frame — an understated luxe detail */}
      <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-6 rounded-2xl"
        style={{ border: "1px solid var(--border)", opacity: 0.6 }} />

      <div style={{ width: "100%", maxWidth: 404 }} className="relative">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl mb-4"
            style={{
              background: "linear-gradient(145deg, var(--gold), var(--blue))",
              boxShadow: "0 8px 24px -8px rgba(120,90,30,0.5), inset 0 1px 0 rgba(255,255,255,0.28)",
            }}>🏨</div>
          <div className="font-display" style={{ fontSize: 32, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em" }}>
            {appName}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span style={{ height: 1, width: 28, background: "var(--gold)", opacity: 0.6 }} />
            <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--gold)" }}>
              {t.sign_in_to}
            </p>
            <span style={{ height: 1, width: 28, background: "var(--gold)", opacity: 0.6 }} />
          </div>
        </div>

        <div className="card overflow-hidden" style={{ padding: 0, boxShadow: "var(--shadow-lg)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, transparent, var(--gold), transparent)" }} />
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm font-medium"
                style={{ background: "var(--bad-bg)", color: "var(--bad)", border: "1px solid var(--bad)" }}>
                {error}
              </div>
            )}

            <div>
              <label className="field-label">{t.email}</label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="field-input"
                style={{ fontSize: 15 }}
              />
            </div>

            <div>
              <label className="field-label">{t.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="field-input pr-10"
                  style={{ fontSize: 15 }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted)" }}>
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: loading ? "var(--muted)" : "var(--blue)", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? t.loading : t.sign_in}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
