"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useProperty } from "@/lib/property-context";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const RES_STATUS_META: Record<string, { color: string; en: string; fr: string }> = {
  confirmed:   { color: "#3b5bdb", en: "Confirmed",   fr: "Confirmée" },
  checked_in:  { color: "#059669", en: "Checked In",  fr: "Enregistrée" },
  checked_out: { color: "#6b7280", en: "Checked Out", fr: "Départ" },
  cancelled:   { color: "#dc2626", en: "Cancelled",   fr: "Annulée" },
  no_show:     { color: "#9ca3af", en: "No Show",     fr: "No Show" },
};

// Rate plan codes used across the PMS: OS = overnight/nuitée, SS = short-stay.
const RATE_PLAN_META: Record<string, { color: string; en: string; fr: string }> = {
  OS: { color: "#3b5bdb", en: "Overnight",   fr: "Nuitée" },
  SS: { color: "#7c3aed", en: "Short Stay",  fr: "Courte Durée" },
};

export default function SalesReportPage() {
  const { lang } = useI18n();
  const { current } = useProperty();
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const today = new Date().toISOString().slice(0, 10);

  const [reservations, setReservations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState<string>("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const load = async () => {
    setLoading(true);
    try {
      const [res, pay, rm, pk, ac] = await Promise.all([
        api.getReservations(""),
        api.getPayments().catch(() => []),
        api.getRooms().catch(() => []),
        api.getPackages().catch(() => []),
        api.getSalesAccounts().catch(() => []),
      ]);
      setReservations(res); setPayments(pay); setRooms(rm); setPackages(pk); setAccounts(ac);
      setGenerated(new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-US"));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const inPeriod = (d?: string) => { const x = String(d || "").slice(0, 10); return x >= from && x <= to; };

  // ── KPIs ────────────────────────────────────────────────────────────────
  // Bookings created within the period (sales velocity).
  const newBookings = reservations.filter(r => inPeriod(r.created_at));
  // Cash actually collected in the period.
  const collected = payments.filter(p => inPeriod(p.paid_at))
    .reduce((s, p) => s + Number(p.xaf_equivalent ?? p.amount), 0);
  // ADR — live snapshot of currently-occupied rooms' rack rate.
  const occupiedRooms = rooms.filter(r => r.status === "occupied");
  const adr = occupiedRooms.length
    ? Math.round(occupiedRooms.reduce((s, r) => s + Number(r.price_per_night), 0) / occupiedRooms.length)
    : 0;

  // Stays overlapping the period (a booking touches the window).
  const periodRes = reservations.filter(r =>
    String(r.check_in_date).slice(0, 10) <= to && String(r.check_out_date).slice(0, 10) >= from);

  const resStatusCounts = Object.fromEntries(
    Object.keys(RES_STATUS_META).map(k => [k, periodRes.filter(r => r.status === k).length])
  );

  const ratePlanCounts = Object.fromEntries(
    Object.keys(RATE_PLAN_META).map(k => [k, periodRes.filter(r => (r.rate_plan || "").toUpperCase() === k).length])
  );
  const ratePlanTotal = Object.values(ratePlanCounts).reduce((s, n) => s + (n as number), 0);

  // Collections grouped by payment method (in period).
  const periodPayments = payments.filter(p => inPeriod(p.paid_at));
  const byMethod = Object.entries(periodPayments.reduce((acc: Record<string, number>, p) => {
    const k = p.payment_method || "—";
    acc[k] = (acc[k] || 0) + Number(p.xaf_equivalent ?? p.amount);
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  // Current config (not period-bound).
  const activePackages = packages.filter(p => p.is_active);
  const topPackages = [...activePackages].sort((a, b) => Number(a.base_price) - Number(b.base_price)).slice(0, 5);
  const activeAccounts = accounts.filter(a => a.is_active);
  const accountsByType = Object.entries(activeAccounts.reduce((acc: Record<string, number>, a) => {
    const k = a.account_type || "—";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const kpis = [
    { label: L("Total Bookings", "Réservations Totales"), value: String(newBookings.length), icon: "📋", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", note: L("Created in period", "Créées sur la période") },
    { label: L("Revenue Collected", "Revenu Encaissé"),   value: fmt(collected),              icon: "💰", gradient: "linear-gradient(135deg,#059669,#10b981)", note: L("Payments in period", "Paiements sur la période") },
    { label: L("ADR", "PMJ"),                              value: fmt(adr),                     icon: "📊", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)", note: L("Occupied rooms (live)", "Chambres occupées (live)") },
  ];

  // Quick period presets
  const setPreset = (days: number | "month" | "all") => {
    if (days === "all") { setFrom("2000-01-01"); setTo(today); return; }
    if (days === "month") { setFrom(today.slice(0, 8) + "01"); setTo(today); return; }
    const d = new Date(Date.now() - (days - 1) * 86400000);
    setFrom(d.toISOString().slice(0, 10)); setTo(today);
  };
  const presets: [string, () => void][] = [
    [L("Today", "Aujourd'hui"), () => setPreset(1)],
    [L("7 days", "7 jours"), () => setPreset(7)],
    [L("This month", "Ce mois"), () => setPreset("month")],
    [L("All", "Tout"), () => setPreset("all")],
  ];

  return (
    <div>
      {/* Print-only letterhead */}
      <div className="print-only mb-4" style={{ borderBottom: "2px solid #1e293b", paddingBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{current?.name ?? "Motel Prestige"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>
          {L("Sales Report", "Rapport Commercial")}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {L("Period", "Période")} : {from} → {to}
          {generated && <> · {L("Generated", "Généré le")} {generated}</>}
        </div>
      </div>

      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <h2 className="page-title">{L("Sales Report", "Rapport Commercial")}</h2>
          <p className="page-subtitle">
            {L("Read-only analytics over the selected period", "Analyse en lecture seule sur la période sélectionnée")}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            🔄 {L("Refresh", "Actualiser")}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "var(--blue)" }}>
            🖨️ {L("Print", "Imprimer")}
          </button>
        </div>
      </div>

      {generated && (
        <p className="text-xs mb-4 no-print" style={{ color: "var(--muted)" }}>
          {L("Generated", "Généré le")} {generated}
        </p>
      )}

      {/* Period selector */}
      <div className="card p-3 mb-5 flex flex-wrap items-center gap-2 no-print">
        <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: "var(--muted)" }}>
          {L("Period", "Période")}
        </span>
        <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
          className="field-input" style={{ width: 150, marginTop: 0 }} />
        <span style={{ color: "var(--muted)" }}>→</span>
        <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
          className="field-input" style={{ width: 150, marginTop: 0 }} />
        <div className="flex gap-1.5 flex-wrap sm:ml-2">
          {presets.map(([label, fn]) => (
            <button key={label} onClick={fn}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--card)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card p-5 relative overflow-hidden"
            style={{ background: k.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{k.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{k.label}</div>
            <div className="text-2xl font-black text-white mb-0.5">{loading ? "—" : k.value}</div>
            <div className="text-white/60 text-xs">{k.note}</div>
          </div>
        ))}
      </div>

      {/* Bookings by status + rate plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5 print-2col">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {L("Bookings by Status", "Réservations par Statut")}
          </h3>
          <div className="space-y-3">
            {Object.entries(RES_STATUS_META).map(([k, m]) => {
              const cnt = resStatusCounts[k] || 0;
              const total = periodRes.length;
              const pct = total ? Math.round((cnt / total) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>
                    {lang === "fr" ? m.fr : m.en}
                  </span>
                  <span className="font-bold text-sm" style={{ color: m.color }}>{cnt}</span>
                  <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: m.color }} />
                  </div>
                  <span className="text-xs w-8 text-right" style={{ color: "var(--muted)" }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {L("Bookings by Rate Plan", "Par Plan Tarifaire")}
          </h3>
          <div className="space-y-3">
            {Object.entries(RATE_PLAN_META).map(([k, m]) => {
              const cnt = ratePlanCounts[k] || 0;
              const pct = ratePlanTotal ? Math.round((cnt / ratePlanTotal) * 100) : 0;
              return (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                  <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>
                    {lang === "fr" ? m.fr : m.en} <span style={{ color: "var(--muted)" }}>({k})</span>
                  </span>
                  <span className="font-bold text-sm" style={{ color: m.color }}>{cnt}</span>
                  <div className="w-28 h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: m.color }} />
                  </div>
                  <span className="text-xs w-8 text-right" style={{ color: "var(--muted)" }}>{pct}%</span>
                </div>
              );
            })}
            {ratePlanTotal === 0 && (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {L("No bookings in period", "Aucune réservation sur la période")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Collections by method + active config */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-2col">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {L("Collections by Method", "Encaissements par Méthode")}
          </h3>
          <div className="space-y-3">
            {byMethod.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {L("No payments in period", "Aucun paiement sur la période")}
              </p>
            ) : byMethod.map(([method, total]) => (
              <div key={method} className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--muted)" }}>💳 {method}</span>
                <span className="text-sm font-bold" style={{ color: "#059669" }}>{fmt(total)}</span>
              </div>
            ))}
            {byMethod.length > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-bold" style={{ color: "var(--text)" }}>Total</span>
                <span className="text-sm font-black" style={{ color: "#059669" }}>{fmt(collected)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {L("Active Packages & Accounts", "Forfaits & Comptes Actifs")}
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <span className="pill" style={{ background: "#3b5bdb18", color: "#3b5bdb" }}>
              {activePackages.length} {L("packages", "forfaits")}
            </span>
            <span className="pill" style={{ background: "#05966918", color: "#059669" }}>
              {activeAccounts.length} {L("accounts", "comptes")}
            </span>
          </div>
          <div className="space-y-2">
            {topPackages.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {L("No active packages", "Aucun forfait actif")}
              </p>
            ) : topPackages.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--text)" }}>
                  {lang === "fr" ? (p.name_fr || p.name_en) : (p.name_en || p.name_fr)}
                  {p.code && <span className="text-xs ml-1" style={{ color: "var(--muted)" }}>({p.code})</span>}
                </span>
                <span className="text-sm font-bold" style={{ color: "var(--blue)" }}>{fmt(Number(p.base_price))}</span>
              </div>
            ))}
          </div>
          {accountsByType.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                {L("Accounts by Type", "Comptes par Type")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {accountsByType.map(([type, cnt]) => (
                  <span key={type} className="pill" style={{ background: "var(--input-bg)", color: "var(--text)" }}>
                    {type}: <b>{cnt}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
