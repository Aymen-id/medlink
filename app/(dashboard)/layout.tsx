import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard/DashboardShell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch the doctor profile for display name / avatar
  const { data: profile } = await supabase
    .from("doctor_profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single()

  const sidebarUser = {
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "Doctor",
    email: user.email ?? "",
    avatarUrl: profile?.avatar_url ?? null,
  }

  return <DashboardShell user={sidebarUser}>{children}</DashboardShell>
}
