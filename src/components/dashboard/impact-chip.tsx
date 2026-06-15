"use client";

import type { ImpactLevel } from "@/types/dart";

const config: Record<ImpactLevel, { emoji: string; className: string }> = {
  호재: { emoji: "🟢", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  악재: { emoji: "🔴", className: "bg-red-100 text-red-800 border-red-300 animate-pulse" },
  중립: { emoji: "🟡", className: "bg-amber-100 text-amber-800 border-amber-300" },
};

export function ImpactChip({ level }: { level: ImpactLevel }) {
  const { emoji, className } = config[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 ${className}`}>
      {emoji} {level}
    </span>
  );
}
