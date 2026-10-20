'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, FolderLock, Globe } from 'lucide-react';
import { FeaturesVisual } from './FeaturesVisual';

const features = [
  {
    icon: FolderLock,
    title: 'Find the right file',
    body: 'Keep patient documents in folders, add tags, and search by name. Give assistants explicit view or edit access.',
  },
  {
    icon: CalendarDays,
    title: 'Keep the appointment context',
    body: 'Record timestamped notes on Pro or Clinic. Return to the history before the next consultation.',
  },
  {
    icon: Globe,
    title: 'Make your practice easy to find',
    body: 'Share your specialty, clinic hours and contact details on a public profile with a simple physician address.',
  },
];

export function FeaturesRoadmap() {
  const listRef = useRef<HTMLOListElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    // Server HTML and unsupported browsers keep the complete, static roadmap.
    if (!list || !window.CSS?.supports?.('animation-timeline: view()') ||
      !window.CSS.supports('animation-range: entry 0% cover 35%') || !window.matchMedia) return;

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = typeof window.IntersectionObserver === 'function'
      ? new window.IntersectionObserver(entries => {
        if (preference.matches) return;
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveFeature(Number(entry.target.getAttribute('data-feature-step')));
        }
      }, { rootMargin: `-${Math.round(window.innerHeight * 0.2)}px 0px -${Math.round(window.innerHeight * 0.6)}px 0px` })
      : null;

    const updateMotion = () => {
      observer?.disconnect();
      if (preference.matches) {
        list.removeAttribute('data-motion');
        contextRef.current?.removeAttribute('data-motion');
      } else {
        list.setAttribute('data-motion', 'ready');
        contextRef.current?.setAttribute('data-motion', 'ready');
        list.querySelectorAll('[data-feature-step]').forEach(step => observer?.observe(step));
      }
    };

    updateMotion();
    preference.addEventListener('change', updateMotion);
    return () => {
      preference.removeEventListener('change', updateMotion);
      observer?.disconnect();
    };
  }, []);

  return (
    <section id="features" aria-labelledby="features-heading" className="border-y border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20 lg:py-24">
        <div ref={contextRef} className="features-context min-w-0 self-start">
          <h2 id="features-heading" className="max-w-xl text-3xl leading-tight font-semibold tracking-tight text-balance lg:text-4xl">
            Keep the work around care simple.
          </h2>
          <FeaturesVisual activeFeature={activeFeature} />
        </div>
        <ol ref={listRef} className="features-roadmap relative mt-12 list-none lg:mt-0" role="list">
          {features.map(({ icon: Icon, title, body }, index) => (
            <li key={title} data-feature-step={index} className="features-roadmap-step relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-4 pb-20 last:pb-0 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:gap-8 sm:pb-24 lg:last:pb-36">
              {index < features.length - 1 && (
                <span aria-hidden="true" className="pointer-events-none absolute start-4 top-4 -bottom-4 w-px bg-border sm:start-5 sm:top-5 sm:-bottom-5">
                  <span className="features-roadmap-progress block size-full origin-top bg-primary" />
                </span>
              )}
              <span aria-hidden="true" className="relative flex size-8 items-center justify-center rounded-full border border-primary/30 bg-background text-xs font-semibold text-primary sm:size-10 sm:text-sm">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="features-roadmap-copy min-w-0 pt-1 sm:pt-2">
                <Icon aria-hidden="true" className="mb-5 size-6 text-primary" />
                <h3 className="max-w-md text-xl leading-tight font-semibold tracking-tight text-balance sm:text-2xl">{title}</h3>
                <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
