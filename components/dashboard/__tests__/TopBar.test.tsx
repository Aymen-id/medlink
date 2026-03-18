import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/patients",
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
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

import { TopBar } from "../TopBar"
import type { SidebarUser } from "../Sidebar"

const mockUser: SidebarUser = {
  displayName: "Dr. Ali Hassan",
  email: "ali@medclinic.com",
  avatarUrl: null,
}

describe("TopBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders search input", () => {
    render(<TopBar user={mockUser} />)
    const searchInput = screen.getByPlaceholderText("Search patients, files...")
    expect(searchInput).toBeDefined()
  })

  it("renders search input with correct aria-label", () => {
    render(<TopBar user={mockUser} />)
    const searchInput = screen.getByLabelText("Search patients and files")
    expect(searchInput).toBeDefined()
  })

  it("renders user menu trigger button", () => {
    render(<TopBar user={mockUser} />)
    const userMenuButton = screen.getByLabelText("User menu")
    expect(userMenuButton).toBeDefined()
  })

  it("renders user initials in avatar", () => {
    render(<TopBar user={mockUser} />)
    // "Dr. Ali Hassan" -> "D", "A" => "DA"
    expect(screen.getByText("DA")).toBeDefined()
  })
})
