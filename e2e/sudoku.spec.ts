import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('lobby → sudoku: a clashing number is marked and undo takes it back', async ({ page }) => {
  await page.getByRole('link', { name: /^Sudoku/ }).click()
  await expect(page).toHaveURL(/\/arcade\/sudoku$/)
  await page.getByRole('radio', { name: 'Easy', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()

  const given = page.getByRole('gridcell', { name: /^Row 1, column \d: \d, given$/ }).first()
  const digit = (await given.getAttribute('aria-label'))!.match(/: (\d),/)![1]!
  await page
    .getByRole('gridcell', { name: /^Row 1, column \d: empty$/ })
    .first()
    .click()
  await page.getByRole('button', { name: `Place ${digit}` }).click()
  await expect(page.getByRole('gridcell', { name: /conflict/ }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('gridcell', { name: /conflict/ })).toHaveCount(0)
})

test('notes mode keeps pencil marks in a cell', async ({ page }) => {
  await page.goto('./sudoku')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const empty = page.getByRole('gridcell', { name: /: empty$/ }).first()
  const label = (await empty.getAttribute('aria-label'))!.replace(': empty', '')
  await empty.click()
  await page.getByRole('button', { name: /^Notes/ }).click()
  await page.getByRole('button', { name: 'Note 3' }).click()
  await page.getByRole('button', { name: 'Note 7' }).click()
  await expect(page.getByRole('gridcell', { name: `${label}: empty, notes 3 7` })).toBeVisible()
})

test('a direct link opens sudoku', async ({ page }) => {
  await page.goto('./sudoku/')
  await expect(page.getByRole('heading', { level: 1, name: 'Sudoku' })).toBeVisible()
})
