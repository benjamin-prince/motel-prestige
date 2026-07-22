"use client";
import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CARD_TYPES = ["staff", "housekeeping", "maintenance", "master", "guest"] as const;
type CardType = typeof CARD_TYPES[number];

const TYPE_META: Record<CardType, { icon: string; color: string; label_en: string; label_fr: string }> = {
  staff:        { icon: "👤", color: "#3b5bdb", label_en: "Staff",        label_fr: "Personnel"     },
  housekeeping: { icon: "🧹", color: "#7950f2", label_en: "Housekeeping", label_fr: "Gouvernance"   },
  maintenance:  { icon: "🔧", color: "#e67700", label_en: "Maintenance",  label_fr: "Maintenance"   },
  master:       { icon: "🔑", color: "#2f9e44", label_en: "Master",       label_fr: "Maître"        },
  guest:        { icon: "🛎️", color: "#0ca678", label_en: "Guest",        label_fr: "Client"        },
};

const STATUS_META: Record<string, { bg: string; color: string; dot: string }> = {
  active:   { bg: "var(--good-bg)", color: "var(--good)", dot: "var(--good)" },
  inactive: { bg: "var(--input-bg)", color: "var(--muted)", dot: "var(--muted)" },
  lost:     { bg: "var(--bad-bg)", color: "var(--bad)", dot: "var(--bad)" },
  expired:  { bg: "var(--warn-bg)", color: "var(--warn)", dot: "var(--warn)" },
};

const UNLIMITED_DATE = "2099-12-31T23:59";
const isUnlimited = (dt: string) => dt >= "2099-12-31";

// Shift presets — hours: -1 means "unlimited"
const PRESETS: Record<CardType, { label_en: string; label_fr: string; hours: number }[]> = {
  staff:        [
    { label_en: "Today's Shift (8h)",   label_fr: "Shift Aujourd'hui (8h)", hours: 8   },
    { label_en: "Tomorrow's Shift",     label_fr: "Shift Demain",           hours: 32  },
    { label_en: "This Week",            label_fr: "Cette Semaine",          hours: 168 },
    { label_en: "Unlimited",            label_fr: "Illimité",               hours: -1  },
  ],
  housekeeping: [
    { label_en: "Today (until 18:00)",  label_fr: "Aujourd'hui (jusqu'à 18h)", hours: 10 },
    { label_en: "This Week",            label_fr: "Cette Semaine",            hours: 168 },
    { label_en: "Unlimited",            label_fr: "Illimité",                 hours: -1  },
  ],
  maintenance:  [
    { label_en: "4 Hours",              label_fr: "4 Heures",               hours: 4   },
    { label_en: "Today",                label_fr: "Aujourd'hui",            hours: 24  },
    { label_en: "This Week",            label_fr: "Cette Semaine",          hours: 168 },
    { label_en: "Unlimited",            label_fr: "Illimité",               hours: -1  },
  ],
  master:       [
    { label_en: "30 Days",              label_fr: "30 Jours",               hours: 720  },
    { label_en: "90 Days",              label_fr: "90 Jours",               hours: 2160 },
    { label_en: "6 Months",             label_fr: "6 Mois",                 hours: 4380 },
    { label_en: "Unlimited",            label_fr: "Illimité",               hours: -1   },
  ],
  guest:        [
    { label_en: "Until Tonight (23:59)",label_fr: "Ce Soir (23:59)",        hours: 12  },
    { label_en: "24 Hours",             label_fr: "24 Heures",              hours: 24  },
    { label_en: "3 Days",               label_fr: "3 Jours",                hours: 72  },
    { label_en: "Unlimited",            label_fr: "Illimité",               hours: -1  },
  ],
};

// Zone options for master / floor-based access
const ZONES = [
  { key: "all",     label_en: "All Floors",     label_fr: "Tous les Étages" },
  { key: "floor_1", label_en: "Floor 1",         label_fr: "Étage 1"         },
  { key: "floor_2", label_en: "Floor 2",         label_fr: "Étage 2"         },
  { key: "floor_3", label_en: "Floor 3",         label_fr: "Étage 3"         },
  { key: "lobby",   label_en: "Lobby",           label_fr: "Lobby"           },
  { key: "pool",    label_en: "Pool",            label_fr: "Piscine"         },
  { key: "gym",     label_en: "Gym",             label_fr: "Salle de Sport"  },
  { key: "parking", label_en: "Parking",         label_fr: "Parking"         },
  { key: "staff",   label_en: "Staff Areas",     label_fr: "Zones Personnel" },
];

function hoursFromNow(h: number): string {
  const d = new Date(Date.now() + h * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

function expiryCountdown(expires_at: string, lang: string): { label: string; urgent: boolean } {
  const ms = new Date(expires_at).getTime() - Date.now();
  if (ms <= 0) return { label: lang === "fr" ? "Expirée" : "Expired", urgent: true };
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return { label: lang === "fr" ? `${d}j restants` : `${d}d left`, urgent: d <= 1 };
  return { label: lang === "fr" ? `${h}h restantes` : `${h}h left`, urgent: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini card visual component
// ─────────────────────────────────────────────────────────────────────────────
function CardChip({ type, lang }: { type: string; lang: string }) {
  const meta = TYPE_META[type as CardType] ?? { icon: "🃏", color: "#888", label_en: type, label_fr: type };
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: meta.color + "18", color: meta.color }}>
      <span>{meta.icon}</span>
      {lang === "fr" ? meta.label_fr : meta.label_en}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Access Logs Modal
// ─────────────────────────────────────────────────────────────────────────────
function LogsModal({ cardId, cardNumber, onClose }: { cardId: number; cardNumber: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCardLogs(cardId).then(l => { setLogs(l); setLoading(false); });
  }, [cardId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(10,20,40,0.6)" }}>
      <div className="card w-full max-w-2xl" style={{ padding: 0, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{t.access_log}</h3>
            <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted)" }}>{cardNumber}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted)", fontSize: 20 }}>✕</button>
        </div>
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.time, t.door, t.access, t.reason].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>{t.no_logs}</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>
                    {new Date(l.accessed_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{l.door_location}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={l.access_granted
                        ? { background: "#e8f5e9", color: "#2e7d32" }
                        : { background: "#fce4ec", color: "#b71c1c" }}>
                      {l.access_granted ? "✓" : "✗"} {l.access_granted ? t.granted : t.denied}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{l.denial_reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Extend Modal
// ─────────────────────────────────────────────────────────────────────────────
function ExtendModal({ card, lang, onClose, onSave }: { card: any; lang: string; onClose: () => void; onSave: (dt: string) => void }) {
  const type = card.card_type as CardType;
  const presets = PRESETS[type] ?? PRESETS.guest;
  const [dt, setDt] = useState(hoursFromNow(24));
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(10,20,40,0.6)" }}>
      <div className="card w-full max-w-sm" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
            {lang === "fr" ? "Prolonger la Carte" : "Extend Card"}
          </h3>
          <button onClick={onClose} style={{ color: "var(--muted)", fontSize: 20 }}>✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>{card.card_number}</p>
          <div>
            <p className="field-label mb-2">{lang === "fr" ? "Presets" : "Quick Presets"}</p>
            <div className="flex flex-col gap-2">
              {presets.map(p => (
                <button key={p.hours} type="button"
                  onClick={() => setDt(p.hours === -1 ? UNLIMITED_DATE : hoursFromNow(p.hours))}
                  className="py-2 px-3 rounded-lg text-sm border text-left transition-colors hover:bg-gray-50"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                  {lang === "fr" ? p.label_fr : p.label_en}
                </button>
              ))}
            </div>
          </div>
          {!isUnlimited(dt) ? (
            <div>
              <label className="field-label">{lang === "fr" ? "Nouvelle Expiration" : "New Expiry"}</label>
              <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} className="field-input" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "#e8f5e9", color: "#2e7d32" }}>
              <span className="font-bold text-lg">∞</span>
              <span className="text-sm font-semibold">{lang === "fr" ? "Illimité" : "Unlimited"}</span>
              <button type="button" onClick={() => setDt(hoursFromNow(24))}
                className="ml-auto text-xs underline" style={{ color: "#1b5e20" }}>
                {lang === "fr" ? "Modifier" : "Change"}
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={async () => { setSaving(true); await onSave(dt); setSaving(false); onClose(); }}
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
              style={{ background: "var(--accent)" }}>
              {saving ? "…" : (lang === "fr" ? "Prolonger" : "Extend")}
            </button>
            <button onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              {lang === "fr" ? "Annuler" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue Card Modal
// ─────────────────────────────────────────────────────────────────────────────
function IssueModal({ rooms, users, lang, onClose, onIssued }: {
  rooms: any[]; users: any[]; lang: string; onClose: () => void; onIssued: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [cardType, setCardType] = useState<CardType>("staff");
  const [roomIds, setRoomIds] = useState<string[]>([]);   // multi-room selection
  const [staffId, setStaffId] = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [zones, setZones] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState(hoursFromNow(8));
  const [cardUid, setCardUid] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const meta = TYPE_META[cardType];
  const isMaster = cardType === "master";
  const isZoneBased = isMaster || cardType === "housekeeping";
  const presets = PRESETS[cardType];

  const toggleRoom = (id: string) =>
    setRoomIds(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);

  const toggleZone = (key: string) =>
    setZones(z => z.includes(key) ? z.filter(x => x !== key) : [...z, key]);

  const handleIssue = async () => {
    if (!isMaster && roomIds.length === 0 && !isZoneBased) { setErr(l("Select at least one room", "Sélectionnez au moins une chambre")); return; }
    if (isMaster && zones.length === 0 && roomIds.length === 0) { setErr(l("Select at least one zone or room", "Sélectionnez au moins une zone ou chambre")); return; }
    setSaving(true); setErr("");
    // Combine room IDs and zones into access_zones: rooms stored as "room:ID"
    const roomZones = roomIds.map(id => `room:${id}`);
    const allZones = [...roomZones, ...zones];
    try {
      await api.issueOperationalCard({
        card_type: cardType,
        room_id: roomIds.length > 0 ? Number(roomIds[0]) : undefined,
        staff_id: staffId ? Number(staffId) : undefined,
        assigned_to_name: assignedName || undefined,
        expires_at: expiresAt,
        access_zones: allZones.length ? allZones : undefined,
        card_uid: cardUid || undefined,
        notes: notes || undefined,
      });
      onIssued();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  const l = (en: string, fr: string) => lang === "fr" ? fr : en;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,20,40,0.6)" }}>
      <div className="card w-full max-w-lg flex flex-col" style={{ padding: 0, maxHeight: "92vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{ color: "var(--muted)" }}>←</button>
            )}
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
                {step === 1 ? l("Issue Card — Type", "Émettre Carte — Type") : l("Issue Card — Configure", "Émettre Carte — Configuration")}
              </h3>
              {step === 2 && (
                <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: meta.color }}>
                  <span>{meta.icon}</span>
                  {lang === "fr" ? meta.label_fr : meta.label_en}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted)", fontSize: 20 }}>✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* Step 1: Card type selection */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-3">
              {CARD_TYPES.map(type => {
                const m = TYPE_META[type];
                return (
                  <button key={type} type="button"
                    onClick={() => { setCardType(type); setStep(2); setExpiresAt(hoursFromNow(PRESETS[type][0].hours)); setZones([]); setRoomIds([]); }}
                    className="flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left hover:shadow-md"
                    style={{ borderColor: m.color + "40", background: m.color + "08" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: m.color + "20" }}>
                      {m.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm" style={{ color: m.color }}>
                        {lang === "fr" ? m.label_fr : m.label_en}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        {type === "staff"        && l("Room access for a specific employee", "Accès chambre pour un employé spécifique")}
                        {type === "housekeeping" && l("Floor/zone access for housekeeping staff", "Accès étage/zone pour le personnel de ménage")}
                        {type === "maintenance"  && l("Temporary access for maintenance work", "Accès temporaire pour les travaux de maintenance")}
                        {type === "master"       && l("Multi-zone master access for management", "Accès maître multi-zones pour la direction")}
                        {type === "guest"        && l("Direct room access for a walk-in guest", "Accès chambre direct pour un client sans réservation")}
                      </p>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 18 }}>›</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-5">
              {err && (
                <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>
              )}

              {/* Assignment — only for non-guest types */}
              {cardType !== "guest" && (
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  {l("Assignment", "Attribution")}
                </p>
                <div>
                  <label className="field-label">{l("Staff Member", "Membre du Personnel")} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({l("optional", "optionnel")})</span></label>
                  <select value={staffId} onChange={e => { setStaffId(e.target.value); if (e.target.value) setAssignedName(""); }}
                    className="field-input">
                    <option value="">— {l("Select staff", "Choisir un employé")} —</option>
                    {users.filter(u => u.is_active).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} · {u.role}</option>
                    ))}
                  </select>
                </div>
                {!staffId && (
                  <div>
                    <label className="field-label">{l("Or enter name", "Ou saisir un nom")} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({l("optional", "optionnel")})</span></label>
                    <input value={assignedName} onChange={e => setAssignedName(e.target.value)}
                      placeholder={l("e.g. John Doe", "ex: Jean Dupont")} className="field-input" />
                  </div>
                )}
              </div>
              )}

              {/* Access */}
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  {l("Room / Zone Access", "Accès Chambre / Zone")}
                </p>

                {/* Room picker — multi-select chips for non-master */}
                {!isMaster && (
                  <div>
                    <label className="field-label flex items-center justify-between">
                      <span>
                        {l("Rooms", "Chambres")}
                        {!isZoneBased && <span className="ml-1 font-semibold" style={{ color: "#dc2626" }}>*</span>}
                      </span>
                      {roomIds.length > 0 && (
                        <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>
                          {roomIds.length} {l("selected", "sélectionnée(s)")}
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1 max-h-48 overflow-y-auto pr-1">
                      {rooms.map(r => {
                        const selected = roomIds.includes(String(r.id));
                        return (
                          <button key={r.id} type="button" onClick={() => toggleRoom(String(r.id))}
                            className="py-2 px-2 rounded-lg text-xs font-semibold border transition-all text-left"
                            style={selected
                              ? { borderColor: meta.color, background: meta.color + "18", color: meta.color }
                              : { borderColor: "var(--border)", color: "var(--muted)" }}>
                            <div className="font-bold">{r.room_number}</div>
                            <div className="text-xs font-normal opacity-70 truncate">{r.room_type}</div>
                          </button>
                        );
                      })}
                    </div>
                    {rooms.length === 0 && (
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{l("No rooms available", "Aucune chambre disponible")}</p>
                    )}
                  </div>
                )}

                {/* Zone picker — master always, HK optional */}
                {(isMaster || isZoneBased) && (
                  <div>
                    <label className="field-label">
                      {l("Access Zones", "Zones d'Accès")}
                      {isMaster && <span className="ml-1 font-semibold" style={{ color: "#dc2626" }}>*</span>}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                      {ZONES.map(z => {
                        const active = zones.includes(z.key);
                        return (
                          <button key={z.key} type="button" onClick={() => toggleZone(z.key)}
                            className="py-2 px-2 rounded-lg text-xs font-semibold border transition-all"
                            style={active
                              ? { borderColor: meta.color, background: meta.color + "18", color: meta.color }
                              : { borderColor: "var(--border)", color: "var(--muted)" }}>
                            {lang === "fr" ? z.label_fr : z.label_en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Validity */}
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                  {l("Validity", "Validité")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {presets.map(p => {
                    const active = p.hours === -1 ? isUnlimited(expiresAt) : false;
                    return (
                      <button key={p.hours} type="button"
                        onClick={() => setExpiresAt(p.hours === -1 ? UNLIMITED_DATE : hoursFromNow(p.hours))}
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold border transition-colors"
                        style={active
                          ? { borderColor: "#2f9e44", background: "#e8f5e9", color: "#2e7d32" }
                          : { borderColor: "var(--border)", color: "var(--text)" }}>
                        {lang === "fr" ? p.label_fr : p.label_en}
                      </button>
                    );
                  })}
                </div>
                {!isUnlimited(expiresAt) && (
                  <div>
                    <label className="field-label">{l("Expires at", "Expire le")} *</label>
                    <input type="datetime-local" required value={expiresAt}
                      onChange={e => setExpiresAt(e.target.value)} className="field-input" />
                  </div>
                )}
                {isUnlimited(expiresAt) && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                    <span className="font-bold text-lg">∞</span>
                    <span className="text-sm font-semibold">{l("Card never expires", "La carte n'expire jamais")}</span>
                    <button type="button" onClick={() => setExpiresAt(hoursFromNow(8))}
                      className="ml-auto text-xs underline" style={{ color: "#1b5e20" }}>
                      {l("Change", "Modifier")}
                    </button>
                  </div>
                )}
              </div>

              {/* Advanced */}
              <details className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
                <summary className="px-4 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer"
                  style={{ color: "var(--muted)" }}>
                  {l("Advanced (Physical Card / Notes)", "Avancé (Carte Physique / Notes)")}
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-3">
                  <div>
                    <label className="field-label">{l("Physical Card UID (RFID)", "UID Physique (RFID)")} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({l("auto if blank", "auto si vide")})</span></label>
                    <input value={cardUid} onChange={e => setCardUid(e.target.value)}
                      placeholder="e.g. 04:A3:5F:2B:9E:10" className="field-input font-mono" />
                  </div>
                  <div>
                    <label className="field-label">{l("Notes", "Notes")}</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder={l("Internal notes…", "Notes internes…")} className="field-input" />
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="flex gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
            <button onClick={handleIssue} disabled={saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60 transition-colors"
              style={{ background: meta.color }}>
              {saving ? l("Issuing…", "Émission…") : `${meta.icon} ${l("Issue Card", "Émettre la Carte")}`}
            </button>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm border hover:bg-gray-50 transition-colors"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              {l("Cancel", "Annuler")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function KeyCardsPage() {
  const { t, lang } = useI18n();
  const [cards, setCards] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [logsCard, setLogsCard] = useState<any | null>(null);
  const [extendCard, setExtendCard] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const [c, r, u] = await Promise.all([
        api.getOperationalCards(),
        api.getRooms(),
        api.getUsersBasic().catch(() => []),
      ]);
      setCards(c); setRooms(r); setUsers(u);
    } catch { /* backend offline */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const roomNum = (id?: number) => id ? (rooms.find(r => r.id === id)?.room_number ?? `#${id}`) : null;
  const userName = (id?: number) => {
    if (!id) return null;
    const u = users.find(u => u.id === id);
    return u ? u.full_name : `#${id}`;
  };

  const filtered = useMemo(() => cards.filter(c =>
    (filterType === "all" || c.card_type === filterType) &&
    (filterStatus === "all" || c.status === filterStatus)
  ), [cards, filterType, filterStatus]);

  // Stats per type
  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    for (const t of CARD_TYPES) s[t] = cards.filter(c => c.card_type === t && c.status === "active").length;
    s.total = cards.filter(c => c.status === "active").length;
    return s;
  }, [cards]);

  const l = (en: string, fr: string) => lang === "fr" ? fr : en;

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.key_card_management}</h2>
        <button onClick={() => setShowIssue(true)}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors flex items-center gap-2"
          style={{ background: "var(--accent)" }}>
          🔑 {l("Issue New Card", "Émettre une Carte")}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card col-span-1 text-center" style={{ padding: "14px 10px" }}>
          <div className="text-2xl font-black" style={{ color: "var(--text)" }}>{stats.total}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{l("Active", "Actives")}</div>
        </div>
        {CARD_TYPES.map(type => {
          const m = TYPE_META[type];
          return (
            <button key={type}
              onClick={() => setFilterType(filterType === type ? "all" : type)}
              className="card text-center transition-all"
              style={{
                padding: "14px 10px", cursor: "pointer",
                borderColor: filterType === type ? m.color : undefined,
                outline: filterType === type ? `2px solid ${m.color}` : undefined,
              }}>
              <div className="text-lg">{m.icon}</div>
              <div className="text-xl font-black" style={{ color: m.color }}>{stats[type]}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? m.label_fr : m.label_en}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--input-bg)" }}>
          {["all", "active", "inactive", "lost", "expired"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
              style={filterStatus === s
                ? { background: "var(--accent)", color: "#fff" }
                : { color: "var(--muted)" }}>
              {s === "all" ? l("All Status", "Tous") : s === "active" ? l("Active", "Actif") : s === "inactive" ? l("Inactive", "Inactif") : s === "lost" ? l("Lost", "Perdu") : l("Expired", "Expiré")}
            </button>
          ))}
        </div>
        {(filterType !== "all" || filterStatus !== "all") && (
          <button onClick={() => { setFilterType("all"); setFilterStatus("all"); }}
            className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            ✕ {l("Clear filters", "Effacer filtres")}
          </button>
        )}
        <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>
          {filtered.length} {l("cards", "cartes")}
        </span>
      </div>

      {/* Cards table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[
                l("Card", "Carte"),
                l("Type", "Type"),
                l("Assigned To", "Attribué à"),
                l("Room / Zone", "Chambre / Zone"),
                l("Valid Window", "Fenêtre de Validité"),
                l("Status", "Statut"),
                l("Uses", "Utilisations"),
                l("Actions", "Actions"),
              ].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-16 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <div className="text-3xl mb-2">🔑</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{t.no_cards}</p>
                </td>
              </tr>
            ) : filtered.map((c, i) => {
              const sm = STATUS_META[c.status] ?? STATUS_META.inactive;
              const assignee = c.staff_id ? userName(c.staff_id) : (c.assigned_to_name || null);
              const room = roomNum(c.room_id);
              let zonesArr: string[] = [];
              try { zonesArr = c.access_zones ? JSON.parse(c.access_zones) : []; } catch {}
              const { label: countdown, urgent } = c.status === "active"
                ? expiryCountdown(c.expires_at, lang)
                : { label: "—", urgent: false };

              return (
                <tr key={c.id} style={{
                  borderBottom: "1px solid var(--border)",
                  background: i % 2 === 0 ? "#fff" : "var(--input-bg)",
                }}>
                  {/* Card number */}
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-bold" style={{ color: "var(--text)" }}>{c.card_number}</div>
                    {c.card_uid && (
                      <div className="font-mono text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                        UID: {c.card_uid.slice(0, 12)}…
                      </div>
                    )}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <CardChip type={c.card_type} lang={lang} />
                  </td>

                  {/* Assignee */}
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--text)" }}>
                    {assignee ?? <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>

                  {/* Room / zones */}
                  <td className="px-4 py-3">
                    {room && (
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded"
                        style={{ background: "#e3f2fd", color: "#1565c0" }}>
                        {l("Room", "Ch.")} {room}
                      </span>
                    )}
                    {zonesArr.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {zonesArr.map(z => {
                          const zMeta = ZONES.find(x => x.key === z);
                          return (
                            <span key={z} className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "#f3e8ff", color: "#6d28d9" }}>
                              {zMeta ? (lang === "fr" ? zMeta.label_fr : zMeta.label_en) : z}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {!room && zonesArr.length === 0 && (
                      c.card_type === "master"
                        ? <span className="text-xs" style={{ color: "#2f9e44" }}>🔑 {l("All Access", "Accès Total")}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>

                  {/* Valid window */}
                  <td className="px-4 py-3">
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(c.valid_from).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}
                      {" → "}
                      {isUnlimited(c.expires_at)
                        ? <span style={{ color: "#2f9e44", fontWeight: 700 }}>∞ {lang === "fr" ? "Illimité" : "Unlimited"}</span>
                        : new Date(c.expires_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")
                      }
                    </div>
                    {c.status === "active" && !isUnlimited(c.expires_at) && (
                      <div className="text-xs font-bold mt-0.5"
                        style={urgent ? { color: "#dc2626" } : { color: "#059669" }}>
                        {countdown}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: sm.bg, color: sm.color }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.dot }} />
                      {c.status}
                    </span>
                  </td>

                  {/* Uses */}
                  <td className="px-4 py-3 text-center text-sm font-semibold" style={{ color: "var(--text)" }}>
                    {c.access_count}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.status === "active" && (
                        <>
                          <button onClick={() => setExtendCard(c)}
                            className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-blue-50"
                            style={{ borderColor: "#93c5fd", color: "#1565c0" }}>
                            {l("Extend", "Prolonger")}
                          </button>
                          <button onClick={() => api.revokeCard(c.id).then(load)}
                            className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-gray-50"
                            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                            {l("Deactivate", "Désactiver")}
                          </button>
                          <button onClick={() => api.reportLost(c.id).then(load)}
                            className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-red-50"
                            style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                            {l("Lost", "Perdue")}
                          </button>
                        </>
                      )}
                      {(c.status === "inactive" || c.status === "expired") && (
                        <button onClick={() => setExtendCard(c)}
                          className="text-xs px-2 py-1 rounded-lg border transition-colors hover:bg-green-50"
                          style={{ borderColor: "#6ee7b7", color: "#059669" }}>
                          {l("Reactivate", "Réactiver")}
                        </button>
                      )}
                      <button onClick={() => setLogsCard(c)}
                        className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-gray-50"
                        style={{ color: "var(--muted)", border: "1px solid var(--border)" }}>
                        {t.logs}
                      </button>
                    </div>
                    {c.notes && (
                      <div className="text-xs mt-1 truncate max-w-[200px]" style={{ color: "var(--muted)" }}
                        title={c.notes}>
                        📝 {c.notes}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showIssue && (
        <IssueModal rooms={rooms} users={users} lang={lang}
          onClose={() => setShowIssue(false)} onIssued={load} />
      )}
      {logsCard && (
        <LogsModal cardId={logsCard.id} cardNumber={logsCard.card_number} onClose={() => setLogsCard(null)} />
      )}
      {extendCard && (
        <ExtendModal card={extendCard} lang={lang}
          onClose={() => setExtendCard(null)}
          onSave={async (dt) => { await api.extendCard(extendCard.id, dt); load(); }} />
      )}
    </div>
  );
}
