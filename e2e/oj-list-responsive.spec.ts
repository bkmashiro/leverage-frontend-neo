import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, setLoggedInViaStorage } from './mocks/api'

const title = '一个很长的中文题目标题：最短路径与状态转换的完整阅读回归'
const problem = { id: 1, prefix: 'A', logicId: 1001, title, accepts: 50, submits: 100,
  tags: [{ id: 7, name: '图论与路径' }], hidden: false, timeLimit: 1000, memoryLimit: 64, description: '题面' }

async function authenticate(page: Page) {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
}

async function capture(page: Page, name: string) {
  const directory = process.env.OJ_LIST_ARTIFACT_DIR
  if (!directory) return
  const { mkdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, name), fullPage: true })
}

for (const width of [360, 390]) {
  test(`手机题库在 ${width}px 完整呈现标题、状态与标签`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await authenticate(page)
    const queries: Array<Record<string, string>> = []
    await page.route(/\/api\/problems(\?.*)?$/, async route => {
      const url = new URL(route.request().url())
      queries.push(Object.fromEntries(url.searchParams))
      await route.fulfill({ json: { items: [problem], total: 45 } })
    })
    await page.route(/\/api\/submissions\/user-problem-status\/batch(\?.*)?$/, route => route.fulfill({ json: { '1': 2 } }))
    await page.goto('/problems')
    const list = page.locator('.mobile-problem-list')
    await expect(list).toBeVisible()
    await expect(list.getByRole('link', { name: title })).toBeVisible()
    await expect(list.getByText('已 AC', { exact: true })).toBeVisible()
    await expect(list.getByText('通过率 50%', { exact: false })).toBeVisible()
    await capture(page, `problems-${width}.png`)
    await list.getByRole('button', { name: '图论与路径', exact: true }).click()
    await expect(page).toHaveURL(/tagId=7/)
    await expect.poll(() => queries.some(query => query.tagId === '7' && query.page === '1')).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('.pagination-wrapper')).toBeVisible()
    await page.locator('.pagination-wrapper .n-pagination-item--button').last().click()
    await expect.poll(() => queries.some(query => query.page === '2' && query.perPage === '20' && query.tagId === '7')).toBe(true)
    await page.locator('.pagination-wrapper .n-select').click()
    await page.locator('.n-base-select-option').filter({ hasText: /^10/ }).first().click()
    await expect.poll(() => queries.some(query => query.page === '1' && query.perPage === '10')).toBe(true)
  })

  test(`手机提交记录在 ${width}px 保留语言、状态、指标与详情链接`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await authenticate(page)
    await page.route(/\/api\/submissions(\?.*)?$/, route => route.fulfill({ json: { items: [{
      id: 31, problemId: 1, userId: 1, language: 'cpp20', status: 0, time: 0, memory: 65536,
      createdAt: '2026-10-03T01:02:03Z', problem, user: { id: 1, username: 'testuser' },
    }], total: 45 } }))
    await page.goto('/submissions')
    const list = page.locator('.mobile-submission-list')
    await expect(list).toBeVisible()
    await expect(list.getByRole('link', { name: '#31', exact: true })).toHaveAttribute('href', '/submissions/31')
    await expect(list.getByRole('link', { name: `A1001 ${title}` })).toHaveAttribute('href', '/problems/1')
    await expect(list.getByText('C++20', { exact: true })).toBeVisible()
    await expect(list.getByText('0ms', { exact: true })).toBeVisible()
    await expect(list.getByText('64 KiB', { exact: true })).toBeVisible()
    await expect(list.locator('.n-tag')).toContainText('AC')
    await capture(page, `submissions-${width}.png`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await expect(page.locator('.pagination-wrapper')).toBeVisible()
  })
}

test('手机提交没有遥测时明确标记未记录，不显示 NaN', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await authenticate(page)
  await page.route(/\/api\/submissions(\?.*)?$/, route => route.fulfill({ json: { items: [{
    id: 32, problemId: 1, userId: 1, language: 'cpp17', status: 0,
    time: null, memory: null, createdAt: '2026-10-03T01:02:03Z', problem,
  }], total: 1 } }))
  await page.goto('/submissions')
  const list = page.locator('.mobile-submission-list')
  await expect(list.getByText('时间未记录', { exact: true })).toBeVisible()
  await expect(list.getByText('内存未记录', { exact: true })).toBeVisible()
  await expect(list).not.toContainText('NaN')
})

test('桌面题库仍使用完整表格', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await authenticate(page)
  await page.route(/\/api\/problems(\?.*)?$/, route => route.fulfill({ json: { items: [problem], total: 1 } }))
  await page.goto('/problems')
  await expect(page.locator('.n-data-table')).toBeVisible()
  await expect(page.locator('.mobile-problem-list')).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: '通过率' })).toBeVisible()
})

for (const route of ['problems', 'submissions'] as const) {
  test(`${route} 加载失败可重试，空数据与错误区分`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await authenticate(page)
    let failed = true
    await page.route(new RegExp(`/api/${route}(\\?.*)?$`), async request => {
      if (failed) return request.fulfill({ status: 503, json: { message: 'fixture unavailable' } })
      return request.fulfill({ json: { items: [], total: 0 } })
    })
    await page.goto(`/${route}`)
    await expect(page.getByText(route === 'problems' ? '题目加载失败' : '提交记录加载失败', { exact: true })).toBeVisible()
    failed = false
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await expect(page.getByText(route === 'problems' ? '暂无题目' : '暂无提交记录', { exact: true })).toBeVisible()
    await expect(page.locator('.pagination-wrapper')).toHaveCount(0)
  })
}
