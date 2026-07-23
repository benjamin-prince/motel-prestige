"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { useProperty } from "@/lib/property-context";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

// A folio charge as a journal entry: positive amounts are debits (revenue
// billed to the guest ledger); negative amounts (payments received, discounts)
// are credits, surfaced as positive numbers in the Credit column.
const debitOf = (c: any) => (Number(c.amount) > 0 ? Number(c.amount) : 0);
const creditOf = (c: any) => (Number(c.amount) < 0 ? -Number(c.amount) : 0);

export default function LedgerPage() {
  const { lang } = useI18n();
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const { current } = useProperty();
  const today = new Date().toISOString().slice(0, 10);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [charges, setCharges] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState("");

  // Charges drive the ledger and reload whenever the period changes.
  const load = async () => {
    setLoading(true);
    try {
      const ch = await api.getAllCharges(from, to).catch(() => []);
      setCharges(ch);
      setGenerated(new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-US"));
    } finally {
      setLoading(false);
    }
  };
  // Payments are fetched once and filtered client-side by paid_at.
  const loadPayments = () => api.getPayments().catch(() => []).then(setPayments);

  useEffect(() => { loadPayments(); }, []);
  useEffect(() => { load(); }, [from, to]);

  // Period presets — identical behaviour to the Front-Office report.
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

  // ── Journal: one row per charge, chronological ──────────────────────────────
  const journal = [...charges].sort((a, b) => {
    const d = String(a.date).slice(0, 10).localeCompare(String(b.date).slice(0, 10));
    return d !== 0 ? d : Number(a.id) - Number(b.id);
  });

  const totalDebit = journal.reduce((s, c) => s + debitOf(c), 0);
  const totalCredit = journal.reduce((s, c) => s + creditOf(c), 0);
  const netBalance = totalDebit - totalCredit;

  // Recorded payments in the period — a cross-reference for the credit side.
  const inPeriod = (d?: string) => { const x = String(d || "").slice(0, 10); return x >= from && x <= to; };
  const paymentsCount = payments.filter(p => inPeriod(p.paid_at)).length;

  // ── Account rollup: totals per particular, biggest movement first ───────────
  const accountsMap = new Map<string, { debit: number; credit: number }>();
  for (const c of journal) {
    const key = c.particular || "—";
    const row = accountsMap.get(key) ?? { debit: 0, credit: 0 };
    row.debit += debitOf(c);
    row.credit += creditOf(c);
    accountsMap.set(key, row);
  }
  const accounts = Array.from(accountsMap, ([particular, v]) => ({ particular, debit: v.debit, credit: v.credit, net: v.debit - v.credit }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const kpis = [
    { label: L("Total Debits", "Total Débits"), value: totalDebit, accent: "var(--blue)", note: L("Revenue billed", "Revenu facturé") },
    { label: L("Total Credits", "Total Crédits"), value: totalCredit, accent: "var(--good)", note: L(`${paymentsCount} payments recorded`, `${paymentsCount} paiements enregistrés`) },
    { label: L("Net Balance", "Solde Net"), value: netBalance, accent: netBalance > 0 ? "var(--bad)" : "var(--good)", note: L("Debits − Credits", "Débits − Crédits") },
  ];

  const cell = "px-4 py-2.5";
  const th = "text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider";

  return (
    <div>
      {/* Print-only letterhead */}
      <div className="print-only mb-4" style={{ borderBottom: "2px solid #1e293b", paddingBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{current?.name ?? "Motel Prestige"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{L("General Ledger", "Grand Livre")}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {L("Period", "Période")} : {from} → {to}
          {generated && <> · {L("Generated", "Généré le")} {generated}</>}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 no-print">
        <div>
          <h2 className="page-title">{L("General Ledger", "Grand Livre")}</h2>
          <p className="page-subtitle">
            {L("Chronological accounting journal over the selected period", "Journal comptable chronologique sur la période sélectionnée")}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { load(); loadPayments(); }}
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card p-5">
            <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>{k.label}</div>
            <div className="text-2xl font-black" style={{ color: k.accent }}>{loading ? "—" : fmt(k.value)}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{k.note}</div>
          </div>
        ))}
      </div>

      {/* Account rollup */}
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>{L("By Account", "Par Compte")}</h3>
      <div className="card overflow-hidden mb-8" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              <th className={th} style={{ color: "var(--muted)" }}>{L("Account", "Compte")}</th>
              <th className={th} style={{ color: "var(--muted)" }}>{L("Debit", "Débit")}</th>
              <th className={th} style={{ color: "var(--muted)" }}>{L("Credit", "Crédit")}</th>
              <th className={th} style={{ color: "var(--muted)" }}>{L("Net", "Net")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10" style={{ color: "var(--muted)" }}>…</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-10" style={{ color: "var(--muted)" }}>
                {L("No entries in this period", "Aucune écriture sur la période")}
              </td></tr>
            ) : accounts.map((a, i) => (
              <tr key={a.particular} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? undefined : "var(--input-bg)" }}>
                <td className={cell + " font-medium"} style={{ color: "var(--text)" }}>{a.particular}</td>
                <td className={cell + " font-semibold"} style={{ color: "var(--text)" }}>{a.debit > 0 ? fmt(a.debit) : "—"}</td>
                <td className={cell + " font-semibold"} style={{ color: "var(--good)" }}>{a.credit > 0 ? fmt(a.credit) : "—"}</td>
                <td className={cell + " font-bold"} style={{ color: a.net >= 0 ? "var(--blue)" : "var(--good)" }}>{fmt(a.net)}</td>
              </tr>
            ))}
          </tbody>
          {accounts.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                <td className={cell + " py-3 font-bold text-right"} style={{ color: "var(--muted)" }}>{L("Totals", "Totaux")}</td>
                <td className={cell + " py-3 font-black"} style={{ color: "var(--text)" }}>{fmt(totalDebit)}</td>
                <td className={cell + " py-3 font-black"} style={{ color: "var(--good)" }}>{fmt(totalCredit)}</td>
                <td className={cell + " py-3 font-black"} style={{ color: netBalance >= 0 ? "var(--blue)" : "var(--good)" }}>{fmt(netBalance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Journal */}
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>{L("Journal", "Journal")}</h3>
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {["Date", L("Ref", "Réf"), L("Room", "Chambre"), L("Account", "Compte"),
                "Description", L("Debit", "Débit"), L("Credit", "Crédit")].map(h => (
                <th key={h} className={th} style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--muted)" }}>…</td></tr>
            ) : journal.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-14">
                  <div className="text-3xl mb-2">📒</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {L("No entries in this period", "Aucune écriture sur la période")}
                  </p>
                </td>
              </tr>
            ) : journal.map((c, i) => {
              const debit = debitOf(c);
              const credit = creditOf(c);
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? undefined : "var(--input-bg)" }}>
                  <td className={cell + " text-xs"} style={{ color: "var(--muted)" }}>{String(c.date).slice(0, 10)}</td>
                  <td className={cell + " font-mono text-xs"} style={{ color: "var(--muted)" }}>{c.ref_number || "—"}</td>
                  <td className={cell + " font-bold"} style={{ color: "var(--text)" }}>{c.room_number || "—"}</td>
                  <td className={cell + " font-medium"} style={{ color: "var(--text)" }}>{c.particular}</td>
                  <td className={cell + " text-xs"} style={{ color: "var(--muted)" }}>{c.description || "—"}</td>
                  <td className={cell + " font-semibold"} style={{ color: "var(--text)" }}>{debit > 0 ? fmt(debit) : "—"}</td>
                  <td className={cell + " font-semibold"} style={{ color: "var(--good)" }}>{credit > 0 ? fmt(credit) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          {journal.length > 0 && (
            <tfoot>
              <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                <td colSpan={5} className={cell + " py-3 font-bold text-right"} style={{ color: "var(--muted)" }}>{L("Totals", "Totaux")}</td>
                <td className={cell + " py-3 font-black"} style={{ color: "var(--text)" }}>{fmt(totalDebit)}</td>
                <td className={cell + " py-3 font-black"} style={{ color: "var(--good)" }}>{fmt(totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
