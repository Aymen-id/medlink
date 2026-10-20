import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { SettingsFrame } from "../SettingsFrame"
import SettingsPage from "@/app/(dashboard)/settings/page"

const { route } = vi.hoisted(() => ({ route: { pathname: "/settings" } }))
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }))

describe("Settings wayfinding", () => {
  it("provides one page heading and the three existing directory destinations", () => {
    route.pathname = "/settings"
    render(<SettingsFrame><SettingsPage /></SettingsFrame>)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    const directory = screen.getByRole("navigation", { name: "Settings sections" })
    expect(within(directory).getAllByRole("link")).toHaveLength(3)
    for (const [name, href] of [
      ["Public Profile", "/settings/profile"],
      ["Team Access", "/settings/team"],
      ["Billing & Plan", "/settings/billing"],
    ]) {
      expect(within(directory).getByRole("link", { name })).toHaveAttribute("href", href)
    }
    expect(screen.getByText(/receptionists and assistants \(Clinic plan\)/)).toBeVisible()
  })

  it.each([
    ["/settings/profile", "Public Profile"],
    ["/settings/team", "Team Access"],
    ["/settings/billing", "Billing & Plan"],
  ])("keeps navigation and one h1 available at %s even when the content is restricted", (pathname, title) => {
    route.pathname = pathname
    render(<SettingsFrame><p>Your account admin manages this section.</p></SettingsFrame>)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeVisible()
    const navigation = screen.getByRole("navigation", { name: "Settings sections" })
    expect(within(navigation).getAllByRole("link")).toHaveLength(4)
    expect(within(navigation).getByRole("link", { name: title })).toHaveAttribute("aria-current", "page")
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(within(navigation).getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings")
    expect(screen.getByText("Your account admin manages this section.")).toBeVisible()
  })
})
