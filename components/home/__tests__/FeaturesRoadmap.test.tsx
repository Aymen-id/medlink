import { act, cleanup, render, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';

const titles = [
  'Find the right file',
  'Keep the appointment context',
  'Make your practice easy to find',
];

describe('homepage features roadmap', () => {
  let reducedMotion = false;
  let timelineSupport = true;
  let preferenceListeners: Set<() => void>;

  beforeEach(() => {
    reducedMotion = false;
    timelineSupport = true;
    preferenceListeners = new Set();
    vi.stubGlobal('CSS', { supports: () => timelineSupport });
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return reducedMotion; },
      addEventListener: (_event: string, listener: () => void) => preferenceListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => preferenceListeners.delete(listener),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('presents all three features in one ordered list with the preserved reading order', () => {
    const { container } = render(<Home />);
    const section = container.querySelector<HTMLElement>('#features')!;
    const list = within(section).getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items.map(item => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual(titles);
    expect(items[1]).toHaveTextContent('Record timestamped notes on Pro or Clinic. Return to the history before the next consultation.');
    expect(section.querySelectorAll('svg:not([aria-hidden="true"])')).toHaveLength(0);
  });

  it('ships the entire readable roadmap in the server HTML before any enhancement runs', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<Home />);
    document.body.appendChild(host);
    const section = host.querySelector<HTMLElement>('#features')!;
    const list = within(section).getByRole('list');
    expect(list).not.toHaveAttribute('data-motion');
    for (const title of titles) {
      expect(within(list).getByRole('heading', { name: title })).toBeVisible();
    }
    expect(section.querySelector('[hidden], [aria-hidden="true"] h3')).toBeNull();
    host.remove();
  });

  it('removes motion immediately when the visitor switches to reduced motion', () => {
    const { container } = render(<Home />);
    const list = within(container.querySelector<HTMLElement>('#features')!).getByRole('list');
    expect(list).toHaveAttribute('data-motion', 'ready');
    act(() => {
      reducedMotion = true;
      preferenceListeners.forEach(listener => listener());
    });
    expect(list).not.toHaveAttribute('data-motion');
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it.each(['reduced motion', 'unsupported timelines'] as const)('keeps a static readable fallback for %s', mode => {
    reducedMotion = mode === 'reduced motion';
    timelineSupport = mode !== 'unsupported timelines';
    const { container } = render(<Home />);
    const list = within(container.querySelector<HTMLElement>('#features')!).getByRole('list');
    expect(list).not.toHaveAttribute('data-motion');
    expect(within(list).getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it('keeps the heading with its decorative visual and changes the visual with the current feature', () => {
    let observeEntries: (entries: Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>[]) => void = () => {};
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: typeof observeEntries) { observeEntries = callback; }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<Home />);
    const visual = container.querySelector<HTMLElement>('[data-feature-visual]');
    expect(visual).not.toBeNull();
    expect(visual).toHaveAttribute('aria-hidden', 'true');
    expect(visual).toHaveAttribute('data-feature', '0');
    expect(visual?.parentElement).toContainElement(within(container).getByRole('heading', { name: 'Keep the work around care simple.' }));
    const steps = container.querySelectorAll('#features ol > li');
    act(() => observeEntries([{ target: steps[1], isIntersecting: true }]));
    expect(visual).toHaveAttribute('data-feature', '1');
    act(() => observeEntries([{ target: steps[2], isIntersecting: true }]));
    expect(visual).toHaveAttribute('data-feature', '2');
    act(() => {
      reducedMotion = true;
      preferenceListeners.forEach(listener => listener());
      observeEntries([{ target: steps[0], isIntersecting: true }]);
    });
    expect(visual).toHaveAttribute('data-feature', '2');
  });
});
