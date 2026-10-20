import type { Metadata } from "next"
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard"

export const metadata: Metadata = {
  title: "Analytics | MediLink",
  description: "Track your public profile performance — views, clicks, and referral sources.",
}

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AnalyticsDashboard />
    </div>
  )
}
