import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('lobby → tetris → stack to the top → game over', async ({ page }) => {
  await page.getByRole('link', { name: /Tetris/ }).click()
  await expect(page).toHaveURL(/\/arcade\/tetris$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Tetris' })).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const board = page.getByRole('img', { name: /Tetris board/ })
  await expect(board).toHaveAttribute('aria-label', /Score 0/)
  // Hard drops straight down pile pieces up until there is no room left.
  for (let i = 0; i < 40 && !(await page.getByText('Game over').isVisible()); i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(40)
  }
  await expect(page.getByText('Game over')).toBeVisible()
  await expect(page.locator('.overlay__score')).not.toHaveText('0')
})

test('a direct link opens tetris', async ({ page }) => {
  await page.goto('./tetris/')
  await expect(page.getByRole('heading', { level: 1, name: 'Tetris' })).toBeVisible()
})
