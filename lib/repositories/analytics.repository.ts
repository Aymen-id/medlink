import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileAnalytics } from '@/types';
import type { ApiResponse } from '@/types/api';
import { getServerConfig } from '@/lib/config/server';
import { z } from 'zod';

export type AnalyticsSummary = {
  totalViews: number;
  totalClicks: number;
  ctr: number; // click-through rate
};

export type DailyMetric = {
  date: string;
  views: number;
  clicks: number;
};

export type SourceMetric = {
  source: string;
  count: number;
};

/**
 * Hashes an IP address using SHA-256 with a salt.
 * Never stores raw IPs — hashed for unique visitor counting only.
 */
export async function hashIp(ip: string): Promise<string> {
  const salt = getServerConfig('analytics').IP_HASH_SALT;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${ip}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class AnalyticsRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly profileId: string,
  ) {}

  async getDashboard(days=30) {
    const { data,error }=await this.supabase.rpc('get_profile_analytics',{ profile:this.profileId,days });
    const parsed=z.object({ summary:z.object({ totalViews:z.number(),totalClicks:z.number(),ctr:z.number() }),daily:z.array(z.object({ date:z.string(),views:z.number(),clicks:z.number() })),referrers:z.array(z.object({ source:z.string(),count:z.number() })) }).safeParse(data);
    return error || !parsed.success ? { data:null,error:'Could not load profile analytics' }:{ data:parsed.data,error:null };
  }

  /**
   * Records a profile view event.
   */
  async recordView(params: {
    referralSource?: string | null;
    userAgent?: string | null;
    ipHash?: string | null;
  }): Promise<ApiResponse<ProfileAnalytics>> {
    const { data, error } = await this.supabase
      .from('profile_analytics')
      .insert({
        profile_id: this.profileId,
        referral_source: params.referralSource ?? null,
        user_agent: params.userAgent ?? null,
        ip_hash: params.ipHash ?? null,
        link_clicked: null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return {
      data: mapAnalyticsRow(data),
      error: null,
    };
  }

  /**
   * Records a link click event on the public profile.
   */
  async recordClick(linkType: string): Promise<ApiResponse<ProfileAnalytics>> {
    const { data, error } = await this.supabase
      .from('profile_analytics')
      .insert({
        profile_id: this.profileId,
        link_clicked: linkType,
        referral_source: null,
        user_agent: null,
        ip_hash: null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return {
      data: mapAnalyticsRow(data),
      error: null,
    };
  }

  /**
   * Fetches a summary of profile analytics.
   */
  async getSummary(days: number = 30): Promise<ApiResponse<AnalyticsSummary>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('profile_analytics')
      .select('id, link_clicked')
      .eq('profile_id', this.profileId)
      .gte('viewed_at', startDate.toISOString());

    if (error) return { data: null, error: error.message };

    const totalViews = data.filter(row=>row.link_clicked===null).length;
    const totalClicks = data.filter((row) => row.link_clicked !== null).length;
    const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

    return {
      data: {
        totalViews,
        totalClicks,
        ctr: parseFloat(ctr.toFixed(2)),
      },
      error: null,
    };
  }

  /**
   * Fetches daily view and click counts for the specified period.
   */
  async getDailyMetrics(days: number = 30): Promise<ApiResponse<DailyMetric[]>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('profile_analytics')
      .select('viewed_at, link_clicked')
      .eq('profile_id', this.profileId)
      .gte('viewed_at', startDate.toISOString())
      .order('viewed_at', { ascending: true });

    if (error) return { data: null, error: error.message };

    const dailyMap = new Map<string, DailyMetric>();

    // Pre-fill all dates with zeros
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, views: 0, clicks: 0 });
    }

    data.forEach((row) => {
      const dateStr = row.viewed_at.split('T')[0];
      const metric = dailyMap.get(dateStr);
      if (metric) {
        if(row.link_clicked===null) metric.views += 1;
        if (row.link_clicked) metric.clicks += 1;
      }
    });

    return {
      data: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      error: null,
    };
  }

  /**
   * Fetches the top referral sources.
   */
  async getTopReferrers(limit: number = 10, days: number = 30): Promise<ApiResponse<SourceMetric[]>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .from('profile_analytics')
      .select('referral_source')
      .eq('profile_id', this.profileId)
      .gte('viewed_at', startDate.toISOString())
      .is('link_clicked', null);

    if (error) return { data: null, error: error.message };

    const sourcesMap = new Map<string, number>();
    data.forEach((row) => {
      let source = 'Direct';
      try {
        if (row.referral_source) {
          const url = new URL(row.referral_source);
          source = url.hostname;
        }
      } catch {
        source = row.referral_source || 'Direct';
      }

      sourcesMap.set(source, (sourcesMap.get(source) || 0) + 1);
    });

    return {
      data: Array.from(sourcesMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit),
      error: null,
    };
  }
}

type AnalyticsRow = {
  id: string;
  profile_id: string;
  viewed_at: string;
  referral_source: string | null;
  link_clicked: string | null;
  user_agent: string | null;
  ip_hash: string | null;
};

function mapAnalyticsRow(row: AnalyticsRow): ProfileAnalytics {
  return {
    id: row.id,
    profileId: row.profile_id,
    viewedAt: row.viewed_at,
    referralSource: row.referral_source,
    linkClicked: row.link_clicked,
    userAgent: row.user_agent,
    ipHash: row.ip_hash,
  };
}

