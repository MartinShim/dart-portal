"use client";

import type { DisclosureInsight } from "@/types/dart";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ImpactChip } from "./impact-chip";
import { TagBadge } from "./tag-badge";
import { Separator } from "@/components/ui/separator";

interface Props {
  insight: DisclosureInsight | null;
  onClose: () => void;
}

export function DetailDrawer({ insight, onClose }: Props) {
  if (!insight) return null;

  const dateStr = insight.receiptDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

  return (
    <Sheet open={!!insight} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-lg font-bold">{insight.companyName}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {insight.stockCode && (
              <span className="text-sm text-gray-500">{insight.stockCode}</span>
            )}
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{insight.market}</span>
            <ImpactChip level={insight.impactLevel} />
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">공시명</p>
            <p className="text-sm text-gray-800">{insight.reportName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI 투자 분석 태그</p>
            <div className="flex flex-wrap gap-1.5">
              {insight.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">태그 부여 근거</p>
            <p className="text-sm text-amber-900">{insight.evidence}</p>
          </div>

          {insight.dartUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">DART 원문</p>
              <a
                href={insight.dartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline break-all"
              >
                {insight.dartUrl}
              </a>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
