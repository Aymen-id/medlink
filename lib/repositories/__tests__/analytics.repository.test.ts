import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsRepository, hashIp } from '../analytics.repository';
import type { SupabaseClient } from '@supabase/supabase-js';
vi.mock('server-only', () => ({}));

// ---------- chainable mock builder ----------
function createMockSupabase() {
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ['select', 'insert', 'eq', 'gte', 'order', 'single', 'is'];
  for (const m of methods) {
    chainable[m] = vi.fn().mockImplementation(() => chainable);
  }
  const from = vi.fn().mockReturnValue(chainable);
  return { supabase: { from } as unknown as SupabaseClient, from, chain: chainable };
}

const PROFILE_ID = 'profile-123';

describe('AnalyticsRepository', () => {
  let mock: ReturnType<typeof createMockSupabase>;
  let repo: AnalyticsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createMockSupabase();
    repo = new AnalyticsRepository(mock.supabase, PROFILE_ID);
  });

  // ---- recordView ----
  describe('recordView', () => {
    it('should insert a view record with all params', async () => {
      const row = {
        id: 'v1',
        profile_id: PROFILE_ID,
        viewed_at: '2025-01-01T00:00:00Z',
        referral_source: 'https://google.com',
        link_clicked: null,
        user_agent: 'Mozilla/5.0',
        ip_hash: 'abc123',
      };
      mock.chain.single.mockResolvedValueOnce({ data: row, error: null });

      const result = await repo.recordView({
        referralSource: 'https://google.com',
        userAgent: 'Mozilla/5.0',
        ipHash: 'abc123',
      });

      expect(mock.from).toHaveBeenCalledWith('profile_analytics');
      expect(mock.chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        profile_id: PROFILE_ID,
        referral_source: 'https://google.com',
        user_agent: 'Mozilla/5.0',
        ip_hash: 'abc123',
        link_clicked: null,
      }));
      expect(result.data).toBeDefined();
      expect(result.data?.profileId).toBe(PROFILE_ID);
      expect(result.error).toBeNull();
    });

    it('should insert a view with null optionals', async () => {
      const row = {
        id: 'v2',
        profile_id: PROFILE_ID,
        viewed_at: '2025-01-01T00:00:00Z',
        referral_source: null,
        link_clicked: null,
        user_agent: null,
        ip_hash: null,
      };
      mock.chain.single.mockResolvedValueOnce({ data: row, error: null });

      const result = await repo.recordView({});

      expect(mock.chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        referral_source: null,
        user_agent: null,
        ip_hash: null,
      }));
      expect(result.error).toBeNull();
    });

    it('should return error on insert failure', async () => {
      mock.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      const result = await repo.recordView({});
      expect(result.data).toBeNull();
      expect(result.error).toBe('Insert failed');
    });
  });

  // ---- recordClick ----
  describe('recordClick', () => {
    it('should insert a click event for a link type', async () => {
      const row = {
        id: 'c1',
        profile_id: PROFILE_ID,
        viewed_at: '2025-01-01T00:00:00Z',
        referral_source: null,
        link_clicked: 'contact',
        user_agent: null,
        ip_hash: null,
      };
      mock.chain.single.mockResolvedValueOnce({ data: row, error: null });

      const result = await repo.recordClick('contact');

      expect(mock.chain.insert).toHaveBeenCalledWith(expect.objectContaining({
        profile_id: PROFILE_ID,
        link_clicked: 'contact',
      }));
      expect(result.data?.linkClicked).toBe('contact');
      expect(result.error).toBeNull();
    });

    it('should return error on click insert failure', async () => {
      mock.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await repo.recordClick('booking');
      expect(result.data).toBeNull();
      expect(result.error).toBe('DB error');
    });
  });

  // ---- getSummary ----
  describe('getSummary', () => {
    it('should calculate CTR from views and clicks', async () => {
      const rows = [
        { id: '1', link_clicked: null },
        { id: '2', link_clicked: 'contact' },
        { id: '3', link_clicked: null },
        { id: '4', link_clicked: 'booking' },
      ];
      mock.chain.gte.mockResolvedValueOnce({ data: rows, error: null });

      const result = await repo.getSummary(30);

      expect(result.data?.totalViews).toBe(2);
      expect(result.data?.totalClicks).toBe(2);
      expect(result.data?.ctr).toBe(100);
    });

    it('should return 0 CTR when no views', async () => {
      mock.chain.gte.mockResolvedValueOnce({ data: [], error: null });

      const result = await repo.getSummary(7);

      expect(result.data?.totalViews).toBe(0);
      expect(result.data?.ctr).toBe(0);
    });

    it('should return error on query failure', async () => {
      mock.chain.gte.mockResolvedValueOnce({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await repo.getSummary();
      expect(result.data).toBeNull();
      expect(result.error).toBe('Query failed');
    });
  });

  // ---- getDailyMetrics ----
  describe('getDailyMetrics', () => {
    it('should aggregate events into daily buckets', async () => {
      const today = new Date().toISOString().split('T')[0];
      const rows = [
        { viewed_at: `${today}T10:00:00Z`, link_clicked: null },
        { viewed_at: `${today}T11:00:00Z`, link_clicked: 'contact' },
        { viewed_at: `${today}T12:00:00Z`, link_clicked: null },
      ];
      mock.chain.order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await repo.getDailyMetrics(7);

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();

      const todayMetric = result.data?.find((d) => d.date === today);
      expect(todayMetric?.views).toBe(2);
      expect(todayMetric?.clicks).toBe(1);
    });

    it('should prefill all dates with zeros', async () => {
      mock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await repo.getDailyMetrics(7);

      expect(result.data?.length).toBe(7);
      result.data?.forEach((d) => {
        expect(d.views).toBe(0);
        expect(d.clicks).toBe(0);
      });
    });

    it('should return error on query failure', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'Error' },
      });

      const result = await repo.getDailyMetrics();
      expect(result.data).toBeNull();
      expect(result.error).toBe('Error');
    });
  });

  // ---- getTopReferrers ----
  describe('getTopReferrers', () => {
    it('should extract hostname from full URLs', async () => {
      const rows = [
        { referral_source: 'https://google.com/search?q=test' },
        { referral_source: 'https://google.com/search?q=doctor' },
        { referral_source: 'https://twitter.com/drsmith' },
        { referral_source:null },
      ];
      mock.chain.is.mockResolvedValueOnce({ data: rows, error: null });

      const result = await repo.getTopReferrers(10, 30);

      expect(result.data).toBeDefined();
      const google = result.data?.find((s) => s.source === 'google.com');
      expect(google?.count).toBe(2);
      const twitter = result.data?.find((s) => s.source === 'twitter.com');
      expect(twitter?.count).toBe(1);
      expect(result.data?.find(source=>source.source==='Direct')?.count).toBe(1);
    });

    it('should handle non-URL referral sources gracefully', async () => {
      const rows = [
        { referral_source: 'direct-link' },
        { referral_source: 'qr-code' },
      ];
      mock.chain.is.mockResolvedValueOnce({ data: rows, error: null });

      const result = await repo.getTopReferrers(10, 30);

      expect(result.data?.length).toBe(2);
      expect(result.data?.some((s) => s.source === 'direct-link')).toBe(true);
    });

    it('should sort by count descending and limit results', async () => {
      const rows = Array.from({ length: 15 }, (_, i) => ({
        referral_source: `https://site${i % 3}.com`,
      }));
      mock.chain.is.mockResolvedValueOnce({ data: rows, error: null });

      const result = await repo.getTopReferrers(2, 30);

      expect(result.data?.length).toBe(2);
      if (result.data && result.data.length >= 2) {
        expect(result.data[0].count).toBeGreaterThanOrEqual(result.data[1].count);
      }
    });

    it('should return error on query failure', async () => {
      mock.chain.is.mockResolvedValueOnce({
        data: null,
        error: { message: 'Denied' },
      });

      const result = await repo.getTopReferrers();
      expect(result.data).toBeNull();
      expect(result.error).toBe('Denied');
    });
  });
});

// ---- hashIp utility ----
describe('hashIp', () => {
  beforeEach(() => vi.stubEnv('IP_HASH_SALT', 'synthetic-test-salt-at-least-32-characters'));
  it('should return a 64-char hex string', async () => {
    const hash = await hashIp('192.168.1.1');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce consistent hashes for the same IP', async () => {
    const hash1 = await hashIp('10.0.0.1');
    const hash2 = await hashIp('10.0.0.1');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different IPs', async () => {
    const hash1 = await hashIp('10.0.0.1');
    const hash2 = await hashIp('10.0.0.2');
    expect(hash1).not.toBe(hash2);
  });
});
