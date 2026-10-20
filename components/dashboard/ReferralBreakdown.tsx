"use client"

import type { SourceMetric } from "@/lib/repositories/analytics.repository"
import { Globe } from "lucide-react"

type ReferralBreakdownProps = {
  readonly data: SourceMetric[]
}

export function ReferralBreakdown({ data }: ReferralBreakdownProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Top Referral Sources</h3>
        <p className="text-sm text-muted-foreground">No referral data yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">Top Referral Sources</h3>
      <div className="space-y-3">
        {data.map((source) => (
          <div key={source.source} className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <Globe className="size-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-medium">{source.source}</p>
                <p className="ml-2 text-sm font-semibold tabular-nums">{source.count}</p>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-[#1E40AF] transition-all"
                  style={{ width: `${(source.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
