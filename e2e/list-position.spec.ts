import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockProblemsApi } from './mocks/api'

async function setup(page: Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.addInitScript(() => localStorage.setItem('refreshToken', 'mock-refresh-token'))
  await page.route('**/api/submissions/user-problem-status/batch**', route => route.fulfill({ json: {} }))
  await page.route(/\/api\/problems(\?.*)?$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({ json: { items: Array.from({ length: 20 }, (_, index) => ({ id: index + 1, prefix: 'A', logicId: 1000 + index, title: `位置测试 ${index + 1}`, accepts: 1, submits: 2, tags: [] })), total: 60 } })
  })
  await page.route(/\/api\/problems\/\d+$/, route => route.fulfill({ json: { id: 11, logicId: 1011, title: '位置测试 11', content: '题面', timeLimit: 1000, memoryLimit: 128, publicSamples: [] } }))
  await page.route(/\/api\/submissions(\?.*)?$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 150))
    await route.fulfill({ json: { items: Array.from({ length: 20 }, (_, index) => ({ id: index + 1, problemId: 11, language: 'cpp17', status: 0, time: 1, memory: 1024, createdAt: '2026-10-05T10:00:00Z', user: { id: 1, username: 'testuser' }, problem: { id: 11, title: `位置测试 ${index + 1}`, prefix: 'A', logicId: 1000 + index } })), total: 60 } })
  })
  await page.route(/\/api\/submissions\/\d+$/, route => route.fulfill({ json: { id: 11, problemId: 11, language: 'cpp17', status: 0, time: 1, memory: 1024, createdAt: '2026-10-05T10:00:00Z', user: { id: 1, username: 'testuser' }, problem: { id: 11, title: '位置测试 11' }, misc: { code: '', judgeResult: '{"testcases":[]}' } } }))
}

async function position(page: Page) {
  return page.locator('.content-shell').evaluate(root => {
    const candidates = [root, ...root.querySelectorAll('*')]
    const scroller = candidates.find(el => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 10)
    if (!scroller) throw new Error('No list scroll container')
    return scroller.scrollTop
  })
}

for (const [kind, width] of [['problems', 1280], ['submissions', 1280], ['problems', 390], ['submissions', 390]] as const) {
  test(`${kind} ${width}px: browser back restores the filtered list position after loading`, async ({ page }) => {
    await page.setViewportSize({ width, height: 650 })
    await setup(page)
    const query = kind === 'problems' ? '?page=2&search=%E4%BD%8D%E7%BD%AE' : '?page=2&status=0'
    await page.goto(`/${kind}${query}`)
    const target = kind === 'problems' ? page.getByText('位置测试 11', { exact: true }) : page.locator('a[href="/submissions/11"]').first()
    await target.scrollIntoViewIfNeeded()
    const before = await position(page)
    expect(before).toBeGreaterThan(100)
    const box = await target.boundingBox()
    if (!box) throw new Error('List target not visible')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page).toHaveURL(new RegExp(`/${kind}/11$`))
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`/${kind}\\?`))
    await expect(target).toBeVisible()
    await expect.poll(() => position(page)).toBeCloseTo(before, 0)
    const url = new URL(page.url())
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get(kind === 'problems' ? 'search' : 'status')).toBe(kind === 'problems' ? '位置' : '0')
  })
}
