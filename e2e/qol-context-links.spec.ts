import { test, expect } from '@playwright/test'
import { mockAuthApi, setLoggedInViaStorage } from './mocks/api'

const course = {
  id: 7,
  name: '链接验证课程',
  startTime: '2025-01-01T00:00:00Z',
  endTime: '2030-01-01T00:00:00Z',
  problems: [
    { courseId: 7, problemId: 501, logicId: 1001, prefix: 'OJ', title: '真实主键题' },
    { courseId: 7, problemId: 502, logicId: 9007, prefix: 'OJ', title: '另一逻辑编号' },
    { courseId: 7, logicId: 9008, title: '关联ID缺失' },
  ],
}

test('course context links use relation IDs and tab/page state survives history without secrets in URL', async ({ page }) => {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route(url => url.pathname === '/api/courses/7', route => route.fulfill({ json: course }))
  await page.route(url => url.pathname === '/api/courses/7/submissions', route => route.fulfill({
    json: {
      items: [{ id: 88, userId: 9, problemId: 501, problem: { id: 501, logicId: 1001, prefix: 'OJ', title: '真实主键题' }, status: 0, language: 'cpp20', createdAt: '2026-01-01T00:00:00Z' }],
      total: 45,
    },
  }))
  await page.goto('/courses/7?tab=problems&keep=preserved')

  const titleLink = page.getByRole('link', { name: /真实主键题/ })
  await expect(titleLink).toHaveAttribute('href', '/course/7/problems/501')
  await expect(page.getByRole('link', { name: /另一逻辑编号/ })).toHaveAttribute('href', '/course/7/problems/502')
  await expect(page.getByText('关联ID缺失')).toBeVisible()
  await expect(page.getByText('关联ID缺失')).toHaveJSProperty('tagName', 'SPAN')

  const submissionsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/courses/7/submissions' && response.request().method() === 'GET')
  await page.locator('.n-tabs-tab').filter({ hasText: '提交记录' }).click()
  await expect(page).toHaveURL(/tab=submissions/)
  await expect(page).toHaveURL(/keep=preserved/)
  await submissionsResponse
  await expect(page.getByRole('link', { name: '#88' })).toHaveAttribute('href', '/submissions/88')
  await expect(page.getByRole('link', { name: /真实主键题/ }).last()).toHaveAttribute('href', '/course/7/problems/501')
  await page.locator('.n-pagination-item').filter({ hasText: /^2$/ }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page).not.toHaveURL(/code|token=.*test-contest/)

  await page.locator('.n-tabs-tab').filter({ hasText: '课程信息' }).click()
  await expect(page).not.toHaveURL(/tab=submissions/)
  await page.goBack()
  await expect(page.locator('.n-tabs-tab--active')).toContainText('提交记录')
  await expect(page).toHaveURL(/tab=submissions/)
  await expect(page).toHaveURL(/page=2/)
  await expect(page).toHaveURL(/keep=preserved/)
  await page.reload()
  await expect(page.locator('.n-tabs-tab--active')).toContainText('提交记录')
  await expect(page).toHaveURL(/tab=submissions/)
  await expect(page).toHaveURL(/page=2/)
})

test('contest problem and ICPC header links stay in protected context and submission links are native', async ({ page }) => {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.evaluate(() => localStorage.setItem('contestToken_7', 'scoped-test-secret'))
  await page.route(url => url.pathname === '/api/contests/7', route => route.fulfill({ json: {
    id: 7,
    name: '保护中的比赛',
    type: 'icpc',
    startTime: '2025-01-01T00:00:00Z',
    endTime: '2030-01-01T00:00:00Z',
    problems: [{ contestId: 7, problemId: 501, label: 'A', logicId: 1001, prefix: 'OJ', title: '比赛题目' }],
  } }))
  await page.route(url => url.pathname === '/api/contests/7/me', route => route.fulfill({ json: { registered: true } }))
  await page.route(url => url.pathname === '/api/contests/7/icpc-ranking', route => route.fulfill({ json: [
    { userId: 19, username: 'rank-user', rank: 1, solved: 1, totalPenalty: 3, problems: {} },
  ] }))
  await page.route(url => url.pathname === '/api/contests/7/submissions', route => route.fulfill({ json: {
    items: [{ id: 92, userId: 19, problemId: 501, problem: { id: 501, logicId: 1001, prefix: 'OJ', title: '比赛题目' }, status: 0, language: 'cpp20', createdAt: '2026-01-01T00:00:00Z' }],
    total: 1,
  } }))
  await page.goto('/contests/7?tab=problems&returnTo=overview')

  await expect(page.getByRole('link', { name: 'A. 比赛题目' })).toHaveAttribute('href', '/contests/7/problems/501')
  await page.locator('.n-tabs-tab').filter({ hasText: '排行榜' }).click()
  await expect(page.getByRole('link', { name: 'A', exact: true })).toHaveAttribute('href', '/contests/7/problems/501')
  await expect(page.getByRole('link', { name: 'rank-user' })).toHaveAttribute('href', '/users/19')
  await page.locator('.n-tabs-tab').filter({ hasText: '提交记录' }).click()
  await expect(page.getByRole('link', { name: '#92' })).toHaveAttribute('href', '/submissions/92')
  await expect(page.getByRole('link', { name: 'OJ1001 比赛题目', exact: true })).toHaveAttribute('href', '/contests/7/problems/501')
  await expect(page).toHaveURL(/returnTo=overview/)
  await expect(page).not.toHaveURL(/scoped-test-secret|contestToken/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('contestToken_7'))).toBe('scoped-test-secret')
})

test('admin contest and course editors link existing problem relations in protected context', async ({ page }) => {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route(url => url.pathname === '/api/contests/7', route => route.fulfill({ json: {
    id: 7, name: 'admin contest', type: 'icpc', startTime: '2025-01-01T00:00:00Z', endTime: '2030-01-01T00:00:00Z',
    problems: [{ contestId: 7, problemId: 501, label: 'A', logicId: 1001, title: '关联题' }],
  } }))
  await page.route(url => url.pathname === '/api/courses/7', route => route.fulfill({ json: {
    id: 7, name: 'admin course', createdAt: '2025-01-01T00:00:00Z',
    problems: [{ courseId: 7, problemId: 501, logicId: 1001, title: '关联题' }],
  } }))

  await page.goto('/admin/contests/7?tab=problems')
  await expect(page.getByRole('link', { name: '关联题', exact: true })).toHaveAttribute('href', '/contests/7/problems/501')
  await page.goto('/admin/courses/7?tab=problems')
  await expect(page.getByRole('link', { name: '关联题', exact: true })).toHaveAttribute('href', '/course/7/problems/501')
})
