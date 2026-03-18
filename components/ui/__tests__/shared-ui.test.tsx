import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Users } from "lucide-react"

import { EmptyState } from "../EmptyState"
import {
  Skeleton,
  PatientCardSkeleton,
  FileRowSkeleton,
  PageLoadingSkeleton,
} from "../LoadingState"

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    render(
      <EmptyState
        icon={Users}
        title="No patients yet"
        description="Add your first patient to get started."
      />
    )
    expect(screen.getByText("No patients yet")).toBeDefined()
    expect(
      screen.getByText("Add your first patient to get started.")
    ).toBeDefined()
  })

  it("renders action button when provided", () => {
    const handleAction = () => {}
    render(
      <EmptyState
        icon={Users}
        title="No patients"
        description="Get started"
        actionLabel="Add Patient"
        onAction={handleAction}
      />
    )
    expect(screen.getByText("Add Patient")).toBeDefined()
  })

  it("does not render action button when no label provided", () => {
    render(
      <EmptyState
        icon={Users}
        title="No patients"
        description="Get started"
      />
    )
    expect(screen.queryByRole("button")).toBeNull()
  })
})

describe("Skeleton components", () => {
  it("renders Skeleton with custom class", () => {
    const { container } = render(<Skeleton className="h-10 w-32" />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.className).toContain("animate-pulse")
    expect(skeleton.className).toContain("h-10")
  })

  it("renders PatientCardSkeleton", () => {
    const { container } = render(<PatientCardSkeleton />)
    expect(container.firstChild).toBeDefined()
  })

  it("renders FileRowSkeleton", () => {
    const { container } = render(<FileRowSkeleton />)
    expect(container.firstChild).toBeDefined()
  })

  it("renders PageLoadingSkeleton with default count", () => {
    const { container } = render(<PageLoadingSkeleton />)
    // Should render 6 skeleton cards by default
    const cards = container.querySelectorAll("[class*='rounded-xl']")
    expect(cards.length).toBe(6)
  })

  it("renders PageLoadingSkeleton with custom count", () => {
    const { container } = render(<PageLoadingSkeleton count={3} />)
    const cards = container.querySelectorAll("[class*='rounded-xl']")
    expect(cards.length).toBe(3)
  })
})
