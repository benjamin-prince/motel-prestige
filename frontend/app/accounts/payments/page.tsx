"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { SearchInput, SegmentedControl, EmptyState, SkeletonCards } from "@/components/ui";

const METHOD_COLORS: Record<string, { bg: string; color: string }> = {
  cash:            { bg: "#e8f5e9", color: "#2e7d32" },
  "credit card":   { bg: "#e3f2fd", color: "#1565c0" },
  "bank transfer": { bg: "#ede7f6", color: "#6a1b9a" },
  cheque:          { bg: "#fff3e0", color: "#e65100" },
};

export default function PaymentsPage() {
  const { t, lang } = useI18n();
  const [payments, setPayments] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMethod, setFilterMethod] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [p, r, g] = await Promise.all([
          api.getPayments(),
          api.getReservations("").catch(() => []),   // labels only — optional per role
          api.getGuests().catch(() => []),
        ]);
        setPayments(p); setReservations(r); setGuests(g);
      } catch { /* backend offline */ } finally { setLoading(false); }
    })();
  }, []);

  const resNumber = (id?: number) => reservations.find((r: any) => r.id === id)?.reservation_number || (id ? `#${id}` : "—");
  const guestName = (resId?: number) => {
    const res = reservations.find((r: any) => r.id === resId);
    const g = res && guests.find((g: any) => g.id === res.guest_id);
    return g ? `${g.first_name} ${g.last_name}` : "—";
  };

  const fmtXaf = (n: number) => `${Number(n).toLocaleString("fr-FR")} FCFA`;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const totals = useMemo(() => ({
    today: payments.filter(p => (p.paid_at || "").startsWith(today)).reduce((s, p) => s + Number(p.xaf_equivalent), 0),
    month: payments.filter(p => (p.paid_at || "").startsWith(month)).reduce((s, p) => s + Number(p.xaf_equivalent), 0),
    all:   payments.reduce((s, p) => s + Number(p.xaf_equivalent), 0),
    count: payments.length,
  }), [payments, today, month]);

  const methods = [...new Set(payments.map(p => p.payment_method))];

  const filtered = payments.filter(p => {
    if (filterMethod && p.payment_method !== filterMethod) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      resNumber(p.reservation_id).toLowerCase().includes(q) ||
      guestName(p.reservation_id).toLowerCase().includes(q) ||
      (p.reference || "").toLowerCase().includes(q) ||
      (p.payment_method || "").toLowerCase().includes(q)
    );
  });

  const kpis = [
    { label: t.pay_collected_today, value: fmtXaf(totals.today), gradient: "linear-gradient(135deg,#059669,#10b981)", icon: "💵" },
    { label: t.pay_collected_month, value: fmtXaf(totals.month), gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", icon: "📅" },
    { label: t.pay_collected_total, value: fmtXaf(totals.all),   gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)", icon: "🏦" },
    { label: t.pay_count,           value: totals.count,         gradient: "linear-gradient(135deg,#d97706,#f59e0b)", icon: "🧾" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h2 className="page-title">{t.nav_payments}</h2>
        <p className="page-subtitle">{t.pay_subtitle}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden" style={{ background: k.gradient, border: "none" }}>
            <div className="absolute -right-2 -bottom-2 text-4xl opacity-20">{k.icon}</div>
            <div className="text-xl font-black text-white">{loading ? "—" : k.value}</div>
            <div className="text-white/70 text-xs mt-0.5 font-semibold">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={t.pay_search} />
        {methods.length > 1 && (
          <SegmentedControl value={filterMethod} onChange={setFilterMethod}
            options={[
              { value: "", label: t.all, badge: String(payments.length) },
              ...methods.map(m => ({ value: m, label: m, badge: String(payments.filter(p => p.payment_method === m).length) })),
            ]} />
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonCards count={1} height={240} className="grid grid-cols-1" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="💳" message={t.pay_none} />
      ) : (
        <div className="card overflow-hidden" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.date, t.res_number, t.guest_col, t.payment_method, t.ref_no, t.amount, "XAF"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const mc = METHOD_COLORS[(p.payment_method || "").toLowerCase()] || { bg: "#f5f5f5", color: "#555" };
                return (
                  <tr key={p.id}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(p.paid_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US",
                        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>
                      {resNumber(p.reservation_id)}
                    </td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text)" }}>
                      {guestName(p.reservation_id)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="badge" style={{ background: mc.bg, color: mc.color }}>{p.payment_method}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{p.reference || "—"}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text)" }}>
                      {Number(p.amount).toLocaleString("fr-FR")} {p.currency_code}
                    </td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#059669" }}>
                      {fmtXaf(Number(p.xaf_equivalent))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
