"use client";
import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";

type ToastType = "success" | "error" | "info";
type ToastEntry = { id: number; message: string; type: ToastType; leaving?: boolean };

const STYLE: Record<ToastType, { icon: string; bg: string; color: string; border: string }> = {
  success: { icon: "✓", bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
  error:   { icon: "✕", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  info:    { icon: "ℹ", bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
};

const ToastCtx = createContext<{ toast: (message: string, type?: ToastType) => void }>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts(ts => ts.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 200);
  }, []);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId.current++;
    setToasts(ts => [...ts.slice(-3), { id, message, type }]);
    setTimeout(() => dismiss(id), type === "error" ? 6000 : 4000);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => {
          const s = STYLE[t.type];
          return (
            <button
              key={t.id}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl shadow-lg text-left max-w-sm"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                animation: t.leaving ? "toast-out 0.2s ease forwards" : "toast-in 0.25s cubic-bezier(0.21,1.02,0.73,1)",
              }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: s.color }}>
                {s.icon}
              </span>
              <span className="text-sm font-medium" style={{ color: s.color }}>{t.message}</span>
            </button>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
