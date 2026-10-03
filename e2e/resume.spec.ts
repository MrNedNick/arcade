import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

const givens = (page: Page) =>
  page
    .getByRole('gridcell', { name: /, given/ })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')!.split(', given')[0]))

test('a reload in the middle of tetris continues the same game', async ({ page }) => {
  await page.goto('./tetris/')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(60)
  }
  const board = page.getByRole('img', { name: /Tetris board/ })
  const label = await board.getAttribute('aria-label')
  expect(label).not.toMatch(/Score 0\b/)

  await page.reload()
  await expect(page.getByText('Welcome back')).toBeVisible()
  await expect(board).toHaveAttribute('aria-label', label!)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Welcome back')).toBeHidden()
  await page.keyboard.press('Space')
  await expect(board).not.toHaveAttribute('aria-label', label!)

  await page.goto('./')
  await expect(page.getByRole('link', { name: /Tetris/ })).toContainText('Continue')
})

test('a reload keeps a sudoku in progress, and New game starts over', async ({ page }) => {
  await page.goto('./sudoku/')
  await page.getByRole('radio', { name: 'Easy', exact: true }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const before = await givens(page)
  const empty = page.getByRole('gridcell', { name: /: empty$/ }).first()
  const where = (await empty.getAttribute('aria-label'))!.replace(': empty', '')
  await empty.click()
  await page.getByRole('button', { name: 'Place 5' }).click()

  await page.reload()
  await expect(page.getByText('Welcome back')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(await givens(page)).toEqual(before)
  await expect(page.getByRole('gridcell', { name: new RegExp(`^${where}: 5`) })).toBeVisible()

  // Starting over gives a fresh grid with nothing filled in by the player.
  await page.getByRole('button', { name: 'Restart' }).click()
  await expect(page.getByRole('gridcell', { name: /: \d(, conflict)?$/ })).toHaveCount(0)
})

test('the daily sudoku is the same on another device', async ({ page, browser }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /^Daily Sudoku/ }).click()
  await expect(page.getByRole('radio', { name: /Daily/ })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const mine = await givens(page)
  expect(mine.length).toBeGreaterThan(20)

  const other = await browser.newContext()
  const page2 = await other.newPage()
  await page2.goto('./sudoku/?daily')
  await page2.getByRole('button', { name: 'Play', exact: true }).click()
  expect(await givens(page2)).toEqual(mine)
  await other.close()
})

test('the daily minesweeper opens the same area on another device', async ({ page, browser }) => {
  const opened = async (p: Page) => {
    await p.goto('./minesweeper/?daily')
    await p.getByRole('button', { name: 'Play', exact: true }).click()
    return p
      .getByRole('gridcell')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label')).filter((l) => !l!.endsWith('hidden')),
      )
  }
  const mine = await opened(page)
  expect(mine.length).toBeGreaterThan(1)
  const other = await browser.newContext()
  expect(await opened(await other.newPage())).toEqual(mine)
  await other.close()
})
