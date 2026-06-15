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
      className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200"
      onClick={() => onClick(insight)}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-semibold text-sm text-gray-900">{insight.companyName}</span>
            {insight.stockCode && (
              <span className="ml-1.5 text-xs text-gray-400">{insight.stockCode}</span>
            )}
            <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {insight.market}
            </span>
          </div>
          <ImpactChip level={insight.impactLevel} />
        </div>

        <p className="text-xs text-gray-500 truncate">{insight.reportName}</p>

        <div className="flex flex-wrap gap-1">
          {insight.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>

        <p className="text-xs text-gray-600 line-clamp-2">{insight.summary}</p>

        <p className="text-xs text-gray-400">{dateStr}</p>
      </CardContent>
    </Card>
  );
}
