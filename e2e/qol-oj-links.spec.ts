import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, setLoggedInViaStorage } from './mocks/api'

async function signedIn(page: Page) {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
}

const rows = [
  { id: 101, userId: 8, user: { id: 8, username: 'alice' }, problemId: 41, problem: { id: 41, prefix: 'Z', logicId: 9001, title: 'Context target' }, contestId: 7, status: 0, language: 'cpp20', createdAt: '2026-01-01T00:00:00Z' },
  { id: 102, userId: 9, user: { id: 9, username: 'bob' }, problemId: 42, problem: { id: 42, prefix: 'A', logicId: 2, title: 'Course target' }, courseId: 5, status: 1, language: 'cpp20', createdAt: '2026-01-01T00:00:00Z' },
  { id: 103, userId: 10, problemId: 0, status: 0, language: 'cpp20', createdAt: '2026-01-01T00:00:00Z' },
]

test('submission relationships are native anchors and preserve contest/course scope on desktop and mobile', async ({ page }) => {
  await signedIn(page)
  await page.route(/\/api\/submissions(\?.*)?$/, route => route.fulfill({ json: { items: rows, total: rows.length } }))
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/submissions')
    const row1 = page.locator('tr').filter({ hasText: 'Context target' })
    const context1 = width < 768 ? page.locator('.mobile-submission-item').filter({ hasText: 'Context target' }) : row1
    await expect(context1.locator('a[href="/submissions/101"]')).toHaveText('#101')
    await expect(context1.locator('a[href="/contests/7/problems/41"]')).toContainText('Z9001')
    await expect(context1.locator('a[href="/users/8"]')).toHaveText('alice')
    if (width >= 768) {
      const colors = await context1.evaluate(element => ({
        submission: getComputedStyle(element.querySelector('a[href="/submissions/101"]')!).color,
        user: getComputedStyle(element.querySelector('a[href="/users/8"]')!).color,
      }))
      expect(colors.submission).toBe(colors.user)
      const [newTab] = await Promise.all([
        page.context().waitForEvent('page'),
        context1.locator('a[href="/submissions/101"]').click({ modifiers: ['Meta'] }),
      ])
      await expect(newTab).toHaveURL(/\/submissions\/101$/)
      await newTab.close()
    }
    await page.screenshot({ path: test.info().outputPath(`qol-submissions-${width}.png`), animations: 'disabled' })
    const context2 = width < 768 ? page.locator('.mobile-submission-item').filter({ hasText: 'Course target' }) : page.locator('tr').filter({ hasText: 'Course target' })
    await expect(context2.locator('a[href="/course/5/problems/42"]')).toContainText('A2')
    const noProblem = width < 768 ? page.locator('.mobile-submission-item').filter({ hasText: '#103' }) : page.locator('tr').filter({ hasText: '#103' })
    await expect(noProblem.locator('a[href^="/problems/"]')).toHaveCount(0)
  }
})

test('submission detail links problem back into its source context', async ({ page }) => {
  await signedIn(page)
  await page.route('**/api/submissions/101', route => route.fulfill({ json: { ...rows[0], misc: { code: 'int main() {}' } } }))
  await page.goto('/submissions/101')
  await expect(page.locator('a[href="/contests/7/problems/41"]')).toContainText('Z9001')
  await expect(page.locator('.cm-editor')).toBeVisible()
})

test('submission list restores URL filters and paging and writes filter edits back without losing unrelated query', async ({ page }) => {
  await signedIn(page)
  const requests: URL[] = []
  await page.route(/\/api\/submissions(\?.*)?$/, route => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/submissions?page=2&perPage=50&problemId=73&status=1&keep=yes')
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].searchParams.get('page')).toBe('2')
  expect(requests[0].searchParams.get('perPage')).toBe('50')
  expect(requests[0].searchParams.get('problemId')).toBe('73')
  expect(requests[0].searchParams.get('status')).toBe('1')
  await page.getByLabel('按题目 ID 筛选').locator('input').fill('81')
  await expect(page).toHaveURL(/problemId=81/)
  await expect(page).toHaveURL(/keep=yes/)
  await expect(page).toHaveURL(/page=1|problemId=81/)
  await expect.poll(() => requests.length).toBe(2)
  await page.goBack()
  await expect.poll(() => new URL(page.url()).searchParams.get('problemId')).toBe('73')
  await expect(page.getByLabel('按题目 ID 筛选').locator('input')).toHaveValue('73')
  await expect.poll(() => requests.length).toBe(3)
})
