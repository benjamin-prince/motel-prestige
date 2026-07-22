"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

export default function OutletPage() {
  const { t, lang } = useI18n();
  const [checkedIn, setCheckedIn] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [particulars, setParticulars] = useState<any[]>([]);
  const [recentCharges, setRecentCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reservationId, setReservationId] = useState("");
  const [particularId, setParticularId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

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

  const guestName = (guestId: number) => {
    const g = guests.find(g => g.id === guestId);
    return g ? `${g.first_name} ${g.last_name}` : `#${guestId}`;
  };
  const roomNum = (roomId: number) => rooms.find(r => r.id === roomId)?.room_number || `#${roomId}`;

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationId || !particularId || !amount) return;
    setPosting(true); setSuccess(""); setError("");
    try {
      const particular = particulars.find(p => p.id === Number(particularId));
      const res = checkedIn.find(r => r.id === Number(reservationId));
      const room = rooms.find(r => r.id === res?.room_id);
      await api.addCharge({
        reservation_id: Number(reservationId),
        date: new Date().toISOString().slice(0, 10),
        room_number: room?.room_number,
        particular: particular?.name_en || "Outlet Charge",
        charge_type: "outlet",
        amount: Number(amount),
        description: description || (lang === "fr" ? particular?.name_fr : particular?.name_en),
      });
      setSuccess(t.fo_charge_posted);
      // Reload folio for this reservation to show in recent
      const folio = await api.getFolio(Number(reservationId));
      const today = new Date().toISOString().slice(0, 10);
      setRecentCharges(folio.filter((c: any) =>
        c.created_at?.startsWith(today) && c.charge_type === "outlet"
      ));
      setAmount(""); setDescription("");
    } catch (e: any) {
      setError(e?.message || (lang === "fr" ? "Erreur lors de l'enregistrement du poste." : "Failed to post charge."));
    } finally { setPosting(false); }
  };

  const selectedRes = checkedIn.find(r => r.id === Number(reservationId));

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">{t.fo_outlet_title}</h2>
        <p className="page-subtitle">{t.fo_outlet_desc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posting form */}
        <div className="card p-6">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse h-10 rounded-lg" style={{ background: "var(--input-bg)" }} />)}
            </div>
          ) : checkedIn.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🏨</div>
              <p className="font-semibold" style={{ color: "var(--text)" }}>{t.fo_no_guests_in}</p>
            </div>
          ) : (
            <form onSubmit={handlePost} className="space-y-4">
              {/* Guest / Room selector */}
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
                  style={{ background: "#ede9fe", border: "1px solid #c4b5fd" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: "#7c3aed" }}>
                    {guestName(selectedRes.guest_id).split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#3b0764" }}>{guestName(selectedRes.guest_id)}</p>
                    <p className="text-xs" style={{ color: "#7c3aed" }}>
                      {lang === "fr" ? "Chambre" : "Room"} {roomNum(selectedRes.room_id)} · {selectedRes.reservation_number}
                    </p>
                  </div>
                </div>
              )}

              {/* Charge type */}
              <div>
                <label className="field-label">{lang === "fr" ? "Type de charge *" : "Charge Type *"}</label>
                <select value={particularId} onChange={e => setParticularId(e.target.value)}
                  className="field-input" required>
                  <option value="">{lang === "fr" ? "— Sélectionner —" : "— Select —"}</option>
                  {particulars.map(p => (
                    <option key={p.id} value={p.id}>
                      {lang === "fr" ? p.name_fr : p.name_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div>
                <label className="field-label">{lang === "fr" ? "Montant (FCFA) *" : "Amount (FCFA) *"}</label>
                <input type="number" min="1" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="field-input" placeholder="5000" required />
              </div>

              {/* Description */}
              <div>
                <label className="field-label">{lang === "fr" ? "Description (optionnel)" : "Description (optional)"}</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="field-input"
                  placeholder={lang === "fr" ? "Détails de la charge…" : "Charge details…"} />
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

              <button type="submit" disabled={posting || !reservationId || !particularId || !amount}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
                {posting ? t.loading : `💳 ${t.fo_post_charge_btn}`}
              </button>
            </form>
          )}
        </div>

        {/* Recent charges */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            {t.fo_recent_charges}
          </h3>
          {recentCharges.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Aucun poste enregistré aujourd'hui." : "No charges posted today."}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden" style={{ padding: 0 }}>
              {recentCharges.map((c, i) => (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3"
                  style={{ borderBottom: i < recentCharges.length - 1 ? "1px solid var(--border)" : "none",
                    background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "#ede9fe" }}>
                    <span className="text-sm">💳</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{c.description}</p>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(c.created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <p className="font-black text-sm" style={{ color: "var(--blue)" }}>{fmt(Number(c.amount))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
