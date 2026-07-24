"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import Link from "next/link";

interface RoomBreakdown { total: number; available: number; occupied: number; cleaning: number; maintenance: number }
interface TrendPoint { date: string; revenue: number; occupancy: number; occupancy_pct: number }
interface Overview {
  date: string; rooms: RoomBreakdown; occupancy_pct: number;
  adr: number; revpar: number; revenue_today: number; room_revenue_today: number;
  revenue_mtd: number; arrivals_today: number; departures_today: number; trend: TrendPoint[];
}
interface ActivityEntry { id: number; icon: string; color: string; message_en: string; message_fr: string; created_at?: string }
interface ArrivalRow { id: number; reservation_number: string; guest_id: number; room_id: number; check_in_date: string; adults: number; nights: number; guest_type?: string }

const EMPTY: Overview = {
  date: "", rooms: { total: 0, available: 0, occupied: 0, cleaning: 0, maintenance: 0 },
  occupancy_pct: 0, adr: 0, revpar: 0, revenue_today: 0, room_revenue_today: 0,
  revenue_mtd: 0, arrivals_today: 0, departures_today: 0, trend: [],
};

// Revenue-trend sparkline — a gold area curve with an emphasised endpoint.
function Sparkline({ points }: { points: TrendPoint[] }) {
  const W = 640, H = 132, P = 6;
  if (points.length < 2) {
    return <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--muted)" }}>—</div>;
  }
  const vals = points.map(p => p.revenue);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 132 }}>
      <defs>
        <linearGradient id="revfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--border)" strokeWidth="1" />
      <path d={area} fill="url(#revfill)" />
      <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(points[last].revenue)} r="4.5" fill="var(--gold)" stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
}

export default function Dashboard() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const L = (fr: string, en: string) => (lang === "fr" ? fr : en);

  const [ov, setOv] = useState<Overview>(EMPTY);
  const [arrivals, setArrivals] = useState<ArrivalRow[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [overview, roomList, checkins, acts, guestList] = await Promise.all([
          api.getDashboardOverview(7),
          api.getRooms(),
          api.getReservations(`status=confirmed&check_in_date=${today}`),
          api.getActivityLog({ limit: 6 }),
          api.getGuests(),
        ]);
        setOv(overview);
        setArrivals(checkins);
        setActivity(acts);
        setGuests(guestList);
        setRooms(roomList);
      } catch { /* backend offline */ } finally { setLoading(false); }
    }
    load();
  }, []);

  const s = ov.rooms;
  const money = (n: number, cents = false) =>
    new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US",
      { style: "currency", currency: "USD", maximumFractionDigits: cents ? 2 : 0 }).format(n || 0);
  const guestName = (id: number) => { const g = guests.find((g: any) => g.id === id); return g ? `${g.first_name} ${g.last_name}` : `#${id}`; };
  const guestInitials = (id: number) => { const g = guests.find((g: any) => g.id === id); return g ? `${g.first_name[0]}${g.last_name[0]}` : "?"; };
  const roomNum = (id: number) => rooms.find((r: any) => r.id === id)?.room_number || `#${id}`;
  const date = new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const trendRevenue = ov.trend.reduce((a, p) => a + p.revenue, 0);

  // Four hero KPIs — restrained luxe tones, not a rainbow.
  const kpis = [
    { label: L("Taux d'occupation", "Occupancy"), value: `${ov.occupancy_pct}%`, sub: `${s.occupied}/${s.total} ${L("chambres", "rooms")}`, icon: "🏨", tone: "var(--blue)" },
    { label: "ADR", value: money(ov.adr), sub: L("prix moyen / nuit", "avg daily rate"), icon: "💵", tone: "var(--gold)" },
    { label: "RevPAR", value: money(ov.revpar), sub: L("revenu / chambre dispo", "revenue per room"), icon: "📈", tone: "var(--good)" },
    { label: L("Revenu du jour", "Revenue today"), value: money(ov.revenue_today), sub: `${L("mois", "MTD")}: ${money(ov.revenue_mtd)}`, icon: "✦", tone: "var(--text)" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{t.dashboard}</h1>
          <p className="page-subtitle">{date}</p>
        </div>
        {can("fo.res.create") && (
          <Link href="/reservations" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            + {t.new_reservation}
          </Link>
        )}
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: k.tone }} />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: "var(--gold-soft)", color: k.tone }}>{k.icon}</span>
            </div>
            <div className="font-display tabular mt-3" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text)" }}>
              {loading ? <span style={{ color: "var(--muted)" }}>—</span> : k.value}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue trend + occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Revenue trend — the analytics centrepiece */}
        <div className="card p-5 lg:col-span-2 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>{L("Revenu — 7 jours", "Revenue — last 7 days")}</div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>{L("Total période", "Period total")} · <span className="tabular" style={{ color: "var(--text)", fontWeight: 600 }}>{money(trendRevenue)}</span></div>
            </div>
            <span className="pill pill-warn" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />{L("chambres + extras", "rooms + extras")}
            </span>
          </div>
          <div className="flex-1 flex items-end mt-3">
            {loading ? <div className="h-[132px] w-full" /> : <Sparkline points={ov.trend} />}
          </div>
          <div className="flex justify-between mt-2">
            {ov.trend.map((p) => (
              <span key={p.date} className="text-[10px] tabular" style={{ color: "var(--muted)" }}>
                {new Date(p.date + "T00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "short" })}
              </span>
            ))}
          </div>
        </div>

        {/* Occupancy gauge + status */}
        <div className="card p-5">
          <div className="section-title">{t.occupancy_rate}</div>
          <div className="flex items-center justify-center mb-4">
            <div className="relative" style={{ width: 128, height: 128 }}>
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="11" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--blue)" strokeWidth="11"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - ov.occupancy_pct / 100)}`}
                  strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display tabular" style={{ fontSize: 28, fontWeight: 600, color: "var(--text)" }}>{ov.occupancy_pct}%</span>
                <span style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>{t.occupied}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: t.available,   val: s.available,   color: "var(--good)" },
              { label: t.occupied,    val: s.occupied,    color: "var(--blue)" },
              { label: t.cleaning,    val: s.cleaning,    color: "var(--gold)" },
              { label: t.maintenance, val: s.maintenance, color: "var(--bad)" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                <span className="flex-1 text-xs" style={{ color: "var(--muted)" }}>{row.label}</span>
                <span className="text-xs font-bold tabular" style={{ color: "var(--text)" }}>{row.val}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: s.total ? `${(row.val / s.total) * 100}%` : "0%", background: row.color, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="card p-5 lg:col-span-2">
          <div className="section-title">{t.quick_actions}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: t.new_reservation, href: "/reservations", icon: "📋", perm: "fo.res.create" },
              { label: t.nav_checkin_list, href: "/reservations?status=confirmed", icon: "📥", perm: "fo.checkin" },
              { label: t.nav_night_audit, href: "/night-audit", icon: "🌙", perm: "fo.night_audit" },
              { label: t.nav_card_management, href: "/keycards", icon: "🔑", perm: "kc.view" },
              { label: t.manage_rooms, href: "/rooms", icon: "🏨", perm: "fo.rooms.view" },
              { label: t.nav_guests, href: "/guests", icon: "👤", perm: "guests.view" },
            ].filter(a => can(a.perm)).map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2.5 p-3 rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: "var(--gold-soft)" }}>{a.icon}</span>
                <span className="text-xs font-semibold leading-tight" style={{ color: "var(--text)" }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="section-title">{t.recent_activity}</div>
          <div className="space-y-3">
            {activity.length === 0 && !loading && (
              <p className="text-xs text-center py-4" style={{ color: "var(--muted)" }}>{t.no_data}</p>
            )}
            {activity.map((entry) => {
              const msg = lang === "fr" ? entry.message_fr : entry.message_en;
              const ago = entry.created_at ? (() => {
                const diff = (Date.now() - new Date(entry.created_at).getTime()) / 1000;
                if (diff < 60) return `${Math.round(diff)}s`;
                if (diff < 3600) return `${Math.round(diff / 60)} min`;
                if (diff < 86400) return `${Math.round(diff / 3600)}h`;
                return `${Math.round(diff / 86400)}d`;
              })() : "";
              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                    style={{ background: "var(--gold-soft)" }}>{entry.icon}</div>
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

      {/* Today's arrivals */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <span className="section-title" style={{ marginBottom: 0 }}>{t.todays_checkins}</span>
            {arrivals.length > 0 && (
              <span className="pill" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>{arrivals.length}</span>
            )}
          </div>
          <Link href="/reservations?status=confirmed" className="text-xs font-semibold" style={{ color: "var(--blue)" }}>{t.view_all}</Link>
        </div>
        {loading ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : arrivals.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--muted)" }}>
            <div className="text-3xl mb-2">✦</div>
            <p className="text-sm">{t.no_arrivals_today}</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
                <tr>
                  {[t.res_number, t.guest_col, t.room_col, t.nights, t.pax_col, t.actions].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arrivals.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: "var(--blue)" }}>{r.reservation_number}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--gold), var(--blue))" }}>{guestInitials(r.guest_id)}</div>
                        <span className="font-medium text-sm" style={{ color: "var(--text)" }}>{guestName(r.guest_id)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><span className="font-bold text-sm tabular" style={{ color: "var(--text)" }}>{roomNum(r.room_id)}</span></td>
                    <td className="px-4 py-2.5 text-center font-semibold text-sm tabular" style={{ color: "var(--text)" }}>{r.nights}</td>
                    <td className="px-4 py-2.5 text-xs tabular" style={{ color: "var(--muted)" }}>{r.adults}A</td>
                    <td className="px-4 py-2.5">
                      {can("fo.checkin") && (
                        <Link href="/reservations?status=confirmed" className="btn-primary" style={{ fontSize: 12, padding: "5px 12px" }}>{t.check_in_action}</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
