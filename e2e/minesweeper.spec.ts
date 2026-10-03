import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('lobby → minesweeper: the first dig is always safe and opens an area', async ({ page }) => {
  await page.getByRole('link', { name: /^Minesweeper/ }).click()
  await expect(page).toHaveURL(/\/arcade\/minesweeper$/)
  await page.getByRole('radio', { name: /Easy/ }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('gridcell', { name: 'Row 5, column 5: hidden' }).click()
  await expect(page.locator('.board--lost')).toHaveCount(0)
  expect(await page.locator('.cell--open').count()).toBeGreaterThan(1)
  await expect(page.getByRole('gridcell', { name: 'Row 5, column 5: empty' })).toBeVisible()
})

test('flags count down the mines and can be removed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'right click is a desktop gesture; phones use a long press')
  await page.goto('./minesweeper')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const mines = page.locator('.stat-mines__value')
  const before = Number(await mines.textContent())
  const cell = page.getByRole('gridcell', { name: 'Row 1, column 1: hidden' })
  await cell.click({ button: 'right' })
  await expect(mines).toHaveText(String(before - 1))
  await page.getByRole('gridcell', { name: 'Row 1, column 1: flagged' }).click({ button: 'right' })
  await expect(mines).toHaveText(String(before))
})

test('a direct link opens minesweeper', async ({ page }) => {
  await page.goto('./minesweeper/')
  await expect(page.getByRole('heading', { level: 1, name: 'Minesweeper' })).toBeVisible()
})
