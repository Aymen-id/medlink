import { CreditCard, Globe, Users } from "lucide-react"

export const SETTINGS_SECTIONS = [
  {
    href: "/settings/profile",
    title: "Public Profile",
    description: "Your medilink.io/drname page — specialty, credentials, hours, contact buttons.",
    pageDescription: "Configure your public-facing MediLink profile page.",
    icon: Globe,
  },
  {
    href: "/settings/team",
    title: "Team Access",
    description: "Grant view or edit access to receptionists and assistants (Clinic plan).",
    pageDescription: "Clinic includes up to eight physician workspaces, including pending provider invitations. Staff receive explicit access to the selected workspace after accepting an invitation.",
    icon: Users,
  },
  {
    href: "/settings/billing",
    title: "Billing & Plan",
    description: "Manage your Free / Pro / Clinic subscription and invoices.",
    pageDescription: "Manage your subscription and billing settings.",
    icon: CreditCard,
  },
] as const
