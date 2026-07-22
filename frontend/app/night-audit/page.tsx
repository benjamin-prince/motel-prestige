"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

export default function NightAuditPage() {
  const { t, lang } = useI18n();
  const [pending, setPending] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, g, r] = await Promise.all([
        api.getPendingCheckouts(),
        api.getGuests(),
        api.getRooms(),
      ]);
      setPending(p); setGuests(g); setRooms(r);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const guestName = (id: number) => {
    const g = guests.find((g: any) => g.id === id);
    return g ? `${g.first_name} ${g.last_name}` : `#${id}`;
  };
  const guestInitials = (id: number) => {
    const g = guests.find((g: any) => g.id === id);
    return g ? `${g.first_name[0]}${g.last_name[0]}` : "?";
  };
  const roomNumber = (id: number) => rooms.find((r: any) => r.id === id)?.room_number || `#${id}`;

  const daysOverdue = (checkoutDate: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(checkoutDate).getTime()) / 86400000));

  const handlePostCharges = async () => {
    setPosting(true);
    setResult(null);
    try {
      const res = await api.postNightlyCharges();
      setResult({
        ok: true,
        message: lang === "fr"
          ? `Charges enregistrées pour ${res.posted_for.length} réservation(s) le ${res.date}.`
          : `Posted room charges for ${res.posted_for.length} reservation(s) on ${res.date}.`,
      });
      load();
    } catch (e: any) {
      setResult({ ok: false, message: e.message || "Error" });
    } finally { setPosting(false); }
  };

  const today = new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="page-title">{t.night_audit}</h2>
          <p className="page-subtitle">{today}</p>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className="rounded-xl px-5 py-4 mb-5 flex items-center justify-between text-sm"
          style={result.ok
            ? { background: "#e8f5e9", border: "1px solid #a5d6a7", color: "#2e7d32" }
            : { background: "#fce4ec", border: "1px solid #f48fb1", color: "#c62828" }}>
          <span>{result.ok ? "✓" : "✕"} {result.message}</span>
          <button onClick={() => setResult(null)} style={{ opacity: 0.6 }}>✕</button>
        </div>
      )}

      {/* KPI + Actions row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Pending checkouts KPI */}
        <div className="card p-5 relative overflow-hidden"
          style={{ background: pending.length > 0 ? "linear-gradient(135deg,#dc2626,#ef4444)" : "linear-gradient(135deg,#059669,#10b981)", border: "none" }}>
          <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">⚠️</div>
          <div className="text-white/70 text-xs font-semibold mb-1">{t.pending_checkouts}</div>
          <div className="text-4xl font-black text-white">{loading ? "—" : pending.length}</div>
          <div className="text-white/60 text-xs mt-1">
            {pending.length === 0
              ? (lang === "fr" ? "Tout est en ordre" : "All clear")
              : (lang === "fr" ? "départs en retard" : "overdue checkouts")}
          </div>
        </div>

        {/* Post nightly charges */}
        <div className="card p-5 col-span-2 flex flex-col justify-between">
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>{t.audit_actions}</p>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>{t.audit_description}</p>
          </div>
          <button onClick={handlePostCharges} disabled={posting}
            className="flex items-center gap-2 self-start px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.3)" }}>
            {posting ? "⏳ " : "🌙 "}
            {posting
              ? (lang === "fr" ? "Enregistrement…" : "Posting…")
              : t.post_nightly_charges}
          </button>
        </div>
      </div>

      {/* Pending checkout table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{t.pending_checkouts}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {lang === "fr"
                ? "Réservations dont la date de départ est passée et toujours enregistrées."
                : "Reservations whose check-out date has passed and are still checked in."}
            </p>
          </div>
          {pending.length > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "#fce4ec", color: "#dc2626" }}>
              {pending.length} overdue
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.res_number, t.guest_col, t.room_col, t.check_out, lang === "fr" ? "Jours dépassés" : "Days Overdue", t.actions].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-14">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{t.no_pending_checkouts}</p>
                </td>
              </tr>
            ) : pending.map((r, i) => {
              const overdue = daysOverdue(r.check_out_date);
              return (
                <tr key={r.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: "var(--blue)" }}>
                    {r.reservation_number}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: "#dc2626" }}>
                        {guestInitials(r.guest_id)}
                      </div>
                      <span className="font-medium" style={{ color: "var(--text)" }}>
                        {guestName(r.guest_id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm px-2 py-0.5 rounded"
                      style={{ background: "var(--input-bg)", color: "var(--text)" }}>
                      {roomNumber(r.room_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-sm" style={{ color: "#dc2626" }}>
                    {r.check_out_date}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: overdue > 1 ? "#fee2e2" : "#fef3c7", color: overdue > 1 ? "#dc2626" : "#d97706" }}>
                      {overdue}d
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={async () => {
                      setResult(null);
                      try { await api.checkOut(r.id); await load(); }
                      catch (e: any) {
                        const msg = e.message || "";
                        setResult({
                          ok: false,
                          message: msg.includes("unsettled balance")
                            ? t.checkout_unsettled_debt.replace("{balance}", msg.match(/([\d,]+) FCFA/)?.[1] ?? "")
                            : msg,
                        });
                      }
                    }}
                      className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold"
                      style={{ background: "#d97706" }}>
                      {t.force_check_out}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
