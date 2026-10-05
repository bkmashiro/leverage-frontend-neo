import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'
import { normalizeExecutionMetadata } from '../app/utils/execution-metadata'

test('execution metadata rejects impossible runtime and measurement combinations', () => {
  expect(normalizeExecutionMetadata({ runtime: 'native', engine: { name: 'wasmtime', version: '34.0.0' }, fuel: { consumed: 1, limit: 10 }, memory: { kind: 'wasm_linear_memory_peak', peakBytes: 65536 } })).toBeNull()
  expect(normalizeExecutionMetadata({ runtime: 'wasmtime', timing: { source: 'trusted_program_wall', scope: 'ready_to_exit', wallMs: 1 }, memory: { kind: 'wasm_linear_memory_peak', peakBytes: 20, limitBytes: 10 }, fuel: { consumed: 1, limit: 0 } })).toBeNull()
})

const submission = {
  id: 812, userId: 1, problemId: 1, status: 0, language: 'cpp17-wasm',
  createdAt: '2026-10-05T00:00:00Z', misc: { code: 'int main() {}' },
}
const metadata = {
  runtime: 'wasmtime',
  timing: { source: 'trusted_program_wall', scope: 'program_start_to_exit', wallMs: 3.25 },
  memory: { kind: 'wasm_linear_memory_peak', peakBytes: 0, limitBytes: 67108864 },
  fuel: { consumed: 0, limit: 100000000 },
  engine: { name: 'wasmtime', version: '34.0.0' },
}

async function login(page: import('@playwright/test').Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
}

test('run and testcase execution metadata show linear-memory peak and honest timing scopes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: {
    id: 1, logicId: 1, prefix: 'A', title: 'metadata', timeLimit: 1000, memoryLimit: 64,
    submits: 0, accepts: 0, hidden: false, tags: [], description: 'test', publicSamples: [],
  } }))
  await page.route('**/api/runs', route => route.fulfill({ json: {
    id: 'metadata-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: 'ok', stderr: '', exitCode: 0, timeMs: 3.25, memoryBytes: 4096,
      outputTruncated: false, runtime: 'wasmtime', fuelConsumed: 0, fuelLimit: 100000000, executionMetadata: metadata },
  } }))
  await page.route('**/api/runs/metadata-run', route => route.fulfill({ json: {
    id: 'metadata-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: 'ok', stderr: '', exitCode: 0, timeMs: 3.25, memoryBytes: 4096,
      outputTruncated: false, runtime: 'wasmtime', fuelConsumed: 0, fuelLimit: 100000000, executionMetadata: metadata },
  } }))
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int main() {}')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  const run = page.getByTestId('oj-run-result')
  await expect(run).toContainText('线性内存峰值')
  await expect(run).toContainText('0 B')
  await expect(run).toContainText('程序启动至退出')
  await expect(run).toContainText('3.25 ms')
  await expect(run.getByText('运行元数据', { exact: true })).toBeVisible()
  await run.getByText('运行元数据', { exact: true }).click()
  await expect(run.locator('.execution-metadata pre')).toContainText('wasm_linear_memory_peak')
  await page.screenshot({ path: process.env.EXECUTION_METADATA_RUN_SCREENSHOT ?? test.info().outputPath('execution-metadata-run-desktop.png'), fullPage: true })

  await page.route('**/api/submissions/812', route => route.fulfill({ json: {
    ...submission,
    misc: { ...submission.misc, judgeResult: { testcases: [
      { id: 1, verdict: 'Accepted', time: 3.25, memory: 4096, runtime: 'wasmtime', executionMetadata: metadata },
      { id: 2, verdict: 'Accepted', time: 1, memory: 1024, executionMetadata: {
        runtime: 'wasmtime', timing: { source: 'host_observed_wall', scope: 'ready_to_exit', wallMs: 8 },
        memory: { kind: 'wasm_linear_memory_peak', peakBytes: 8192 }, unknown: '<img src=x onerror=alert(1)>', source: 'private token image',
      } },
      { id: 3, verdict: 'Accepted', time: 0, memory: 0, executionMetadata: {
        runtime: 'wasmtime', timing: { source: 'trusted_program_wall', scope: 'program_start_to_exit', wallMs: -2 },
        memory: { kind: 'process_peak_rss', peakBytes: 1.5 }, fuel: { consumed: -1, limit: -1 },
      } },
    ] } },
  } }))
  await page.goto('/submissions/812')
  const feedback = page.getByTestId('submission-feedback')
  await expect(feedback).toContainText('程序启动至退出')
  await expect(feedback).toContainText('ready 至退出（宿主观测）')
  await expect(feedback).toContainText('线性内存峰值')
  await expect(feedback.locator('tbody tr').nth(2)).not.toContainText('运行元数据')
  await expect(feedback).not.toContainText('private token image')
  await expect(feedback.locator('img')).toHaveCount(0)
  await feedback.getByText('运行元数据').first().click()
  await expect(feedback.locator('.execution-metadata pre').first()).toContainText('wasm_linear_memory_peak')
  await page.screenshot({ path: process.env.EXECUTION_METADATA_FORMAL_SCREENSHOT ?? test.info().outputPath('execution-metadata-formal-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await feedback.locator('.case-region').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await feedback.locator('tbody').scrollIntoViewIfNeeded()
  await page.screenshot({ path: process.env.EXECUTION_METADATA_MOBILE_SCREENSHOT ?? test.info().outputPath('execution-metadata-formal-mobile.png') })
})

test('older responses without execution metadata remain unchanged', async ({ page }) => {
  await login(page)
  await page.route('**/api/submissions/812', route => route.fulfill({ json: {
    ...submission, misc: { ...submission.misc, judgeResult: { testcases: [{ id: 1, verdict: 'Accepted', time: 0, memory: 0 }] } },
  } }))
  await page.goto('/submissions/812')
  const feedback = page.getByTestId('submission-feedback')
  await expect(feedback.locator('tbody tr').first().locator('.case-memory .resource-value')).toHaveText('0 B')
  await expect(feedback).not.toContainText('运行元数据')
})

test('progress metadata remains visible after refreshing a pending submission', async ({ page }) => {
  await login(page)
  await page.route('**/api/submissions/812', route => route.fulfill({ json: { ...submission, status: 9 } }))
  await page.route('**/api/submissions/812/status/wait**', route => route.fulfill({ json: {
    status: 9, version: 'b'.repeat(64), progress: { completed: 1, total: 2, testcases: [
      { id: 1, verdict: 'Accepted', time: 4, memory: 2048, executionMetadata: metadata },
    ] },
  } }))
  await page.goto('/submissions/812')
  const feedback = page.getByTestId('submission-feedback')
  await expect(feedback).toContainText('线性内存峰值')
  await expect(feedback).toContainText('已完成 1 / 2')
  await page.reload()
  await expect(page.getByTestId('submission-feedback')).toContainText('线性内存峰值')
})
