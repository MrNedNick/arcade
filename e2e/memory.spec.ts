import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('lobby → memory: two cards turn over, faces stay hidden until then', async ({ page }) => {
  await page.getByRole('link', { name: /Memory/ }).click()
  await expect(page).toHaveURL(/\/arcade\/memory$/)
  await page.getByRole('radio', { name: '4 × 4' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('gridcell', { name: /face down/ })).toHaveCount(16)
  // Face-down cards give nothing away, not even to a screen reader.
  await expect(page.locator('.card__face')).toHaveCount(0)
  await page.getByRole('gridcell', { name: 'Card 1: face down' }).click()
  await page.getByRole('gridcell', { name: 'Card 2: face down' }).click()
  await expect(page.locator('.stat-moves__value')).toHaveText('1')
  await expect(page.getByRole('gridcell', { name: /^Card 1: (?!face down)/ })).toBeVisible()
})

test('a direct link opens memory', async ({ page }) => {
  await page.goto('./memory/')
  await expect(page.getByRole('heading', { level: 1, name: 'Memory' })).toBeVisible()
})
