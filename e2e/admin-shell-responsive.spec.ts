import { expect, test, type Page } from '@playwright/test'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })

const adminPaths = [
  '/admin', '/admin/users', '/admin/problems', '/admin/contests', '/admin/courses',
  '/admin/submissions', '/admin/submissions/sus', '/admin/submissions/sus/recent',
  '/admin/submissions/sus/union', '/admin/rejudge', '/admin/rejudge/log', '/admin/compete',
  '/admin/tags', '/admin/colleges', '/admin/professions', '/admin/notifications',
  '/admin/setting', '/admin/log', '/admin/task',
]

type DashboardFixture = { stat?: 'ok' | 'error' | 'loading'; notifications?: 'ok' | 'error' | 'empty' }

async function setup(page: Page, role: string, fixture: DashboardFixture = {}) {
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem('refreshToken', 'synthetic-admin-test')
  })
  const writes: string[] = []
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api/, '')
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && path !== '/auth/refresh') writes.push(`${request.method()} ${path}`)
    if (path === '/auth/refresh') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'synthetic-access' }) })
      return
    }
    if (path === '/auth/profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 23, username: 'Admin tester', role }) })
      return
    }
    if (path === '/stat') {
      if (fixture.stat === 'loading') await new Promise(resolve => setTimeout(resolve, 1200))
      await route.fulfill({ status: fixture.stat === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ user: 45, problem: 128, submission: 700, contest: 8, course: 3 }) })
      return
    }
    if (path === '/notifications') {
      const body = fixture.notifications === 'empty' ? { items: [], total: 0 } : { items: [{ id: 9, title: '维护公告', content: '服务维护时间', createdAt: '2026-10-03T01:00:00Z' }], total: 1 }
      await route.fulfill({ status: fixture.notifications === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(body) })
      return
    }
    if (path === '/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', info: { database: { status: 'up' }, redis: { status: 'up' }, memory_heap: { status: 'up' }, memory_rss: { status: 'up' } } }) })
      return
    }
    if (path === '/health/queues') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ queue: 'judge', waiting: 0, active: 0, completed: 0, failed: 0 }) })
      return
    }
    if (path === '/health/system') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ process: { pid: 1, uptime: '1h', uptimeSec: 3600, nodeVersion: 'v22', platform: 'darwin', arch: 'arm64' }, memory: { heapUsed: '1 MB', heapTotal: '2 MB', rss: '3 MB', external: '0 MB' }, cpu: { userMs: 1, systemMs: 1 }, latency: { dbMs: 1, redisMs: 1 }, env: 'test', timestamp: new Date().toISOString() }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], items: [], total: 0 }) })
  })
  return writes
}

test('ordinary user is denied admin route and does not request dashboard data', async ({ page }) => {
  const writes = await setup(page, 'user')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home$/)
  expect(writes).toEqual([])
})

test('supervisor retains existing route permission boundary', async ({ page }) => {
  await setup(page, 'supervisor')
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home$/)
})

for (const role of ['admin', 'sa']) {
  test(`${role} sees all admin navigation and dashboard data without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const writes = await setup(page, role)
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: '管理后台' })).toBeVisible()
    for (const path of adminPaths) {
      await page.goto(path)
      await expect(page).toHaveURL(new URL(path, page.url()).href)
    }
    await page.goto('/admin')
    await expect(page.getByText('128', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
    expect(writes).toEqual([])
  })
}

test('mobile admin navigation is discoverable, keyboard operable, closes after route change and fits 390/768px', async ({ page }) => {
  await setup(page, 'admin')
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/admin')
    const toggle = page.getByRole('button', { name: /打开管理导航/ })
    await expect(toggle).toBeVisible()
    await toggle.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: '管理导航' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText('用户管理')).toBeVisible()
    await expect(drawer.getByText('通知管理')).toBeVisible()
    await drawer.getByText('用户管理').click()
    await expect(page).toHaveURL(/\/admin\/users$/)
    await expect(drawer).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
})

test('dashboard keeps API-backed loading and error states distinct from empty announcements', async ({ page }) => {
  await setup(page, 'admin', { stat: 'error', notifications: 'error' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin')
  await expect(page.getByText('平台统计暂时不可用')).toBeVisible()
  await expect(page.getByText('公告暂时无法加载')).toBeVisible()
  await expect(page.getByText('暂无公告')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: test.info().outputPath('admin-mobile.png'), fullPage: true })
})

test('supervisor keeps permitted statistics but is not offered an inaccessible admin entry', async ({ page }) => {
  await setup(page, 'supervisor')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/home')
  await expect(page.getByText('128', { exact: true })).toBeVisible()
  await expect(page.getByText('管理后台', { exact: true })).toHaveCount(0)
})

test('dashboard indicates pending platform statistics without inventing zero values', async ({ page }) => {
  await setup(page, 'admin', { stat: 'loading' })
  await page.goto('/admin')
  await expect(page.getByText('正在加载平台统计')).toBeVisible()
  await expect(page.getByText('45', { exact: true })).toHaveCount(0)
})

test('desktop keeps a persistent workspace sidebar and dashboard separates populated data from empty notices', async ({ page }) => {
  await setup(page, 'admin', { notifications: 'empty' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/admin')
  await expect(page.getByRole('navigation', { name: '管理导航' })).toBeVisible()
  await expect(page.getByText('45', { exact: true })).toBeVisible()
  await expect(page.getByText('暂无公告')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('admin-desktop.png'), fullPage: true })
})
