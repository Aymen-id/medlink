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
    <div className="flex h-screen overflow-hidden bg-gray-50/50">
      {/* Desktop sidebar */}
      <DesktopSidebar user={user} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar user={user} />
        {workspaceSwitcher}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
