"use client";
import { useEffect, useState, useRef, Fragment, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Reservation, Guest, Room } from "@/lib/types";
import { ConfirmDialog, SearchInput } from "@/components/ui";
import GuestProfileModal from "@/components/GuestProfileModal";
import { useProperty, parseFacilities, getFloors } from "@/lib/property-context";

// HotelPro semantic palette — theme-aware via CSS variables
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  confirmed:   { bg: "var(--info-bg)", color: "var(--info)" },
  checked_in:  { bg: "var(--good-bg)", color: "var(--good)" },
  checked_out: { bg: "var(--input-bg)", color: "var(--muted)" },
  cancelled:   { bg: "var(--bad-bg)", color: "var(--bad)" },
  no_show:     { bg: "var(--warn-bg)", color: "var(--warn)" },
};

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label} :</label>
      {children}
    </div>
  );
}

// ── Reservation Form ──────────────────────────────────────────────────────────
function ReservationForm({
  guests, rooms, onSave, onCancel, initialRoomId,
}: {
  guests: Guest[]; rooms: Room[];
  onSave: (data: any) => void;
  onCancel: () => void;
  initialRoomId?: string;
}) {
  const { t, lang } = useI18n();
  const [lookups, setLookups] = useState<Record<string, any[]>>({});

  useEffect(() => {
    api.getAllLookups().then(all => {
      const grouped: Record<string, any[]> = {};
      for (const item of all) {
        if (!grouped[item.group]) grouped[item.group] = [];
        grouped[item.group].push(item);
      }
      setLookups(grouped);
    }).catch(() => {});
  }, []);

  const opts = (group: string) =>
    (lookups[group] || []).map((v: any) => ({
      value: v.value_en,
      label: lang === "fr" ? v.value_fr : v.value_en,
    }));

  // Arriving from a room card ("Book this room"): preselect the room and
  // default to a tonight-to-tomorrow stay so check-in can happen right away.
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    guest_id: "",
    room_id: initialRoomId || "",
    rate_plan: "OS",      // OS = overnight (nuitée), SS = Short Stay (2h)
    ss_time: "",          // Short Stay start time, e.g. "14:00"
    checkin_time: "18:00",// Nuitée declared arrival time — occupancy starts here
    check_in_date: initialRoomId ? today : "",
    check_out_date: initialRoomId ? tomorrow : "",
    adults: 1, children: 0, infants: 0, extra_bed: 0,
    guest_type: "FIT", resev_type: "Confirm Reservation",
    arrival_mode: "By Air", arrival_flight: "",
    payment_type: "Cash", payment_method: "Cash",
    advance_amount: "", bill_to: "Guest", special_requests: "",
  });
  const set = (key: string) => (v: string | number) => setForm(f => ({ ...f, [key]: v }));

  // ── Wizard state: one focused step at a time ────────────────────────────────
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1); // furthest step reached (stepper clicks)
  const [stepError, setStepError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [instructions, setInstructions] = useState<{ dept: string; desc: string }[]>([]);
  const [newInst, setNewInst] = useState({ dept: "HK", desc: "" });

  // Walk-in guests: create a guest inline without leaving the reservation form.
  // Kept as a div (not <form>) — nesting forms inside the reservation form is invalid HTML.
  const [guestList, setGuestList] = useState<Guest[]>(guests);
  useEffect(() => setGuestList(guests), [guests]);
  const EMPTY_NEW_GUEST = { first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", id_type: "", id_number: "" };
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuest, setNewGuest] = useState(EMPTY_NEW_GUEST);
  const [newGuestError, setNewGuestError] = useState("");
  const [newGuestSaving, setNewGuestSaving] = useState(false);

  const handleCreateGuest = async () => {
    // Booking policy: only adults (18+) with a valid ID can book — collect
    // DOB and ID up front so the walk-in can proceed without a detour.
    if (!newGuest.first_name.trim() || !newGuest.last_name.trim() || !newGuest.email.trim()
        || !newGuest.date_of_birth || !newGuest.id_type || !newGuest.id_number.trim()) {
      setNewGuestError(t.required_field);
      return;
    }
    const dob = new Date(newGuest.date_of_birth + "T00:00:00");
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
    if (age < 18) {
      setNewGuestError(t.guest_must_be_adult);
      return;
    }
    setNewGuestSaving(true);
    setNewGuestError("");
    try {
      const g = await api.createGuest({
        first_name: newGuest.first_name.trim(),
        last_name: newGuest.last_name.trim(),
        email: newGuest.email.trim(),
        phone: newGuest.phone.trim() || undefined,
        date_of_birth: newGuest.date_of_birth,
        id_type: newGuest.id_type,
        id_number: newGuest.id_number.trim(),
      });
      setGuestList(list => [...list, g]);
      setForm(f => ({ ...f, guest_id: String(g.id) }));
      setShowNewGuest(false);
      setNewGuest(EMPTY_NEW_GUEST);
      setGuestOpen(false);
    } catch (e: any) {
      setNewGuestError(e.message || "Failed");
    } finally {
      setNewGuestSaving(false);
    }
  };

  // ── Searchable guest picker (type to filter) ────────────────────────────────
  const [profileGuest, setProfileGuest] = useState<Guest | null>(null);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);
  const guestBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (guestBoxRef.current && !guestBoxRef.current.contains(e.target as Node)) setGuestOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const guestMatches = guestList.filter(g => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return true;
    return `${g.first_name} ${g.last_name}`.toLowerCase().includes(q)
      || (g.email || "").toLowerCase().includes(q)
      || (g.phone || "").includes(q);
  }).slice(0, 8);

  const selectedRoom = rooms.find(r => r.id === Number(form.room_id));
  const nights = form.check_in_date && form.check_out_date
    ? Math.max(0, (new Date(form.check_out_date).getTime() - new Date(form.check_in_date).getTime()) / 86400000)
    : 0;

  // Short Stay (2h): the stay window is start time + 2 hours, same day.
  const isShortStay = form.rate_plan === "SS";
  const ssStart = isShortStay && form.check_in_date && form.ss_time
    ? `${form.check_in_date}T${form.ss_time}` : "";
  // Nuitée: occupancy starts at the declared arrival time, so a room that
  // frees up earlier that day (e.g. after a 2h stay) can still be booked.
  const osStart = !isShortStay && form.check_in_date && form.checkin_time
    ? `${form.check_in_date}T${form.checkin_time}` : "";
  const ssEnd = (() => {
    if (!ssStart) return "";
    const d = new Date(ssStart);
    d.setHours(d.getHours() + 2);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  })();

  // Availability drives the wizard: it opens on the stay step so a booking
  // can only proceed on a room that is actually free for that stay.
  // null = stay not fully chosen yet (room picker shows a hint instead).
  const [availRooms, setAvailRooms] = useState<Room[] | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  useEffect(() => {
    const ready = isShortStay
      ? Boolean(ssStart)
      : Boolean(form.check_in_date && form.check_out_date && form.check_out_date > form.check_in_date);
    if (!ready) {
      setAvailRooms(null);
      return;
    }
    let cancelled = false;
    setAvailLoading(true);
    (isShortStay
      ? api.getAvailableRooms(form.check_in_date, form.check_in_date, ssStart, ssEnd)
      : api.getAvailableRooms(form.check_in_date, form.check_out_date, osStart || undefined))
      .then(r => { if (!cancelled) setAvailRooms(r); })
      .catch(() => { if (!cancelled) setAvailRooms([]); })
      .finally(() => { if (!cancelled) setAvailLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.check_in_date, form.check_out_date, form.rate_plan, form.ss_time, form.checkin_time]);

  // Changing dates can invalidate an earlier room choice — drop it silently.
  useEffect(() => {
    if (availRooms && form.room_id && !availRooms.some(r => String(r.id) === form.room_id)) {
      setForm(f => ({ ...f, room_id: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availRooms]);
  const roomCharges = isShortStay
    ? Number(selectedRoom?.price_short_stay || 0)
    : nights * (selectedRoom ? Number(selectedRoom.price_per_night) : 0);
  const advance = Number(form.advance_amount) || 0;
  const balanceTotal = Math.max(0, roomCharges - advance);
  const selectedGuest = guestList.find(g => g.id === Number(form.guest_id));

  const pickGuest = (g: Guest) => {
    setForm(f => ({ ...f, guest_id: String(g.id) }));
    setGuestOpen(false);
    setGuestQuery("");
    setStepError("");
  };

  // Booking policy: only adults (18+) with a valid, unexpired ID can book.
  // Mirrors the backend check so the operator is told at step 1, not at save.
  const guestEligibility = (g?: Guest): string => {
    if (!g) return t.select_guest;
    if (!g.date_of_birth) return t.guest_dob_required;
    const dob = new Date(g.date_of_birth + "T00:00:00");
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
    if (age < 18) return t.guest_must_be_adult;
    if (!g.id_type || !g.id_number) return t.guest_id_required;
    if (g.id_expiry_date && g.id_expiry_date < today) return t.guest_id_expired;
    return "";
  };
  const eligibilityError = guestEligibility(selectedGuest);

  // ── Step validation: catch problems where they happen ──────────────────────
  // Step 1 is the stay: no free room for the dates → no reservation, period.
  const validateStep = (s: number): string => {
    if (s === 1) {
      if (isShortStay) {
        if (!form.check_in_date || !form.ss_time) return t.required_field;
      } else {
        if (!form.check_in_date || !form.check_out_date) return t.required_field;
        if (nights <= 0) return t.invalid_dates;
      }
      if (availRooms && availRooms.length === 0) return t.no_rooms_available;
      if (!form.room_id) return t.select_room;
    }
    if (s === 2) return guestEligibility(selectedGuest);
    return "";
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { setStepError(err); return; }
    setStepError("");
    setStep(s => Math.min(4, s + 1));
    setMaxStep(m => Math.max(m, step + 1));
  };
  const back = () => { setStepError(""); setStep(s => Math.max(1, s - 1)); };

  // Called only from the explicit Save button on the review step. The form's
  // onSubmit is blocked entirely: when "Next" re-renders into "Save" mid-click,
  // the browser would otherwise treat that same click as a submit.
  const submitNow = async () => {
    for (const s of [1, 2]) {
      const err = validateStep(s);
      if (err) { setStep(s); setStepError(err); return; }
    }
    setSubmitting(true);
    setStepError("");
    try {
      const { ss_time, checkin_time, ...payload } = form;
      await onSave({
        ...payload,
        guest_id: Number(form.guest_id), room_id: Number(form.room_id),
        adults: Number(form.adults), children: Number(form.children),
        infants: Number(form.infants), extra_bed: Number(form.extra_bed),
        advance_amount: advance,
        // A 2h stay starts and ends the same day on a precise time window;
        // a nuitée carries its declared arrival time as the occupancy start.
        ...(isShortStay
          ? { check_out_date: form.check_in_date, stay_starts_at: ssStart, stay_ends_at: ssEnd }
          : { stay_starts_at: osStart || undefined }),
        special_instructions: instructions.map(i => ({ department: i.dept, description: i.desc })),
      });
    } catch (err: any) {
      const msg = err.message || "Failed";
      // Room got taken between picking it and saving — send the operator
      // back to the stay step with a bilingual explanation.
      if (msg.includes("not available") || msg.includes("under maintenance")) {
        setStep(1);
        setStepError(t.room_taken);
      } else {
        setStepError(msg);
      }
      setSubmitting(false);
    }
  };

  const STEPS = [
    { n: 1, label: t.stay_information },
    { n: 2, label: t.guest_information },
    { n: 3, label: t.step_payment },
    { n: 4, label: t.summary },
  ];

  const fmtDate = (d: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

  // Review-step row
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-1.5 text-sm">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="font-medium text-right" style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(30,37,50,0.45)", animation: "backdrop-in 0.15s ease" }}>
      <form onSubmit={e => e.preventDefault()} className="card w-full max-w-2xl max-h-[92vh] flex flex-col"
        style={{ padding: 0, animation: "modal-in 0.18s ease" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>{t.new_reservation}</span>
          <div className="flex items-center gap-3">
            <span className="badge" style={{ background: "#fff3e0", color: "#e67e22" }}>{t.confirmed}</span>
            <button type="button" onClick={onCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: "var(--muted)", fontSize: 16 }}>✕</button>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          {STEPS.map((s, i) => {
            const done = step > s.n;
            const current = step === s.n;
            return (
              <Fragment key={s.n}>
                {i > 0 && (
                  <div className="flex-1 h-0.5 mx-2 rounded"
                    style={{ background: step > STEPS[i - 1].n ? "#10b981" : "var(--border)" }} />
                )}
                <button type="button" disabled={s.n > maxStep}
                  onClick={() => { setStepError(""); setStep(s.n); }}
                  className="flex items-center gap-2 shrink-0 disabled:cursor-not-allowed">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                    style={done
                      ? { background: "#10b981", color: "#fff" }
                      : current
                        ? { background: "var(--blue)", color: "#fff", boxShadow: "0 0 0 4px var(--blue-light)" }
                        : { background: "var(--input-bg)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                    {done ? "✓" : s.n}
                  </span>
                  <span className="text-xs font-semibold"
                    style={{ color: current ? "var(--blue)" : done ? "#10b981" : "var(--muted)" }}>
                    {s.label}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 340 }}>
          {stepError && (
            <div className="rounded-lg px-4 py-2.5 text-sm mb-4" style={{ background: "#fce4ec", color: "#b71c1c" }}>
              {stepError}
            </div>
          )}

          {/* ── Step 2: Guest ── */}
          {step === 2 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div ref={guestBoxRef} className="relative">
                <label className="field-label">{t.guest_col} :</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--muted)" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={guestOpen ? guestQuery : (selectedGuest ? `${selectedGuest.first_name} ${selectedGuest.last_name}` : guestQuery)}
                    onFocus={() => { setGuestOpen(true); setGuestQuery(""); }}
                    onChange={e => { setGuestQuery(e.target.value); setGuestOpen(true); }}
                    placeholder={t.search_guest}
                    className="field-input pl-9"
                  />
                </div>
                {guestOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl z-20 overflow-hidden"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="max-h-56 overflow-y-auto">
                      {guestMatches.length === 0 ? (
                        <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                          {t.cmd_no_results} “{guestQuery}”
                        </div>
                      ) : guestMatches.map(g => (
                        <button key={g.id} type="button" onMouseDown={() => pickGuest(g)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-gray-50">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: "#7c3aed" }}>
                            {g.first_name[0]}{g.last_name[0]}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                              {g.first_name} {g.last_name}
                            </span>
                            <span className="block text-xs truncate" style={{ color: "var(--muted)" }}>
                              {g.email}{g.phone ? ` · ${g.phone}` : ""}
                            </span>
                          </span>
                          {form.guest_id === String(g.id) && (
                            <svg className="w-4 h-4 ml-auto shrink-0" style={{ color: "var(--blue)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                    <button type="button"
                      onMouseDown={() => { setShowNewGuest(true); setGuestOpen(false); setNewGuestError(""); }}
                      className="w-full px-4 py-2.5 text-left text-sm font-semibold border-t transition-colors hover:bg-gray-50"
                      style={{ color: "var(--blue)", borderColor: "var(--border)" }}>
                      + {t.new_guest}
                    </button>
                  </div>
                )}
              </div>

              {/* Walk-in: create the guest without leaving this form */}
              {showNewGuest && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ border: "1px solid var(--blue)", background: "var(--blue-light)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "var(--blue)" }}>+ {t.new_guest}</span>
                    <button type="button" onClick={() => setShowNewGuest(false)}
                      style={{ color: "var(--muted)", fontSize: 14 }}>✕</button>
                  </div>
                  {newGuestError && (
                    <div className="rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "#fce4ec", color: "#b71c1c" }}>
                      {newGuestError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newGuest.first_name} placeholder={`${t.first_name} *`}
                      onChange={e => setNewGuest(g => ({ ...g, first_name: e.target.value }))} className="field-input" />
                    <input value={newGuest.last_name} placeholder={`${t.last_name} *`}
                      onChange={e => setNewGuest(g => ({ ...g, last_name: e.target.value }))} className="field-input" />
                  </div>
                  <input type="email" value={newGuest.email} placeholder={`${t.email} *`}
                    onChange={e => setNewGuest(g => ({ ...g, email: e.target.value }))} className="field-input" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={newGuest.phone} placeholder={t.phone}
                      onChange={e => setNewGuest(g => ({ ...g, phone: e.target.value }))} className="field-input" />
                    <div>
                      <input type="date" value={newGuest.date_of_birth} title={`${t.dob} *`}
                        max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0, 10)}
                        onChange={e => setNewGuest(g => ({ ...g, date_of_birth: e.target.value }))} className="field-input" />
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>{t.dob} * — 18+</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newGuest.id_type}
                      onChange={e => setNewGuest(g => ({ ...g, id_type: e.target.value }))} className="field-input">
                      <option value="">{t.id_type} *</option>
                      {opts("id_type").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input value={newGuest.id_number} placeholder={`${t.id_number} *`}
                      onChange={e => setNewGuest(g => ({ ...g, id_number: e.target.value }))} className="field-input" />
                  </div>
                  <button type="button" onClick={handleCreateGuest} disabled={newGuestSaving}
                    className="w-full py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60 transition-colors"
                    style={{ background: "var(--blue)" }}>
                    {newGuestSaving ? t.loading : t.save}
                  </button>
                </div>
              )}

              {/* Selected guest preview — click to view/update the full profile */}
              {selectedGuest && !showNewGuest && (
                <button type="button" onClick={() => setProfileGuest(selectedGuest)}
                  title={t.guest_profile}
                  className="w-full rounded-xl p-4 flex items-start gap-3 text-left transition-colors hover:bg-blue-50"
                  style={eligibilityError
                    ? { background: "#fff7f7", border: "1px solid #f5b5b5" }
                    : { background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                  <span className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ background: "#7c3aed" }}>
                    {selectedGuest.first_name[0]}{selectedGuest.last_name[0]}
                  </span>
                  <span className="min-w-0 text-sm flex-1">
                    <span className="block font-bold" style={{ color: "var(--text)" }}>
                      {selectedGuest.first_name} {selectedGuest.last_name}
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                      {selectedGuest.email}
                      {selectedGuest.phone ? ` · ${selectedGuest.phone}` : ""}
                      {(selectedGuest.id_type || selectedGuest.id_number)
                        ? ` · ${selectedGuest.id_type || t.id_type} ${selectedGuest.id_number || ""}`
                        : ""}
                    </span>
                    {eligibilityError && (
                      <span className="block text-xs font-semibold mt-1.5" style={{ color: "#c0392b" }}>
                        ⚠ {eligibilityError}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-semibold shrink-0" style={{ color: "var(--blue)" }}>
                    {t.guest_profile} →
                  </span>
                </button>
              )}

              <Field label={t.guest_category}>
                <select value={form.guest_type} onChange={e => set("guest_type")(e.target.value)} className="field-input">
                  {opts("guest_type").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          )}

          {/* ── Step 1: Stay — pick the stay type and dates first, then a room
                 that is actually free for that window ── */}
          {step === 1 && (
            <div className="space-y-4 max-w-md mx-auto">
              {/* Stay type: overnight (nuitée) or 2h short stay */}
              <div className="grid grid-cols-2 gap-2">
                {([["OS", `🌙 ${t.overnight_stay}`], ["SS", `⏱️ ${t.short_stay_2h}`]] as [string, string][]).map(([plan, label]) => (
                  <button key={plan} type="button"
                    onClick={() => { setStepError(""); setForm(f => ({ ...f, rate_plan: plan, room_id: "" })); }}
                    className="py-2.5 rounded-xl text-sm font-bold border transition-all"
                    style={form.rate_plan === plan
                      ? { background: "var(--blue-light)", borderColor: "var(--blue)", color: "var(--blue)" }
                      : { borderColor: "var(--border)", color: "var(--muted)" }}>
                    {label}
                  </button>
                ))}
              </div>

              {isShortStay ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.ss_date}>
                    <input type="date" value={form.check_in_date} onChange={e => set("check_in_date")(e.target.value)} className="field-input" />
                  </Field>
                  <Field label={t.ss_start_time}>
                    <input type="time" value={form.ss_time} onChange={e => set("ss_time")(e.target.value)} className="field-input" />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label={t.check_in}>
                    <input type="date" value={form.check_in_date} onChange={e => set("check_in_date")(e.target.value)} className="field-input" />
                  </Field>
                  <Field label={t.arrival_time}>
                    <input type="time" value={form.checkin_time} onChange={e => set("checkin_time")(e.target.value)} className="field-input" />
                  </Field>
                  <Field label={t.check_out}>
                    <input type="date" value={form.check_out_date} onChange={e => set("check_out_date")(e.target.value)} className="field-input" />
                  </Field>
                </div>
              )}
              {isShortStay && ssStart && (
                <div className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-block"
                  style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                  {t.ss_window}: {form.ss_time} → {ssEnd.slice(11, 16)} ({t.per_2h})
                </div>
              )}
              {!isShortStay && nights > 0 && (
                <div className="text-xs font-semibold px-3 py-1.5 rounded-lg inline-block"
                  style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                  {nights} {t.nights}
                </div>
              )}
              <Field label={t.room_col}>
                {!availRooms ? (
                  <p className="text-xs px-3 py-2.5 rounded-lg" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>
                    {isShortStay ? t.pick_slot_first : t.pick_dates_first}
                  </p>
                ) : availLoading ? (
                  <p className="text-xs px-3 py-2.5" style={{ color: "var(--muted)" }}>{t.loading}</p>
                ) : availRooms.length === 0 ? (
                  <div className="rounded-lg px-4 py-3 text-sm font-semibold" style={{ background: "#fce4ec", color: "#b71c1c" }}>
                    🚫 {t.no_rooms_available}
                  </div>
                ) : (
                  <>
                    <select value={form.room_id} onChange={e => set("room_id")(e.target.value)} className="field-input">
                      <option value="">{t.select_room}</option>
                      {availRooms.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.room_number} — {r.room_type} ({Number(isShortStay ? r.price_short_stay : r.price_per_night).toLocaleString("fr-FR")} FCFA/{isShortStay ? t.per_2h : t.nights})
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] font-semibold mt-1 inline-block" style={{ color: "#059669" }}>
                      ✓ {t.rooms_available_count.replace("{count}", String(availRooms.length))}
                    </span>
                  </>
                )}
              </Field>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([[t.adults, "adults"], [t.children, "children"], [t.infants, "infants"], [t.extra_bed, "extra_bed"]] as [string, string][]).map(([l, k]) => (
                  <Field key={k} label={l}>
                    <input type="number" min={0} value={(form as any)[k]} onChange={e => set(k)(e.target.value)} className="field-input" />
                  </Field>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.arrival_mode}>
                  <select value={form.arrival_mode} onChange={e => set("arrival_mode")(e.target.value)} className="field-input">
                    {opts("arrival_mode").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label={t.arrival_flight}>
                  <input value={form.arrival_flight} onChange={e => set("arrival_flight")(e.target.value)} className="field-input" placeholder="F-08" />
                </Field>
              </div>
              <Field label={t.resev_type}>
                <select value={form.resev_type} onChange={e => set("resev_type")(e.target.value)} className="field-input">
                  {opts("resev_type").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
          )}

          {/* ── Step 3: Payment & instructions ── */}
          {step === 3 && (
            <div className="space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.bill_to}>
                  <select value={form.bill_to} onChange={e => set("bill_to")(e.target.value)} className="field-input">
                    {opts("bill_to").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label={t.payment_method}>
                  <select value={form.payment_method} onChange={e => set("payment_method")(e.target.value)} className="field-input">
                    {opts("payment_method").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={`${t.advance_amount} (FCFA)`}>
                <input type="number" min={0} value={form.advance_amount}
                  onChange={e => set("advance_amount")(e.target.value)} className="field-input" placeholder="0" />
              </Field>

              <div className="rounded-xl p-4" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{t.special_instruction}</span>
                </div>
                <div className="flex gap-2 mb-2">
                  <select value={newInst.dept} onChange={e => setNewInst(i => ({ ...i, dept: e.target.value }))}
                    className="field-input" style={{ width: 90 }}>
                    {opts("department").map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={newInst.desc} onChange={e => setNewInst(i => ({ ...i, desc: e.target.value }))}
                    className="field-input flex-1" placeholder={t.description} />
                  <button type="button"
                    onClick={() => { if (newInst.desc) { setInstructions(i => [...i, newInst]); setNewInst({ dept: "HK", desc: "" }); } }}
                    className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold hover:bg-blue-700 shrink-0">
                    +
                  </button>
                </div>
                {instructions.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: "var(--muted)" }}>{t.no_instructions}</p>
                ) : instructions.map((inst, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1.5 border-t text-xs" style={{ borderColor: "var(--border)" }}>
                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>{inst.dept}</span>
                    <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{inst.desc}</span>
                    <button type="button" onClick={() => setInstructions(x => x.filter((_, j) => j !== idx))}
                      className="text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div className="space-y-3 max-w-md mx-auto">
              {([
                {
                  title: t.stay_information, target: 1,
                  rows: [
                    [t.room_col, selectedRoom ? `${selectedRoom.room_number} — ${selectedRoom.room_type}` : "—"],
                    ...(isShortStay
                      ? [
                          [t.ss_window, `${fmtDate(form.check_in_date)} · ${form.ss_time} → ${ssEnd.slice(11, 16)}`],
                          [t.rate_plan, t.short_stay_2h],
                        ]
                      : [
                          [`${t.check_in} → ${t.check_out}`, `${fmtDate(form.check_in_date)} ${form.checkin_time} → ${fmtDate(form.check_out_date)}`],
                          [t.nights, nights],
                        ]),
                    [t.adults, `${form.adults} + ${form.children} ${t.children}`],
                  ],
                },
                {
                  title: t.guest_information, target: 2,
                  rows: [
                    [t.guest_col, selectedGuest ? `${selectedGuest.first_name} ${selectedGuest.last_name}` : "—"],
                    [t.phone, selectedGuest?.phone || "—"],
                  ],
                },
                {
                  title: t.step_payment, target: 3,
                  rows: [
                    [t.payment_method, form.payment_method],
                    [t.special_instruction, instructions.length],
                  ],
                },
              ] as { title: string; target: number; rows: [string, React.ReactNode][] }[]).map(card => (
                <div key={card.title} className="rounded-xl p-4" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{card.title}</span>
                    <button type="button" onClick={() => { setStepError(""); setStep(card.target); }}
                      className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
                      {t.edit}
                    </button>
                  </div>
                  {card.rows.map(([l, v]) => <Row key={String(l)} label={l} value={v} />)}
                </div>
              ))}

              <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
                <Row label={t.room_charges} value={`${roomCharges.toLocaleString("fr-FR")} FCFA`} />
                <Row label={t.amount_paid} value={`${advance.toLocaleString("fr-FR")} FCFA`} />
                <div className="flex justify-between pt-2 mt-1 border-t" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{t.total}</span>
                  <span className="text-base font-black" style={{ color: "#e74c3c" }}>
                    {balanceTotal.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <button type="button" onClick={onCancel}
            className="px-5 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            {t.cancel}
          </button>
          <div className="ml-auto flex items-center gap-3">
            {step > 1 && (
              <button type="button" onClick={back}
                className="px-5 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                ← {t.back}
              </button>
            )}
            {step < 4 ? (
              <button type="button" onClick={next}
                className="px-8 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
                {t.next} →
              </button>
            ) : (
              <button type="button" onClick={submitNow} disabled={submitting}
                className="px-8 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
                {submitting ? t.loading : t.save}
              </button>
            )}
          </div>
        </div>
      </form>

      {profileGuest && (
        <GuestProfileModal guest={profileGuest}
          onClose={() => setProfileGuest(null)}
          onSaved={g => {
            setGuestList(list => list.map(x => (x.id === g.id ? g : x)));
            setProfileGuest(g);
          }} />
      )}
    </div>
  );
}


// ── Folio Modal ───────────────────────────────────────────────────────────────
function FolioModal({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { current, capabilities } = useProperty();
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [charges, setCharges] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [particulars, setParticulars] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [hideVoid, setHideVoid] = useState(false);
  const [hideUnposted, setHideUnposted] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState("");
  const [activeTab, setActiveTab] = useState<"charges" | "payments" | "keycards">("charges");
  // Key cards
  const [guestCards, setGuestCards] = useState<any[]>([]);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardForm, setCardForm] = useState({ valid_from: "", expires_at: "" });
  const [issuingCard, setIssuingCard] = useState(false);

  // Charge form
  const [settle, setSettle] = useState({ payment_type: "Cash", particular: "", amount: "", description: "" });
  // Extra-room charge: pick an available room by type, then number
  const [extraRoom, setExtraRoom] = useState({ type: "", number: "" });
  // Payment form
  const [payForm, setPayForm] = useState({ amount: "", currency_code: "XAF", payment_method: "Cash", reference: "", note: "" });
  const [converting, setConverting] = useState<{ target_amount: number; symbol: string } | null>(null);

  const xafCur = currencies.find((c: any) => c.code === "XAF") || { symbol: "FCFA", code: "XAF" };

  const load = async () => {
    const [c, s, p, cur, parts, pm, kc, rms] = await Promise.all([
      api.getFolio(reservation.id),
      api.getFolioSummary(reservation.id),
      api.getPayments(reservation.id),
      api.getCurrencies(true),
      api.getFolioParticulars(),
      api.getLookup("payment_method"),
      api.getGuestCards(reservation.id),
      api.getRooms("status=available"),
    ]);
    setCharges(c); setSummary(s); setPayments(p); setCurrencies(cur);
    setParticulars(parts); setPaymentMethods(pm); setGuestCards(kc);
    setAvailableRooms(rms.filter((r: Room) => r.id !== reservation.room_id));
    if (pm.length) { setSettle(st => ({ ...st, payment_type: pm[0].value_en })); setPayForm(pf => ({ ...pf, payment_method: pm[0].value_en })); }
  };
  useEffect(() => { load(); }, []);

  // Only offer services this site actually has (Settings → Sites). Particular
  // labels are user-editable, so match on keywords; unknown labels stay visible.
  const facilityCodes = parseFacilities(current?.facilities).map(f => f.code);
  const hasFacility = (...cs: string[]) => cs.some(c => facilityCodes.includes(c));
  const particularAvailable = (nameEn: string): boolean => {
    const n = nameEn.toLowerCase();
    if (/gym|fitness/.test(n)) return hasFacility("gym", "fitness");
    if (/spa|massage/.test(n)) return capabilities.spa;
    if (/restaurant|night ?club/.test(n)) return capabilities.fnb;
    if (/min ?bar/.test(n)) return capabilities.lodging;
    if (/\bbar\b/.test(n)) return capabilities.fnb;
    if (/parking|valet/.test(n)) return hasFacility("parking", "valet_parking");
    if (/pool|piscine/.test(n)) return hasFacility("pool", "swimming_pool");
    if (/laundry|blanchisserie/.test(n)) return hasFacility("laundry");
    if (/room|extra bed/.test(n)) return capabilities.lodging;
    return true;
  };
  const offeredParticulars = particulars.filter((p: any) => particularAvailable(p.name_en));

  // Keep the selection valid as the filtered list settles.
  useEffect(() => {
    if (offeredParticulars.length && !offeredParticulars.some((p: any) => p.name_en === settle.particular)) {
      setSettle(st => ({ ...st, particular: offeredParticulars[0].name_en }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [particulars, current]);

  // "Room Rent" charge = billing an extra room: pick type → number from
  // what's actually free right now.
  const isExtraRoomCharge = settle.particular.toLowerCase().includes("room rent");
  const extraRoomTypes = [...new Set(availableRooms.map(r => r.room_type))];
  const extraRoomsOfType = availableRooms.filter(r => !extraRoom.type || r.room_type === extraRoom.type);
  const pickExtraRoom = (num: string) => {
    const room = availableRooms.find(r => r.room_number === num);
    setExtraRoom(er => ({ ...er, number: num }));
    if (room) {
      setSettle(s => ({
        ...s,
        amount: String(room.price_per_night),
        description: s.description || `${t.room_col} #${room.room_number}`,
      }));
    }
  };

  // Live conversion preview
  useEffect(() => {
    if (!payForm.amount || !payForm.currency_code || payForm.currency_code === "XAF") {
      setConverting(null); return;
    }
    const cur = currencies.find((c: any) => c.code === payForm.currency_code);
    if (!cur) return;
    const xafAmt = Number(payForm.amount) * Number(cur.xaf_rate);
    setConverting({ target_amount: xafAmt, symbol: "FCFA" });
  }, [payForm.amount, payForm.currency_code, currencies]);

  const visible = charges.filter(c => (!hideVoid || !c.is_void) && (!hideUnposted || c.is_posted));

  const handleAddCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExtraRoomCharge && !extraRoom.number) return; // must pick a free room
    await api.addCharge({
      reservation_id: reservation.id,
      date: new Date().toISOString().slice(0, 10),
      ...settle,
      amount: Number(settle.amount),
      ...(isExtraRoomCharge ? { room_number: extraRoom.number, charge_type: "room" } : {}),
    });
    setSettle(s => ({ ...s, amount: "", description: "" }));
    setExtraRoom({ type: "", number: "" });
    load();
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createPayment({ reservation_id: reservation.id, ...payForm, amount: Number(payForm.amount) });
    setPayForm(p => ({ ...p, amount: "", reference: "", note: "" }));
    load();
  };

  const handleIssueGuestCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssuingCard(true);
    try {
      await api.issueCard({
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        room_id: reservation.room_id,
        card_type: "guest",
        valid_from: cardForm.valid_from || undefined,
        expires_at: cardForm.expires_at,
      });
      setShowCardForm(false);
      setCardForm({ valid_from: "", expires_at: "" });
      load();
    } finally { setIssuingCard(false); }
  };

  const formatXaf = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} ${xafCur.symbol}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(30,37,50,0.45)" }}>
      <div className="card w-full max-w-4xl max-h-[95vh] overflow-y-auto" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{t.settle_folio}</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>#{reservation.reservation_number}</p>
          </div>
          <button onClick={onClose} style={{ color: "var(--muted)", fontSize: 18 }}>✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tabs: Charges / Payments / Key Cards */}
          <div className="flex gap-1 p-1 rounded-xl self-start" style={{ background: "var(--input-bg)", width: "fit-content" }}>
            {(["charges", "payments", "keycards"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={activeTab === tab ? { background: "var(--blue)", color: "#fff" } : { color: "var(--muted)" }}>
                {tab === "charges"
                  ? (lang === "fr" ? "Frais" : "Charges")
                  : tab === "payments"
                  ? (lang === "fr" ? "Paiements" : "Payments")
                  : (lang === "fr" ? "Cartes Clés" : "Key Cards")}
                {tab === "payments" && payments.length > 0 && (
                  <span className="ml-1.5 text-xs px-1.5 rounded-full" style={activeTab === "payments" ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
                    {payments.length}
                  </span>
                )}
                {tab === "keycards" && guestCards.length > 0 && (
                  <span className="ml-1.5 text-xs px-1.5 rounded-full" style={activeTab === "keycards" ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
                    {guestCards.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "charges" && (
            <>
              {/* Charge form */}
              <div>
                <div className="section-title">{t.folio_header}</div>
                <form onSubmit={handleAddCharge} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label={t.folio_label}><input readOnly value={`#${reservation.reservation_number}`} className="field-input" /></Field>
                  <Field label={t.payment_type}>
                    <select value={settle.payment_type} onChange={e => setSettle(s => ({ ...s, payment_type: e.target.value }))} className="field-input">
                      {paymentMethods.map((o: any) => <option key={o.value_en} value={o.value_en}>{lang === "fr" ? o.value_fr : o.value_en}</option>)}
                    </select>
                  </Field>
                  <Field label={t.date}><input type="date" readOnly value={new Date().toISOString().slice(0, 10)} className="field-input" /></Field>
                  <Field label={t.receivable_no}><input readOnly value={`AR${reservation.reservation_number}`} className="field-input" /></Field>
                  <Field label={t.particular}>
                    <select value={settle.particular}
                      onChange={e => { setSettle(s => ({ ...s, particular: e.target.value })); setExtraRoom({ type: "", number: "" }); }}
                      className="field-input">
                      {offeredParticulars.map((p: any) => (
                        <option key={p.id} value={p.name_en}>{lang === "fr" ? p.name_fr : p.name_en}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`${t.amount} (XAF)`}>
                    <input type="number" value={settle.amount} onChange={e => setSettle(s => ({ ...s, amount: e.target.value }))} className="field-input" />
                  </Field>
                  {/* Extra room: only rooms that are actually free, by type then number */}
                  {isExtraRoomCharge && (
                    availableRooms.length === 0 ? (
                      <div className="col-span-3 rounded-lg px-4 py-2.5 text-sm font-semibold"
                        style={{ background: "#fce4ec", color: "#b71c1c" }}>
                        {t.no_rooms_available}
                      </div>
                    ) : (
                      <>
                        <Field label={t.room_type}>
                          <select value={extraRoom.type}
                            onChange={e => setExtraRoom({ type: e.target.value, number: "" })}
                            className="field-input">
                            <option value="">{t.all_types}</option>
                            {extraRoomTypes.map(ty => <option key={ty} value={ty}>{ty}</option>)}
                          </select>
                        </Field>
                        <Field label={t.room_number}>
                          <select value={extraRoom.number} onChange={e => pickExtraRoom(e.target.value)} className="field-input">
                            <option value="">—</option>
                            {extraRoomsOfType.map(r => (
                              <option key={r.id} value={r.room_number}>
                                {r.room_number} ({Number(r.price_per_night).toLocaleString("fr-FR")} FCFA)
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div />
                      </>
                    )
                  )}
                  <div className="col-span-2">
                    <Field label={t.description}><input value={settle.description} onChange={e => setSettle(s => ({ ...s, description: e.target.value }))} className="field-input" /></Field>
                  </div>
                  <div className="flex items-end">
                    <button type="submit"
                      disabled={isExtraRoomCharge && (!extraRoom.number || availableRooms.length === 0)}
                      className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40">
                      {t.add}
                    </button>
                  </div>
                </form>
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--muted)" }}>
                {[t.void, t.move, t.itemize_list].map(btn => (
                  <button key={btn} className="px-3 py-1.5 rounded border text-xs font-medium hover:bg-gray-50"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{btn}</button>
                ))}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={hideVoid} onChange={e => setHideVoid(e.target.checked)} /> {t.hide_voids}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={hideUnposted} onChange={e => setHideUnposted(e.target.checked)} /> {t.hide_unposted}
                </label>
              </div>

              {/* Charges table */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "var(--input-bg)" }}>
                    <tr>
                      <th className="w-6 px-3 py-2"><input type="checkbox" /></th>
                      {[t.date, t.room_col, t.ref_no, t.particular, t.description, t.user, `${t.amount} (XAF)`].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {visible.length === 0
                      ? <tr><td colSpan={8} className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>{t.no_charges}</td></tr>
                      : visible.map(c => (
                        <tr key={c.id} className={c.is_void ? "opacity-40" : ""}>
                          <td className="px-3 py-2.5"><input type="checkbox" /></td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{c.date}</td>
                          <td className="px-3 py-2.5 text-xs">{c.room_number || "—"}</td>
                          <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>{c.ref_number}</td>
                          <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{c.particular}</td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{c.description}</td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{c.posted_by || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-sm"
                            style={{ color: Number(c.amount) < 0 ? "#27ae60" : "#e74c3c" }}>
                            {formatXaf(Math.abs(Number(c.amount)))}
                          </td>
                        </tr>
                      ))}
                    {summary && (
                      <tr style={{ background: "var(--input-bg)" }}>
                        <td colSpan={7} className="px-3 py-2 text-right text-sm font-semibold" style={{ color: "#e74c3c" }}>{t.balance}</td>
                        <td className="px-3 py-2 text-right font-bold" style={{ color: "#e74c3c" }}>{formatXaf(Number(summary.total))}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "payments" && (
            <>
              {/* Payment form */}
              <div className="rounded-xl p-4" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                <div className="section-title mb-3">{lang === "fr" ? "Enregistrer un Paiement" : "Record Payment"}</div>
                <form onSubmit={handlePayment} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="field-label">{lang === "fr" ? "Montant payé" : "Amount paid"}</label>
                    <div className="flex gap-2">
                      <input type="number" required min="0.01" step="0.01" value={payForm.amount}
                        onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                        className="field-input flex-1" placeholder="0" />
                      <select value={payForm.currency_code} onChange={e => setPayForm(p => ({ ...p, currency_code: e.target.value }))}
                        className="field-input" style={{ width: 110 }}>
                        {currencies.map((c: any) => (
                          <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                        ))}
                      </select>
                    </div>
                    {converting && payForm.currency_code !== "XAF" && (
                      <p className="text-xs mt-1 font-semibold" style={{ color: "var(--blue)" }}>
                        ≈ {formatXaf(converting.target_amount)} XAF
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="field-label">{t.payment_method}</label>
                    <select value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} className="field-input">
                      {paymentMethods.map((o: any) => <option key={o.value_en} value={o.value_en}>{lang === "fr" ? o.value_fr : o.value_en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">{lang === "fr" ? "Référence" : "Reference"}</label>
                    <input value={payForm.reference} onChange={e => setPayForm(p => ({ ...p, reference: e.target.value }))} className="field-input" />
                  </div>
                  <div className="col-span-3">
                    <label className="field-label">{lang === "fr" ? "Note" : "Note"}</label>
                    <input value={payForm.note} onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))} className="field-input" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700">
                      {lang === "fr" ? "Valider" : "Record"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Payments list */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "var(--input-bg)" }}>
                    <tr>
                      {[t.date, lang === "fr" ? "Montant" : "Amount", lang === "fr" ? "Devise" : "Currency",
                        lang === "fr" ? "Équivalent XAF" : "XAF Equivalent",
                        lang === "fr" ? "Taux" : "Rate", t.payment_method, lang === "fr" ? "Réf." : "Ref."].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: "var(--muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {payments.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>
                        {lang === "fr" ? "Aucun paiement enregistré." : "No payments recorded."}
                      </td></tr>
                    ) : payments.map(p => {
                      const cur = currencies.find((c: any) => c.code === p.currency_code) || { symbol: p.currency_code };
                      return (
                        <tr key={p.id}>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>
                            {new Date(p.paid_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}
                          </td>
                          <td className="px-3 py-2.5 font-bold" style={{ color: "var(--text)" }}>
                            {Number(p.amount).toLocaleString("fr-FR")} {cur.symbol}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="badge font-mono font-bold" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>{p.currency_code}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold" style={{ color: "#059669" }}>
                            {formatXaf(Number(p.xaf_equivalent))}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted)" }}>
                            1 {p.currency_code} = {Number(p.xaf_rate_snapshot).toLocaleString("fr-FR")} XAF
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{p.payment_method}</td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{p.reference || "—"}</td>
                        </tr>
                      );
                    })}
                    {payments.length > 0 && (
                      <tr style={{ background: "var(--input-bg)" }}>
                        <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold" style={{ color: "#059669" }}>
                          {lang === "fr" ? "Total encaissé (XAF)" : "Total collected (XAF)"}
                        </td>
                        <td className="px-3 py-2 font-black text-sm" style={{ color: "#059669" }}>
                          {formatXaf(payments.reduce((s, p) => s + Number(p.xaf_equivalent), 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Key Cards tab ──────────────────────────────────────────────── */}
          {activeTab === "keycards" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {lang === "fr" ? "Cartes émises pour cette réservation" : "Cards issued for this reservation"}
                </p>
                {reservation.status === "checked_in" && (
                  <button onClick={() => setShowCardForm(v => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                    style={{ background: "var(--accent)" }}>
                    🔑 {lang === "fr" ? "Donner Accès" : "Give Access"}
                  </button>
                )}
              </div>

              {showCardForm && (
                <form onSubmit={handleIssueGuestCard}
                  className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    🏠 {lang === "fr"
                      ? `Accès accordé à la chambre ${reservation.room_id} pour le client.`
                      : `Room access granted for room #${reservation.room_id}`}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">
                        {t.valid_from}
                        <span className="ml-1 text-xs font-normal" style={{ color: "var(--muted)" }}>({t.optional})</span>
                      </label>
                      <input type="datetime-local" value={cardForm.valid_from}
                        onChange={e => setCardForm(f => ({ ...f, valid_from: e.target.value }))}
                        className="field-input" />
                    </div>
                    <div>
                      <label className="field-label">{t.expires_at} *</label>
                      <input type="datetime-local" required value={cardForm.expires_at}
                        onChange={e => setCardForm(f => ({ ...f, expires_at: e.target.value }))}
                        className="field-input" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={issuingCard}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                      style={{ background: "var(--accent)" }}>
                      {issuingCard ? t.loading : t.issue_card}
                    </button>
                    <button type="button" onClick={() => setShowCardForm(false)}
                      className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                      {t.cancel}
                    </button>
                  </div>
                </form>
              )}

              {guestCards.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: "var(--muted)" }}>{t.no_guest_cards}</p>
              ) : (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead style={{ background: "var(--input-bg)" }}>
                      <tr>
                        {[t.card_number, t.card_uid, t.status, t.valid_from, t.expires_at, t.uses, t.actions].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider"
                            style={{ color: "var(--muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guestCards.map((c, i) => {
                        const scMap: Record<string, string> = { active: "#e8f5e9/green", inactive: "#f5f5f5/gray", lost: "#fce4ec/red", expired: "#fffde7/orange" };
                        const sc = scMap[c.status as string];
                        const [sbg, scol] = sc ? sc.split("/") : ["#f5f5f5", "gray"];
                        return (
                          <tr key={c.id} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                            <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: "var(--accent)" }}>{c.card_number}</td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--muted)" }}>{c.card_uid?.slice(0, 8) || "—"}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: sbg, color: scol === "green" ? "#2e7d32" : scol === "red" ? "#b71c1c" : scol === "orange" ? "#f57f17" : "#555" }}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{new Date(c.valid_from).toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted)" }}>{new Date(c.expires_at).toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center text-sm" style={{ color: "var(--text)" }}>{c.access_count}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1.5">
                                {c.status === "active" && (
                                  <>
                                    <button onClick={() => api.revokeCard(c.id).then(load)}
                                      className="text-xs border px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                                      {t.revoke}
                                    </button>
                                    <button onClick={() => api.reportLost(c.id).then(load)}
                                      className="text-xs border px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                      style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                                      {t.report_lost}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Summary strip — charges/payments only */}
          {activeTab !== "keycards" && summary && (
            <div className="flex items-center justify-between rounded-xl px-5 py-3"
              style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
              <div className="flex gap-6 text-sm">
                {[
                  [lang === "fr" ? "Frais total" : "Total charges", formatXaf(Number(summary.room_charges) + Number(summary.extra_charge)), ""],
                  ...(Number(summary.tax) > 0 ? [[t.tax, formatXaf(Number(summary.tax)), ""]] : []),
                  ...(Number(summary.discount) > 0 ? [[t.discount, `-${formatXaf(Number(summary.discount))}`, "#d97706"]] : []),
                  // Collected = everything settled on the folio (advance + payments)
                  [lang === "fr" ? "Encaissé" : "Collected", formatXaf(Number(summary.amount_paid)), "#059669"],
                ].map(([label, val, color]) => (
                  <div key={label as string}>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
                    <div className="font-bold" style={{ color: color ? (color as string) : "var(--text)" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div className="text-right">
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {Number(summary.total) < 0 ? (lang === "fr" ? "Crédit client" : "Guest credit") : t.balance}
                </div>
                <div className="text-xl font-black" style={{ color: Number(summary.total) > 0 ? "#e74c3c" : "#059669" }}>
                  {formatXaf(Math.abs(Number(summary.total)))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          {checkoutErr && (
            <p className="flex-1 text-sm font-medium" style={{ color: "#dc2626" }}>{checkoutErr}</p>
          )}
          <button onClick={onClose} className="px-6 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
          {reservation.status === "checked_in" && (
            <button onClick={async () => {
              setCheckoutErr("");
              try { await api.checkOut(reservation.id); onClose(); }
              catch (e: any) {
                const msg = e.message || "";
                setCheckoutErr(msg.includes("unsettled balance")
                  ? t.checkout_unsettled_debt.replace("{balance}", msg.match(/([\d,]+) FCFA/)?.[1] ?? "")
                  : msg);
              }
            }}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
              {t.check_out_btn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Check-In Modal ────────────────────────────────────────────────────────────
// Gated flow: 1) payment settled → 2) room card activated & validated →
// 3) check-in completes. The backend enforces the same rules.
function CheckInModal({ reservation, room, guest, onClose, onDone }: {
  reservation: Reservation;
  room?: Room;
  guest?: Guest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const { current } = useProperty();
  const [summary, setSummary] = useState<any | null>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [card, setCard] = useState<any | null>(null);
  const [validated, setValidated] = useState<{ granted: boolean; denial_reason?: string } | null>(null);
  const [encoderPrompt, setEncoderPrompt] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  // The folio is the source of truth — the stay is billed to it at booking.
  const expected = Number(summary?.room_charges || 0) + Number(summary?.extra_charge || 0)
    + Number(summary?.tax || 0) - Number(summary?.discount || 0);
  const paid = Number(summary?.amount_paid || 0);
  const balance = Math.max(0, Number(summary?.total || 0));
  const paidOk = summary !== null && balance <= 0;

  const loadSummary = () => api.getFolioSummary(reservation.id).then(setSummary).catch(() => {});
  useEffect(() => {
    loadSummary();
    api.getLookup("payment_method").then(setMethods).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (balance > 0) setAmount(String(balance)); }, [balance]);

  const mapErr = (m: string) =>
    m.includes("ID not verified") ? t.checkin_requires_id
    : m.includes("ID expired") ? t.checkin_id_expired
    : m.includes("key card not activated") ? t.checkin_requires_card
    : m;

  const recordPayment = async () => {
    if (!Number(amount)) return;
    if (Number(amount) > balance) { setErr(t.overpay_blocked.replace("{balance}", balance.toLocaleString("fr-FR"))); return; }
    setBusy("pay"); setErr("");
    try {
      await api.createPayment({
        reservation_id: reservation.id,
        amount: Number(amount),
        currency_code: "XAF",
        payment_method: method,
      });
      await loadSummary();
    } catch (e: any) { setErr(mapErr(e.message || "")); }
    finally { setBusy(""); }
  };

  const activate = async () => {
    setBusy("card"); setErr("");
    try {
      const c = await api.activateRoomCard(reservation.id);
      setCard(c);
      setValidated(null);
      setEncoderPrompt(false);
    } catch (e: any) { setErr(mapErr(e.message || "")); }
    finally { setBusy(""); }
  };

  const validate = async () => {
    if (!card) return;
    setBusy("validate"); setErr("");
    try {
      const r = await api.simulateAccess(card.id, room?.room_number || "door");
      setValidated(r);
    } catch (e: any) { setErr(mapErr(e.message || "")); }
    finally { setBusy(""); }
  };

  const complete = async () => {
    setBusy("done"); setErr("");
    try {
      await api.checkIn(reservation.id);
      setCheckedIn(true); // show room number + directions before closing
    } catch (e: any) { setErr(mapErr(e.message || "")); }
    finally { setBusy(""); }
  };

  // Directions to the room from the site's floor plan (Settings → Sites).
  const floorLabel = room ? getFloors(current).find(f => f.floor === room.floor)?.label : "";
  const direction = room
    ? room.floor === 0
      ? t.room_direction_ground
      : t.room_direction_floor.replace("{floor}", String(room.floor))
    : "";

  const fmtMoney = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

  const StepHead = ({ n, title, done }: { n: number; title: string; done: boolean }) => (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
        style={done ? { background: "#10b981", color: "#fff" } : { background: "var(--blue)", color: "#fff" }}>
        {done ? "✓" : n}
      </span>
      <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{title}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(30,37,50,0.45)", animation: "backdrop-in 0.15s ease" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="card w-full max-w-md max-h-[92vh] overflow-y-auto"
        style={{ padding: 0, animation: "modal-in 0.18s ease" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <div className="font-bold" style={{ color: "var(--text)" }}>{t.check_in_action} — {room?.room_number ?? ""}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {guest ? `${guest.first_name} ${guest.last_name} · ` : ""}{reservation.reservation_number}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: "var(--muted)", fontSize: 16 }}>✕</button>
        </div>

        {checkedIn ? (
          /* All done — show the guest their room and the way there */
          <div className="p-8 text-center space-y-4" style={{ animation: "modal-in 0.25s ease" }}>
            <div className="text-5xl">🎉</div>
            <div className="font-bold text-lg" style={{ color: "var(--text)" }}>{t.checkin_complete_title}</div>
            <div className="inline-block px-10 py-4 rounded-2xl"
              style={{ background: "var(--blue-light)", border: "1px solid var(--blue)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                {t.room_col}
              </div>
              <div className="text-4xl font-black my-1" style={{ color: "var(--blue)" }}>
                {room?.room_number}
              </div>
              <div className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                {t.floor_label} {room?.floor}{floorLabel ? ` — ${floorLabel}` : ""}
              </div>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>🧭 {direction}</p>
            <button type="button" onClick={onDone}
              className="px-10 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700">
              {t.done_btn}
            </button>
          </div>
        ) : (
        <div className="p-6 space-y-4">
          {err && (
            <div className="rounded-lg px-4 py-2.5 text-sm" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>
          )}

          {/* Step 1 — Payment */}
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: paidOk ? "#f0fdf4" : "var(--card)" }}>
            <StepHead n={1} title={t.step_payment} done={paidOk} />
            <div className="text-xs space-y-1" style={{ color: "var(--muted)" }}>
              <div className="flex justify-between"><span>{t.room_charges}</span><b style={{ color: "var(--text)" }}>{fmtMoney(expected)}</b></div>
              <div className="flex justify-between"><span>{t.amount_paid}</span><b style={{ color: "var(--text)" }}>{fmtMoney(paid)}</b></div>
              <div className="flex justify-between"><span>{t.balance_due}</span>
                <b style={{ color: paidOk ? "#10b981" : "#e74c3c" }}>{fmtMoney(balance)}</b></div>
            </div>
            {paidOk ? (
              <div className="mt-2 text-xs font-bold" style={{ color: "#10b981" }}>✓ {t.paid_in_full}</div>
            ) : (
              <div className="flex gap-2 mt-3">
                <input type="number" min={0} max={balance} value={amount} onChange={e => setAmount(e.target.value)}
                  className="field-input" style={{ width: 110 }} />
                <select value={method} onChange={e => setMethod(e.target.value)} className="field-input flex-1">
                  {methods.map((m: any) => (
                    <option key={m.value_en} value={m.value_en}>{lang === "fr" ? m.value_fr : m.value_en}</option>
                  ))}
                </select>
                <button type="button" onClick={recordPayment} disabled={busy === "pay" || !Number(amount)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0">
                  {busy === "pay" ? t.loading : t.record_payment}
                </button>
              </div>
            )}
          </div>

          {/* Step 2 — Room key card */}
          <div className="rounded-xl p-4 transition-opacity"
            style={{
              border: "1px solid var(--border)",
              background: validated?.granted ? "#f0fdf4" : "var(--card)",
              opacity: paidOk ? 1 : 0.45,
              pointerEvents: paidOk ? "auto" : "none",
            }}>
            <StepHead n={2} title={t.step_room_card} done={!!validated?.granted} />
            {!card ? (
              !encoderPrompt ? (
                <button type="button" onClick={() => { setEncoderPrompt(true); setErr(""); }}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
                  🔑 {t.activate_room_card}
                </button>
              ) : (
                <div className="rounded-lg p-4 text-center space-y-2"
                  style={{ background: "var(--blue-light)", border: "1px dashed var(--blue)" }}>
                  <div className="text-3xl" style={{ animation: "page-in 0.3s ease" }}>💳</div>
                  <p className="text-sm font-semibold" style={{ color: "var(--blue)" }}>
                    {t.place_card_on_encoder}
                  </p>
                  <button type="button" onClick={activate} disabled={busy === "card"}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                    {busy === "card" ? t.encoding_card : t.card_ready_activate}
                  </button>
                  <button type="button" onClick={() => setEncoderPrompt(false)}
                    className="text-xs" style={{ color: "var(--muted)" }}>
                    {t.cancel}
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-2">
                {/* Card is encoded — hand it over with a welcome */}
                <div className="rounded-lg p-3 text-center"
                  style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", animation: "modal-in 0.25s ease" }}>
                  <div className="text-2xl mb-0.5">🔑✨</div>
                  <div className="text-sm font-bold" style={{ color: "#065f46" }}>✓ {t.card_activated}</div>
                  <p className="text-xs mt-1 font-medium" style={{ color: "#047857" }}>
                    {t.card_welcome_msg.replace("{hotel}", current?.name || "")}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
                  <span className="font-mono font-bold" style={{ color: "var(--text)" }}>{card.card_number}</span>
                  <span>{t.card_active_until} {new Date(card.expires_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {validated ? (
                  validated.granted ? (
                    <div className="text-xs font-bold" style={{ color: "#10b981" }}>✓ {t.card_access_granted}</div>
                  ) : (
                    <div className="text-xs font-bold" style={{ color: "#e74c3c" }}>
                      ✕ {t.card_access_denied}{validated.denial_reason ? ` — ${validated.denial_reason}` : ""}
                    </div>
                  )
                ) : null}
                {!validated?.granted && (
                  <button type="button" onClick={validate} disabled={busy === "validate"}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                    {busy === "validate" ? t.loading : t.validate_card}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 3 — Complete */}
          <button type="button" onClick={complete}
            disabled={!paidOk || !validated?.granted || busy === "done"}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 transition-opacity">
            {busy === "done" ? t.loading : `✓ ${t.complete_checkin}`}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ReservationsInner() {
  const { t, lang } = useI18n();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const autoFolioId = searchParams.get("folio");
  const autoRoomId = searchParams.get("room");

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [folio, setFolio] = useState<Reservation | null>(null);
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ res: Reservation; action: "cancel" | "no_show" } | null>(null);
  const [initialRoomId, setInitialRoomId] = useState<string | null>(null);
  const [profileGuest, setProfileGuest] = useState<Guest | null>(null);

  // "Book this room" from the Rooms page — open the form with the room preset.
  useEffect(() => {
    if (autoRoomId) {
      setInitialRoomId(autoRoomId);
      setShowForm(true);
    }
  }, [autoRoomId]);
  const [allReservations, setAllReservations] = useState<Reservation[]>([]);
  const [actionError, setActionError] = useState("");

  // Check-in/out policy refusals — map the server message to a bilingual one.
  const actionErrorText = (msg: string) =>
    msg.includes("ID not verified") ? t.checkin_requires_id
    : msg.includes("ID expired") ? t.checkin_id_expired
    : msg.includes("unsettled balance") ? t.checkout_unsettled_debt.replace("{balance}", msg.match(/([\d,]+) FCFA/)?.[1] ?? "")
    : msg;

  // Check-in goes through the gated modal: payment → card activation → done.
  const [checkinRes, setCheckinRes] = useState<Reservation | null>(null);

  const doCheckOut = async (id: number) => {
    setActionError("");
    try { await api.checkOut(id); load(); }
    catch (e: any) { setActionError(actionErrorText(e.message || "")); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [res, all, g, r] = await Promise.all([
        api.getReservations(statusFilter ? `status=${statusFilter}` : ""),
        api.getReservations(""),
        api.getGuests(), api.getRooms(),
      ]);
      setReservations(res); setAllReservations(all); setGuests(g); setRooms(r);
      // Auto-open folio if ?folio=ID in URL
      if (autoFolioId) {
        const target = res.find(r => r.id === Number(autoFolioId));
        if (target) setFolio(target);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [statusFilter]);

  const handleSave = async (data: any) => {
    await api.createReservation(data);
    setShowForm(false);
    setInitialRoomId(null);
    load();
  };
  const guestName = (id: number) => { const g = guests.find(g => g.id === id); return g ? `${g.first_name} ${g.last_name}` : `#${id}`; };
  const guestInitials = (id: number) => { const g = guests.find(g => g.id === id); return g ? `${g.first_name[0]}${g.last_name[0]}` : "?"; };
  const roomNum = (id: number) => rooms.find(r => r.id === id)?.room_number || `#${id}`;

  const pageTitle = statusFilter === "confirmed" ? t.checkin_list
    : statusFilter === "checked_in" ? t.checkout_list
    : t.reservation;

  const STATUS_LABELS: Record<string, string> = {
    confirmed: t.confirmed, checked_in: t.checked_in,
    checked_out: t.checked_out, cancelled: t.cancelled, no_show: t.no_show,
  };

  const today = new Date().toISOString().slice(0, 10);

  // Counts for chips
  const counts: Record<string, number> = { "": allReservations.length };
  for (const r of allReservations) counts[r.status] = (counts[r.status] || 0) + 1;
  const arrivingToday = allReservations.filter(r => r.status === "confirmed" && r.check_in_date === today).length;
  const departingToday = allReservations.filter(r => r.status === "checked_in" && r.check_out_date === today).length;

  const STATUS_CHIP_META: Record<string, { color: string; bg: string }> = {
    "":           { color: "var(--blue)", bg: "#e3f2fd" },
    confirmed:    { color: "#d97706",     bg: "#fef3c7" },
    checked_in:   { color: "#059669",     bg: "#dcfce7" },
    checked_out:  { color: "#6b7280",     bg: "#f3f4f6" },
    cancelled:    { color: "#dc2626",     bg: "#fee2e2" },
  };

  const filterChips = [
    { val: "", label: t.all },
    { val: "confirmed",  label: t.confirmed },
    { val: "checked_in", label: t.checked_in },
    { val: "checked_out",label: t.checked_out },
    { val: "cancelled",  label: t.cancelled },
  ];

  // Search filter
  const filtered = reservations.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.reservation_number.toLowerCase().includes(q) ||
      guestName(r.guest_id).toLowerCase().includes(q) ||
      roomNum(r.room_id).includes(q)
    );
  });

  const handleAction = async () => {
    if (!confirmAction) return;
    const { res, action } = confirmAction;
    const newStatus = action === "cancel" ? "cancelled" : "no_show";
    await api.updateReservation(res.id, { status: newStatus });
    setConfirmAction(null);
    load();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{pageTitle}</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {arrivingToday > 0 && <span className="mr-3">📥 {arrivingToday} {t.checkin_today_stat}</span>}
            {departingToday > 0 && <span>📤 {departingToday} {t.checkout_today_stat}</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
          + {t.new_reservation}
        </button>
      </div>

      {actionError && (
        <div className="flex items-center justify-between text-sm px-4 py-3 rounded-xl mb-4"
          style={{ background: "#fce4ec", color: "#b71c1c", border: "1px solid #f8bbd0" }}>
          <span>🪪 {actionError}</span>
          <button onClick={() => setActionError("")} className="font-bold ml-4">✕</button>
        </div>
      )}

      {/* Filter chips with counts */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filterChips.map(({ val, label }) => {
          const meta = STATUS_CHIP_META[val] || STATUS_CHIP_META[""];
          const active = statusFilter === val;
          return (
            <a key={val} href={val ? `/reservations?status=${val}` : "/reservations"}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
              style={active
                ? { background: meta.color, color: "#fff", borderColor: "transparent", boxShadow: `0 2px 8px ${meta.color}40` }
                : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
              {label}
              <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
                style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
                {counts[val] ?? 0}
              </span>
            </a>
          );
        })}
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder={t.search_reservations}
        className="relative mb-4 max-w-sm" />

      {/* Table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.res_number, t.guest_col, t.room_col, t.check_in, t.check_out, t.nights, t.pax_col, t.status_col, t.actions].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{t.no_reservations}</p>
                </td>
              </tr>
            ) : filtered.map((r, i) => {
              const sc = STATUS_COLORS[r.status] || { bg: "#f5f5f5", color: "#555" };
              const isToday = r.check_in_date === today || r.check_out_date === today;
              const isSS = r.rate_plan === "SS";
              const fmtTime = (ts?: string | null) =>
                ts ? new Date(ts).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "";
              // Check-in time: real arrival when known, else the booked time.
              const inTime = fmtTime(r.actual_check_in) || fmtTime(r.stay_starts_at);
              // Leaving time: real departure when known, else the 2h slot end.
              const outTime = fmtTime(r.actual_check_out) || (isSS ? fmtTime(r.stay_ends_at) : "");
              return (
                <tr key={r.id}
                  className="hover:bg-blue-50/30 transition-colors"
                  style={{ borderBottom: "1px solid var(--border)", background: isToday ? "#fffbf0" : i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                      <span className="font-mono font-semibold text-xs" style={{ color: "var(--blue)" }}>
                        {r.reservation_number}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button"
                      onClick={() => { const g = guests.find(g => g.id === r.guest_id); if (g) setProfileGuest(g); }}
                      title={t.guest_profile}
                      className="flex items-center gap-2 group/guest rounded-lg px-1.5 py-1 -mx-1.5 transition-colors hover:bg-blue-50">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: "#3b5bdb" }}>
                        {guestInitials(r.guest_id)}
                      </div>
                      <span className="font-medium text-sm group-hover/guest:underline" style={{ color: "var(--text)" }}>
                        {guestName(r.guest_id)}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sm px-2 py-0.5 rounded" style={{ background: "var(--input-bg)", color: "var(--text)" }}>
                      {roomNum(r.room_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: r.check_in_date === today ? "#d97706" : "var(--muted)", fontWeight: r.check_in_date === today ? 700 : 400 }}>
                    {r.check_in_date}
                    {r.check_in_date === today && <span className="ml-1 text-orange-500">●</span>}
                    {inTime && <span className="block font-semibold" style={{ color: "var(--text)" }}>🕐 {inTime}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: r.check_out_date === today ? "#059669" : "var(--muted)", fontWeight: r.check_out_date === today ? 700 : 400 }}>
                    {r.check_out_date}
                    {r.check_out_date === today && <span className="ml-1 text-green-500">●</span>}
                    {outTime && <span className="block font-semibold" style={{ color: "var(--text)" }}>🕐 {outTime}</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-sm" style={{ color: "var(--text)" }}>
                    {isSS ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#d97706" }}>
                        {t.per_2h}
                      </span>
                    ) : r.nights}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {r.adults}A {r.children > 0 ? `${r.children}C` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge capitalize" style={{ background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {r.status === "confirmed" && (
                        <>
                          <button onClick={() => { setActionError(""); setCheckinRes(r); }}
                            className="text-xs px-2.5 py-1 rounded-lg text-white font-semibold"
                            style={{ background: "#059669" }}>
                            {t.check_in_action}
                          </button>
                          <button onClick={() => setConfirmAction({ res: r, action: "no_show" })}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold border"
                            style={{ borderColor: "#fcd34d", color: "#d97706" }}>
                            {t.no_show_btn}
                          </button>
                          <button onClick={() => setConfirmAction({ res: r, action: "cancel" })}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold border"
                            style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                            {t.cancel_res_btn}
                          </button>
                        </>
                      )}
                      {r.status === "checked_in" && (
                        <button onClick={() => doCheckOut(r.id)}
                          className="text-xs px-2.5 py-1 rounded-lg text-white font-semibold"
                          style={{ background: "#d97706" }}>
                          {t.check_out_btn}
                        </button>
                      )}
                      <button onClick={() => setFolio(r)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold border"
                        style={{ borderColor: "var(--border)", color: "var(--blue)" }}>
                        {t.folio}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm action modal */}
      {confirmAction && (
        <ConfirmDialog
          icon={confirmAction.action === "cancel" ? "🗑️" : "🚫"}
          title={confirmAction.action === "cancel" ? t.cancel_confirm : t.no_show_confirm}
          message={`#${confirmAction.res.reservation_number} — ${guestName(confirmAction.res.guest_id)}`}
          confirmLabel={confirmAction.action === "cancel" ? t.cancel_res_btn : t.no_show_btn}
          confirmColor={confirmAction.action === "cancel" ? "#dc2626" : "#d97706"}
          cancelLabel={t.cancel}
          onConfirm={handleAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {showForm && (
        <ReservationForm guests={guests} rooms={rooms} onSave={handleSave}
          initialRoomId={initialRoomId ?? undefined}
          onCancel={() => { setShowForm(false); setInitialRoomId(null); }} />
      )}
      {profileGuest && (
        <GuestProfileModal guest={profileGuest}
          onClose={() => setProfileGuest(null)}
          onSaved={g => {
            setGuests(list => list.map(x => (x.id === g.id ? g : x)));
            setProfileGuest(g);
          }} />
      )}
      {checkinRes && (
        <CheckInModal reservation={checkinRes}
          room={rooms.find(r => r.id === checkinRes.room_id)}
          guest={guests.find(g => g.id === checkinRes.guest_id)}
          onClose={() => setCheckinRes(null)}
          onDone={() => { setCheckinRes(null); load(); }} />
      )}
      {folio && <FolioModal reservation={folio} onClose={() => { setFolio(null); load(); }} />}
    </div>
  );
}

export default function ReservationsPage() {
  return <Suspense><ReservationsInner /></Suspense>;
}
