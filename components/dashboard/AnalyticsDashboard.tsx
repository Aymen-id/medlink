"use client"

import { useCallback, useEffect, useState } from "react"
import { AnalyticsOverview } from "@/components/dashboard/AnalyticsOverview"
import { ViewsChart } from "@/components/dashboard/ViewsChart"
import { ReferralBreakdown } from "@/components/dashboard/ReferralBreakdown"
import { DateRangePicker } from "@/components/dashboard/DateRangePicker"
import type { AnalyticsSummary, DailyMetric, SourceMetric } from "@/lib/repositories/analytics.repository"

type AnalyticsData = {
  summary: AnalyticsSummary
  daily: DailyMetric[]
  referrers: SourceMetric[]
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (range: number) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/analytics/stats?days=${range}`)
      const json = await response.json()

      if (!response.ok) {
        setError(json.error ?? "Failed to load analytics")
        return
      }

      setData(json.data)
    } catch {
      setError("Failed to connect to the server")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // A network request starts here; its loading state is part of that external synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(days)
  }, [days, fetchData])

  function handleRangeChange(newDays: number) {
    setDays(newDays)
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => fetchData(days)}
          className="mt-3 text-sm font-medium text-[#1E40AF] hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <DateRangePicker value={days} onChange={handleRangeChange} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-gray-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-xl border bg-gray-100" />
        <div className="h-48 animate-pulse rounded-xl border bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Profile Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Last {days} days performance
          </p>
        </div>
        <DateRangePicker value={days} onChange={handleRangeChange} />
      </div>

      <AnalyticsOverview
        totalViews={data.summary.totalViews}
        totalClicks={data.summary.totalClicks}
        ctr={data.summary.ctr}
      />

      <ViewsChart data={data.daily} />

      <ReferralBreakdown data={data.referrers} />
    </div>
  )
}
