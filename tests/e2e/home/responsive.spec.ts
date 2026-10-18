import { test,expect } from '@playwright/test';
test('home works at desktop and mobile widths with keyboard navigation',async({ page })=>{
  await page.setViewportSize({ width:1280,height:800 });await page.goto('/');
  await expect(page.getByRole('heading',{ level:1 })).toHaveText('Your practice, in one place.');
  await page.screenshot({ path:'.tmp/home-desktop.png',fullPage:true });
  await page.setViewportSize({ width:390,height:844 });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab');await expect(page.getByRole('link',{ name:'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');await expect(page).toHaveURL(/#main$/);
  await page.screenshot({ path:'.tmp/home-mobile.png',fullPage:true });
  await page.getByRole('link',{ name:'Start for free',exact:true }).click();await expect(page).toHaveURL(/\/signup/);
});
