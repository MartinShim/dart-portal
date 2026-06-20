"use client";

import type { ImpactLevel } from "@/types/dart";

const config: Record<ImpactLevel, { dot: string; className: string }> = {
  호재: { dot: "bg-emerald-500", className: "bg-emerald-50 text-emerald-700" },
  악재: { dot: "bg-red-500", className: "bg-red-50 text-red-700" },
  중립: { dot: "bg-amber-400", className: "bg-amber-50 text-amber-700" },
};

export function ImpactChip({ level }: { level: ImpactLevel }) {
  const { dot, className } = config[level];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {level}
    </span>
  );
}
