import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

async function stableBox(locator: import('@playwright/test').Locator) {
  let previous = await locator.boundingBox()
  let stable = 0
  for (let attempt = 0; attempt < 15 && stable < 3; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100))
    const current = await locator.boundingBox()
    if (current?.y === previous?.y && current?.height === previous?.height) stable++
    else stable = 0
    previous = current
  }
  return previous
}

async function prepare(page: import('@playwright/test').Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: {
    id: 1, logicId: 1, prefix: 'A', title: '布局回归', timeLimit: 1000, memoryLimit: 64,
    submits: 0, accepts: 0, hidden: false, tags: [], description: '# Workbench',
    publicSamples: [{ input: '1', output: '1' }],
  } }))
  await page.route('**/api/runs', route => route.fulfill({ json: {
    id: 'layout-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: '1', stderr: '', exitCode: 0, outputTruncated: false },
  } }))
  await page.route('**/api/submissions/by-request/**', route => route.fulfill({ status: 404, json: { message: 'not found' } }))
  await page.route('**/api/submissions', route => route.fulfill({ json: { id: 88, userId: 1, problemId: 1, status: 9, language: 'cpp17', misc: { code: 'int main() {}' } } }))
  await page.route('**/api/submissions/88', route => route.fulfill({ json: { id: 88, userId: 1, problemId: 1, status: 9, language: 'cpp17', misc: { code: 'int main() {}' } } }))
  await page.route('**/api/submissions/88/status/wait**', route => route.fulfill({ json: { status: 9, progress: { completed: 0, total: 1, testcases: [] } } }))
}

for (const width of [390, 1280]) {
  test(`compact input/run/submit stays adjacent and stable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await prepare(page)
    await page.goto('/problems/1')
    await page.locator('.cm-content').first().fill('print(1)')
    await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
    await page.getByText('公开样例 1', { exact: true }).click()
    await page.waitForTimeout(2000)
    const editor = page.locator('.problem-right > .code-editor')
    const workbench = page.getByRole('region', { name: '评测工作区' })
    const editorBefore = await stableBox(editor)
    const innerScroller = page.locator('.problem-right')
    const innerScrollBefore = await innerScroller.evaluate(el => el.scrollTop)
    const scrollBefore = await page.locator('.n-layout-content > .n-layout-scroll-container').evaluate(el => el.scrollTop)
    await page.getByRole('button', { name: '运行', exact: true }).click()
    await expect(page.getByText('样例输出一致')).toBeVisible()
    expect(await page.locator('.n-layout-content > .n-layout-scroll-container').evaluate(el => el.scrollTop)).toBe(scrollBefore)
    expect(await page.locator('[aria-label="运行输入与结果"]').count()).toBe(1)
    await expect(page.getByRole('tab', { name: '运行结果' })).toBeVisible()
    const submitButton = page.getByRole('button', { name: '提交代码', exact: true })
    // Locator.click() may scroll each nested scroller; click the already-visible
    // button at viewport coordinates to test pointer behavior without reveal scrolling.
    const submitBox = await submitButton.boundingBox()
    expect(submitBox).not.toBeNull()
    if (submitBox) await page.mouse.click(submitBox.x + submitBox.width / 2, submitBox.y + submitBox.height / 2)
    await expect(page).toHaveURL(/submission=88/)
    const editorAfter = await stableBox(editor)
    expect(editorAfter?.y).toBe(editorBefore?.y)
    expect(editorAfter?.height).toBe(editorBefore?.height)
    expect(await innerScroller.evaluate(el => el.scrollTop)).toBe(innerScrollBefore)
    expect(await page.locator('.n-layout-content > .n-layout-scroll-container').evaluate(el => el.scrollTop)).toBe(scrollBefore)
    expect(await workbench.boundingBox()).not.toBeNull()
    if (width === 390) expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('fullscreen reuses one run panel instance and keeps result usable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await prepare(page)
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('print(1)')
  await page.getByRole('button', { name: '全屏编辑代码' }).click()
  await expect(page.getByRole('dialog', { name: '全屏代码编辑器' })).toBeVisible()
  expect(await page.locator('[aria-label="运行输入与结果"]').count()).toBe(1)
  await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
  await page.getByText('公开样例 1', { exact: true }).click()
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByText('样例输出一致')).toBeVisible()
})

test('finishing a run does not pull the user back after they scroll away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await prepare(page)
  let release: (() => void) | undefined
  await page.route('**/api/runs', async route => {
    await new Promise<void>(resolve => { release = resolve })
    await route.fulfill({ json: { id: 'scroll-run', status: 'completed', createdAt: 1, expiresAt: 9, result: { status: 'OK', stdout: 'done', stderr: '', exitCode: 0, outputTruncated: false } } })
  })
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('print(1)')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect.poll(() => !!release).toBe(true)
  const scroller = page.locator('.n-layout-content > .n-layout-scroll-container')
  await scroller.evaluate(el => { el.scrollTop = 0 })
  release?.()
  await expect(page.locator('.output-block pre')).toHaveText('done')
  await page.waitForTimeout(200)
  expect(await scroller.evaluate(el => el.scrollTop)).toBe(0)
})

test('tab Home and End keys reach the ends rather than staying on the current tab', async ({ page }) => {
  await prepare(page)
  await page.goto('/problems/1')
  const middle = page.getByRole('tab', { name: '运行结果', exact: true })
  await middle.click()
  await middle.press('Home')
  await expect(page.getByRole('tab', { name: '输入', exact: true })).toBeFocused()
  await page.getByRole('tab', { name: '输入', exact: true }).press('End')
  await expect(page.getByRole('tab', { name: '正式评测', exact: true })).toBeFocused()
})

test('long stdout remains bounded inside its own scroll region', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await prepare(page)
  await page.route('**/api/runs', route => route.fulfill({ json: {
    id: 'layout-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: 'X'.repeat(50000), stderr: '', exitCode: 0, outputTruncated: false },
  } }))
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('print(1)')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.locator('.output-block pre')).toBeVisible()
  expect(await page.locator('.output-block pre').evaluate(el => el.clientHeight)).toBeLessThanOrEqual(242)
  expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
})
