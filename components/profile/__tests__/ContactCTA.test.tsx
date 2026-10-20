import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactCTA } from '../ContactCTA';

describe('ContactCTA click tracking', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
  });

  it('sends a phone-click event when the Call button is clicked', () => {
    render(<ContactCTA contactCTA="+212600000000" bookingCTA={null} profileId="prof-1" />);
    fireEvent.click(screen.getByRole('link', { name: /call/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/analytics/track');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body)).toEqual({
      profileId: 'prof-1',
      type: 'click',
      linkType: 'phone',
    });
  });

  it('sends a booking-click event when the booking button is clicked', () => {
    render(
      <ContactCTA
        contactCTA={null}
        bookingCTA="https://calendly.com/dr-sana"
        profileId="prof-1"
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: /book/i }));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      profileId: 'prof-1',
      type: 'click',
      linkType: 'booking',
    });
  });

  it('does not send events without a profileId', () => {
    render(<ContactCTA contactCTA="contact@clinic.ma" bookingCTA={null} />);
    fireEvent.click(screen.getByRole('link', { name: /email/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('swallows network failures so navigation is never affected', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<ContactCTA contactCTA="+212600000000" bookingCTA={null} profileId="prof-1" />);
    expect(() =>
      fireEvent.click(screen.getByRole('link', { name: /call/i })),
    ).not.toThrow();
  });
});
