import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

async function openTestFiles(page: Page, response: unknown, status = 200) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.route(url => url.pathname === '/api/tags', route => route.fulfill({ json: [] }))
  await page.route(url => url.pathname === '/api/problems/1/test-cases', route =>
    route.fulfill({ status, json: response }))
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.goto('/admin/problems/1')
  await expect(page.getByRole('heading', { name: 'A1001 - 两数之和' })).toBeVisible()
  await page.getByText('测试用例', { exact: true }).click()
  await expect(page.getByRole('button', { name: '保存基本信息', exact: true })).toBeHidden()
}

test('legacy filenames remain visible without inventing a size', async ({ page }) => {
  await openTestFiles(page, ['1.in', '1.out'])
  const row = page.getByRole('row').filter({ hasText: '1.in' })
  await expect(row).toBeVisible()
  await expect(row).toContainText('—')
  await expect(page.getByText('NaN MB', { exact: true })).toHaveCount(0)
})

test('requests file details and shows exact zero and measured sizes', async ({ page }, testInfo) => {
  const requests: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.pathname === '/api/problems/1/test-cases') requests.push(url.searchParams.get('details') ?? '')
  })
  await openTestFiles(page, [
    { name: '1.in', size: 0 },
    { name: '1.out', size: 7 },
    { name: '2.in', size: 1024 },
    { name: '2.out', size: 1048576 },
  ])
  await expect(page.getByRole('row').filter({ hasText: '1.in' })).toContainText('0 B')
  await expect(page.getByRole('row').filter({ hasText: '1.out' })).toContainText('7 B')
  await expect(page.getByRole('row').filter({ hasText: '2.in' })).toContainText('1.0 KB')
  await expect(page.getByRole('row').filter({ hasText: '2.out' })).toContainText('1.0 MB')
  expect(requests).toEqual(['true'])
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath('testcase-files-desktop.png'), animations: 'disabled' })
})

test('missing and invalid sizes never render as NaN or zero', async ({ page }) => {
  await openTestFiles(page, [
    { name: 'missing.in' }, { name: 'null.out', size: null },
    { name: 'negative.in', size: -1 }, { name: 'string.out', size: 'oops' },
  ])
  for (const name of ['missing.in', 'null.out', 'negative.in', 'string.out']) {
    await expect(page.getByRole('row').filter({ hasText: name })).toContainText('—')
  }
  await expect(page.getByText('NaN MB', { exact: true })).toHaveCount(0)
})

test('a failed listing shows an error and can be retried, not an empty-data message', async ({ page }) => {
  await openTestFiles(page, { message: 'Storage unavailable' }, 503)
  await expect(page.getByText('测试文件加载失败', { exact: true })).toBeVisible()
  await expect(page.getByText('暂无测试数据', { exact: true })).toHaveCount(0)
  await page.route(url => url.pathname === '/api/problems/1/test-cases', route =>
    route.fulfill({ json: [{ name: '1.in', size: 4 }] }))
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: '1.in' })).toContainText('4 B')
  await expect(page.getByText('测试文件加载失败', { exact: true })).toHaveCount(0)
})

test('an empty successful listing keeps the empty-data state', async ({ page }) => {
  await openTestFiles(page, [])
  await expect(page.getByText('暂无测试数据', { exact: true })).toBeVisible()
  await expect(page.getByText('测试文件加载失败', { exact: true })).toHaveCount(0)
})

test.describe('mobile file list', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  test('keeps names and sizes readable without horizontal overflow', async ({ page }, testInfo) => {
    await openTestFiles(page, [{ name: '1.in', size: 0 }, { name: '1.out', size: 1024 }])
    await expect(page.locator('.admin-shell')).toHaveCount(1)
    await expect(page.getByRole('row').filter({ hasText: '1.out' })).toContainText('1.0 KB')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflow).toBe(false)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: testInfo.outputPath('testcase-files-mobile.png'), animations: 'disabled' })
  })
})
