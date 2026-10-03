import { test, expect } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

async function setup(page: import('@playwright/test').Page) {
  await mockAuthApi(page)
  await page.addInitScript(token => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
  await page.route(url => url.pathname === '/api/problems', route => route.fulfill({ json: { items: [], total: 0 } }))
  await page.route(url => url.pathname === '/api/submissions', route => route.fulfill({ json: { items: [], total: 0 } }))
}

for (const source of ['problems', 'submissions'] as const) {
  test(`离开 ${source} 后待执行的筛选不抢回导航或改写目标 query`, async ({ page }) => {
    await setup(page)
    await page.goto(`/${source}`)
    if (source === 'problems') await page.getByRole('textbox', { name: '搜索题目' }).fill('pending-filter')
    else await page.getByLabel('按题目 ID 筛选').locator('input').fill('71')
    const target = source === 'problems' ? 'submissions' : 'problems'
    await page.getByRole('menuitem', { name: target === 'submissions' ? '提交记录' : '题目列表', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/${target}$`))
    // Negative timer-boundary check: the existing 300ms debounce must not mutate the departed route.
    await page.waitForTimeout(450)
    await expect(page).toHaveURL(new RegExp(`/${target}$`))
  })
}

test('榜单控件一次变化只发一次对应读取请求', async ({ page }) => {
  await setup(page)
  let calls = 0
  await page.route('**/api/compete/leaderboard**', route => { calls++; return route.fulfill({ json: [] }) })
  await page.route('**/api/compete/games**', route => route.fulfill({ json: { items: [], total: 0 } }))
  await page.goto('/compete/leaderboard')
  await expect.poll(() => calls).toBe(1)
  await page.getByText('内榜', { exact: true }).click()
  await expect(page).toHaveURL(/board=inner/)
  await page.waitForTimeout(100)
  expect(calls).toBe(2)
})
