"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Invoice } from "@/lib/types";

const STATUS_META: Record<string, { bg: string; color: string; label_en: string; label_fr: string }> = {
  draft:     { bg: "var(--input-bg)", color: "var(--muted)", label_en: "Draft",     label_fr: "Brouillon" },
  issued:    { bg: "var(--info-bg)",  color: "var(--info)",  label_en: "Issued",    label_fr: "Émise" },
  paid:      { bg: "var(--good-bg)",  color: "var(--good)",  label_en: "Paid",      label_fr: "Payée" },
  cancelled: { bg: "var(--bad-bg)",   color: "var(--bad)",   label_en: "Cancelled", label_fr: "Annulée" },
};

export default function BillingPage() {
  const { t, lang } = useI18n();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    Promise.all([
      api.getInvoices(),
      api.getGuests(),
      api.getReservations(""),
    ]).then(([inv, g, res]) => {
      setInvoices(inv); setGuests(g); setReservations(res);
    }).finally(() => setLoading(false));
  }, []);

  const guestName = (guestId: number | undefined) => {
    if (!guestId) return "—";
    const g = guests.find(g => g.id === guestId);
    return g ? `${g.first_name} ${g.last_name}` : `#${guestId}`;
  };

  const resNumber = (resId: number | undefined) => {
    if (!resId) return "—";
    const r = reservations.find(r => r.id === resId);
    return r ? r.reservation_number : `#${resId}`;
  };

  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

  const filtered = filterStatus ? invoices.filter(i => i.status === filterStatus) : invoices;

  const totalInvoiced = filtered.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = filtered.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const outstanding = filtered.filter(i => i.status !== "paid" && i.status !== "cancelled")
    .reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid)), 0);

  const counts: Record<string, number> = { "": invoices.length };
  for (const inv of invoices) counts[inv.status] = (counts[inv.status] || 0) + 1;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.invoices}</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{t.invoices_note}</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: lang === "fr" ? "Total Facturé" : "Total Invoiced", value: totalInvoiced, gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", icon: "📄" },
          { label: t.amount_paid,  value: totalPaid,     gradient: "linear-gradient(135deg,#059669,#10b981)", icon: "✅" },
          { label: t.outstanding,  value: outstanding,   gradient: "linear-gradient(135deg,#dc2626,#ef4444)", icon: "⚠️" },
        ].map(c => (
          <div key={c.label} className="card p-5 relative overflow-hidden"
            style={{ background: c.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{c.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{c.label}</div>
            <div className="text-2xl font-black text-white">{loading ? "—" : fmt(c.value)}</div>
          </div>
        ))}
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[{ val: "", label: t.all }, ...Object.entries(STATUS_META).map(([val, m]) => ({
          val,
          label: lang === "fr" ? m.label_fr : m.label_en,
        }))].map(({ val, label }) => {
          const meta = val ? STATUS_META[val] : null;
          const active = filterStatus === val;
          return (
            <button key={val} onClick={() => setFilterStatus(val)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
              style={active
                ? { background: meta?.color || "var(--blue)", color: "#fff", borderColor: "transparent" }
                : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
              {label}
              <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
                style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
                {counts[val] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.invoice_no, t.reservation_col, t.guest_col, lang === "fr" ? "Chambre" : "Room Charges",
                t.extra, t.discount, t.tax, t.amount_paid, t.total, t.status_col, t.issued_col].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="text-center py-14">
                  <div className="text-3xl mb-2">📄</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{t.no_invoices}</p>
                </td>
              </tr>
            ) : filtered.map((inv, i) => {
              const meta = STATUS_META[inv.status] || STATUS_META.draft;
              const balance = Number(inv.total) - Number(inv.amount_paid);
              return (
                <tr key={inv.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3 font-mono font-bold text-xs" style={{ color: "var(--blue)" }}>
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "var(--muted)" }}>
                    {resNumber(inv.reservation_id)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm" style={{ color: "var(--text)" }}>
                      {guestName(inv.guest_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>
                    {fmt(Number(inv.room_charges))}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {Number(inv.extra_charge) > 0 ? fmt(Number(inv.extra_charge)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#d97706" }}>
                    {Number(inv.discount) > 0 ? `-${fmt(Number(inv.discount))}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {Number(inv.tax) > 0 ? fmt(Number(inv.tax)) : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#059669" }}>
                    {fmt(Number(inv.amount_paid))}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-black text-sm" style={{ color: "var(--text)" }}>
                        {fmt(Number(inv.total))}
                      </p>
                      {balance > 0 && inv.status !== "cancelled" && (
                        <p className="text-xs font-semibold mt-0.5" style={{ color: "#dc2626" }}>
                          -{fmt(balance)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge font-semibold" style={{ background: meta.bg, color: meta.color }}>
                      {lang === "fr" ? meta.label_fr : meta.label_en}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 1 && (
            <tfoot>
              <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={3} className="px-4 py-3 text-sm font-bold text-right"
                  style={{ color: "var(--muted)" }}>
                  {lang === "fr" ? "Totaux" : "Totals"}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "var(--text)" }}>
                  {fmt(filtered.reduce((s, i) => s + Number(i.room_charges), 0))}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "var(--text)" }}>
                  {fmt(filtered.reduce((s, i) => s + Number(i.extra_charge), 0))}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "#d97706" }}>
                  {fmt(filtered.reduce((s, i) => s + Number(i.discount), 0))}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "var(--text)" }}>
                  {fmt(filtered.reduce((s, i) => s + Number(i.tax), 0))}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "#059669" }}>
                  {fmt(totalPaid)}
                </td>
                <td className="px-4 py-3 font-black text-sm" style={{ color: "var(--text)" }}>
                  {fmt(totalInvoiced)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
