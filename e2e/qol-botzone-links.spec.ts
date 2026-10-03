import { expect, test, type Page } from '@playwright/test'

const game = { id: 41, title: 'Fixture game', name: 'Fixture game', gamerQuantity: 2, timeLimit: 1000, memoryLimit: 256, disabled: false, description: 'fixture', allowHuman: true }
const gamer = { id: 71, gameId: 41, userId: 9, title: 'Fixture bot', name: 'Fixture bot', type: 'code', language: 'python', opensource: true, code: 'print(1)', elo: 1200, game }
const opponent = { ...gamer, id: 72, userId: 10, title: 'Opponent', name: 'Opponent', user: { id: 10, username: 'opponent-user' } }
const match = { id: 91, gameId: 41, status: 2, createdAt: '2026-01-01T00:00:00.000Z', game, links: [{ index: 0, gamerId: 71, gamer, userId: 9, user: { id: 9, username: 'owner-user' } }, { index: 1, gamerId: 72, gamer: opponent, userId: 10, user: opponent.user }], result: { finalResult: { 71: 1, 72: 0 } } }

async function fixture(page: Page) {
  const calls: string[] = []
  await page.addInitScript(() => { if (window === window.top) localStorage.setItem('refreshToken', 'synthetic-browser-test') })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api/, '')
    let body: unknown = {}
    if (path === '/auth/refresh') body = { accessToken: 'synthetic-access' }
    else if (path === '/auth/profile') body = { id: 9, username: 'owner-user', role: 'user' }
    else if (path === '/compete/games') body = { items: [game], total: 25 }
    else if (path === '/compete/games/41') body = game
    else if (path === '/compete/gamers') body = { items: [gamer, opponent], total: 2 }
    else if (path === '/compete/gamers/71') body = gamer
    else if (path === '/compete/gamers/71/stats') body = { gamerId: 71, totalMatches: 0, wins: 0, losses: 0, draws: 0, opponents: [] }
    else if (path === '/compete/gamers/71/elo-history') body = []
    else if (path === '/compete/games/41/leaderboard' || path === '/compete/leaderboard') body = [{ gamerId: 71, id: 71, title: 'Fixture bot', name: 'Fixture bot', type: 'code', elo: 1200, game, user: { id: 9, username: 'owner-user' }, userId: 9 }]
    else if (path === '/compete/matches') body = { items: [match], total: 30 }
    else if (path === '/compete/matches/91') body = match
    else if (path === '/compete/rooms') body = []
    else if (path === '/compete/matches/91/human-sse') body = {}
    if (path.startsWith('/compete/') && req.method() === 'POST') calls.push(`${path} ${req.postData() || ''}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return calls
}

test('关联对象是原生 href；缺 ID 的对象不伪造目标', async ({ page }) => {
  const writes = await fixture(page)
  await page.goto('/compete?tab=history&gameId=41&page=2&status=2&isTest=true&keep=yes')
  await page.getByText('历史对局', { exact: true }).click()
  await expect(page.locator('a[href="/compete/matches/91"]')).toBeVisible()
  await expect(page.locator('a[href="/compete/games/41"]').first()).toBeVisible()
  await expect(page.locator('a[href="/compete/gamer/71"]')).toBeVisible()
  await expect(page.locator('a[href="/users/10"]')).toBeVisible()
  await page.locator('a[href="/compete/matches/91"]').click()
  await expect(page).toHaveURL(/\/compete\/matches\/91$/)
  expect(writes).toEqual([])
  await page.goto('/compete?tab=history')
  await expect(page.getByText('Fixture game', { exact: true })).toBeVisible()
  await expect(page.locator('a[href="/compete/games/undefined"]')).toHaveCount(0)
})

test('游戏/参赛者/对局页将相关对象变成原生链接', async ({ page }) => {
  await fixture(page)
  await page.goto('/compete/games/41')
  await page.locator('.n-tabs-tab').filter({ hasText: '排行榜' }).click()
  await expect(page.locator('a[href="/compete/gamer/71"]')).toBeVisible()
  await page.locator('.n-tabs-tab').filter({ hasText: '参赛' }).click()
  await expect(page.locator('a[href="/compete/gamer/72"]')).toBeVisible()
  await expect(page.locator('a[href="/users/10"]')).toBeVisible()
  await page.goto('/compete/gamer/71')
  await expect(page.locator('a[href="/compete/games/41"]').first()).toBeVisible()
  await expect(page.locator('a[href="/compete/matches/91"]')).toBeVisible()
  await page.goto('/compete/matches/91')
  await page.getByText('参与 Bot & 对局详情').click()
  await expect(page.locator('a[href="/compete/gamer/71"]')).toBeVisible()
  await expect(page.locator('a[href="/users/10"]')).toBeVisible()
})

test('列表与榜单从 URL 恢复支持的分页、过滤、榜单状态并保留其他 query', async ({ page }) => {
  const seen: URL[] = []
  const writes = await fixture(page)
  page.on('request', request => { if (request.url().includes('/api/compete/')) seen.push(new URL(request.url())) })
  await page.goto('/compete')
  await page.locator('.n-tabs-tab').filter({ hasText: '历史对局' }).click()
  await expect(page).toHaveURL(/tab=history/)
  await expect(page.locator('.n-tabs-tab--active')).toContainText('历史对局')
  await page.locator('.n-tabs-tab').filter({ hasText: '游戏列表' }).click()
  await expect(page.locator('.n-tabs-tab--active')).toContainText('游戏列表')
  await expect(page).not.toHaveURL(/tab=history/)
  await page.goBack()
  await expect(page).toHaveURL(/tab=history/)
  await expect(page.locator('.n-tabs-tab--active')).toContainText('历史对局')
  await page.goForward()
  await expect(page.locator('.n-tabs-tab--active')).toContainText('游戏列表')
  await page.goto('/compete?tab=history&gameId=41&page=2&perPage=20&status=2&isTest=true&keep=yes')
  await expect(page.locator('.n-tabs-tab--active')).toContainText('历史对局')
  await expect.poll(() => seen.some(url => url.pathname.endsWith('/compete/matches') && url.searchParams.get('page') === '2' && url.searchParams.get('gameId') === '41' && url.searchParams.get('status') === '2' && url.searchParams.get('isTest') === 'true')).toBe(true)
  await page.goto('/compete/leaderboard?board=inner&gameId=41&limit=50&keep=yes')
  await expect(page.getByRole('radio', { name: '内榜' })).toBeChecked()
  await expect(page.getByText('50', { exact: true }).first()).toBeVisible()
  await expect.poll(() => seen.some(url => url.pathname.endsWith('/compete/leaderboard') && url.searchParams.get('board') === 'inner' && url.searchParams.get('gameId') === '41' && url.searchParams.get('limit') === '50')).toBe(true)
  await expect.poll(() => page.url()).toContain('keep=yes')
  expect(writes).toEqual([])
})
