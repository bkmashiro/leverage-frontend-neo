import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

const game = { id: 41, title: 'closest fixture', name: 'closest fixture', disabled: false, gamerQuantity: 2, timeLimit: 2000, memoryLimit: 128 }

async function setup(page: Page) {
  await mockAuthApi(page)
  await page.addInitScript((token) => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { accessToken: mockTokens.accessToken } }))
  await page.route('**/api/auth/profile', route => route.fulfill({ json: { id: 1, username: 'testuser', role: 'sa', email: 'test@example.com' } }))
  await page.route('**/api/compete/games**', async route => {
    const pathname = new URL(route.request().url()).pathname
    await route.fulfill({ json: pathname === '/api/compete/games/41' ? game : { items: [game], total: 1 } })
  })
  await page.route('**/api/compete/gamers**', route => route.fulfill({ json: {
    items: [{ id: 53, gameId: 41, title: 'fixture opponent', type: 'code', disabled: false, isTest: false }], total: 1,
  } }))
}

test('Playground inserts a matching-language starter for all runtime languages and POSTs canonical name', async ({ page }) => {
  await setup(page)
  const payloads: Array<{ code: string; language: string; opponentGamerId: number }> = []
  await page.route('**/api/compete/games/41/playground', async route => {
    payloads.push(route.request().postDataJSON())
    await route.fulfill({ json: { matchId: 71, testGamerId: 91 } })
  })
  await page.route('**/api/compete/matches/71', route => route.fulfill({ json: { id: 71, status: 2, gameId: 41, result: null } }))
  await page.goto('/compete/playground?tab=bot&gameId=41')
  await expect(page.getByText('代码编辑器')).toBeVisible()
  await expect(page.getByText('fixture opponent (ELO 1200)')).toBeVisible()

  const expected: Record<string, RegExp> = {
    python: /import json/,
    cpp: /#include <iostream>/,
    javascript: /require\('node:readline'\)/,
    typescript: /import \* as readline/,
  }
  let submitted = 0
  for (const language of ['cpp', 'javascript', 'typescript', 'python']) {
    const editorCard = page.locator('.n-card').filter({ hasText: '代码编辑器' }).first()
    await editorCard.locator('.n-base-selection').click()
    await page.getByText(language === 'python' ? 'Python 3' : language === 'cpp' ? 'C++17' : language === 'javascript' ? 'JavaScript' : 'TypeScript', { exact: true }).last().click()
    await expect(page.locator('.cm-content').first()).toHaveAttribute('data-language', language === 'typescript' ? 'javascript' : language)
    await editorCard.getByRole('button', { name: /插入模板/ }).click()
    await expect(page.locator('.cm-content').first()).toContainText(expected[language])
    await expect(page.locator('.cm-content').first()).toContainText(/current command|current command JSON/)
    await page.getByRole('button', { name: /运行测试对局/ }).click()
    submitted += 1
    await expect.poll(() => payloads.length).toBeGreaterThanOrEqual(submitted)
    const payload = payloads.at(-1)!
    expect(payload.language).toBe(language)
    expect(payload.code).toMatch(expected[language])
    expect(payload.opponentGamerId).toBe(53)
    await page.evaluate(() => localStorage.removeItem('leverage:code-draft:1:new:41'))
    await page.reload()
    await expect(page.getByText('fixture opponent (ELO 1200)')).toBeVisible()
  }
})
