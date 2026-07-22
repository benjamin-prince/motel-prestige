"use client";
import { ReactNode, useEffect } from "react";

export default function Modal({ title, onClose, children, maxWidth = "max-w-md" }: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(30,37,50,0.45)", animation: "backdrop-in 0.15s ease" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true"
        className={`card w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        style={{ padding: 0, animation: "modal-in 0.18s ease" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
            style={{ color: "var(--muted)", fontSize: 16 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
