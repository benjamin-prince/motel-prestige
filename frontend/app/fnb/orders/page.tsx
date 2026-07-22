"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";

type Line = { menu_item_id: number | null; name: string; unit_price: number; quantity: number };

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const STATUS_META: Record<string, { bg: string; color: string; en: string; fr: string }> = {
  open:     { bg: "var(--warn-bg)", color: "var(--warn)", en: "Open",       fr: "Ouverte" },
  charged:  { bg: "var(--info-bg)", color: "var(--info)", en: "On room",    fr: "Sur chambre" },
  paid:     { bg: "var(--good-bg)", color: "var(--good)", en: "Paid",       fr: "Encaissée" },
  cancelled:{ bg: "var(--input-bg)", color: "var(--muted)", en: "Cancelled", fr: "Annulée" },
};

export default function FnbOrdersPage() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const canManage = can("fnb.orders.manage");
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const [menu, setMenu] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart / builder state
  const [outlet, setOutlet] = useState<"restaurant" | "bar">("restaurant");
  const [cat, setCat] = useState<string>("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [table, setTable] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Close modal: which order is being settled/charged
  const [closing, setClosing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [m, o, r, rm, pm] = await Promise.all([
        api.getMenuItems(),
        api.getFnbOrders({ status: "open" }),
        api.getReservations("").catch(() => []),
        api.getRooms().catch(() => []),
        api.getLookup("payment_method").catch(() => []),
      ]);
      setMenu(m); setOrders(o); setReservations(r); setRooms(rm); setMethods(pm);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Menu filtered by outlet: bar → drinks, restaurant → food (fallback: all)
  const outletMenu = useMemo(() => menu.filter(mi => {
    if (!mi.is_available) return false;
    const isDrink = /boisson|bar|alcool|drink/i.test(`${mi.main_category} ${mi.category}`);
    return outlet === "bar" ? isDrink : !isDrink;
  }), [menu, outlet]);

  const cats = useMemo(() => Array.from(new Set(outletMenu.map(m => m.category).filter(Boolean))), [outletMenu]);
  const shown = outletMenu.filter(m =>
    (cat === "all" || m.category === cat) &&
    (!search || `${m.name_en} ${m.name_fr}`.toLowerCase().includes(search.toLowerCase()))
  );

  const cartTotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);

  const addItem = (mi: any) => {
    setErr("");
    setLines(prev => {
      const i = prev.findIndex(l => l.menu_item_id === mi.id);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], quantity: c[i].quantity + 1 }; return c; }
      return [...prev, { menu_item_id: mi.id, name: lang === "fr" ? mi.name_fr : mi.name_en, unit_price: Number(mi.price), quantity: 1 }];
    });
  };
  const setQty = (idx: number, q: number) =>
    setLines(prev => q <= 0 ? prev.filter((_, i) => i !== idx) : prev.map((l, i) => i === idx ? { ...l, quantity: q } : l));

  const submit = async () => {
    if (!lines.length) { setErr(L("Add at least one item", "Ajoutez au moins un article")); return; }
    setSaving(true); setErr("");
    try {
      await api.createFnbOrder({ outlet, table_label: table || null, items: lines.map(l => ({ menu_item_id: l.menu_item_id, name: l.name, unit_price: l.unit_price, quantity: l.quantity })) });
      setLines([]); setTable("");
      await load();
    } catch (e: any) { setErr(e.message || "Error"); }
    finally { setSaving(false); }
  };

  const roomNo = (id: number) => rooms.find(r => r.id === id)?.room_number ?? `#${id}`;
  const checkedIn = reservations
    .filter(r => r.status === "checked_in")
    .map(r => ({ ...r, room_number: roomNo(r.room_id) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{L("F&B Orders", "Commandes F&B")}</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Take restaurant & bar orders — charge to a room or cash out", "Prise de commande resto & bar — sur chambre ou encaissement")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Menu picker ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Outlet switch */}
          <div className="flex gap-2">
            {(["restaurant", "bar"] as const).map(o => (
              <button key={o} onClick={() => { setOutlet(o); setCat("all"); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all"
                style={outlet === o
                  ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" }
                  : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
                {o === "restaurant" ? `🍽️ ${L("Restaurant", "Restaurant")}` : `🍹 ${L("Bar", "Bar")}`}
              </button>
            ))}
          </div>

          {/* Search + categories */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={L("Search the menu…", "Rechercher au menu…")} className="field-input" style={{ marginTop: 0 }} />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {["all", ...cats].map(c => (
              <button key={c} onClick={() => setCat(c)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={cat === c
                  ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" }
                  : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
                {c === "all" ? L("All", "Tout") : c}
              </button>
            ))}
          </div>

          {/* Menu grid */}
          {loading ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
          ) : shown.length === 0 ? (
            <div className="card text-center py-12 text-sm" style={{ color: "var(--muted)" }}>
              {L("No items in this outlet yet — add them in F&B → Menu.", "Aucun article dans ce point de vente — ajoutez-les dans F&B → Menu.")}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {shown.map(mi => (
                <button key={mi.id} disabled={!canManage} onClick={() => addItem(mi)}
                  className="card p-3 text-left transition-all hover:shadow-md disabled:opacity-60"
                  style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>
                    {lang === "fr" ? mi.name_fr : mi.name_en}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{mi.category}</div>
                  <div className="text-sm font-black mt-1.5" style={{ color: "var(--blue)" }}>{fmt(Number(mi.price))}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Cart ── */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
              🧾 {L("Current Order", "Commande en cours")}
            </h3>
            {lines.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: "var(--muted)" }}>
                {L("Tap menu items to add them", "Touchez les articles du menu")}
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{l.name}</div>
                      <div className="text-xs" style={{ color: "var(--muted)" }}>{fmt(l.unit_price)}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setQty(i, l.quantity - 1)} className="w-6 h-6 rounded border text-sm" style={{ borderColor: "var(--border)" }}>−</button>
                      <span className="w-6 text-center text-sm font-bold" style={{ color: "var(--text)" }}>{l.quantity}</span>
                      <button onClick={() => setQty(i, l.quantity + 1)} className="w-6 h-6 rounded border text-sm" style={{ borderColor: "var(--border)" }}>+</button>
                    </div>
                    <div className="w-20 text-right text-sm font-bold" style={{ color: "var(--text)" }}>{fmt(l.unit_price * l.quantity)}</div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-sm font-bold" style={{ color: "var(--text)" }}>Total</span>
                  <span className="text-lg font-black" style={{ color: "var(--blue)" }}>{fmt(cartTotal)}</span>
                </div>
                <input value={table} onChange={e => setTable(e.target.value)}
                  placeholder={L("Table / note (optional)", "Table / note (optionnel)")} className="field-input" style={{ marginTop: 8 }} />
                {err && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>{err}</div>}
                <button onClick={submit} disabled={saving || !canManage}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: "var(--blue)", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "…" : L("Send Order", "Envoyer la Commande")}
                </button>
              </div>
            )}
          </div>

          {/* Open orders */}
          <div className="card p-4">
            <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
              🔔 {L("Open Orders", "Commandes Ouvertes")} ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "var(--muted)" }}>
                {L("No open orders", "Aucune commande ouverte")}
              </p>
            ) : (
              <div className="space-y-2">
                {orders.map(o => {
                  const st = STATUS_META[o.status] ?? STATUS_META.open;
                  return (
                    <div key={o.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs font-bold" style={{ color: "var(--blue)" }}>{o.order_number}</span>
                          <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                            {o.outlet === "bar" ? "🍹" : "🍽️"} {o.table_label || "—"}
                          </span>
                        </div>
                        <span className="pill" style={{ background: st.bg, color: st.color }}>{lang === "fr" ? st.fr : st.en}</span>
                      </div>
                      <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {o.items.map((i: any) => `${i.quantity}× ${i.name}`).join(", ")}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-black text-sm" style={{ color: "var(--text)" }}>{fmt(Number(o.subtotal))}</span>
                        {canManage && (
                          <button onClick={() => setClosing(o)}
                            className="text-xs px-3 py-1.5 rounded-lg font-bold text-white" style={{ background: "var(--good)" }}>
                            {L("Close", "Clôturer")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close modal */}
      {closing && (
        <CloseOrderModal order={closing} checkedIn={checkedIn} methods={methods} L={L} lang={lang} fmt={fmt}
          onClose={() => setClosing(null)} onDone={() => { setClosing(null); load(); }} />
      )}
    </div>
  );
}

function CloseOrderModal({ order, checkedIn, methods, L, lang, fmt, onClose, onDone }: any) {
  const [mode, setMode] = useState<"cash" | "room">("cash");
  const [method, setMethod] = useState("Cash");
  const [resId, setResId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const confirm = async () => {
    setBusy(true); setErr("");
    try {
      if (mode === "cash") {
        await api.settleFnbOrder(order.id, method);
      } else {
        if (!resId) { setErr(L("Pick a room", "Choisissez une chambre")); setBusy(false); return; }
        await api.chargeFnbToRoom(order.id, Number(resId));
      }
      onDone();
    } catch (e: any) { setErr(e.message || "Error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(30,37,50,0.45)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card w-full max-w-md" style={{ padding: 20 }}>
        <h3 className="font-bold text-base mb-1" style={{ color: "var(--text)" }}>
          {L("Close order", "Clôturer la commande")} {order.order_number}
        </h3>
        <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
          {order.items.map((i: any) => `${i.quantity}× ${i.name}`).join(", ")} · <b style={{ color: "var(--text)" }}>{fmt(Number(order.subtotal))}</b>
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button onClick={() => setMode("cash")}
            className="py-2.5 rounded-xl text-sm font-bold border"
            style={mode === "cash" ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
            💵 {L("Cash out", "Encaisser")}
          </button>
          <button onClick={() => setMode("room")}
            className="py-2.5 rounded-xl text-sm font-bold border"
            style={mode === "room" ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
            🏨 {L("Charge to room", "Sur chambre")}
          </button>
        </div>

        {mode === "cash" ? (
          <select value={method} onChange={e => setMethod(e.target.value)} className="field-input">
            {(methods.length ? methods : [{ value_en: "Cash", value_fr: "Espèces" }]).map((m: any) => (
              <option key={m.value_en} value={m.value_en}>{lang === "fr" ? m.value_fr : m.value_en}</option>
            ))}
          </select>
        ) : (
          <select value={resId} onChange={e => setResId(e.target.value)} className="field-input">
            <option value="">— {L("Select an in-house guest", "Choisir un client en séjour")} —</option>
            {checkedIn.map((r: any) => (
              <option key={r.id} value={r.id}>
                {L("Room", "Ch.")} {r.room_number ?? r.room_id} · {r.reservation_number}
              </option>
            ))}
          </select>
        )}
        {mode === "room" && checkedIn.length === 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--warn)" }}>
            {L("No checked-in guests right now.", "Aucun client en séjour actuellement.")}
          </p>
        )}
        {err && <div className="text-xs px-3 py-2 rounded-lg mt-3" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>{err}</div>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            {L("Cancel", "Annuler")}
          </button>
          <button onClick={confirm} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "var(--good)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "…" : L("Confirm", "Confirmer")}
          </button>
        </div>
      </div>
    </div>
  );
}
