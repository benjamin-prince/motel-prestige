"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import Link from "next/link";

interface Stats { total: number; available: number; occupied: number; cleaning: number; maintenance: number }
interface ActivityEntry { id: number; icon: string; color: string; message_en: string; message_fr: string; created_at?: string }
interface ArrivalRow { id: number; reservation_number: string; guest_id: number; room_id: number; check_in_date: string; adults: number; nights: number; guest_type?: string }

const OCCUPANCY_COLOR = (p: number) => p > 80 ? "#e74c3c" : p > 60 ? "#f39c12" : "#27ae60";

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const [stats, setStats] = useState<Stats>({ total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 });
  const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
  const [pendingCheckout, setPendingCheckout] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [roomList, checkins, audit, acts, guestList] = await Promise.all([
          api.getRooms(),
          api.getReservations(`status=confirmed&check_in_date=${today}`),
          api.getPendingCheckouts(),
          api.getActivityLog({ limit: 6 }),
          api.getGuests(),
        ]);
        const s: Stats = { total: roomList.length, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
        for (const r of roomList) { const k = r.status as keyof Stats; if (k in s) s[k]++; }
        setStats(s);
        setArrivals(checkins);
        setPendingCheckout(audit.length);
        setActivity(acts);
        setGuests(guestList);
        setRooms(roomList);
      } catch { /* backend offline */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const occupancyPct = stats.total ? Math.round((stats.occupied / stats.total) * 100) : 0;
  const guestName = (id: number) => { const g = guests.find((g: any) => g.id === id); return g ? `${g.first_name} ${g.last_name}` : `#${id}`; };
  const guestInitials = (id: number) => { const g = guests.find((g: any) => g.id === id); return g ? `${g.first_name[0]}${g.last_name[0]}` : "?"; };
  const roomNum = (id: number) => rooms.find((r: any) => r.id === id)?.room_number || `#${id}`;
  const date = new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const kpis = [
    { label: t.total_rooms,      value: stats.total,       icon: "🏨", sub: t.all_floors,        gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)" },
    { label: t.available,        value: stats.available,   icon: "✅", sub: t.ready_for_guests,   gradient: "linear-gradient(135deg,#059669,#10b981)" },
    { label: t.occupied,         value: stats.occupied,    icon: "🛏️", sub: `${occupancyPct}%`,  gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
    { label: t.checkin_today,    value: arrivals.length,   icon: "📥", sub: t.arriving_today,     gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)" },
    { label: t.pending_checkout, value: pendingCheckout,   icon: "⚠️", sub: t.past_checkout,      gradient: "linear-gradient(135deg,#dc2626,#ef4444)" },
    { label: t.cleaning,         value: stats.cleaning,    icon: "🧹", sub: t.in_progress,        gradient: "linear-gradient(135deg,#0891b2,#06b6d4)" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{t.dashboard}</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>{date}</p>
        </div>
        {can("fo.res.create") && (
          <Link href="/reservations"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.35)" }}>
            + {t.new_reservation}
          </Link>
        )}
      </div>

      {/* KPI cards — HotelPro white style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map((k) => {
          const accent = (k.gradient.match(/#[0-9a-fA-F]{6}/) || ["#2f62f6"])[0];
          return (
            <div key={k.label} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold leading-tight" style={{ color: "var(--muted)" }}>{k.label}</span>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: accent + "1f", color: accent }}>{k.icon}</span>
              </div>
              <div className="text-2xl font-extrabold mt-2" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {loading ? <span style={{ color: "var(--muted)" }}>—</span> : k.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Occupancy gauge */}
        <div className="card p-5">
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>{t.occupancy_rate}</div>
          <div className="flex items-center justify-center mb-4">
            <div className="relative" style={{ width: 120, height: 120 }}>
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none"
                  stroke={OCCUPANCY_COLOR(occupancyPct)} strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - occupancyPct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.8s ease" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontSize: 26, fontWeight: 900, color: "var(--text)" }}>{occupancyPct}%</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.occupied}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: t.available,   val: stats.available,   color: "#10b981" },
              { label: t.occupied,    val: stats.occupied,    color: "#f59e0b" },
              { label: t.cleaning,    val: stats.cleaning,    color: "#06b6d4" },
              { label: t.maintenance, val: stats.maintenance, color: "#ef4444" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-xs" style={{ color: "var(--muted)" }}>{s.label}</span>
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{s.val}</span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: stats.total ? `${(s.val / stats.total) * 100}%` : "0%", background: s.color, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>{t.quick_actions}</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t.new_reservation, href: "/reservations",                   icon: "📋", color: "#3b5bdb", perm: "fo.res.create" },
              { label: t.nav_checkin_list,href: "/reservations?status=confirmed",  icon: "📥", color: "#059669", perm: "fo.checkin" },
              { label: t.nav_night_audit, href: "/night-audit",                    icon: "🌙", color: "#7c3aed", perm: "fo.night_audit" },
              { label: t.nav_card_management, href: "/keycards",                   icon: "🔑", color: "#d97706", perm: "kc.view" },
              { label: t.manage_rooms,    href: "/rooms",                           icon: "🏨", color: "#0891b2", perm: "fo.rooms.view" },
              { label: t.nav_guests,      href: "/guests",                          icon: "👤", color: "#dc2626", perm: "guests.view" },
            ].filter(a => can(a.perm)).map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2 p-3 rounded-xl transition-all hover:scale-[1.02]"
                style={{ background: `${a.color}12`, border: `1px solid ${a.color}25` }}>
                <span className="text-lg">{a.icon}</span>
                <span className="text-xs font-semibold leading-tight" style={{ color: a.color }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <div className="text-sm font-bold mb-4" style={{ color: "var(--text)" }}>{t.recent_activity}</div>
          <div className="space-y-3">
            {activity.length === 0 && !loading && (
              <p className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>{t.no_data}</p>
            )}
            {activity.map((entry) => {
              const msg = lang === "fr" ? entry.message_fr : entry.message_en;
              const ago = entry.created_at
                ? (() => {
                    const diff = (Date.now() - new Date(entry.created_at).getTime()) / 1000;
                    if (diff < 60) return `${Math.round(diff)}s`;
                    if (diff < 3600) return `${Math.round(diff / 60)} min`;
                    if (diff < 86400) return `${Math.round(diff / 3600)}h`;
                    return `${Math.round(diff / 86400)}d`;
                  })()
                : "";
              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                    style={{ background: `${entry.color}15` }}>
                    {entry.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug" style={{ color: "var(--text)" }}>{msg}</p>
                    {ago && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{ago} ago</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Today's arrivals — full list */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{t.todays_checkins}</span>
            {arrivals.length > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#ede9fe", color: "#7c3aed" }}>
                {arrivals.length}
              </span>
            )}
          </div>
          <Link href="/reservations?status=confirmed" className="text-xs font-semibold"
            style={{ color: "var(--blue)" }}>{t.view_all}</Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : arrivals.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--muted)" }}>
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm">{t.no_arrivals_today}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.res_number, t.guest_col, t.room_col, t.nights, t.pax_col, t.actions].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {arrivals.map((r, i) => (
                <tr key={r.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>
                    {r.reservation_number}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: "#7c3aed" }}>
                        {guestInitials(r.guest_id)}
                      </div>
                      <span className="font-medium text-sm" style={{ color: "var(--text)" }}>
                        {guestName(r.guest_id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
                      {roomNum(r.room_id)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold text-sm" style={{ color: "var(--text)" }}>
                    {r.nights}
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                    {r.adults}A
                  </td>
                  <td className="px-4 py-2.5">
                    {can("fo.checkin") && (
                      <Link href="/reservations?status=confirmed"
                        className="text-xs px-2.5 py-1 rounded-lg text-white font-semibold"
                        style={{ background: "#059669" }}>
                        {t.check_in_action}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
