"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { StatCardGrid, SearchInput } from "@/components/ui";

type User = {
  id: number | string;
  full_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
  is_active?: boolean;
  avatar_url?: string;
  department?: string | null;
  employee_id?: string | null;
  hire_date?: string | null;
  nationality?: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
};

type Role = { id: string; name_en?: string; name_fr?: string; color?: string };

const AVATAR_COLORS = [
  "#3b5bdb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#c2410c", "#4f46e5",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(u: User) {
  const fn = u.first_name?.[0] || "";
  const ln = u.last_name?.[0] || "";
  if (fn || ln) return `${fn}${ln}`.toUpperCase();
  const parts = (u.full_name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
}

const displayName = (u: User) =>
  u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "—";

export default function HrmStaffPage() {
  const { lang } = useI18n();
  const { can } = usePermissions();
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<string>("");

  const canManage = can("hrm.staff.manage") || can("admin.users.manage");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [u, r] = await Promise.all([
          api.getUsers(),
          api.getRoles().catch(() => []),
        ]);
        setUsers(u || []);
        setRoles(r || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roleById = useMemo(() => {
    const m: Record<string, Role> = {};
    for (const r of roles) m[r.id] = r;
    return m;
  }, [roles]);

  const roleName = (id?: string) => {
    const r = id ? roleById[id] : undefined;
    if (!r) return id || "—";
    return (lang === "fr" ? r.name_fr : r.name_en) || r.name_en || id || "—";
  };

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) if (u.department) set.add(u.department);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter(u => {
        if (dept && (u.department || "") !== dept) return false;
        if (!q) return true;
        return (
          displayName(u).toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.employee_id || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const da = a.department || "￿";
        const db = b.department || "￿";
        if (da !== db) return da.localeCompare(db);
        return displayName(a).localeCompare(displayName(b));
      });
  }, [users, search, dept]);

  const activeCount = users.filter(u => u.is_active !== false).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            {L("Staff Directory", "Répertoire du Personnel")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Company staff directory — read only", "Annuaire du personnel — lecture seule")}
          </p>
        </div>
        {canManage && (
          <a href="/admin/users"
            className="text-xs px-3 py-2 rounded-lg border font-semibold transition-colors hover:opacity-80"
            style={{ borderColor: "var(--border)", color: "var(--blue)", background: "var(--card)" }}>
            {L("Manage in Admin → Users", "Gérer dans Admin → Utilisateurs")}
          </a>
        )}
      </div>

      {/* Stats */}
      <StatCardGrid
        loading={loading}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"
        stats={[
          { label: L("Total Staff", "Personnel Total"), value: users.length, icon: "👥", gradient: "#3b5bdb" },
          { label: L("Active", "Actifs"), value: activeCount, icon: "✅", gradient: "#059669" },
          { label: L("Departments", "Départements"), value: departments.length, icon: "🏢", gradient: "#7c3aed" },
        ]}
      />

      {/* Search + department pills */}
      <div className="mb-5 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={L("Search name, email, or ID…", "Rechercher nom, email ou matricule…")}
          className="relative flex-1 min-w-48 max-w-sm"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{ key: "", label: L("All", "Tout") }, ...departments.map(d => ({ key: d, label: d }))].map(p => (
            <button key={p.key || "all"} onClick={() => setDept(p.key)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={dept === p.key
                ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" }
                : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Directory */}
      {loading ? (
        <div className="text-center py-16 text-sm" style={{ color: "var(--muted)" }}>
          {L("Loading…", "Chargement…")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <div className="text-4xl mb-2">🧑‍💼</div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {L("No staff found", "Aucun membre du personnel trouvé")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(u => {
            const name = displayName(u);
            const color = avatarColor(name);
            const role = u.role ? roleById[u.role] : undefined;
            const roleColor = role?.color || "var(--muted)";
            const active = u.is_active !== false;
            return (
              <div key={u.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: color }}>
                    {initials(u)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--text)" }}>{name}</p>
                      <span className={active ? "pill pill-good" : "pill pill-slate"}>
                        {active ? L("Active", "Actif") : L("Inactive", "Inactif")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: (role?.color || "#94a3b8") + "22", color: roleColor }}>
                        {roleName(u.role)}
                      </span>
                      {u.department && (
                        <span className="text-xs" style={{ color: "var(--muted)" }}>{u.department}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs" style={{ color: "var(--muted)" }}>
                  {u.employee_id && (
                    <div className="flex items-center gap-2">
                      <span>🆔</span>
                      <span className="font-mono" style={{ color: "var(--text)" }}>{u.employee_id}</span>
                    </div>
                  )}
                  {u.email && (
                    <div className="flex items-center gap-2 truncate">
                      <span>✉️</span>
                      <span className="truncate">{u.email}</span>
                    </div>
                  )}
                  {u.phone && (
                    <div className="flex items-center gap-2">
                      <span>📞</span>
                      <span>{u.phone}</span>
                    </div>
                  )}
                  {u.hire_date && (
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>{L("Hired", "Embauché")} {u.hire_date}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
