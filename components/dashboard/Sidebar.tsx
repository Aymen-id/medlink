"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import { APP_NAME } from "@/lib/constants"

type NavItem = {
  readonly label: string
  readonly href: string
  readonly icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
] as const

type SidebarUser = {
  readonly displayName: string
  readonly email: string
  readonly avatarUrl?: string | null
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function NavLink({
  item,
  isActive,
  isExact,
}: {
  readonly item: NavItem
  readonly isActive: boolean
  readonly isExact: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      data-testid={`nav-${item.label.toLowerCase()}`}
      aria-current={isActive ? item.href === "/settings" && !isExact ? "location" : "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        item.href === "/settings" && "min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:min-h-9",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  )
}

function SidebarNav({ user }: { readonly user: SidebarUser }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Image src="/medilink-logo.svg" alt={APP_NAME} width={136} height={32} />
        <span className="sr-only">{APP_NAME}</span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={pathname.startsWith(item.href)}
            isExact={pathname === item.href}
          />
        ))}
      </nav>

      <Separator />

      {/* User section */}
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.displayName} />
            ) : null}
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-2 text-muted-foreground"
          onClick={handleLogout}
          data-testid="sidebar-logout"
        >
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </div>
  )
}

/** Desktop sidebar — visible on md+ */
function DesktopSidebar({ user }: { readonly user: SidebarUser }) {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-background">
      <SidebarNav user={user} />
    </aside>
  )
}

/** Mobile sidebar — sheet triggered by hamburger */
function MobileSidebar({ user }: { readonly user: SidebarUser }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SidebarNav user={user} />
      </SheetContent>
    </Sheet>
  )
}

export { DesktopSidebar, MobileSidebar, type SidebarUser }
