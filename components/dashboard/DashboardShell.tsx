"use client"

import { DesktopSidebar, type SidebarUser } from "@/components/dashboard/Sidebar"
import { TopBar } from "@/components/dashboard/TopBar"

type DashboardShellProps = {
  readonly user: SidebarUser
  readonly children: React.ReactNode
  readonly workspaceSwitcher?: React.ReactNode
}

export function DashboardShell({ user, children,workspaceSwitcher }: DashboardShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-muted/50">
      <a href="#dashboard-main" className="absolute left-4 top-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground focus:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <DesktopSidebar user={user} />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar user={user} />
        {workspaceSwitcher && (
          <div className="shrink-0 [&_[data-slot=select-trigger]]:min-h-11 [&_[data-slot=select-trigger]]:bg-background md:[&_[data-slot=select-trigger]]:min-h-8">
            {workspaceSwitcher}
          </div>
        )}

        {/* Page content */}
        <main id="dashboard-main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
