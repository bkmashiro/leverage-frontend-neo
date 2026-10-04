import { expect, test, type Page } from '@playwright/test'

async function mockCommon(page: Page) {
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem('refreshToken', 'ux-layout-session')
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api/, '')
    if (path === '/auth/refresh') return route.fulfill({ json: { accessToken: 'ux-layout-access' } })
    if (path === '/auth/profile') return route.fulfill({ json: { id: 7, username: 'layout-test', role: 'user' } })
    if (path === '/message/unread-count' || path === '/messages/unread-count') return route.fulfill({ json: { count: 0 } })
    if (path === '/notifications') return route.fulfill({ json: { items: [], total: 0, unreadCount: 0 } })
    if (path === '/settings/public') return route.fulfill({ json: { 'site.announcement': '' } })
    if (path.startsWith('/settings/')) return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    if (path === '/compete/games') return route.fulfill({ json: { items: [
      { id: 1, title: '短简介游戏', name: '短简介游戏', description: '简短。', disabled: false, timeLimit: 1000, memoryLimit: 128, gamerQuantity: 2 },
      { id: 2, title: '长简介游戏', name: '长简介游戏', description: '这是一个非常长的简介，用来检查详情、分隔线和操作区在同一行卡片中的布局。'.repeat(5), disabled: false, timeLimit: 1000, memoryLimit: 128, gamerQuantity: 2 },
      { id: 3, title: '空简介游戏', name: '空简介游戏', description: '', disabled: false, timeLimit: 1000, memoryLimit: 128, gamerQuantity: 2 },
    ], total: 3 } })
    if (path === '/compete/examples') return route.fulfill({ json: { items: [] } })
    if (path === '/compete/gamers') return route.fulfill({ json: { items: [], total: 0 } })
    if (path === '/compete/rooms' || path === '/compete/matches') return route.fulfill({ json: { items: [], total: 0 } })
    if (path === '/stat') return route.fulfill({ json: {} })
    return route.fulfill({ json: {} })
  })
}

test('同一行 Bot 游戏卡片保留完整简介，按钮底边稳定', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await mockCommon(page)
  await page.goto('/compete')
  const cards = page.locator('.game-card')
  await expect(cards).toHaveCount(3)
  await expect(cards.nth(1)).toContainText('这是一个非常长的简介')
  await expect(cards.nth(2)).toContainText('暂无描述')
  const bottoms = await cards.getByRole('button', { name: '查看游戏与参赛' }).evaluateAll(buttons =>
    buttons.map(button => button.getBoundingClientRect().bottom),
  )
  expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: test.info().outputPath('compete-cards.png'), fullPage: true })
})

test('学习中心桌面章节目录与正文可独立滚动，最后章节仍可访问', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 633 })
  await mockCommon(page)
  await page.goto('/compete/learn?track=bot&step=1&gameId=2')
  await expect(page.getByRole('heading', { name: /Bot 是如何工作的/ })).toBeVisible()
  await expect(page.getByLabel('练习游戏')).toHaveCount(0)
  await expect(page.getByText('学习 · 实践 · 对战')).toHaveCount(0)
  await expect(page.getByRole('region', { name: '官方练习示例' })).toBeVisible()
  const nav = page.locator('.chapter-navigation')
  const reading = page.locator('.reading-surface')
  await expect.poll(async () => nav.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto')
  await expect.poll(async () => reading.evaluate(el => getComputedStyle(el).overflowY)).toBe('auto')
  expect(await reading.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await nav.evaluate(el => { el.scrollTop = el.scrollHeight })
  const last = nav.getByRole('link', { name: /测试与保存 Bot/ })
  await expect(last).toBeVisible()
  const visible = await last.evaluate(el => {
    const rect = el.getBoundingClientRect()
    const parent = el.closest('.chapter-navigation')!.getBoundingClientRect()
    return rect.top >= parent.top && rect.bottom <= parent.bottom
  })
  expect(visible).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280)
  await page.screenshot({ path: test.info().outputPath('learn-short-desktop.png'), fullPage: true })
})

test('学习中心移动目录折叠，正文仍可见且无任意教材选择', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCommon(page)
  await page.goto('/compete/learn?track=bot&step=1&gameId=2')
  const directory = page.locator('.chapter-directory')
  await expect(directory).not.toHaveAttribute('open')
  await expect(page.getByRole('heading', { name: /Bot 是如何工作的/ })).toBeVisible()
  await expect(page.getByLabel('练习游戏')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: test.info().outputPath('learn-mobile.png'), fullPage: true })
})

test('教程示例固定映射官方目录，深链 gameId 不会改变教材环境', async ({ page }) => {
  await mockCommon(page)
  await page.route('**/api/compete/examples', route => route.fulfill({ json: { items: [
    { key: 'closest-v1', title: '最接近 5', status: 'ready', gameId: 1, opponents: [{ id: 31, title: '官方对手' }], starter: { language: 'python', code: 'print(1)' } },
  ] } }))
  await page.goto('/compete/learn?track=bot&step=2&gameId=2')
  await expect(page.getByLabel('练习游戏')).toHaveCount(0)
  await page.getByRole('button', { name: /在 Playground 测试/ }).first().click()
  await expect(page).toHaveURL(/\/compete\/playground\?.*gameId=1/)
})

test('Bot 工作台压缩页头，测试完成后滚动到就近结果', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 633 })
  await mockCommon(page)
  await page.route('**/api/compete/games/1', route => route.fulfill({ json: { id: 1, title: '短简介游戏', disabled: false, gamerQuantity: 2 } }))
  await page.route('**/api/compete/gamers**', route => route.fulfill({ json: { items: [{ id: 31, gameId: 1, title: '对手 Bot', type: 'code', disabled: false, isTest: false }], total: 1 } }))
  await page.route('**/api/compete/games/1/playground', route => route.fulfill({ json: { matchId: 91, testGamerId: 41 } }))
  await page.route('**/api/compete/matches/91', route => route.fulfill({ json: { id: 91, gameId: 1, status: 2, result: { finalResult: { '41': 1, '31': 0 } } } }))
  await page.goto('/compete/playground?tab=bot&gameId=1')
  await expect(page.getByText('Bot 测试', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Bot 工作台' })).toHaveCount(0)
  await page.getByRole('button', { name: '插入模板' }).click()
  await page.getByRole('button', { name: /运行测试对局/ }).click()
  const result = page.locator('.bot-result-region')
  await expect(result).toBeVisible()
  await expect(result).toContainText('已完成')
  await expect.poll(async () => result.evaluate(el => {
    const rect = el.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= window.innerHeight
  })).toBe(true)
})

test('首页无公告时不渲染空卡，有内容时通过公开设置值展示', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await mockCommon(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '开始练习' })).toBeVisible()
  await expect(page.locator('.announcement')).toHaveCount(0)
  await expect(page.getByText('暂无公告')).toHaveCount(0)
  const columnsWithoutOptionalCards = await page.locator('.info-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  expect(columnsWithoutOptionalCards).toBe(1)
  await page.screenshot({ path: test.info().outputPath('home-empty-announcement.png'), fullPage: true })
  await page.route('**/api/settings/public', route => route.fulfill({ json: { 'site.announcement': '本周日 02:00 维护' } }))
  await page.reload()
  await expect(page.locator('.announcement')).toContainText('本周日 02:00 维护')
  await expect(page.locator('.updates-panel')).toHaveCount(0)
  const bounds = await page.locator('.announcement').evaluate(el => ({ width: el.getBoundingClientRect().width, parent: el.parentElement!.getBoundingClientRect().width }))
  expect(Math.abs(bounds.width - bounds.parent)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: test.info().outputPath('home-announcement.png'), fullPage: true })

  let failNotifications = true
  await page.route('**/api/notifications?*', route => failNotifications
    ? route.fulfill({ status: 503, json: { message: 'Unavailable' } })
    : route.fulfill({ json: { items: [{ id: 1, title: '新的比赛安排', createdAt: '2026-10-04T00:00:00Z' }], total: 1 } }))
  await page.reload()
  await expect(page.locator('.updates-panel')).toContainText('通知暂时无法加载')
  failNotifications = false
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.locator('.updates-panel')).toContainText('新的比赛安排')
})
