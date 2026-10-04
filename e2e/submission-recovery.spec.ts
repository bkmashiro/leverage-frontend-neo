import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const submission = { id: 42, userId: 1, problemId: 1, status: 9, language: 'cpp17', createdAt: '2026-10-04T00:00:00Z' }
test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
})
for (const status of [4, 5, 6, 12, 13]) {
  test(`terminal error verdict ${status} does not maintain a waiter`, async ({ page }) => {
    let waits = 0
    await page.route('**/api/submissions/42', route => route.fulfill({ json: { ...submission, status } }))
    await page.route('**/api/submissions/42/status/wait**', route => { waits++; return route.fulfill({ status: 500 }) })
    await page.goto('/submissions/42')
    await expect(page.getByTestId('submission-feedback')).toContainText('评测汇总')
    await page.waitForTimeout(300)
    expect(waits).toBe(0)
  })
}

test('wait failures recover, offline resumes, permission failure stops', async ({ page, context }) => {
  let waits = 0
  let forbidden = false
  await page.route('**/api/submissions/42', route => route.fulfill({ json: submission }))
  await page.route('**/api/submissions/42/status/wait**', async route => {
    waits++
    if (forbidden) return route.fulfill({ status: 403 })
    if (waits === 1) return route.fulfill({ status: 503 })
    await new Promise(resolve => setTimeout(resolve, 100))
    return route.fulfill({ json: { status: 9, version: 'b'.repeat(64), progress: { completed: 1, total: 3, testcases: [{ id: 1, verdict: 'AC' }] } } })
  })
  await page.goto('/problems/1?submission=42')
  await expect(page.getByTestId('submission-feedback')).toContainText('正在自动重连')
  await expect(page.getByTestId('submission-feedback')).toContainText('已完成 1 / 3')
  await context.setOffline(true)
  await expect(page.getByTestId('submission-feedback')).toContainText('网络已断开')
  const before = waits
  await page.waitForTimeout(700)
  expect(waits).toBe(before)
  await context.setOffline(false)
  await expect(page.getByTestId('submission-feedback')).toContainText('已完成 1 / 3')
  forbidden = true
  await expect(page.getByTestId('submission-feedback')).toContainText('访问权限')
  const stopped = waits
  await page.waitForTimeout(800)
  expect(waits).toBe(stopped)
})

test('long wait shows a non-terminal hint; route departure cancels updates', async ({ page }) => {
  await page.clock.install()
  await page.route('**/api/submissions/42', route => route.fulfill({ json: submission }))
  let held = false
  await page.route('**/api/submissions/42/status/wait**', async route => {
    held = true
    await new Promise(resolve => setTimeout(resolve, 3000))
    await route.fulfill({ json: { status: 9, version: 'a'.repeat(64) } }).catch(() => {})
  })
  await page.goto('/problems/1?submission=42')
  await expect.poll(() => held).toBe(true)
  await page.clock.fastForward(31000)
  await expect(page.getByTestId('submission-feedback')).toContainText('等待时间较长')
  await expect(page.getByTestId('submission-feedback')).not.toContainText('评测汇总')
  await page.goto('/problems')
  await expect(page.getByTestId('submission-feedback')).toHaveCount(0)
})

for (const width of [390, 1280]) {
  test(`submission feedback keeps button geometry and respects motion preference at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let posts = 0
    await page.route('**/api/submissions', async route => {
      posts++
      await new Promise(resolve => setTimeout(resolve, 450))
      await route.fulfill({ json: submission })
    })
    await page.route('**/api/submissions/42', route => route.fulfill({ json: { ...submission, status: 0, misc: { judgeResult: { testcases: [{ id: 1, verdict: 'AC', time: 12.5, memory: 8192 }] } } } }))
    await page.goto('/problems/1')
    await page.locator('.cm-content').first().fill('int main() {}')
    const button = page.getByRole('button', { name: '提交代码', exact: true })
    await button.scrollIntoViewIfNeeded()
    const before = await button.boundingBox()
    await button.click()
    await page.keyboard.press('Control+Enter')
    await page.keyboard.press('Control+Enter')
    await expect(page.getByTestId('submission-feedback')).toContainText('评测汇总')
    expect(posts).toBe(1)
    const after = await button.boundingBox()
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1)
    await expect(page.locator('.cm-content').first()).toContainText('int main() {}')
    const feedback = page.getByTestId('submission-feedback')
    expect(await feedback.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await feedback.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`feedback-${width}.png`), fullPage: true })
  })
}

test('fullscreen keeps submission controls reachable with a long result', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 650 })
  await page.route('**/api/submissions/42', route => route.fulfill({ json: { ...submission, status: 0, misc: { judgeResult: { testcases: Array.from({ length: 40 }, (_, index) => ({ id: index + 1, verdict: 'AC', time: 1, memory: 8192 })) } } } }))
  await page.goto('/problems/1?submission=42')
  await expect(page.getByTestId('submission-feedback')).toContainText('评测汇总')
  await page.getByRole('button', { name: '全屏编辑代码' }).click()
  const dialog = page.getByRole('dialog', { name: '全屏代码编辑器' })
  await expect(dialog.getByTestId('submission-feedback')).toContainText('测试点通过 40 / 40')
  await expect.poll(async () => (await dialog.boundingBox())!.height).toBe(650)
  const bounds = await dialog.boundingBox()
  expect(bounds!.x).toBe(0)
  expect(bounds!.y).toBe(0)
  expect(bounds!.width).toBe(390)
  const controls = await dialog.getByRole('button', { name: '提交代码', exact: true }).boundingBox()
  expect(controls!.y).toBeGreaterThan(0)
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(650)
  await expect.poll(async () => (await dialog.locator('.cm-editor').boundingBox())!.height).toBeGreaterThan(150)
  await expect(dialog).toHaveCSS('opacity', '1')
  await expect(dialog).toHaveCSS('transform', 'none')
  await page.screenshot({ path: testInfo.outputPath('fullscreen-feedback-390.png') })
})

test('uncertain submission response preserves code and never retries the POST', async ({ page }) => {
  let posts = 0
  await page.route('**/api/submissions', route => { posts++; return route.fulfill({ status: 503 }) })
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int important_work = 42;')
  await page.getByRole('button', { name: '提交代码', exact: true }).click()
  await expect(page.getByTestId('submission-feedback')).toContainText('请先查看提交记录')
  await expect(page.locator('.cm-content').first()).toContainText('int important_work = 42;')
  await page.waitForTimeout(1100)
  expect(posts).toBe(1)
})
