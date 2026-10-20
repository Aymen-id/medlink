import { expect, test } from '@playwright/test';

const titles = ['Find the right file', 'Keep the appointment context', 'Make your practice easy to find'];
const sizes = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 844, height: 390 },
];

for (const viewport of sizes) {
  test(`roadmap and hero fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('#features ol')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

    const section = page.locator('#features');
    await expect(section.getByRole('listitem')).toHaveCount(3);
    await expect(section.getByRole('heading', { level: 3 })).toHaveText(titles);
    expect(await section.locator('h3, p').evaluateAll(elements => elements.every(element => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.right <= document.documentElement.clientWidth + 1 && element.scrollWidth <= element.clientWidth + 1;
    }))).toBe(true);

    await page.getByRole('link', { name: 'Explore the workspace', exact: true }).click();
    await expect(page).toHaveURL(/#features$/);
    await page.keyboard.press('End');
    await expect(page.getByRole('link', { name: 'Create your workspace', exact: true })).toBeInViewport();
  });
}

test('reduced motion keeps every step and connector static', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#features');
  const list = page.locator('#features ol');
  await expect(list).not.toHaveAttribute('data-motion', 'ready');
  for (const element of await list.locator('.features-roadmap-copy, .features-roadmap-progress').all()) {
    await expect(element).toHaveCSS('animation-name', 'none');
    await expect(element).toHaveCSS('transform', 'none');
    await expect(element).toHaveCSS('opacity', '1');
  }
  await expect(list.getByRole('heading', { level: 3 })).toHaveText(titles);
});

test('native keyboard scrolling advances the path without changing layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#features');
  await expect(page.locator('#features ol')).toHaveAttribute('data-motion', 'ready');
  const copy = page.locator('.features-roadmap-copy').first();
  const connector = page.locator('.features-roadmap-progress').first();
  const initialTransform = await connector.evaluate(element => getComputedStyle(element).transform);
  const initialY = await page.evaluate(() => window.scrollY);
  const initialHeight = await page.locator('#features').evaluate(element => element.getBoundingClientRect().height);
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialY);
  await expect.poll(() => connector.evaluate(element => getComputedStyle(element).transform)).not.toBe(initialTransform);
  await expect(copy).toHaveCSS('opacity', '1');
  expect(await page.locator('#features').evaluate(element => element.getBoundingClientRect().height)).toBe(initialHeight);
  expect(await page.locator('#features [aria-hidden="true"]').count()).toBeGreaterThan(0);
});

test('skip link and homepage destinations remain keyboard reachable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  const hasFocusRing = await skip.evaluate(element => {
    const style = getComputedStyle(element);
    return style.outlineStyle !== 'none' || style.textDecorationLine.includes('underline');
  });
  expect(hasFocusRing).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  const chosenPlans = page.getByRole('link', { name: /^Choose (Free|Pro|Clinic)$/ });
  await expect(chosenPlans).toHaveCount(3);
  for (const link of await chosenPlans.all()) await expect(link).toHaveAttribute('href', '/signup');
});

test('desktop heading stays pinned while the visual follows the roadmap steps', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#features');
  const visual = page.locator('[data-feature-visual]');
  const heading = page.locator('#features-heading');
  await expect(visual).toBeVisible();
  await expect(visual).toHaveAttribute('data-feature', '0');
  const initialTop = await heading.evaluate(element => element.getBoundingClientRect().top);
  expect(Math.abs(initialTop - 96)).toBeLessThan(2);
  await page.mouse.wheel(0, 140);
  await expect(visual).toHaveAttribute('data-feature', '1');
  await expect.poll(() => heading.evaluate(element => Math.abs(element.getBoundingClientRect().top - 96))).toBeLessThan(2);
  await page.mouse.wheel(0, 230);
  await expect(visual).toHaveAttribute('data-feature', '2');
  await expect.poll(() => heading.evaluate(element => Math.abs(element.getBoundingClientRect().top - 96))).toBeLessThan(2);
  await expect(visual).toHaveAttribute('aria-hidden', 'true');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 740 } });

  test('all roadmap content is visible and static in the server-rendered page', async ({ page }) => {
    await page.goto('/#features');
    const list = page.locator('#features ol');
    await expect(list).not.toHaveAttribute('data-motion', 'ready');
    await expect(list.getByRole('heading', { level: 3 })).toHaveText(titles);
    for (const element of await list.locator('.features-roadmap-copy, .features-roadmap-progress').all()) {
      await expect(element).toBeVisible();
      await expect(element).toHaveCSS('animation-name', 'none');
      await expect(element).toHaveCSS('opacity', '1');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});
