import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Phone, MessageCircle, Mail, ExternalLink } from 'lucide-react';

type ContactCTAProps = {
  contactCTA: string | null;
  bookingCTA: string | null;
};

function getContactType(cta: string): 'phone' | 'whatsapp' | 'email' | 'link' {
  if (cta.startsWith('mailto:') || cta.includes('@')) return 'email';
  if (cta.startsWith('https://wa.me') || cta.toLowerCase().includes('whatsapp')) return 'whatsapp';
  if (cta.startsWith('tel:') || cta.startsWith('+') || /^\d/.test(cta)) return 'phone';
  return 'link';
}

function formatContactHref(cta: string, type: 'phone' | 'whatsapp' | 'email' | 'link'): string {
  switch (type) {
    case 'phone':
      return cta.startsWith('tel:') ? cta : `tel:${cta.replace(/\s/g, '')}`;
    case 'email':
      return cta.startsWith('mailto:') ? cta : `mailto:${cta}`;
    case 'whatsapp':
      return cta.startsWith('http') ? cta : `https://wa.me/${cta.replace(/[^0-9]/g, '')}`;
    case 'link':
      return cta.startsWith('http') ? cta : `https://${cta}`;
  }
}

const ICON_MAP = {
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  link: ExternalLink,
};

const LABEL_MAP = {
  phone: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  link: 'Contact',
};

export function ContactCTA({ contactCTA, bookingCTA }: ContactCTAProps) {
  if (!contactCTA && !bookingCTA) return null;

  const contactType = contactCTA ? getContactType(contactCTA) : null;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {contactCTA && contactType && (() => {
        const Icon = ICON_MAP[contactType];
        return (
          <a
            href={formatContactHref(contactCTA, contactType)}
            target={contactType === 'link' ? '_blank' : undefined}
            rel={contactType === 'link' ? 'noopener noreferrer' : undefined}
            className={cn(
              buttonVariants({ variant: 'default', size: 'lg' }),
              'flex-1 bg-blue-800 hover:bg-blue-700 text-white h-12 text-base justify-center',
            )}
          >
            <Icon className="mr-2 h-5 w-5" />
            {LABEL_MAP[contactType]}
          </a>
        );
      })()}
      {bookingCTA && (
        <a
          href={bookingCTA.startsWith('http') ? bookingCTA : `https://${bookingCTA}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'flex-1 border-blue-800 text-blue-800 hover:bg-blue-50 h-12 text-base justify-center',
          )}
        >
          <ExternalLink className="mr-2 h-5 w-5" />
          Book Appointment
        </a>
      )}
    </div>
  );
}
