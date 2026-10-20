import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SETTINGS_SECTIONS } from '@/components/settings/sections';

export const metadata = {
  title: 'Settings | MediLink',
};

export default function SettingsPage() {
  return (
    <nav aria-label="Settings sections">
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <ul className="divide-y divide-border">
            {SETTINGS_SECTIONS.map(({ href, title, description, icon: Icon }, index) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-labelledby={`settings-title-${index}`}
                  aria-describedby={`settings-description-${index}`}
                  className="group flex min-h-11 items-start gap-3 px-4 py-5 transition-colors hover:bg-muted/50 focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:gap-4 sm:px-6"
                >
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 id={`settings-title-${index}`} className="text-base font-medium leading-6 text-foreground group-hover:text-primary group-focus-visible:text-primary">{title}</h2>
                    <p id={`settings-description-${index}`} className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                  <ChevronRight aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </nav>
  );
}
