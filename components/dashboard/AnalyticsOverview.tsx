"use client"

import { Eye, MousePointerClick, TrendingUp } from "lucide-react"

type AnalyticsOverviewProps = {
  readonly totalViews: number
  readonly totalClicks: number
  readonly ctr: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
}: {
  readonly label: string
  readonly value: number | string
  readonly icon: React.ComponentType<{ className?: string }>
  readonly suffix?: string
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="rounded-lg bg-[#1E40AF]/10 p-2">
          <Icon className="size-4 text-[#1E40AF]" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight">
          {value}
          {suffix ? <span className="text-lg text-muted-foreground">{suffix}</span> : null}
        </p>
      </div>
    </div>
  )
}

export function AnalyticsOverview({ totalViews, totalClicks, ctr }: AnalyticsOverviewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Profile Views" value={totalViews.toLocaleString()} icon={Eye} />
      <StatCard label="Link Clicks" value={totalClicks.toLocaleString()} icon={MousePointerClick} />
      <StatCard label="Click-Through Rate" value={ctr.toFixed(1)} icon={TrendingUp} suffix="%" />
    </div>
  )
}
