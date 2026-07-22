"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

export default function NightlyChargesPage() {
  const { t, lang } = useI18n();
  const [checkedIn, setCheckedIn] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [reservations, g, r] = await Promise.all([
        api.getReservations("status=checked_in"),
        api.getGuests(),
        api.getRooms(),
      ]);
      setCheckedIn(reservations);
      setGuests(g);
      setRooms(r);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const enrich = (r: any) => {
    const g = guests.find((g: any) => g.id === r.guest_id);
    const room = rooms.find((rm: any) => rm.id === r.room_id);
    return {
      ...r,
      guest_name: g ? `${g.first_name} ${g.last_name}` : `#${r.guest_id}`,
      guest_initials: g ? `${g.first_name[0]}${g.last_name[0]}` : "?",
      room_number: room?.room_number || `#${r.room_id}`,
      nightly_rate: Number(room?.price_per_night || 0),
    };
  };

  const enriched = checkedIn.map(enrich);
  const totalToPost = enriched.reduce((s, r) => s + r.nightly_rate, 0);

  const today = new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const handlePostAll = async () => {
    setPosting(true);
    setResult(null);
    try {
      const res = await api.postNightlyCharges();
      const count = res.posted_for?.length ?? 0;
      setResult({
        ok: true,
        message: lang === "fr"
          ? `Charges enregistrées pour ${count} réservation(s) le ${res.date}.`
          : `Posted room charges for ${count} reservation(s) on ${res.date}.`,
      });
      load();
    } catch (e: any) {
      setResult({ ok: false, message: e.message || "Error posting charges." });
    } finally { setPosting(false); }
  };

  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="page-title">{t.nightly_charges_title}</h2>
          <p className="page-subtitle">{today}</p>
        </div>
        <button onClick={handlePostAll} disabled={posting || checkedIn.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.3)" }}>
          {posting ? "⏳" : "🌙"} {posting
            ? (lang === "fr" ? "Enregistrement…" : "Posting…")
            : t.post_all_btn}
        </button>
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

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", border: "none" }}>
          <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">🌙</div>
          <div className="text-white/70 text-xs font-semibold mb-1">{t.rooms_to_charge}</div>
          <div className="text-3xl font-black text-white">{loading ? "—" : enriched.length}</div>
          <div className="text-white/60 text-xs mt-0.5">{lang === "fr" ? "chambres occupées ce soir" : "occupied rooms tonight"}</div>
        </div>

        <div className="card p-5 relative overflow-hidden sm:col-span-2"
          style={{ background: "linear-gradient(135deg,#059669,#10b981)", border: "none" }}>
          <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">💵</div>
          <div className="text-white/70 text-xs font-semibold mb-1">{t.total_to_post}</div>
          <div className="text-3xl font-black text-white">{loading ? "—" : fmt(totalToPost)}</div>
          <div className="text-white/60 text-xs mt-0.5">{t.charge_preview_desc}</div>
        </div>
      </div>

      {/* Charge preview table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
              {lang === "fr" ? "Aperçu des Charges de Nuit" : "Tonight's Charge Preview"}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {t.charge_date}: {new Date().toISOString().slice(0, 10)}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "var(--input-bg)", color: "var(--muted)" }}>
            {enriched.length} {lang === "fr" ? "entrées" : "entries"}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--muted)" }}>
            <div className="text-5xl mb-3">🌙</div>
            <p className="text-base font-semibold" style={{ color: "var(--text)" }}>{t.no_checkedin_guests}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.room_col, t.guest_col, t.res_number, t.check_in, t.check_out, t.nightly_rate, t.expected_charge].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map((item, i) => (
                <tr key={item.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.room_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: "#3b5bdb" }}>
                        {item.guest_initials}
                      </div>
                      <span className="font-medium" style={{ color: "var(--text)" }}>{item.guest_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>
                    {item.reservation_number}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{item.check_in_date}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{item.check_out_date}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>
                    {fmt(item.nightly_rate)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-black text-sm" style={{ color: "#059669" }}>
                      {fmt(item.nightly_rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {enriched.length > 0 && (
              <tfoot>
                <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                  <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right" style={{ color: "var(--text)" }}>
                    {t.total_to_post}
                  </td>
                  <td />
                  <td className="px-4 py-3 font-black text-sm" style={{ color: "#059669" }}>
                    {fmt(totalToPost)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
