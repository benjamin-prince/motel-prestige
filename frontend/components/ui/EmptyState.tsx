"use client";
import { ReactNode } from "react";

export default function EmptyState({ icon, message, className = "card flex flex-col items-center justify-center py-20" }: {
  icon: string;
  message: ReactNode;
  className?: string;
}) {
  return (
    <div className={className} style={{ color: "var(--muted)" }}>
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
