import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('lobby → snake → crash → name → top players, and the record survives a reload', async ({
  page,
}) => {
  await page.getByRole('link', { name: /Snake/ }).click()
  await expect(page).toHaveURL(/\/arcade\/snake$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Snake' })).toBeVisible()

  await page.getByRole('radio', { name: 'Solid walls' }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  // Head straight up into the wall.
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('Game over')).toBeVisible({ timeout: 10_000 })
})

test('a direct link opens the game', async ({ page }) => {
  await page.goto('./snake/')
  await expect(page.getByRole('heading', { level: 1, name: 'Snake' })).toBeVisible()
  await page.getByRole('link', { name: 'All games', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Arcade' })).toBeVisible()
})

test('unknown addresses fall back to the lobby', async ({ page }) => {
  await page.goto('./pong')
  await expect(page.getByRole('heading', { level: 1, name: 'Arcade' })).toBeVisible()
})

test('a top-10 score asks for a name once and lands on the board', async ({ page }) => {
  // Seed a finished game straight into storage to keep the test fast and deterministic.
  await page.goto('./snake')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('Game over')).toBeVisible({ timeout: 10_000 })
  // Score 0 never asks for a name.
  await expect(page.getByLabel('Top 10! What’s your name?')).toHaveCount(0)

  await page.evaluate(() =>
    localStorage.setItem('arcade:top:snake', JSON.stringify([{ name: 'Ann', score: 3, at: 1 }])),
  )
  await page.reload()
  await page.getByRole('button', { name: 'Top players' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Top players' })
  await expect(dialog.getByText('Ann')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.stat__value').nth(1)).toHaveAttribute('aria-label', '3')
})
