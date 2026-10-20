import { expect,it } from 'vitest';
import { TIER_PRICING } from '@/lib/constants';
it('applies exactly 20 percent to twelve months without discarding currency cents',()=>{
  expect(TIER_PRICING.pro.annual).toBe(278.4);expect(TIER_PRICING.clinic.annual).toBe(950.4);
});
