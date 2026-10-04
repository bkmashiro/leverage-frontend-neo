import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const submission = {
  id: 42, userId: 1, problemId: 1, status: 9, language: 'cpp17',
  courseId: null as number | null, contestId: null as number | null,
  createdAt: '2026-10-04T00:00:00Z', misc: { code: 'int main() {}' },
}

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
})

for (const context of [
  { path: '/problems/1', courseId: null, contestId: null },
  { path: '/course/2/problems/1', courseId: 2, contestId: null },
  { path: '/contests/3/problems/1', courseId: null, contestId: 3 },
]) {
  test(`submit stays in place and refresh resumes without another POST: ${context.path}`, async ({ page }) => {
    const current = { ...submission, courseId: context.courseId, contestId: context.contestId }
    await page.route('**/api/contests/3', route => route.fulfill({ json: { id: 3, startTime: '2026-01-01', endTime: '2027-01-01', problems: [] } }))
    let posts = 0
    let waits = 0
    let terminal = false
    await page.route('**/api/submissions', async route => {
      posts++
      await new Promise(resolve => setTimeout(resolve, 200))
      await route.fulfill({ json: current })
    })
    await page.route('**/api/submissions/42', route => route.fulfill({ json: { ...current, status: terminal ? 4 : 9, misc: { ...current.misc, compileErrorMsg: terminal ? 'expected semicolon' : '' } } }))
    await page.route('**/api/submissions/42/status/wait**', async route => {
      waits++
      await new Promise(resolve => setTimeout(resolve, 150))
      await route.fulfill({ json: { status: 9, version: 'a'.repeat(64), progress: { completed: 1, total: 3, testcases: [{ id: 1, verdict: 'AC', time: 1, memory: 1024 }] } } })
    })
    await page.goto(context.path)
    await page.locator('.cm-content').first().fill('int main() {}')
    await page.getByRole('button', { name: '提交代码', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${context.path}\\?submission=42$`))
    await expect(page.getByTestId('submission-feedback')).toContainText('已完成 1 / 3')
    expect(posts).toBe(1)
    await page.reload()
    await expect(page.getByTestId('submission-feedback')).toContainText('已完成 1 / 3')
    expect(posts).toBe(1)
    terminal = true
    await page.reload()
    await expect(page.getByTestId('submission-feedback')).toContainText('expected semicolon')
    const stoppedAt = waits
    await page.waitForTimeout(400)
    expect(waits).toBe(stoppedAt)
    expect(posts).toBe(1)
  })
}

test('initial detail failure is recoverable, not a false 404; terminal has one result table', async ({ page }) => {
  let reads = 0
  await page.route('**/api/submissions/42', route => {
    reads++
    return reads === 1
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { ...submission, status: 0, misc: { judgeResult: { testcases: [{ id: 1, verdict: 'AC', time: 0, memory: 0 }] } } } })
  })
  let waits = 0
  await page.route('**/api/submissions/42/status/wait**', route => { waits++; return route.fulfill({ status: 500 }) })
  await page.goto('/submissions/42')
  await expect(page.getByText('提交记录不存在', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('submission-feedback')).toContainText('通过(AC)')
  await expect(page.getByTestId('submission-feedback').locator('table')).toHaveCount(1)
  await expect(page.getByText('OK 编译成功')).toHaveCount(0)
  expect(reads).toBe(2)
  expect(waits).toBe(0)
})

test('restoring a different owner or problem does not start a waiter', async ({ page }) => {
  await page.route('**/api/submissions/42', route => route.fulfill({ json: { ...submission, userId: 99, problemId: 99 } }))
  let waits = 0
  await page.route('**/api/submissions/42/status/wait**', route => { waits++; return route.fulfill({ status: 500 }) })
  await page.goto('/problems/1?submission=42')
  await expect(page.getByTestId('submission-feedback')).toContainText('不属于当前')
  expect(waits).toBe(0)
})
