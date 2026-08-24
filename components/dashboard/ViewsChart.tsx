"use client"

import type { DailyMetric } from "@/lib/repositories/analytics.repository"

type ViewsChartProps = {
  readonly data: DailyMetric[]
}

/**
 * Simple SVG line chart for daily views and clicks.
 * No external chart library — lightweight and dependency-free.
 */
export function ViewsChart({ data }: ViewsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-white text-muted-foreground">
        No data available
      </div>
    )
  }

  const maxViews = Math.max(...data.map((d) => d.views), 1)
  const chartWidth = 800
  const chartHeight = 200
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom

  const xScale = (i: number) => padding.left + (i / (data.length - 1 || 1)) * innerWidth
  const yScale = (v: number) => padding.top + innerHeight - (v / maxViews) * innerHeight

  const viewsLine = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.views)}`).join(" ")
  const clicksLine = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.clicks)}`).join(" ")

  // Area under the views line
  const viewsArea = `${viewsLine} L ${xScale(data.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`

  // Y-axis labels
  const yLabels = [0, Math.round(maxViews / 2), maxViews]

  // X-axis labels (show every ~7th date)
  const step = Math.max(1, Math.floor(data.length / 6))
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1)

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Daily Views & Clicks</h3>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-[#1E40AF]" />
            Views
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            Clicks
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yLabels.map((v) => (
          <line
            key={v}
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke="#e5e7eb"
            strokeDasharray="4,4"
          />
        ))}

        {/* Area fill */}
        <path d={viewsArea} fill="#1E40AF" fillOpacity={0.08} />

        {/* Lines */}
        <path d={viewsLine} fill="none" stroke="#1E40AF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={clicksLine} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6,3" />

        {/* Y-axis labels */}
        {yLabels.map((v) => (
          <text key={v} x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
            {v}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((d) => {
          const i = data.indexOf(d)
          const dateLabel = new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          return (
            <text key={d.date} x={xScale(i)} y={chartHeight - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {dateLabel}
            </text>
          )
        })}

        {/* Data points */}
        {data.map((d, i) => (
          <circle key={`v-${d.date}`} cx={xScale(i)} cy={yScale(d.views)} r={2.5} fill="#1E40AF" />
        ))}
      </svg>
    </div>
  )
}
