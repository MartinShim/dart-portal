"use client";

import type { DisclosureInsight } from "@/types/dart";
import { ImpactChip } from "./impact-chip";
import { TagBadge } from "./tag-badge";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  insight: DisclosureInsight;
  onClick: (insight: DisclosureInsight) => void;
}

export function DisclosureCard({ insight, onClick }: Props) {
  const dateStr = insight.receiptDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

  return (
    <Card
      className="group cursor-pointer rounded-3xl border border-[var(--sam-line)] shadow-sm hover:shadow-lg hover:border-[var(--sam-blue)]/40 hover:-translate-y-0.5 transition-all duration-200"
      onClick={() => onClick(insight)}
    >
      <CardContent className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-bold text-[15px] text-[var(--sam-ink)] group-hover:text-[var(--sam-blue)] transition-colors">{insight.companyName}</span>
            {insight.stockCode && (
              <span className="ml-2 text-xs text-gray-400 tabular-nums">{insight.stockCode}</span>
            )}
            <span className="ml-2 text-[10px] font-medium text-[var(--sam-sub)] bg-[var(--sam-bg)] px-1.5 py-0.5 rounded-md">
              {insight.market}
            </span>
          </div>
          <ImpactChip level={insight.impactLevel} />
        </div>

        <p className="text-xs text-[var(--sam-sub)] truncate">{insight.reportName}</p>

        <div className="flex flex-wrap gap-1.5">
          {insight.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        <p className="text-[13px] text-gray-600 leading-relaxed line-clamp-2">{insight.summary}</p>

        <p className="text-[11px] text-gray-400 tabular-nums pt-0.5">{dateStr}</p>
      </CardContent>
    </Card>
  );
}
