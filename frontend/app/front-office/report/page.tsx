"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useProperty } from "@/lib/property-context";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const ROOM_STATUS_META: Record<string, { color: string; en: string; fr: string }> = {
  available:   { color: "#059669", en: "Available",   fr: "Disponible" },
  occupied:    { color: "#d97706", en: "Occupied",    fr: "Occupée" },
  cleaning:    { color: "#0891b2", en: "Cleaning",    fr: "Nettoyage" },
  maintenance: { color: "#dc2626", en: "Maintenance", fr: "Maintenance" },
};

const RES_STATUS_META: Record<string, { color: string; en: string; fr: string }> = {
  confirmed:    { color: "#3b5bdb", en: "Confirmed",   fr: "Confirmée" },
  checked_in:  { color: "#059669", en: "Checked In",  fr: "Enregistrée" },
  checked_out: { color: "#6b7280", en: "Checked Out", fr: "Départ" },
  cancelled:   { color: "#dc2626", en: "Cancelled",   fr: "Annulée" },
  no_show:     { color: "#9ca3af", en: "No Show",     fr: "No Show" },
};

export default function ReportPage() {
  const { t, lang } = useI18n();
  const { current } = useProperty();
  const today = new Date().toISOString().slice(0, 10);
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [folioBalances, setFolioBalances] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState<string>("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [charges, setCharges] = useState<any[]>([]);
  const [tab, setTab] = useState<"general" | "rooms" | "restaurant" | "bar">("general");

  const load = async () => {
    setLoading(true);
    try {
      const [r, res, inv, pay, ch, ov] = await Promise.all([
        api.getRooms(),
        api.getReservations(""),
        api.getInvoices(),
        api.getPayments().catch(() => []),
        api.getAllCharges().catch(() => []),
        api.getPendingCheckouts(),
      ]);
      setRooms(r); setReservations(res); setInvoices(inv); setPayments(pay); setCharges(ch); setOverdue(ov);
      // Folio balances of in-house guests — the same source of truth used by
      // the Unsettled page and the check-out debt guard.
      const inHouse = res.filter((x: any) => x.status === "checked_in");
      const sums = await Promise.allSettled(inHouse.map((x: any) => api.getFolioSummary(x.id)));
      setFolioBalances(sums.map(s => (s.status === "fulfilled" ? Number((s.value as any).total) : 0)));
      setGenerated(new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-US"));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Computed metrics — occupancy/room status are a live snapshot; money and
  // reservation counts respect the selected period.
  const totalRooms = rooms.length;
  const occupied = rooms.filter(r => r.status === "occupied").length;
  const occRate = totalRooms ? Math.round((occupied / totalRooms) * 100) : 0;

  const inPeriod = (d?: string) => { const x = String(d || "").slice(0, 10); return x >= from && x <= to; };

  const checkedInRes = reservations.filter(r => r.status === "checked_in");
  // Collected = payments actually recorded in the period (folio payments,
  // advances, settlements) — the number the desk reconciles the caisse with.
  const collected = payments.filter(p => inPeriod(p.paid_at))
    .reduce((s, p) => s + Number(p.xaf_equivalent ?? p.amount), 0);
  const totalRevenue = invoices.filter(i => inPeriod(i.issued_at || i.created_at))
    .reduce((s, i) => s + Number(i.total), 0);
  // Outstanding = unsettled in-house folio debt — what the check-out guard
  // will refuse to release until collected.
  const outstanding = folioBalances.filter(b => b > 0).reduce((s, b) => s + b, 0);
  const adr = occupied > 0
    ? Math.round(rooms.filter(r => r.status === "occupied").reduce((s, r) => s + Number(r.price_per_night), 0) / occupied)
    : 0;

  const roomStatusCounts = Object.fromEntries(
    Object.keys(ROOM_STATUS_META).map(k => [k, rooms.filter(r => r.status === k).length])
  );
  // Stays overlapping the period
  const periodRes = reservations.filter(r =>
    String(r.check_in_date) <= to && String(r.check_out_date) >= from);
  const resStatusCounts = Object.fromEntries(
    Object.keys(RES_STATUS_META).map(k => [k, periodRes.filter(r => r.status === k).length])
  );

  const unsettled = folioBalances.filter(b => b > 0);

  // ── Department split from folio charges (non-void, in period) ──────────────
  const periodCharges = charges.filter(c => inPeriod(c.date) && c.charge_type !== "payment");
  const isRestaurant = (p: string) => /restaurant/i.test(p);
  const isBar = (p: string) => /\bbar\b|mini ?bar|min bar/i.test(p);
  const restaurantCharges = periodCharges.filter(c => isRestaurant(c.particular));
  const barCharges = periodCharges.filter(c => isBar(c.particular));
  const roomCharges = periodCharges.filter(c => c.charge_type === "room");
  const otherCharges = periodCharges.filter(c =>
    c.charge_type !== "room" && !isRestaurant(c.particular) && !isBar(c.particular));
  const sum = (list: any[]) => list.reduce((s, c) => s + Number(c.amount), 0);

  // Per-room stats: nights sold = room-rent postings; extras = other charges on the room
  const roomStats = rooms.map(r => {
    const rc = roomCharges.filter(c => c.room_number === r.room_number);
    const extras = periodCharges.filter(c => c.room_number === r.room_number && c.charge_type !== "room");
    return { room: r, nights: rc.length, roomRevenue: sum(rc), extras: sum(extras) };
  }).sort((a, b) => String(a.room.room_number).localeCompare(String(b.room.room_number), undefined, { numeric: true }));

  // Payments grouped by method (in period)
  const periodPayments = payments.filter(p => inPeriod(p.paid_at));
  const byMethod = Object.entries(periodPayments.reduce((acc: Record<string, number>, p) => {
    const k = p.payment_method || "—";
    acc[k] = (acc[k] || 0) + Number(p.xaf_equivalent ?? p.amount);
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  const TABS: { key: typeof tab; icon: string; fr: string; en: string }[] = [
    { key: "general",    icon: "📊", fr: "Général",    en: "General" },
    { key: "rooms",      icon: "🛏️", fr: "Chambres",   en: "Rooms" },
    { key: "restaurant", icon: "🍽️", fr: "Restaurant", en: "Restaurant" },
    { key: "bar",        icon: "🍹", fr: "Bar",        en: "Bar" },
  ];
  const tabTitle = (k: typeof tab) => {
    const m = TABS.find(x => x.key === k)!;
    return lang === "fr" ? `Rapport ${m.fr}` : `${m.en} Report`;
  };

  const kpis = [
    { label: t.fo_occ_rate,  value: `${occRate}%`,  icon: "🏨", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)",  note: `${occupied}/${totalRooms}` },
    { label: t.fo_rev_total, value: fmt(collected), icon: "💰", gradient: "linear-gradient(135deg,#059669,#10b981)", note: lang === "fr" ? "Encaissé sur la période" : "Collected in period" },
    { label: t.fo_adr,       value: fmt(adr),         icon: "📊", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)", note: lang === "fr" ? "Chambres occupées" : "Occupied rooms" },
  ];

  // Quick period presets
  const setPreset = (days: number | "month" | "all") => {
    if (days === "all") { setFrom("2000-01-01"); setTo(today); return; }
    if (days === "month") { setFrom(today.slice(0, 8) + "01"); setTo(today); return; }
    const d = new Date(Date.now() - (days - 1) * 86400000);
    setFrom(d.toISOString().slice(0, 10)); setTo(today);
  };
  const presets: [string, () => void][] = [
    [lang === "fr" ? "Aujourd'hui" : "Today", () => setPreset(1)],
    [lang === "fr" ? "7 jours" : "7 days", () => setPreset(7)],
    [lang === "fr" ? "Ce mois" : "This month", () => setPreset("month")],
    [lang === "fr" ? "Tout" : "All", () => setPreset("all")],
  ];

  return (
    <div>
      {/* Print-only letterhead */}
      <div className="print-only mb-4" style={{ borderBottom: "2px solid #1e293b", paddingBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{current?.name ?? "Motel Prestige"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{tabTitle(tab)}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {lang === "fr" ? "Période" : "Period"} : {from} → {to}
          {generated && <> · {lang === "fr" ? "Généré le" : "Generated"} {generated}</>}
        </div>
      </div>

      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <h2 className="page-title">{t.fo_report_title}</h2>
          <p className="page-subtitle">{t.fo_report_desc}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            🔄 {lang === "fr" ? "Actualiser" : "Refresh"}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "var(--blue)" }}>
            🖨️ {lang === "fr" ? "Imprimer" : "Print"}
          </button>
        </div>
      </div>

      {generated && (
        <p className="text-xs mb-4 no-print" style={{ color: "var(--muted)" }}>
          {lang === "fr" ? "Généré le" : "Generated"} {generated}
        </p>
      )}

      {/* Report tabs */}
      <div className="flex gap-2 mb-4 flex-wrap no-print">
        {TABS.map(m => (
          <button key={m.key} onClick={() => setTab(m.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={tab === m.key
              ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" }
              : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
            {m.icon} {lang === "fr" ? m.fr : m.en}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="card p-3 mb-5 flex flex-wrap items-center gap-2 no-print">
        <span className="text-xs font-bold uppercase tracking-wider mr-1" style={{ color: "var(--muted)" }}>
          {lang === "fr" ? "Période" : "Period"}
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

      {tab === "general" && (<>
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card p-5 relative overflow-hidden"
            style={{ background: k.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{k.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{k.label}</div>
            <div className="text-2xl font-black text-white mb-0.5">
              {loading ? "—" : k.value}
            </div>
            <div className="text-white/60 text-xs">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5 print-2col">
        {/* Room status breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>{t.fo_room_status_bkdn}</h3>
          <div className="space-y-3">
            {Object.entries(ROOM_STATUS_META).map(([k, m]) => {
              const cnt = roomStatusCounts[k] || 0;
              const pct = totalRooms ? Math.round((cnt / totalRooms) * 100) : 0;
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

        {/* Reservation status breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>{t.fo_res_status_bkdn}</h3>
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
      </div>

      {/* Pending issues + Revenue summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print-2col">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>{t.fo_pending_issues}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: overdue.length > 0 ? "#fce4ec" : "#f0fdf4",
                border: `1px solid ${overdue.length > 0 ? "#fca5a5" : "#bbf7d0"}` }}>
              <div className="flex items-center gap-2">
                <span>{overdue.length > 0 ? "⚠️" : "✅"}</span>
                <span className="text-sm font-semibold" style={{ color: overdue.length > 0 ? "#dc2626" : "#059669" }}>
                  {t.fo_overdue_checkout}
                </span>
              </div>
              <span className="text-xl font-black" style={{ color: overdue.length > 0 ? "#dc2626" : "#059669" }}>
                {overdue.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: unsettled.length > 0 ? "#fff7ed" : "#f0fdf4",
                border: `1px solid ${unsettled.length > 0 ? "#fed7aa" : "#bbf7d0"}` }}>
              <div className="flex items-center gap-2">
                <span>{unsettled.length > 0 ? "💳" : "✅"}</span>
                <span className="text-sm font-semibold" style={{ color: unsettled.length > 0 ? "#d97706" : "#059669" }}>
                  {t.fo_unsettled_count}
                </span>
              </div>
              <span className="text-xl font-black" style={{ color: unsettled.length > 0 ? "#d97706" : "#059669" }}>
                {unsettled.length}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <div className="flex items-center gap-2">
                <span>🏨</span>
                <span className="text-sm font-semibold" style={{ color: "#0891b2" }}>
                  {lang === "fr" ? "En séjour" : "Guests In-House"}
                </span>
              </div>
              <span className="text-xl font-black" style={{ color: "#0891b2" }}>{checkedInRes.length}</span>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {lang === "fr" ? "Résumé du Revenu" : "Revenue Summary"}
          </h3>
          <div className="space-y-3">
            {[
              { label: t.fo_rev_collected,   value: collected,    color: "#059669",     bold: true },
              { label: lang === "fr" ? "Facturé (période)" : "Invoiced (period)", value: totalRevenue, color: "var(--text)", bold: false },
              { label: t.fo_rev_outstanding, value: outstanding,  color: "#dc2626",      bold: false },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--muted)" }}>{row.label}</span>
                <span className={`text-sm ${row.bold ? "font-black" : "font-bold"}`}
                  style={{ color: row.color }}>
                  {loading ? "—" : fmt(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department revenue + payment methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5 print-2col">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {lang === "fr" ? "Revenus par Département" : "Revenue by Department"}
          </h3>
          <div className="space-y-3">
            {[
              { label: lang === "fr" ? "🛏️ Hébergement" : "🛏️ Rooms", value: sum(roomCharges), color: "var(--blue)" },
              { label: "🍽️ Restaurant", value: sum(restaurantCharges), color: "#d97706" },
              { label: "🍹 Bar", value: sum(barCharges), color: "#7c3aed" },
              { label: lang === "fr" ? "➕ Autres extras" : "➕ Other extras", value: sum(otherCharges), color: "var(--muted)" },
              { label: lang === "fr" ? "Total facturé folio" : "Total folio billed", value: sum(periodCharges), color: "var(--text)", bold: true },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--muted)" }}>{row.label}</span>
                <span className={`text-sm ${row.bold ? "font-black" : "font-bold"}`} style={{ color: row.color }}>
                  {loading ? "—" : fmt(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>
            {lang === "fr" ? "Encaissements par Méthode" : "Collections by Method"}
          </h3>
          <div className="space-y-3">
            {byMethod.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Aucun paiement sur la période" : "No payments in period"}
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
      </div>
      </>)}

      {tab === "rooms" && (<>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: t.fo_occ_rate, value: `${occRate}%`, icon: "🏨", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", note: `${occupied}/${totalRooms}` },
          { label: lang === "fr" ? "Nuits Vendues" : "Nights Sold", value: String(roomCharges.length), icon: "🌙", gradient: "linear-gradient(135deg,#059669,#10b981)", note: lang === "fr" ? "Sur la période" : "In period" },
          { label: lang === "fr" ? "Revenu Chambres" : "Room Revenue", value: fmt(sum(roomCharges)), icon: "💰", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)", note: lang === "fr" ? "Hébergement seul" : "Lodging only" },
        ].map(k => (
          <div key={k.label} className="card p-5 relative overflow-hidden" style={{ background: k.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{k.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{k.label}</div>
            <div className="text-2xl font-black text-white mb-0.5">{loading ? "—" : k.value}</div>
            <div className="text-white/60 text-xs">{k.note}</div>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[lang === "fr" ? "Chambre" : "Room", "Type", lang === "fr" ? "Statut" : "Status",
                lang === "fr" ? "Prix/Nuit" : "Price/Night", lang === "fr" ? "Nuits" : "Nights",
                lang === "fr" ? "Revenu Chambre" : "Room Revenue", "Extras", "Total"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomStats.map(({ room: r, nights, roomRevenue, extras }, i) => {
              const st = ROOM_STATUS_META[r.status] ?? { color: "var(--muted)", en: r.status, fr: r.status };
              return (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? undefined : "var(--input-bg)" }}>
                  <td className="px-4 py-2.5 font-bold" style={{ color: "var(--text)" }}>{r.room_number}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{r.room_type}</td>
                  <td className="px-4 py-2.5">
                    <span className="pill" style={{ background: st.color + "18", color: st.color }}>
                      {lang === "fr" ? st.fr : st.en}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{fmt(Number(r.price_per_night))}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text)" }}>{nights}</td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--blue)" }}>{fmt(roomRevenue)}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "#d97706" }}>{extras > 0 ? fmt(extras) : "—"}</td>
                  <td className="px-4 py-2.5 font-black" style={{ color: "var(--text)" }}>{fmt(roomRevenue + extras)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
              <td colSpan={4} className="px-4 py-3 font-bold text-right text-sm" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Totaux" : "Totals"}
              </td>
              <td className="px-4 py-3 font-black text-sm" style={{ color: "var(--text)" }}>{roomCharges.length}</td>
              <td className="px-4 py-3 font-black text-sm" style={{ color: "var(--blue)" }}>{fmt(sum(roomCharges))}</td>
              <td className="px-4 py-3 font-black text-sm" style={{ color: "#d97706" }}>
                {fmt(roomStats.reduce((s, x) => s + x.extras, 0))}
              </td>
              <td className="px-4 py-3 font-black text-sm" style={{ color: "var(--text)" }}>
                {fmt(roomStats.reduce((s, x) => s + x.roomRevenue + x.extras, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      </>)}

      {(tab === "restaurant" || tab === "bar") && (() => {
        const list = tab === "restaurant" ? restaurantCharges : barCharges;
        const icon = tab === "restaurant" ? "🍽️" : "🍹";
        const avg = list.length ? sum(list) / list.length : 0;
        return (<>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[
              { label: lang === "fr" ? "Ventes Totales" : "Total Sales", value: fmt(sum(list)), icon: "💰", gradient: "linear-gradient(135deg,#059669,#10b981)", note: `${from} → ${to}` },
              { label: lang === "fr" ? "Nombre de Ventes" : "Sales Count", value: String(list.length), icon, gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", note: lang === "fr" ? "Postes facturés" : "Charges posted" },
              { label: lang === "fr" ? "Panier Moyen" : "Average Sale", value: fmt(avg), icon: "📊", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)", note: lang === "fr" ? "Par vente" : "Per sale" },
            ].map(k => (
              <div key={k.label} className="card p-5 relative overflow-hidden" style={{ background: k.gradient, border: "none" }}>
                <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{k.icon}</div>
                <div className="text-white/70 text-xs font-semibold mb-1">{k.label}</div>
                <div className="text-2xl font-black text-white mb-0.5">{loading ? "—" : k.value}</div>
                <div className="text-white/60 text-xs">{k.note}</div>
              </div>
            ))}
          </div>
          <div className="card overflow-hidden" style={{ padding: 0 }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
                <tr>
                  {["Date", lang === "fr" ? "Chambre" : "Room", "Réf", lang === "fr" ? "Libellé" : "Item",
                    "Description", lang === "fr" ? "Montant" : "Amount"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>
                    {icon} {lang === "fr" ? "Aucune vente sur la période" : "No sales in period"}
                  </td></tr>
                ) : list.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? undefined : "var(--input-bg)" }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{String(c.date).slice(0, 10)}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "var(--text)" }}>{c.room_number || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>{c.ref_number}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>{c.particular}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{c.description || "—"}</td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#059669" }}>{fmt(Number(c.amount))}</td>
                  </tr>
                ))}
              </tbody>
              {list.length > 0 && (
                <tfoot>
                  <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                    <td colSpan={5} className="px-4 py-3 font-bold text-right text-sm" style={{ color: "var(--muted)" }}>Total</td>
                    <td className="px-4 py-3 font-black text-sm" style={{ color: "#059669" }}>{fmt(sum(list))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>);
      })()}
    </div>
  );
}
