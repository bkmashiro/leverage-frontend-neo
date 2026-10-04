import { test, expect } from '@playwright/test'
import { mockAuthApi, setLoggedInViaStorage } from './mocks/api'

test('pending submission displays safe testcase progress but not a final AC summary', async ({ page }) => {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  let waits = 0
  await page.route('**/api/submissions/42', async route => route.fulfill({ json: {
    id: 42, status: 9, userId: 7, problemId: 3, language: 'cpp17', createdAt: '2026-10-04T00:00:00Z',
    provider: 'internal', problem: { id: 3, prefix: 'A', logicId: 1, title: 'Progress test' },
  } }))
  await page.route('**/api/submissions/42/status/wait**', async route => {
    waits++
    const url = new URL(route.request().url())
    if (waits > 1) await new Promise(resolve => setTimeout(resolve, 3000))
    await route.fulfill({ json: {
      status: 9,
      version: waits === 1 ? 'a'.repeat(64) : 'b'.repeat(64),
      progress: { completed: 1, total: 4, testcases: [{ id: 1, verdict: 'Accepted', time: 3.5, memory: 1024 }] },
    } })
    expect(url.searchParams.get('after')).toBe(waits === 1 ? '' : 'a'.repeat(64))
  })

  await page.goto('/submissions/42')
  await expect(page.getByTestId('submission-progress')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/已完成 1 \/ 4 个测试点/)).toBeVisible()
  await expect(page.getByTestId('submission-progress').getByText('AC', { exact: true })).toBeVisible()
  await expect(page.getByText('评测汇总', { exact: true })).toHaveCount(0)
  expect(waits).toBeGreaterThan(0)
})

test('terminal detail fetch failure retries until full submission details load', async ({ page }) => {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  let detailCalls = 0
  const fullSubmission = {
    id: 42, status: 1, userId: 7, problemId: 3, language: 'cpp17', createdAt: '2026-10-04T00:00:00Z',
    provider: 'internal', code: 'full terminal result', misc: { judgeResult: [{ verdict: 'AC', time: 2, memory: 1024 }] },
    problem: { id: 3, prefix: 'A', logicId: 1, title: 'Terminal retry test' },
  }
  await page.route('**/api/submissions/42', async route => {
    detailCalls++
    if (detailCalls === 2) {
      await route.fulfill({ status: 503, json: { message: 'temporary detail failure' } })
      return
    }
    await route.fulfill({ json: detailCalls === 1 ? { ...fullSubmission, status: 9, code: '' } : fullSubmission })
  })
  await page.route('**/api/submissions/42/status/wait**', async route => {
    const url = new URL(route.request().url())
    expect(url.searchParams.get('after')).toBe('')
    await route.fulfill({ json: { status: 1, version: 'c'.repeat(64) } })
  })

  await page.goto('/submissions/42')
  await expect(page.getByText('full terminal result', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('AC', { exact: true })).toBeVisible()
  expect(detailCalls).toBeGreaterThanOrEqual(3)
})
