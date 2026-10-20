import { CalendarDays, Clock3, FileText, Globe, LockKeyhole, UserRound } from 'lucide-react';

export function FeaturesVisual({ activeFeature }: { activeFeature: number }) {
  return (
    <div data-feature-visual="" data-feature={activeFeature} aria-hidden="true" className="pointer-events-none mt-8 hidden w-full max-w-sm lg:block">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 360 280" className="w-full overflow-visible text-primary">
        <circle cx="180" cy="140" r="110" className="fill-accent" />

        <g data-active={activeFeature === 0} className="features-visual-scene opacity-0 data-[active=true]:opacity-100">
          {[{ x: 77, y: 42 }, { x: 146, y: 24 }, { x: 215, y: 42 }].map(({ x, y }, index) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <g className={`features-visual-file features-visual-file-${index}`}>
                <rect width="68" height="98" rx="8" strokeWidth="1.5" className="fill-background stroke-border" />
                <FileText aria-hidden="true" x="19" y="16" width="30" height="30" strokeWidth="1.5" />
                <path d="M16 63h36M16 74h27" strokeWidth="3" strokeLinecap="round" className="stroke-border" />
              </g>
            </g>
          ))}
          <path d="M78 134a12 12 0 0 1 12-12h54l18 16h108a12 12 0 0 1 12 12v70a12 12 0 0 1-12 12H90a12 12 0 0 1-12-12Z" strokeWidth="1.5" className="fill-accent stroke-primary" />
          <path d="M78 153h204l-12 79H90Z" strokeWidth="1.5" strokeLinejoin="round" className="fill-background stroke-primary" />
          <LockKeyhole aria-hidden="true" x="165" y="174" width="30" height="30" strokeWidth="1.5" />
        </g>

        <g data-active={activeFeature === 1} className="features-visual-scene opacity-0 data-[active=true]:opacity-100">
          <rect x="70" y="49" width="204" height="192" rx="12" className="fill-accent stroke-border" />
          <rect x="82" y="36" width="204" height="196" rx="12" strokeWidth="1.5" className="fill-background stroke-border" />
          <CalendarDays aria-hidden="true" x="104" y="60" width="36" height="36" strokeWidth="1.5" />
          <Clock3 aria-hidden="true" x="242" y="65" width="20" height="20" strokeWidth="1.5" />
          <path d="M105 112h158" strokeWidth="1" className="stroke-border" />
          <g className="features-visual-note-lines">
            <rect x="105" y="134" width="152" height="5" rx="2.5" className="fill-primary/70" />
            <rect x="105" y="154" width="124" height="5" rx="2.5" className="fill-primary/40" />
            <rect x="105" y="174" width="143" height="5" rx="2.5" className="fill-primary/40" />
            <rect x="105" y="194" width="95" height="5" rx="2.5" className="fill-primary/40" />
          </g>
        </g>

        <g data-active={activeFeature === 2} className="features-visual-scene opacity-0 data-[active=true]:opacity-100">
          <rect x="54" y="40" width="252" height="200" rx="12" strokeWidth="1.5" className="fill-background stroke-border" />
          <path d="M54 70h252" strokeWidth="1" className="stroke-border" />
          {[74, 86, 98].map(x => <circle key={x} cx={x} cy="55" r="2.5" className="fill-border" />)}
          <g className="features-visual-profile">
            <circle cx="180" cy="112" r="30" className="fill-accent" />
            <UserRound aria-hidden="true" x="162" y="94" width="36" height="36" strokeWidth="1.5" />
            <rect x="120" y="158" width="120" height="6" rx="3" className="fill-primary/70" />
            <rect x="141" y="175" width="78" height="5" rx="2.5" className="fill-primary/40" />
            <rect x="112" y="198" width="136" height="26" rx="6" className="fill-primary" />
            <Globe aria-hidden="true" x="172" y="203" width="16" height="16" strokeWidth="1.5" className="text-primary-foreground" />
          </g>
        </g>
      </svg>
    </div>
  );
}
