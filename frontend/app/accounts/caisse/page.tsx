"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { CaisseSummary, Payment, Currency } from "@/lib/types";
import { formatAmount } from "@/lib/currency";

export default function CaissePage() {
  const { lang } = useI18n();
  const [summary, setSummary] = useState<CaisseSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCur, setFilterCur] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [s, p, c] = await Promise.all([api.getCaisse(), api.getPayments(), api.getCurrencies()]);
      setSummary(s); setPayments(p); setCurrencies(c);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const getCur = (code: string) => currencies.find(c => c.code === code);
  const xafCur: Currency = getCur("XAF") || { id: 0, code: "XAF", name: "Franc CFA BEAC", symbol: "FCFA", xaf_rate: 1, is_default: true, is_active: true };

  const filtered = payments.filter(p => !filterCur || p.currency_code === filterCur);

  return (
    <div>
      <div className="mb-5">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
          {lang === "fr" ? "Caisse — Suivi des Encaissements" : "Cash Register — Payment Tracking"}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
          {lang === "fr" ? "Total en caisse par devise, converti en XAF." : "Total in register per currency, converted to XAF."}
        </p>
      </div>

      {/* Per-currency totals */}
      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {summary.entries.map(entry => {
              const cur = getCur(entry.currency_code);
              const isXaf = entry.currency_code === "XAF";
              return (
                <div key={entry.currency_code} className="card p-4 relative overflow-hidden"
                  style={{ background: isXaf ? "linear-gradient(135deg,#3b5bdb,#4c6ef5)" : "white", border: isXaf ? "none" : "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className={`text-lg font-black ${isXaf ? "text-white" : ""}`} style={!isXaf ? { color: "var(--text)" } : {}}>
                        {entry.currency_code}
                      </span>
                      {isXaf && <span className="ml-2 text-xs text-white/70">{lang === "fr" ? "Défaut" : "Default"}</span>}
                    </div>
                    <span className={`text-xs font-medium ${isXaf ? "text-white/70" : ""}`} style={!isXaf ? { color: "var(--muted)" } : {}}>
                      {entry.payment_count} {lang === "fr" ? "paiement(s)" : "payment(s)"}
                    </span>
                  </div>
                  <div className={`text-xl font-black mb-1 ${isXaf ? "text-white" : ""}`} style={!isXaf ? { color: "var(--blue)" } : {}}>
                    {cur ? formatAmount(Number(entry.total_amount), cur) : `${Number(entry.total_amount).toLocaleString("fr-FR")} ${entry.symbol}`}
                  </div>
                  {!isXaf && (
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      ≈ {formatAmount(Number(entry.total_xaf), xafCur)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grand total */}
          <div className="card p-5 mb-6 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg,#059669,#10b981)", border: "none" }}>
            <div>
              <div className="text-white/80 text-sm font-semibold">
                {lang === "fr" ? "Total Général (équivalent XAF)" : "Grand Total (XAF equivalent)"}
              </div>
              <div className="text-white text-xs mt-0.5">
                {summary.entries.length} {lang === "fr" ? "devise(s) en caisse" : "currency(ies) in register"}
              </div>
            </div>
            <div className="text-3xl font-black text-white">
              {formatAmount(Number(summary.grand_total_xaf), xafCur)}
            </div>
          </div>
        </>
      )}

      {/* Payment history */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold text-sm" style={{ color: "var(--text)" }}>
          {lang === "fr" ? "Historique des Paiements" : "Payment History"}
        </div>
        <div className="flex gap-2">
          <select value={filterCur} onChange={e => setFilterCur(e.target.value)} className="field-input" style={{ width: 160 }}>
            <option value="">{lang === "fr" ? "Toutes les devises" : "All currencies"}</option>
            {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.symbol}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[
                lang === "fr" ? "Date" : "Date",
                lang === "fr" ? "Réservation" : "Reservation",
                lang === "fr" ? "Montant payé" : "Amount Paid",
                lang === "fr" ? "Devise" : "Currency",
                lang === "fr" ? "Équivalent XAF" : "XAF Equivalent",
                lang === "fr" ? "Taux utilisé" : "Rate Used",
                lang === "fr" ? "Méthode" : "Method",
                lang === "fr" ? "Référence" : "Reference",
              ].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Chargement…" : "Loading…"}
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12">
                <div className="text-3xl mb-2">💰</div>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {lang === "fr" ? "Aucun paiement enregistré." : "No payments recorded yet."}
                </p>
              </td></tr>
            ) : filtered.map((p, i) => {
              const cur = getCur(p.currency_code);
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {new Date(p.paid_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>
                    #{p.reservation_id}
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: "var(--text)" }}>
                    {cur ? formatAmount(Number(p.amount), cur) : `${Number(p.amount).toLocaleString("fr-FR")} ${p.currency_code}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge font-mono font-bold" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>{p.currency_code}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#059669" }}>
                    {formatAmount(Number(p.xaf_equivalent), xafCur)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--muted)" }}>
                    1 {p.currency_code} = {Number(p.xaf_rate_snapshot).toLocaleString("fr-FR")} XAF
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{p.payment_method}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{p.reference || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
