"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const SERVICE_TYPES = [
  { key: "laundry",  icon: "👕", en: "Laundry",       fr: "Blanchisserie" },
  { key: "spa",      icon: "💆", en: "Spa",            fr: "Spa" },
  { key: "transfer", icon: "🚌", en: "Airport Transfer",fr: "Transfert aéroport" },
  { key: "minibar",  icon: "🍸", en: "Mini Bar",       fr: "Mini Bar" },
  { key: "phone",    icon: "📞", en: "Phone",          fr: "Téléphone" },
  { key: "gym",      icon: "🏋️", en: "Gym",            fr: "Gym" },
  { key: "parking",  icon: "🅿️", en: "Parking",        fr: "Parking" },
  { key: "other",    icon: "💰", en: "Other",          fr: "Autre" },
];

export default function ServicePage() {
  const { t, lang } = useI18n();
  const [checkedIn, setCheckedIn] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [particulars, setParticulars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reservationId, setReservationId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [particularId, setParticularId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.getReservations("status=checked_in"),
      api.getGuests(),
      api.getRooms(),
      api.getFolioParticulars(),
    ]).then(([res, g, r, p]) => {
      setCheckedIn(res); setGuests(g); setRooms(r); setParticulars(p);
    }).finally(() => setLoading(false));
  }, []);

  const guestName = (gId: number) => {
    const g = guests.find(g => g.id === gId);
    return g ? `${g.first_name} ${g.last_name}` : `#${gId}`;
  };
  const roomNum = (rId: number) => rooms.find(r => r.id === rId)?.room_number || `#${rId}`;

  const selectedSvc = SERVICE_TYPES.find(s => s.key === serviceType);
  const selectedRes = checkedIn.find(r => r.id === Number(reservationId));

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationId || !serviceType || !amount) return;
    setPosting(true); setSuccess(""); setError("");
    try {
      const particular = particulars.find(p =>
        p.name_en.toLowerCase().includes(serviceType) ||
        p.name_en.toLowerCase() === selectedSvc?.en.toLowerCase()
      );
      const res = checkedIn.find(r => r.id === Number(reservationId));
      const room = rooms.find(r => r.id === res?.room_id);
      await api.addCharge({
        reservation_id: Number(reservationId),
        date: new Date().toISOString().slice(0, 10),
        room_number: room?.room_number,
        particular: particular?.name_en || selectedSvc?.en || "Service Charge",
        charge_type: "service",
        amount: Number(amount),
        description: description || (lang === "fr" ? selectedSvc?.fr : selectedSvc?.en),
      });
      setSuccess(t.fo_service_posted);
      const folio = await api.getFolio(Number(reservationId));
      const today = new Date().toISOString().slice(0, 10);
      setHistory(folio.filter((c: any) =>
        c.created_at?.startsWith(today) && c.charge_type === "service"
      ));
      setAmount(""); setDescription(""); setServiceType("");
    } catch (e: any) {
      setError(e?.message || (lang === "fr" ? "Erreur lors de l'enregistrement." : "Failed to post service charge."));
    } finally { setPosting(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">{t.fo_service_title}</h2>
        <p className="page-subtitle">{t.fo_service_desc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse h-10 rounded-lg" style={{ background: "var(--input-bg)" }} />
              ))}
            </div>
          ) : checkedIn.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏨</div>
              <p className="font-semibold" style={{ color: "var(--text)" }}>{t.fo_no_guests_in}</p>
            </div>
          ) : (
            <form onSubmit={handlePost} className="space-y-4">
              <div>
                <label className="field-label">{t.fo_select_guest_room} *</label>
                <select value={reservationId} onChange={e => setReservationId(e.target.value)}
                  className="field-input" required>
                  <option value="">{lang === "fr" ? "— Sélectionner un client —" : "— Select a guest —"}</option>
                  {checkedIn.map(res => (
                    <option key={res.id} value={res.id}>
                      {roomNum(res.room_id)} — {guestName(res.guest_id)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRes && (
                <div className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "#e0f2fe", border: "1px solid #7dd3fc" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: "#0891b2" }}>
                    {guestName(selectedRes.guest_id).split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#075985" }}>{guestName(selectedRes.guest_id)}</p>
                    <p className="text-xs" style={{ color: "#0891b2" }}>
                      {lang === "fr" ? "Chambre" : "Room"} {roomNum(selectedRes.room_id)}
                    </p>
                  </div>
                </div>
              )}

              {/* Service type grid */}
              <div>
                <label className="field-label">{lang === "fr" ? "Type de service *" : "Service Type *"}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SERVICE_TYPES.map(s => (
                    <button key={s.key} type="button"
                      onClick={() => setServiceType(s.key)}
                      className="p-2 rounded-xl flex flex-col items-center gap-1 transition-all border"
                      style={serviceType === s.key
                        ? { background: "#3b5bdb", borderColor: "#3b5bdb", color: "#fff" }
                        : { background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}>
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xs font-semibold">{lang === "fr" ? s.fr : s.en}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">{lang === "fr" ? "Montant (FCFA) *" : "Amount (FCFA) *"}</label>
                <input type="number" min="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="field-input" placeholder="2500" required />
              </div>

              <div>
                <label className="field-label">{lang === "fr" ? "Description (optionnel)" : "Description (optional)"}</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="field-input"
                  placeholder={lang === "fr" ? "Précisions…" : "Details…"} />
              </div>

              {success && (
                <div className="p-3 rounded-xl text-sm font-semibold" style={{ background: "#dcfce7", color: "#059669" }}>
                  ✅ {success}
                </div>
              )}
              {error && (
                <div className="p-3 rounded-xl text-sm font-semibold" style={{ background: "#fce4ec", color: "#dc2626" }}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit"
                disabled={posting || !reservationId || !serviceType || !amount}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)", boxShadow: "0 4px 14px rgba(8,145,178,0.25)" }}>
                {posting ? t.loading : `🔔 ${t.fo_post_charge_btn}`}
              </button>
            </form>
          )}
        </div>

        {/* Today's service log */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            {t.fo_recent_charges}
          </h3>
          {history.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-2">🔔</div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Aucun service enregistré aujourd'hui." : "No service charges posted today."}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden" style={{ padding: 0 }}>
              {history.map((c, i) => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3"
                  style={{ borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none",
                    background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "#e0f2fe" }}>
                    <span className="text-sm">🔔</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{c.description}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(c.created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US",
                        { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className="font-black text-sm" style={{ color: "#0891b2" }}>{fmt(Number(c.amount))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
