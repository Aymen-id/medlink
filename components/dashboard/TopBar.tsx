"use client"

import { useRouter } from "next/navigation"
import { Search, User, Settings, LogOut } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MobileSidebar, type SidebarUser } from "@/components/dashboard/Sidebar"
import { createClient } from "@/lib/supabase/client"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

type TopBarProps = {
  readonly user: SidebarUser
}

export function TopBar({ user }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {/* Mobile hamburger */}
      <MobileSidebar user={user} />

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const q = new FormData(e.currentTarget).get("q")
          if (typeof q === "string" && q.trim()) {
            router.push(`/search?q=${encodeURIComponent(q.trim())}`)
          }
        }}
        className="relative flex-1 max-w-md"
      >
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          placeholder="Search patients, files..."
          className="pl-9 h-8 bg-muted/50 border-0 focus-visible:ring-1"
          aria-label="Search patients and files"
          data-testid="search-input"
        />
      </form>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-11 rounded-full transition-colors md:size-8"
              aria-label="User menu"
              data-testid="user-menu-trigger"
            />
          }
        >
          <Avatar size="sm">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.displayName} />
            ) : null}
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-2rem)]">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Current workspace</span>
                <span className="break-words text-sm font-medium text-foreground">{user.displayName}</span>
                <span className="mt-2 text-xs text-muted-foreground">Signed in as</span>
                <span className="break-all text-sm font-normal text-foreground">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="min-h-11 gap-3 px-3 md:min-h-8" onClick={() => router.push("/settings/profile")}>
              <User aria-hidden="true" className="size-4" />
              Public Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 gap-3 px-3 md:min-h-8" onClick={() => router.push("/settings")}>
              <Settings aria-hidden="true" className="size-4" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 gap-3 px-3 md:min-h-8"
            onClick={handleLogout}
            data-testid="user-menu-logout"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
