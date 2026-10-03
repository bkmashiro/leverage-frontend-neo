import { expect, test, type Page } from '@playwright/test'

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })

type HomeFixture = {
  stats?: 'ok' | 'error' | 'loading'
  announcement?: 'filled' | 'empty' | 'error'
  notifications?: 'filled' | 'empty' | 'error' | 'loading'
}

async function setupHome(page: Page, fixture: HomeFixture = {}, loggedIn = true, role: 'user' | 'supervisor' = 'supervisor') {
  const requests: string[] = []
  if (loggedIn) {
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem('refreshToken', 'synthetic-home-test')
    })
  }
  let notificationAttempts = 0
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '')
    requests.push(`${path}${url.search ? `?${url.searchParams.toString()}` : ''}`)
    if (path === '/auth/refresh') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'synthetic-access' }) })
      return
    }
    if (path === '/auth/profile') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 23, username: 'Home tester', role }) })
      return
    }
    if (path === '/stat') {
      if (fixture.stats === 'loading') await new Promise(resolve => setTimeout(resolve, 1200))
      await route.fulfill({ status: fixture.stats === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ problem: 128, user: 45, submission: 700, contest: 8 }) })
      return
    }
    if (path === '/settings/site.announcement') {
      const announcement = fixture.announcement === 'filled' ? '周末系统维护通知' : ''
      await route.fulfill({ status: fixture.announcement === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ valueString: announcement }) })
      return
    }
    if (path === '/notifications') {
      const isHomeListRequest = url.searchParams.get('page') === '1' && url.searchParams.get('perPage') === '5'
      if (isHomeListRequest) notificationAttempts += 1
      if (fixture.notifications === 'loading' && isHomeListRequest) await new Promise(resolve => setTimeout(resolve, 1200))
      const data = fixture.notifications === 'filled' && isHomeListRequest
        ? { items: [{ id: 9, title: '竞赛报名现已开放', createdAt: '2026-09-20T10:00:00.000Z' }], total: 1 }
        : { items: [], total: 0 }
      await route.fulfill({ status: fixture.notifications === 'error' && isHomeListRequest && notificationAttempts === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(data) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  })
  await page.goto('/')
  return requests
}

test('home keeps real task paths and existing platform data for a signed-in user', async ({ page }) => {
  const requests = await setupHome(page, { announcement: 'filled', notifications: 'filled' })
  const tasks = page.locator('.task-section')
  await expect(tasks.getByText('题库练习', { exact: true })).toBeVisible()
  await expect(tasks.getByText('Bot 对战', { exact: true })).toBeVisible()
  await expect(tasks.getByText('学习中心', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /题库练习/ })).toHaveAttribute('href', '/problems')
  await expect(page.getByRole('link', { name: /Bot 对战/ })).toHaveAttribute('href', '/compete')
  await expect(page.getByRole('link', { name: /学习中心/ })).toHaveAttribute('href', '/compete/learn')
  await expect(page.getByText('周末系统维护通知')).toBeVisible()
  await expect(page.getByText('竞赛报名现已开放')).toBeVisible()
  await expect(page.getByText('128', { exact: true })).toBeVisible()
  await expect(page.getByText('700', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /全部通知/ })).toHaveAttribute('href', '/notification')
  await expect(page.getByRole('menu').getByText('题目列表')).toBeVisible()
  await expect(page.getByRole('menu').getByText('Bot 对战')).toBeVisible()
  expect(requests.filter(path => ['/stat', '/settings/site.announcement', '/notifications?page=1&perPage=5'].includes(path)).sort()).toEqual(['/notifications?page=1&perPage=5', '/settings/site.announcement', '/stat'])
  expect(requests.some(path => path.startsWith('/submissions'))).toBe(false)
})

test('ordinary signed-in user is not sent to the supervisor-only statistics API', async ({ page }) => {
  const requests = await setupHome(page, { announcement: 'empty', notifications: 'empty' }, true, 'user')
  await expect(page.getByText('平台概况仅向管理人员开放。')).toBeVisible()
  await expect(page.getByText('暂无公告')).toBeVisible()
  await expect(page.getByText('暂无通知')).toBeVisible()
  expect(requests).not.toContain('/stat')
})

test('guest retains the existing login gate without requesting home data', async ({ page }) => {
  const requests: string[] = []
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    requests.push(new URL(route.request().url()).pathname)
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  expect(requests).toEqual([])
})

test('home distinguishes loading, empty, and error states and can retry notifications', async ({ page }) => {
  const requests = await setupHome(page, { stats: 'error', announcement: 'error', notifications: 'error' })
  await expect(page.getByText('平台数据暂时无法加载。')).toBeVisible()
  await expect(page.getByText('公告暂时无法加载。')).toBeVisible()
  await expect(page.getByText('通知暂时无法加载。')).toBeVisible()
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
  await page.getByRole('button', { name: '重试' }).click()
  await expect(page.getByText('暂无通知')).toBeVisible()
  expect(requests.filter(path => path.startsWith('/notifications?page=1&perPage=5'))).toHaveLength(2)
})

test('loading remains visible while APIs are pending and layout fits mobile and desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setupHome(page, { stats: 'loading', notifications: 'loading' })
  await expect(page.getByText('平台数据加载中…')).toBeVisible()
  await expect(page.getByText('通知加载中…')).toBeVisible()
  await expect(page.getByText('题库练习', { exact: true })).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await expect(page.getByText('700', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.header-bar')).toHaveCount(1)
  await page.screenshot({ path: test.info().outputPath('home-mobile.png'), fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440)
  await expect(page.locator('.header-bar')).toHaveCount(1)
  const layout = await page.evaluate(() => ({
    viewportHeight: innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    headerTop: document.querySelector('.header-bar')!.getBoundingClientRect().top,
  }))
  expect(layout.headerTop).toBe(0)
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1)
  await page.screenshot({ path: test.info().outputPath('home-desktop.png'), fullPage: true, animations: 'disabled' })
})
