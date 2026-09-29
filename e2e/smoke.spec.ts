import { expect, test } from '@playwright/test'

test('lobby opens with the product name', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'Arcade' })).toBeVisible()
  await expect(page.getByText('Free games. No ads, no sign-up.')).toBeVisible()
})

test('theme toggle switches and survives a reload', async ({ page }) => {
  await page.goto('./')
  const html = page.locator('html')
  const before = await page.evaluate(() =>
    matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  )
  await page.getByRole('button', { name: /switch to/i }).click()
  const after = before === 'dark' ? 'light' : 'dark'
  await expect(html).toHaveAttribute('data-theme', after)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after)
})
