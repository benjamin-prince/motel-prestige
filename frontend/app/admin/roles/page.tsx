"use client";
import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface PermGroup {
  key: string;
  label_en: string;
  label_fr: string;
  color: string;
  icon: string;
  sort_order: number;
  permissions: Array<{ key: string; label_en: string; label_fr: string; sort_order: number }>;
}

interface Role {
  id: string;
  name_en: string;
  name_fr: string;
  color: string;
  is_locked: boolean;
  permissions: string[];
}

const PRESET_COLORS = [
  "#dc2626", "#e11d48", "#d97706", "#059669",
  "#0891b2", "#0284c7", "#3b5bdb", "#7c3aed",
  "#1e293b", "#475569", "#10b981", "#6d28d9",
];

const EMPTY_ROLE = { id: "", name_en: "", name_fr: "", color: "#3b5bdb", permissions: [] as string[] };

/* ─── Permission cell (checkbox visual) ─────────────────────────────────────── */
function PermCell({ granted, color, onClick, locked }: {
  granted: boolean; color: string; onClick?: () => void; locked: boolean;
}) {
  return (
    <button
      type="button"
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${locked ? "cursor-default" : "cursor-pointer"}`}
      style={granted
        ? { background: color }
        : { border: "1.5px solid var(--border)", background: "var(--input-bg)" }}
    >
      {granted && (
        <svg className="w-3 h-3" fill="none" stroke="white" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */
export default function RolesPage() {
  const { lang, t } = useI18n();
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [draftPerms, setDraftPerms] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ROLE });
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const allKeys = groups.flatMap(g => g.permissions.map(p => p.key));

  function roleName(role: Role) {
    return lang === "fr" ? role.name_fr : role.name_en;
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [g, r] = await Promise.all([api.getPermissionGroups(), api.getRoles()]);
      setGroups(g);
      setRoles(r);
      if (r.length > 0) { setSelected(r[0]); setDraftPerms(r[0].permissions); }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function selectRole(role: Role) {
    setSelected(role);
    setDraftPerms(role.permissions);
    setIsDirty(false);
    setConfirmDelete(false);
  }

  function togglePerm(key: string) {
    if (!selected || selected.is_locked) return;
    setDraftPerms(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      setIsDirty(JSON.stringify([...next].sort()) !== JSON.stringify([...selected.permissions].sort()));
      return next;
    });
  }

  function toggleGroup(group: PermGroup) {
    if (!selected || selected.is_locked) return;
    const keys = group.permissions.map(p => p.key);
    const allGranted = keys.every(k => draftPerms.includes(k));
    setDraftPerms(prev => {
      const next = allGranted
        ? prev.filter(k => !keys.includes(k))
        : [...new Set([...prev, ...keys])];
      setIsDirty(JSON.stringify([...next].sort()) !== JSON.stringify([...selected.permissions].sort()));
      return next;
    });
  }

  async function savePerms() {
    if (!selected || !isDirty) return;
    setSaving(true);
    try {
      const updated = await api.updateRole(selected.id, { permissions: draftPerms });
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
      setSelected(updated);
      setDraftPerms(updated.permissions);
      setIsDirty(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  function discardPerms() {
    if (selected) { setDraftPerms(selected.permissions); setIsDirty(false); }
  }

  function openAddModal() {
    setForm({ ...EMPTY_ROLE });
    setFormError("");
    setModal("add");
  }

  function openEditModal() {
    if (!selected || selected.is_locked) return;
    setForm({ id: selected.id, name_en: selected.name_en, name_fr: selected.name_fr, color: selected.color, permissions: selected.permissions });
    setFormError("");
    setModal("edit");
  }

  async function submitModal() {
    if (!form.name_en.trim() || !form.name_fr.trim()) {
      setFormError(t.required_field);
      return;
    }
    if (modal === "add" && !form.id.trim()) { setFormError("ID is required"); return; }
    setFormSaving(true);
    setFormError("");
    try {
      if (modal === "add") {
        const created = await api.createRole({
          id: form.id.trim().toLowerCase().replace(/\s+/g, "_"),
          name_en: form.name_en.trim(),
          name_fr: form.name_fr.trim(),
          color: form.color,
          permissions: [],
        });
        setRoles(prev => [...prev, created]);
        setSelected(created);
        setDraftPerms([]);
        setIsDirty(false);
      } else if (modal === "edit" && selected) {
        const updated = await api.updateRole(selected.id, {
          name_en: form.name_en.trim(),
          name_fr: form.name_fr.trim(),
          color: form.color,
        });
        setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelected(updated);
      }
      setModal(null);
    } catch (e: any) { setFormError(e.message); }
    finally { setFormSaving(false); }
  }

  async function deleteRole() {
    if (!selected || selected.is_locked) return;
    setSaving(true);
    try {
      await api.deleteRole(selected.id);
      const next = roles.filter(r => r.id !== selected.id);
      setRoles(next);
      setSelected(next[0] ?? null);
      setDraftPerms(next[0]?.permissions ?? []);
      setIsDirty(false);
      setConfirmDelete(false);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
    </div>
  );

  const granted = draftPerms.length;
  const total = allKeys.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.roles_permissions}</h2>
        <button onClick={openAddModal}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: "var(--accent)" }}>
          + {t.add_role}
        </button>
      </div>

      {error && (
        <div className="text-sm px-4 py-2 rounded-lg" style={{ background: "#fee2e2", color: "#dc2626" }}>
          {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 items-stretch lg:items-start">
        {/* Role list panel — vertical on desktop, horizontal scroll strip on mobile */}
        <div className="card shrink-0 overflow-hidden w-full lg:w-[230px]" style={{ padding: 0 }}>
          <div className="px-4 py-2.5 border-b text-xs font-semibold uppercase tracking-wider"
            style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--input-bg)" }}>
            {t.nav_roles}
          </div>
          <div className="flex overflow-x-auto lg:block">
          {roles.map(role => {
            const isActive = selected?.id === role.id;
            const g = role.permissions.length;
            return (
              <button key={role.id} onClick={() => selectRole(role)}
                className="text-left px-4 py-3 transition-colors border-b border-r lg:border-r-0 shrink-0 w-44 lg:w-full"
                style={{
                  borderColor: "var(--border)",
                  background: isActive ? role.color + "10" : undefined,
                  borderLeft: `3px solid ${isActive ? role.color : "transparent"}`,
                }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: role.color }} />
                  <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                    {roleName(role)}
                  </span>
                  {role.is_locked && (
                    <svg className="w-3 h-3 ml-auto shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${total ? (g / total) * 100 : 0}%`, background: role.color }} />
                  </div>
                  <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>{g}/{total}</span>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* Permissions matrix */}
        {selected && (
          <div className="flex-1 card overflow-hidden w-full min-w-0" style={{ padding: 0 }}>
            {/* Role info bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b"
              style={{ borderColor: "var(--border)", borderLeft: `4px solid ${selected.color}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base" style={{ color: "var(--text)" }}>{roleName(selected)}</span>
                  {selected.is_locked && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: selected.color + "18", color: selected.color }}>
                      {t.all_permissions}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  {selected.is_locked ? t.superadmin_desc : t.click_to_toggle}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-2xl font-bold" style={{ color: selected.color }}>{granted}</span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}> / {total}</span>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{t.permissions}</div>
                </div>
                {!selected.is_locked && (
                  <div className="flex gap-2">
                    <button onClick={openEditModal}
                      className="p-2 rounded-lg border text-xs"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                      title={t.edit_role}>
                      ✏️
                    </button>
                    <button onClick={() => setConfirmDelete(true)}
                      className="p-2 rounded-lg border text-xs"
                      style={{ borderColor: "#fca5a5", color: "#dc2626" }}
                      title={t.delete}>
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pending changes bar */}
            {isDirty && (
              <div className="flex items-center justify-between px-6 py-2 border-b text-sm"
                style={{ background: "#fefce8", borderColor: "#fde047" }}>
                <span style={{ color: "#854d0e" }}>{t.unsaved_changes}</span>
                <div className="flex gap-2">
                  <button onClick={discardPerms} className="px-3 py-1 rounded text-xs font-medium border"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                    {t.cancel}
                  </button>
                  <button onClick={savePerms} disabled={saving}
                    className="px-3 py-1 rounded text-xs font-medium text-white"
                    style={{ background: "var(--accent)", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "…" : t.save_changes}
                  </button>
                </div>
              </div>
            )}

            {/* Delete confirm bar */}
            {confirmDelete && (
              <div className="flex items-center justify-between px-6 py-2 border-b text-sm"
                style={{ background: "#fee2e2", borderColor: "#fca5a5" }}>
                <span style={{ color: "#dc2626" }}>{t.confirm_delete}</span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1 rounded text-xs font-medium border"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                    {t.cancel}
                  </button>
                  <button onClick={deleteRole} disabled={saving}
                    className="px-3 py-1 rounded text-xs font-medium text-white"
                    style={{ background: "#dc2626", opacity: saving ? 0.6 : 1 }}>
                    {saving ? "…" : t.delete}
                  </button>
                </div>
              </div>
            )}

            {/* Groups */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
              {groups.map(group => {
                const groupKeys = group.permissions.map(p => p.key);
                const groupGranted = groupKeys.filter(k => draftPerms.includes(k)).length;
                const allGroupGranted = groupGranted === groupKeys.length;
                return (
                  <div key={group.key}>
                    <div className="flex items-center gap-2 px-6 py-2 border-b"
                      style={{ background: group.color + "0c", borderColor: "var(--border)" }}>
                      <span>{group.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>
                        {lang === "fr" ? group.label_fr : group.label_en}
                      </span>
                      <span className="ml-auto text-xs font-semibold" style={{ color: group.color }}>
                        {groupGranted}/{groupKeys.length}
                      </span>
                      {!selected.is_locked && (
                        <button onClick={() => toggleGroup(group)}
                          className="ml-2 text-xs px-2 py-0.5 rounded"
                          style={{
                            background: allGroupGranted ? group.color + "20" : "var(--input-bg)",
                            color: allGroupGranted ? group.color : "var(--muted)",
                            border: `1px solid ${group.color}40`,
                          }}>
                          {allGroupGranted ? t.deselect_all : t.select_all}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      {group.permissions.map((perm, idx) => (
                        <div key={perm.key}
                          className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b sm:border-r"
                          style={{ borderColor: "var(--border)", background: idx % 2 === 0 ? undefined : "var(--input-bg)" }}>
                          <PermCell
                            granted={draftPerms.includes(perm.key)}
                            color={group.color}
                            locked={selected.is_locked}
                            onClick={() => togglePerm(perm.key)}
                          />
                          <span className="text-sm" style={{ color: "var(--text)" }}>
                            {lang === "fr" ? perm.label_fr : perm.label_en}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Role Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="card w-full max-w-md" style={{ padding: "1.5rem" }}>
            <h3 className="font-bold text-base mb-4" style={{ color: "var(--text)" }}>
              {modal === "add" ? `+ ${t.add_role}` : `✏️ ${t.edit_role}`}
            </h3>

            <div className="space-y-4">
              {modal === "add" && (
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                    ID (slug)
                  </label>
                  <input
                    value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                    placeholder="e.g. front_desk"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text)" }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                    {t.role_name} (EN)
                  </label>
                  <input
                    value={form.name_en}
                    onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                    placeholder="e.g. Receptionist"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                    {t.role_name} (FR)
                  </label>
                  <input
                    value={form.name_fr}
                    onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))}
                    placeholder="ex. Réceptionniste"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--border)", background: "var(--input-bg)", color: "var(--text)" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
                  {t.color}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full transition-transform"
                      style={{
                        background: c,
                        transform: form.color === c ? "scale(1.25)" : undefined,
                        outline: form.color === c ? `2px solid ${c}` : undefined,
                        outlineOffset: 2,
                      }} />
                  ))}
                </div>
              </div>

              {formError && <p className="text-xs" style={{ color: "#dc2626" }}>{formError}</p>}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {t.cancel}
              </button>
              <button onClick={submitModal} disabled={formSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--accent)", opacity: formSaving ? 0.6 : 1 }}>
                {formSaving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
