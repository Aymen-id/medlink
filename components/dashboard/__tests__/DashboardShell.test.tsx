import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/patients",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}))

import { DashboardShell } from "../DashboardShell"
import type { SidebarUser } from "../Sidebar"

const mockUser: SidebarUser = {
  displayName: "Dr. Test User",
  email: "test@clinic.com",
  avatarUrl: null,
}

describe("DashboardShell", () => {
  it("renders children content", () => {
    render(
      <DashboardShell user={mockUser}>
        <div data-testid="child-content">Hello Dashboard</div>
      </DashboardShell>
    )
    expect(screen.getByTestId("child-content")).toBeDefined()
    expect(screen.getByText("Hello Dashboard")).toBeDefined()
  })

  it("renders sidebar navigation", () => {
    render(
      <DashboardShell user={mockUser}>
        <div>Content</div>
      </DashboardShell>
    )
    // Sidebar nav items should be present
    expect(screen.getByText("Patients")).toBeDefined()
    expect(screen.getByText("Analytics")).toBeDefined()
    expect(screen.getByText("Settings")).toBeDefined()
  })

  it("renders search in top bar", () => {
    render(
      <DashboardShell user={mockUser}>
        <div>Content</div>
      </DashboardShell>
    )
    expect(screen.getByPlaceholderText("Search patients, files...")).toBeDefined()
  })
})
