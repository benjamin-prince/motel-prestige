"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { ConfirmDialog, useToast } from "@/components/ui";

interface DBRole {
  id: string;
  name_en: string;
  name_fr: string;
  color: string;
  is_locked: boolean;
  permissions: string[];
}

type ModalTab = "account" | "personal" | "identity" | "address" | "hr";

const EMPTY_FORM = {
  full_name: "", email: "", password: "", role: "",
  avatar_url: "", first_name: "", last_name: "", phone: "",
  date_of_birth: "", gender: "", nationality: "",
  id_type: "", id_number: "",
  address: "", city: "", country: "",
  employee_id: "", department: "", hire_date: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  notes: "",
};

function roleLabel(role: DBRole, lang: string) {
  return lang === "fr" ? role.name_fr : role.name_en;
}

function roleBadgeStyle(color: string) {
  return { background: color + "20", color };
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function UsersPage() {
  const { lang, t } = useI18n();
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<DBRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [activeTab, setActiveTab] = useState<ModalTab>("account");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    import("@/lib/auth").then(({ getUser }) => setMe(getUser()));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.getUsers(), api.getRoles()]);
      setUsers(u);
      setRoles(r);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  function defaultRole() {
    return (roles.find(r => !r.is_locked) ?? roles[0])?.id ?? "";
  }

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role: defaultRole() });
    setActiveTab("account");
    setError("");
    setShowModal(true);
  };

  const openEdit = (user: any) => {
    setEditing(user);
    setForm({
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      password: "",
      role: user.role ?? "",
      avatar_url: user.avatar_url ?? "",
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      phone: user.phone ?? "",
      date_of_birth: user.date_of_birth ?? "",
      gender: user.gender ?? "",
      nationality: user.nationality ?? "",
      id_type: user.id_type ?? "",
      id_number: user.id_number ?? "",
      address: user.address ?? "",
      city: user.city ?? "",
      country: user.country ?? "",
      employee_id: user.employee_id ?? "",
      department: user.department ?? "",
      hire_date: user.hire_date ?? "",
      emergency_contact_name: user.emergency_contact_name ?? "",
      emergency_contact_phone: user.emergency_contact_phone ?? "",
      notes: user.notes ?? "",
    });
    setActiveTab("account");
    setError("");
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setError(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const payload: any = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "password") {
          if (v) payload.password = v;
        } else if (k === "email") {
          if (!editing) payload.email = v;
        } else {
          if (v !== "") payload[k] = v;
        }
      }
      if (editing) {
        await api.updateUser(editing.id, payload);
      } else {
        if (!payload.password) { setError("Password is required"); setSaving(false); return; }
        payload.email = form.email;
        await api.createUser(payload);
      }
      closeModal();
      load();
    } catch (err: any) {
      setError(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: any) => {
    try { await api.updateUser(user.id, { is_active: !user.is_active }); load(); }
    catch (err: any) { toast(err.message, "error"); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try { await api.deleteUser(confirmDelete.id); setConfirmDelete(null); load(); }
    catch (err: any) { toast(err.message, "error"); setConfirmDelete(null); }
  };

  function getRoleObj(roleId: string): DBRole | undefined {
    return roles.find(r => r.id === roleId);
  }

  const f = (k: keyof typeof form) => form[k];
  const sf = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.user_management}</h2>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ background: "var(--accent)" }}>
          + {t.invite_user}
        </button>
      </div>

      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.full_name, t.email, t.role, t.status, t.joined, t.actions].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: "var(--muted)" }}>{t.no_data}</td></tr>
            ) : users.map((user, i) => {
              const roleObj = getRoleObj(user.role);
              const color = roleObj?.color ?? "#64748b";
              const isMe = me && Number(me.id) === user.id;
              return (
                <tr key={user.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.full_name}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: color }}>
                          {initials(user.full_name)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                          {user.full_name}
                          {isMe && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: "#e3f2fd", color: "#1565c0" }}>{t.you}</span>
                          )}
                        </div>
                        {user.employee_id && (
                          <div className="text-xs" style={{ color: "var(--muted)" }}>#{user.employee_id}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3">
                    <div style={{ color: "var(--muted)" }}>{user.email}</div>
                    {user.phone && <div className="text-xs" style={{ color: "var(--muted)" }}>{user.phone}</div>}
                  </td>

                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={roleBadgeStyle(color)}>
                      {roleObj ? roleLabel(roleObj, lang) : user.role}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={user.is_active
                        ? { background: "#e8f5e9", color: "#2e7d32" }
                        : { background: "#f5f5f5", color: "#757575" }}>
                      {user.is_active ? t.active_status : t.inactive_status}
                    </span>
                  </td>

                  <td className="px-5 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(user)}
                        className="text-xs border px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                        style={{ borderColor: "var(--border)", color: "#1565c0" }}>
                        {t.edit}
                      </button>
                      <button onClick={() => toggleActive(user)}
                        className="text-xs border px-2.5 py-1 rounded-lg transition-colors"
                        style={user.is_active
                          ? { borderColor: "#fca5a5", color: "#dc2626" }
                          : { borderColor: "#a7f3d0", color: "#059669" }}>
                        {user.is_active ? t.deactivate : t.activate}
                      </button>
                      {Number(me?.id) !== user.id && (
                        <button onClick={() => setConfirmDelete(user)}
                          className="text-xs border px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                          {t.delete}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(30,37,50,0.45)" }}>
          <div className="card w-full max-w-2xl flex flex-col" style={{ padding: 0, maxHeight: "90vh" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: "var(--border)" }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                {editing ? t.edit_user : t.invite_user}
              </h3>
              <button onClick={closeModal} style={{ color: "var(--muted)", fontSize: 18 }}>✕</button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b shrink-0 overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              {(["account", "personal", "identity", "address", "hr"] as ModalTab[]).map(tab => {
                const labels: Record<ModalTab, string> = {
                  account:  t.section_account,
                  personal: t.section_personal,
                  identity: t.section_identity,
                  address:  t.section_address,
                  hr:       t.section_hr,
                };
                return (
                  <button key={tab} type="button"
                    onClick={() => setActiveTab(tab)}
                    className="px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2"
                    style={activeTab === tab
                      ? { borderBottomColor: "var(--accent)", color: "var(--accent)" }
                      : { borderBottomColor: "transparent", color: "var(--muted)" }}>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {error && (
                  <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#fce4ec", color: "#b71c1c" }}>
                    {error}
                  </div>
                )}

                {/* ── Account tab ─────────────────────────────────────── */}
                {activeTab === "account" && (
                  <div className="space-y-4">
                    <div>
                      <label className="field-label">{t.full_name} *</label>
                      <input required value={f("full_name")} autoFocus onChange={sf("full_name")} className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">{t.email} *</label>
                      <input type="email" required value={f("email")} disabled={!!editing}
                        onChange={sf("email")} className="field-input"
                        style={editing ? { opacity: 0.6, cursor: "not-allowed" } : undefined} />
                    </div>
                    <div>
                      <label className="field-label">
                        {editing ? t.new_password : t.password}
                        {editing && <span className="ml-1 text-xs font-normal" style={{ color: "var(--muted)" }}>({t.optional})</span>}
                      </label>
                      <input type="password" value={f("password")} required={!editing}
                        placeholder={editing ? t.leave_blank : undefined}
                        onChange={sf("password")} className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">{t.role} *</label>
                      <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                        {roles.map(r => {
                          const active = form.role === r.id;
                          return (
                            <button key={r.id} type="button"
                              onClick={() => setForm(prev => ({ ...prev, role: r.id }))}
                              className="py-2 px-3 rounded-lg text-sm font-semibold border transition-colors text-left flex items-center gap-2"
                              style={active
                                ? { borderColor: r.color, background: r.color + "18", color: r.color }
                                : { borderColor: "var(--border)", color: "var(--muted)" }}>
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                              {roleLabel(r, lang)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="field-label">
                        {t.avatar_url}
                        <span className="ml-1 text-xs font-normal" style={{ color: "var(--muted)" }}>({t.optional})</span>
                      </label>
                      <input value={f("avatar_url")} onChange={sf("avatar_url")} className="field-input" placeholder="https://…" />
                    </div>
                  </div>
                )}

                {/* ── Personal tab ─────────────────────────────────────── */}
                {activeTab === "personal" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.first_name}</label>
                        <input value={f("first_name")} onChange={sf("first_name")} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">{t.last_name}</label>
                        <input value={f("last_name")} onChange={sf("last_name")} className="field-input" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.phone}</label>
                        <input value={f("phone")} onChange={sf("phone")} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">{t.date_of_birth}</label>
                        <input type="date" value={f("date_of_birth")} onChange={sf("date_of_birth")} className="field-input" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.gender}</label>
                        <input value={f("gender")} onChange={sf("gender")} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">{t.nationality}</label>
                        <input value={f("nationality")} onChange={sf("nationality")} className="field-input" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Identity tab ─────────────────────────────────────── */}
                {activeTab === "identity" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.id_type}</label>
                        <input value={f("id_type")} onChange={sf("id_type")} className="field-input" placeholder="Passport, NID…" />
                      </div>
                      <div>
                        <label className="field-label">{t.id_number}</label>
                        <input value={f("id_number")} onChange={sf("id_number")} className="field-input" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Address tab ─────────────────────────────────────── */}
                {activeTab === "address" && (
                  <div className="space-y-4">
                    <div>
                      <label className="field-label">{t.address}</label>
                      <input value={f("address")} onChange={sf("address")} className="field-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.city}</label>
                        <input value={f("city")} onChange={sf("city")} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">{t.country}</label>
                        <input value={f("country")} onChange={sf("country")} className="field-input" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── HR / Emergency tab ─────────────────────────────────────── */}
                {activeTab === "hr" && (
                  <div className="space-y-4">
                    <div>
                      <label className="field-label">{t.employee_id}</label>
                      <input value={f("employee_id")} onChange={sf("employee_id")} className="field-input" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.department}</label>
                        <input value={f("department")} onChange={sf("department")} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">{t.hire_date}</label>
                        <input type="date" value={f("hire_date")} onChange={sf("hire_date")} className="field-input" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider pt-2" style={{ color: "var(--muted)" }}>
                      {t.section_emergency}
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="field-label">{t.emergency_contact_name}</label>
                        <input value={f("emergency_contact_name")} onChange={sf("emergency_contact_name")} className="field-input" />
                      </div>
                      <div>
                        <label className="field-label">{t.emergency_contact_phone}</label>
                        <input value={f("emergency_contact_phone")} onChange={sf("emergency_contact_phone")} className="field-input" />
                      </div>
                    </div>
                    <div>
                      <label className="field-label">{t.notes}</label>
                      <textarea value={f("notes")} onChange={sf("notes") as any} rows={4} className="field-input resize-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                  style={{ background: "var(--accent)" }}>
                  {saving ? t.loading : t.save}
                </button>
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title={`${t.delete} ${confirmDelete.full_name}?`}
          message={t.confirm_delete}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
