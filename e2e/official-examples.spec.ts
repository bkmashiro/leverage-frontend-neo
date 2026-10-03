import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

const game = { id: 41, title: '最接近 5', disabled: false, gamerQuantity: 2, timeLimit: 2000, memoryLimit: 128 }
const starter = 'import json,sys\nprint(json.dumps({"move":5})) # official starter'
async function setup(page: Page, status: 'missing' | 'ready' | 'conflict', loggedIn = false, disabled = false) {
  await mockAuthApi(page)
  const writes: string[] = []
  await page.route('**/api/compete/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes.push(path)
    if (path === '/api/compete/examples') return route.fulfill({ json: { items: [{ key: 'closest-v1', title: game.title, status, gameId: status === 'ready' ? 41 : undefined, opponents: status === 'ready' ? [{ id: 53, title: '官方对手' }] : [], starter: { language: 'python', code: starter } }] } })
    if (path === '/api/compete/games') return route.fulfill({ json: { items: [], total: 0 } })
    if (path === '/api/compete/games/41') return route.fulfill({ json: { ...game, disabled } })
    if (path === '/api/compete/gamers') return route.fulfill({ json: { items: [{ id: 53, gameId: 41, title: '官方对手', type: 'code', disabled: false, isTest: false }], total: 1 } })
    return route.fulfill({ status: 404, json: { message: 'No fixture' } })
  })
  if (loggedIn) await page.addInitScript(token => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
  return writes
}

for (const status of ['missing', 'conflict'] as const) {
  test(`${status} 示例有明确说明，不提供虚假练习或自动安装`, async ({ page }) => {
    const writes = await setup(page, status)
    await page.goto('/compete/learn')
    const catalog = page.getByRole('region', { name: '官方练习示例' })
    await expect(catalog).toContainText(status === 'missing' ? '未安装' : '配置冲突')
    await expect(catalog.getByRole('button', { name: '载入示例代码' })).toHaveCount(0)
    expect(writes).toEqual([])
  })
}

test('官方示例不在游戏列表首页也能单次转交代码，390px 无横向溢出', async ({ page }) => {
  const writes = await setup(page, 'ready', true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/compete/learn')
  const catalog = page.getByRole('region', { name: '官方练习示例' })
  await expect(catalog).toContainText('可练习')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await catalog.scrollIntoViewIfNeeded()
  await page.screenshot({ path: test.info().outputPath('official-example-mobile.png'), animations: 'disabled' })
  await catalog.getByRole('button', { name: '载入示例代码' }).click()
  await expect(page).toHaveURL(/compete\/playground\?.*gameId=41/)
  await expect(page.locator('.cm-content').first()).toContainText('official starter')
  expect(writes).toEqual([])
  await page.reload()
  await expect(page.locator('.cm-content').first()).toContainText('official starter')
})

test('示例状态过期时重新检查游戏可用性，禁用游戏不转交草稿', async ({ page }) => {
  const writes = await setup(page, 'ready', true, true)
  await page.goto('/compete/learn')
  await page.getByRole('region', { name: '官方练习示例' }).getByRole('button', { name: '载入示例代码' }).click()
  await expect(page.getByText('示例游戏暂不可用，请刷新示例状态。', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/compete\/learn/)
  expect(writes).toEqual([])
})

test('示例接口失败可重试，访客不跨登录缓存源码', async ({ page }) => {
  await setup(page, 'ready')
  let calls = 0
  await page.route('**/api/compete/examples', route => ++calls === 1
    ? route.fulfill({ status: 503, json: { message: 'offline' } })
    : route.fulfill({ json: { items: [{ key: 'closest-v1', title: game.title, status: 'ready', gameId: 41, opponents: [{ id: 53, title: '对手' }], starter: { language: 'python', code: starter } }] } }))
  await page.goto('/compete/learn')
  const catalog = page.getByRole('region', { name: '官方练习示例' })
  await expect(catalog).toContainText('示例状态加载失败')
  await catalog.getByRole('button', { name: '重试' }).click()
  await expect(catalog).toContainText('可练习')
  await catalog.getByRole('button', { name: '载入示例代码' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect(await page.evaluate(() => Object.values(localStorage).some(value => String(value).includes('official starter')))).toBe(false)
})
