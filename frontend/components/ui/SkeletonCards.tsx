"use client";

export default function SkeletonCards({ count = 4, height = 80, className = "space-y-3" }: {
  count?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="card animate-pulse" style={{ height }} />
      ))}
    </div>
  );
}
