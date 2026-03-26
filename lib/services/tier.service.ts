import type { SubscriptionTier } from '@/types';
import { FREE_TIER_FILE_LIMIT, SUBSCRIPTION_FEATURES } from '@/lib/constants';

type TierLimits = {
  maxFiles: number;
  analytics: boolean;
  maxTeamSeats: number;
};

/**
 * Centralized feature-gating service.
 * All tier logic flows through this service — no ad-hoc checks elsewhere.
 */
export class TierService {
  static canUploadFile(tier: SubscriptionTier, currentFileCount: number): boolean {
    if (SUBSCRIPTION_FEATURES[tier].unlimitedFiles) return true;
    return currentFileCount < FREE_TIER_FILE_LIMIT;
  }

  static hasAnalyticsAccess(tier: SubscriptionTier): boolean {
    return SUBSCRIPTION_FEATURES[tier].analytics;
  }

  static getMaxTeamSeats(tier: SubscriptionTier): number {
    return SUBSCRIPTION_FEATURES[tier].maxTeamSeats;
  }

  static canAddTeamMember(tier: SubscriptionTier, currentTeamSize: number): boolean {
    const max = TierService.getMaxTeamSeats(tier);
    if (max === 0) return false;
    return currentTeamSize < max;
  }

  static isFeatureAllowed(tier: SubscriptionTier, feature: string): boolean {
    switch (feature) {
      case 'analytics':
        return TierService.hasAnalyticsAccess(tier);
      case 'unlimited_files':
        return SUBSCRIPTION_FEATURES[tier].unlimitedFiles;
      case 'team':
        return TierService.getMaxTeamSeats(tier) > 0;
      default:
        return false;
    }
  }

  static getTierLimits(tier: SubscriptionTier): TierLimits {
    const features = SUBSCRIPTION_FEATURES[tier];
    return {
      maxFiles: features.unlimitedFiles ? Infinity : FREE_TIER_FILE_LIMIT,
      analytics: features.analytics,
      maxTeamSeats: features.maxTeamSeats,
    };
  }
}
