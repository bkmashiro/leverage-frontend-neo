import { test, expect } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

test('课程提交深链初始加载实际数据并恢复每页数量', async ({ page }) => {
  await mockAuthApi(page)
  await page.addInitScript(token => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
  await page.route(url => url.pathname === '/api/courses/7', route => route.fulfill({ json: { id: 7, name: '课程', problems: [] } }))
  const requests: URL[] = []
  await page.route(url => url.pathname === '/api/courses/7/submissions', route => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({ json: { items: [{ id: 88, problemId: 501, problem: { id: 501, title: '数据应真实载入', prefix: 'P', logicId: 1001 }, language: 'cpp20', status: 0 }], total: 90 } })
  })
  await page.goto('/courses/7?tab=submissions&page=2&perPage=50&keep=yes')
  await expect(page.getByRole('link', { name: '#88', exact: true })).toHaveAttribute('href', '/submissions/88')
  expect(requests[0].searchParams.get('page')).toBe('2')
  expect(requests[0].searchParams.get('perPage')).toBe('50')
  await page.reload()
  await expect(page.getByRole('link', { name: '#88', exact: true })).toBeVisible()
  expect(requests.at(-1)!.searchParams.get('perPage')).toBe('50')
})
