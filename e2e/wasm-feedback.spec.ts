import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const submission = {
  id: 701, userId: 1, problemId: 1, status: 0, language: 'cpp17',
  createdAt: '2026-10-05T00:00:00Z', misc: { code: 'int main() {}' },
}

async function login(page: import('@playwright/test').Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
}

test('submission feedback shows only Wasmtime fuel metadata, including zero and missing values', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page)
  await page.route('**/api/submissions/701', route => route.fulfill({ json: {
    ...submission,
    misc: { ...submission.misc, judgeResult: { testcases: [
      { id: 1, verdict: 'Accepted', time: 1802.76, memory: 8192, actualOutput: '3\n', runtime: 'wasmtime', fuelConsumed: 1234567, fuelLimit: 100000000 },
      { id: 2, verdict: 'Accepted', time: 0, memory: 0, runtime: 'wasmtime', fuelConsumed: 0, fuelLimit: 100000000 },
      { id: 3, verdict: 'TimeLimitExceeded', time: 1000, memory: 1024, runtime: 'wasmtime', limitReason: 'fuel' },
      { id: 4, verdict: 'Accepted', time: 2, memory: 1024 },
      { id: 5, verdict: 'TimeLimitExceeded', time: 1000, memory: 1024, runtime: 'wasmtime', limitReason: 'wall' },
    ] } },
  } }))
  await page.goto('/submissions/701')
  const feedback = page.getByTestId('submission-feedback')
  await expect(feedback.getByRole('columnheader', { name: '燃料' })).toBeVisible()
  await expect(feedback).toContainText('WASM')
  await expect(feedback).toContainText('1.23M / 100M')
  await expect(feedback).toContainText('0 / 100M')
  await expect(feedback).toContainText('燃料耗尽')
  await expect(feedback.locator('tbody tr').nth(3).locator('.case-fuel .resource-value')).toHaveText('—')
  await expect(feedback.locator('tbody tr').nth(4)).toContainText('运行超时')
  await expect(feedback).toContainText('1802.76ms')
  await expect(feedback).not.toContainText('CPU 指令')
  await page.screenshot({ path: process.env.WASM_FEEDBACK_SCREENSHOT ?? test.info().outputPath('wasm-feedback-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
  const caseRegion = feedback.locator('.case-region')
  expect(await caseRegion.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  const timeCell = feedback.locator('tbody tr').first().locator('td').nth(1)
  expect(await timeCell.evaluate(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && !node.textContent?.includes('1802.76ms')) node = walker.nextNode()
    if (!node) return 0
    const range = document.createRange()
    range.selectNodeContents(node)
    return range.getClientRects().length
  })).toBe(1)
  await caseRegion.scrollIntoViewIfNeeded()
  await page.screenshot({ path: process.env.WASM_FEEDBACK_MOBILE_SCREENSHOT ?? test.info().outputPath('wasm-feedback-mobile.png'), fullPage: true })
})

test('progress fuel projection survives refresh before the final judge result', async ({ page }) => {
  await login(page)
  await page.route('**/api/submissions/701', route => route.fulfill({ json: { ...submission, status: 9 } }))
  await page.route('**/api/submissions/701/status/wait**', route => route.fulfill({ json: {
    status: 9, version: 'a'.repeat(64),
    progress: { completed: 1, total: 2, testcases: [
      { id: 1, verdict: 'Accepted', time: 6, memory: 4096, runtime: 'wasmtime', fuelConsumed: 1234567, fuelLimit: 100000000 },
    ] },
  } }))
  await page.goto('/submissions/701')
  const feedback = page.getByTestId('submission-feedback')
  await expect(feedback).toContainText('1.23M / 100M')
  await expect(feedback).toContainText('已完成 1 / 2')
  await page.reload()
  await expect(page.getByTestId('submission-feedback')).toContainText('1.23M / 100M')
})

test('native and older submission feedback has no WASM noise', async ({ page }) => {
  await login(page)
  await page.route('**/api/submissions/701', route => route.fulfill({ json: {
    ...submission, status: 2,
    misc: { ...submission.misc, judgeResult: { testcases: [
      { id: 1, verdict: 'TimeLimitExceeded', time: 1000, memory: 1024, limitReason: 'fuel' },
      { id: 2, verdict: 'Accepted', time: 0, memory: 0 },
    ] } },
  } }))
  await page.goto('/submissions/701')
  const feedback = page.getByTestId('submission-feedback')
  await expect(feedback.getByRole('columnheader', { name: '燃料' })).toHaveCount(0)
  await expect(feedback).not.toContainText('WASM')
  await expect(feedback).not.toContainText('燃料耗尽')
  await expect(feedback).toContainText('超时(TLE)')
  await expect(feedback.locator('tbody tr').nth(1).locator('.case-memory .resource-value')).toHaveText('0 B')
})

test('local run result renders runtime fuel separately from elapsed time and survives refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await login(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: {
    id: 1, logicId: 1, prefix: 'A', title: 'fuel run', timeLimit: 1000, memoryLimit: 64,
    submits: 0, accepts: 0, hidden: false, tags: [], description: 'run', publicSamples: [],
  } }))
  await page.route('**/api/runs', route => route.fulfill({ json: {
    id: 'wasm-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'TLE', stdout: '', stderr: '', exitCode: null, timeMs: 1000, memoryBytes: 8192,
      outputTruncated: false, runtime: 'wasmtime', fuelConsumed: 0, fuelLimit: 100000000, limitReason: 'fuel' },
  } }))
  await page.route('**/api/runs/wasm-run', route => route.fulfill({ json: {
    id: 'wasm-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'TLE', stdout: '', stderr: '', exitCode: null, timeMs: 1000, memoryBytes: 8192,
      outputTruncated: false, runtime: 'wasmtime', fuelConsumed: 0, fuelLimit: 100000000, limitReason: 'fuel' },
  } }))
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int main() {}')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByTestId('oj-run-result')).toContainText('燃料耗尽')
  await expect(page.getByTestId('oj-run-result')).toContainText('0 / 100M')
  await expect(page.getByTestId('oj-run-result')).toContainText('1000 ms')
  await expect.poll(() => page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByTestId('oj-run-result').scrollIntoViewIfNeeded()
  await page.screenshot({ path: process.env.WASM_FEEDBACK_RUN_SCREENSHOT ?? test.info().outputPath('wasm-run-mobile.png'), fullPage: true })
  await page.reload()
  await expect(page.getByTestId('oj-run-result')).toContainText('0 / 100M')
})
