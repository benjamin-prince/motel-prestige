"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import Link from "next/link";

export default function UnsettledPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [reservations, guests, rooms] = await Promise.all([
        api.getReservations("status=checked_in"),
        api.getGuests(),
        api.getRooms(),
      ]);

      const summaries = await Promise.allSettled(
        reservations.map(r => api.getFolioSummary(r.id))
      );

      const enriched = reservations.map((r, i) => {
        const g = guests.find((g: any) => g.id === r.guest_id);
        const room = rooms.find((rm: any) => rm.id === r.room_id);
        const sumResult = summaries[i];
        const balance = sumResult.status === "fulfilled" ? Number(sumResult.value.total) : 0;
        const daysIn = Math.floor((Date.now() - new Date(r.check_in_date).getTime()) / 86400000);
        return {
          ...r,
          guest_name: g ? `${g.first_name} ${g.last_name}` : `#${r.guest_id}`,
          guest_initials: g ? `${g.first_name[0]}${g.last_name[0]}` : "?",
          room_number: room?.room_number || `#${r.room_id}`,
          balance,
          days_in_house: Math.max(0, daysIn),
        };
      }).filter(r => r.balance > 0).sort((a, b) => b.balance - a.balance);

      setItems(enriched);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalBalance = items.reduce((s, i) => s + i.balance, 0);

  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="page-title">{t.unsettled_accounts}</h2>
          <p className="page-subtitle">{t.unsettled_desc}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", border: "none" }}>
          <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">⚠️</div>
          <div className="text-white/70 text-xs font-semibold mb-1">{t.unsettled_accounts}</div>
          <div className="text-3xl font-black text-white">{loading ? "—" : items.length}</div>
          <div className="text-white/60 text-xs mt-0.5">{lang === "fr" ? "clients avec solde impayé" : "guests with outstanding balance"}</div>
        </div>

        <div className="card p-5 relative overflow-hidden sm:col-span-2"
          style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)", border: "none" }}>
          <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">💰</div>
          <div className="text-white/70 text-xs font-semibold mb-1">{t.total_outstanding}</div>
          <div className="text-3xl font-black text-white">
            {loading ? "—" : fmt(totalBalance)}
          </div>
          <div className="text-white/60 text-xs mt-0.5">
            {lang === "fr" ? "total des balances impayées" : "total outstanding across all folios"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {loading ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--muted)" }}>
            <div className="text-5xl mb-3">✅</div>
            <p className="text-base font-semibold" style={{ color: "var(--text)" }}>{t.all_settled}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.guest_col, t.room_col, t.res_number, t.check_in, t.days_in_house, t.outstanding_balance, t.actions].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: "#d97706" }}>
                        {item.guest_initials}
                      </div>
                      <span className="font-medium" style={{ color: "var(--text)" }}>{item.guest_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.room_number}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>
                    {item.reservation_number}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {item.check_in_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: item.days_in_house > 5 ? "#fef3c7" : "var(--input-bg)", color: item.days_in_house > 5 ? "#d97706" : "var(--muted)" }}>
                      {item.days_in_house}d
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-black text-sm" style={{ color: "#dc2626" }}>
                      {fmt(item.balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/reservations?folio=${item.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-colors"
                      style={{ background: "var(--blue)" }}>
                      {t.open_folio_btn}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                  <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right" style={{ color: "var(--text)" }}>
                    {t.total_outstanding}
                  </td>
                  <td className="px-4 py-3 font-black text-sm" style={{ color: "#dc2626" }}>
                    {fmt(totalBalance)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
