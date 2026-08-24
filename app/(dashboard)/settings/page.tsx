import Link from 'next/link';

export const metadata = {
  title: 'Settings | MediLink',
};

const sections = [
  {
    href: '/settings/profile',
    title: 'Public Profile',
    description: 'Your medilink.io/drname page — specialty, credentials, hours, contact buttons.',
  },
  {
    href: '/settings/team',
    title: 'Team Access',
    description: 'Grant view or edit access to receptionists and assistants (Clinic plan).',
  },
  {
    href: '/settings/billing',
    title: 'Billing & Plan',
    description: 'Manage your Free / Pro / Clinic subscription and invoices.',
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(section => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
          >
            <h2 className="font-medium text-foreground group-hover:text-primary">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
