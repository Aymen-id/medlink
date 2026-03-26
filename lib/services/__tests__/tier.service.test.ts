import { describe, it, expect } from 'vitest';
import { TierService } from '../../services/tier.service';
import type { SubscriptionTier } from '@/types';

describe('TierService', () => {
  // ---- FILE LIMITS ----
  describe('canUploadFile', () => {
    it('should allow free tier up to 10 files', () => {
      expect(TierService.canUploadFile('free', 0)).toBe(true);
      expect(TierService.canUploadFile('free', 9)).toBe(true);
    });

    it('should block free tier at 10 files', () => {
      expect(TierService.canUploadFile('free', 10)).toBe(false);
      expect(TierService.canUploadFile('free', 50)).toBe(false);
    });

    it('should allow pro tier unlimited files', () => {
      expect(TierService.canUploadFile('pro', 0)).toBe(true);
      expect(TierService.canUploadFile('pro', 10)).toBe(true);
      expect(TierService.canUploadFile('pro', 10000)).toBe(true);
    });

    it('should allow clinic tier unlimited files', () => {
      expect(TierService.canUploadFile('clinic', 999)).toBe(true);
    });
  });

  // ---- ANALYTICS ACCESS ----
  describe('hasAnalyticsAccess', () => {
    it('should deny analytics for free tier', () => {
      expect(TierService.hasAnalyticsAccess('free')).toBe(false);
    });

    it('should allow analytics for pro tier', () => {
      expect(TierService.hasAnalyticsAccess('pro')).toBe(true);
    });

    it('should allow analytics for clinic tier', () => {
      expect(TierService.hasAnalyticsAccess('clinic')).toBe(true);
    });
  });

  // ---- TEAM ACCESS ----
  describe('getMaxTeamSeats', () => {
    it('should return 0 for free tier', () => {
      expect(TierService.getMaxTeamSeats('free')).toBe(0);
    });

    it('should return 0 for pro tier', () => {
      expect(TierService.getMaxTeamSeats('pro')).toBe(0);
    });

    it('should return 8 for clinic tier', () => {
      expect(TierService.getMaxTeamSeats('clinic')).toBe(8);
    });
  });

  describe('canAddTeamMember', () => {
    it('should deny team members for free tier', () => {
      expect(TierService.canAddTeamMember('free', 0)).toBe(false);
    });

    it('should deny team members for pro tier', () => {
      expect(TierService.canAddTeamMember('pro', 0)).toBe(false);
    });

    it('should allow team members for clinic tier up to 8', () => {
      expect(TierService.canAddTeamMember('clinic', 0)).toBe(true);
      expect(TierService.canAddTeamMember('clinic', 7)).toBe(true);
    });

    it('should deny team members for clinic tier at 8', () => {
      expect(TierService.canAddTeamMember('clinic', 8)).toBe(false);
    });
  });

  // ---- FEATURE ALLOWED ----
  describe('isFeatureAllowed', () => {
    const features: Array<{ feature: string; tier: SubscriptionTier; expected: boolean }> = [
      { feature: 'analytics', tier: 'free', expected: false },
      { feature: 'analytics', tier: 'pro', expected: true },
      { feature: 'analytics', tier: 'clinic', expected: true },
      { feature: 'unlimited_files', tier: 'free', expected: false },
      { feature: 'unlimited_files', tier: 'pro', expected: true },
      { feature: 'unlimited_files', tier: 'clinic', expected: true },
      { feature: 'team', tier: 'free', expected: false },
      { feature: 'team', tier: 'pro', expected: false },
      { feature: 'team', tier: 'clinic', expected: true },
    ];

    features.forEach(({ feature, tier, expected }) => {
      it(`should return ${expected} for "${feature}" on ${tier} tier`, () => {
        expect(TierService.isFeatureAllowed(tier, feature)).toBe(expected);
      });
    });

    it('should deny unknown features', () => {
      expect(TierService.isFeatureAllowed('pro', 'teleportation')).toBe(false);
    });
  });

  // ---- GET TIER LIMITS ----
  describe('getTierLimits', () => {
    it('should return correct limits for each tier', () => {
      const free = TierService.getTierLimits('free');
      expect(free.maxFiles).toBe(10);
      expect(free.analytics).toBe(false);
      expect(free.maxTeamSeats).toBe(0);

      const pro = TierService.getTierLimits('pro');
      expect(pro.maxFiles).toBe(Infinity);
      expect(pro.analytics).toBe(true);
      expect(pro.maxTeamSeats).toBe(0);

      const clinic = TierService.getTierLimits('clinic');
      expect(clinic.maxFiles).toBe(Infinity);
      expect(clinic.analytics).toBe(true);
      expect(clinic.maxTeamSeats).toBe(8);
    });
  });
});
