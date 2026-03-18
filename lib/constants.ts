import { SubscriptionTier } from "@/types";

export const APP_NAME = "MediLink";
export const APP_DOMAIN = "medilink.io";

export const FREE_TIER_FILE_LIMIT = 10;

export const TIER_PRICING = {
  free: { monthly: 0, annual: 0 },
  pro: { monthly: 29, annual: Math.round(29 * 12 * 0.8) }, // 20% discount
  clinic: { monthly: 99, annual: Math.round(99 * 12 * 0.8) },
};

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const ROLE_OWNER = 'owner';
export const ROLE_RECEPTIONIST = 'receptionist';
export const ROLE_ASSISTANT = 'assistant';

export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, { unlimitedFiles: boolean, analytics: boolean, maxTeamSeats: number }> = {
  free: { unlimitedFiles: false, analytics: false, maxTeamSeats: 0 },
  pro: { unlimitedFiles: true, analytics: true, maxTeamSeats: 0 },
  clinic: { unlimitedFiles: true, analytics: true, maxTeamSeats: 8 },
};
