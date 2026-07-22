"use client";
import { ReactNode, useEffect, useRef } from "react";

export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, icon = "🗑️", confirmColor }: {
  title: ReactNode;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  icon?: string;
  confirmColor?: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe action so Enter never destroys something by accident.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(30,37,50,0.45)", animation: "backdrop-in 0.15s ease" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="alertdialog" aria-modal="true"
        className="card w-full max-w-sm text-center"
        style={{ padding: "32px 28px", animation: "modal-in 0.18s ease" }}>
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="font-bold text-base mb-2" style={{ color: "var(--text)" }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 ${confirmColor ? "" : "bg-red-600 hover:bg-red-700"}`}
            style={confirmColor ? { background: confirmColor } : undefined}>
            {confirmLabel}
          </button>
          <button ref={cancelRef} onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
