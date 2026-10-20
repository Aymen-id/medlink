"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SETTINGS_SECTIONS } from "./sections"

export function SettingsFrame({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname()
  const section = SETTINGS_SECTIONS.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))

  return (
    <div data-slot="settings-container" className="@container/settings mx-auto w-full min-w-0 max-w-7xl space-y-6">
      {section && (
        <nav aria-label="Settings sections" className="grid grid-cols-2 gap-2 border-b border-border pb-4 @[40rem]/settings:flex @[40rem]/settings:flex-wrap">
          {[{ href: "/settings", title: "Settings" }, ...SETTINGS_SECTIONS].map(({ href, title }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === section.href ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-auto min-h-11 min-w-0 justify-start whitespace-normal px-3 py-2 text-left leading-5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background @[40rem]/settings:min-h-9",
                href === section.href
                  ? "bg-accent text-accent-foreground underline decoration-primary underline-offset-4"
                  : "text-muted-foreground"
              )}
            >
              {title}
            </Link>
          ))}
        </nav>
      )}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{section?.title ?? "Settings"}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {section?.pageDescription ?? "Choose a section to view its settings."}
        </p>
      </header>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
