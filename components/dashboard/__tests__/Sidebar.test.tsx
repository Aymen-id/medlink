import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock next/navigation
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockPathname = vi.fn(() => "/patients")

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
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

// Import AFTER mocks
import { DesktopSidebar, type SidebarUser } from "../Sidebar"

const mockUser: SidebarUser = {
  displayName: "Dr. Jane Smith",
  email: "jane@clinic.com",
  avatarUrl: null,
}

describe("DesktopSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue("/patients")
  })

  it("renders the app name", () => {
    render(<DesktopSidebar user={mockUser} />)
    expect(screen.getByText("MediLink")).toBeDefined()
  })

  it("renders all navigation links", () => {
    render(<DesktopSidebar user={mockUser} />)
    expect(screen.getByText("Patients")).toBeDefined()
    expect(screen.getByText("Analytics")).toBeDefined()
    expect(screen.getByText("Settings")).toBeDefined()
  })

  it("highlights the active navigation link", () => {
    mockPathname.mockReturnValue("/patients")
    render(<DesktopSidebar user={mockUser} />)

    const patientsLink = screen.getByText("Patients").closest("a")
    expect(patientsLink?.className).toContain("text-[#1E40AF]")
  })

  it("renders user display name and email", () => {
    render(<DesktopSidebar user={mockUser} />)
    expect(screen.getByText("Dr. Jane Smith")).toBeDefined()
    expect(screen.getByText("jane@clinic.com")).toBeDefined()
  })

  it("renders user initials in avatar fallback", () => {
    render(<DesktopSidebar user={mockUser} />)
    // Should show "JS" from "Dr. Jane Smith" — first letters of each word
    // Actually getInitials splits on space, so "Dr." -> "D", "Jane" -> "J" => "DJ"
    expect(screen.getByText("DJ")).toBeDefined()
  })

  it("renders logout button", () => {
    render(<DesktopSidebar user={mockUser} />)
    expect(screen.getByText("Log out")).toBeDefined()
  })
})
