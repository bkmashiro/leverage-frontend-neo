import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'
import type { Page } from '@playwright/test'
import { createSampleWorkspaceCache, WORKSPACE_CACHE_BYTES, WORKSPACE_CACHE_LIMIT, WORKSPACE_ENTRY_BYTES } from '../app/composables/useSampleWorkspace'
import type { SampleWorkspaceState } from '../app/composables/useSampleWorkspace'

type TestApp = HTMLElement & { __vue_app__: { config: { globalProperties: {
  $router: { push: (path: string) => Promise<void>; afterEach: (hook: (to: { path: string }) => void) => () => void }
  $pinia: { _s: Map<string, { logout: () => void; $patch: (state: object) => void }> }
} } } }
async function spaNavigate(page: Page, path: string) {
  await page.evaluate(path => (document.querySelector('#__nuxt') as TestApp).__vue_app__.config.globalProperties.$router.push(path), path)
  await expect(page).toHaveURL(new RegExp(path.replace(/[?]/g, '\\?') + '$'))
}
async function updateSamples(page: Page, samples: Array<{ input: string; output: string }>) {
  // Exercise a late publicSamples prop through the real mounted page, not HTML extraction.
  await page.locator('.problem-page').evaluate((el, samples) => {
    const instance = (el as HTMLElement & { __vueParentComponent: { setupState: { problem: { publicSamples: typeof samples } } } }).__vueParentComponent
    instance.setupState.problem.publicSamples = samples
  }, samples)
}
const diagnosticCode = 'int main() {\n  return 0\n}'
async function mockCompile(page: Page, context: { courseId?: number; contestId?: number } = {}) {
  const row = { id: 42, userId: 1, problemId: 1, status: 4, language: 'cpp17', courseId: null, contestId: null, ...context,
    misc: { code: diagnosticCode, compileErrorMsg: 'main.cpp:2:10: error: expected semicolon', judgeResult: { testcases: [] } } }
  await page.route('**/api/submissions', route => route.fulfill({ json: row }))
  await page.route('**/api/submissions/42', route => route.fulfill({ json: row }))
}

async function openProblem(page: import('@playwright/test').Page, samples: Array<{ input: string; output: string }> = [{ input: 'first input', output: 'first expected' }, { input: 'second input', output: 'second expected' }], options: { spj?: boolean } = {}) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: {
    id: 1, logicId: 1, prefix: 'D', title: '工作区', timeLimit: 1000, memoryLimit: 64,
    submits: 0, accepts: 0, hidden: false, tags: [], description: '# Workspace',
    spjId: options.spj ? 9 : null, publicSamples: samples,
  } }))
  await page.route('**/api/runs', route => route.fulfill({ json: {
    id: `run-${Date.now()}`, status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: 'actual line\nadded output', stderr: '', exitCode: 0, outputTruncated: false },
  } }))
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int main() { return 0; }')
}

test('public samples are visible on the statement and choosing one copies input without running', async ({ page }, testInfo) => {
  let runCount = 0
  await openProblem(page)
  await page.route('**/api/runs', route => { runCount++; return route.fulfill({ json: { id: 'unused', status: 'completed', createdAt: 1, expiresAt: 9, result: { status: 'OK', stdout: '', stderr: '', exitCode: 0, outputTruncated: false } } }) })
  await expect(page.getByRole('button', { name: '使用此样例' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: '使用此样例' }).first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('first input', { exact: true })).toBeVisible()
  await expect(page.getByText('first expected', { exact: true })).toBeVisible()
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
  await page.getByRole('button', { name: '使用此样例' }).nth(1).click()
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('second input')
  await expect(page.getByRole('tab', { name: '输入' })).toHaveAttribute('aria-selected', 'true')
  expect(runCount).toBe(0)
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    await page.getByLabel('自定义标准输入').scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`samples-${width}.png`), fullPage: true })
  }
})

test('custom input remains editable and old result stays tied to its original expected output', async ({ page }) => {
  await openProblem(page)
  await page.getByRole('button', { name: '使用此样例' }).first().click()
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByText(/期望输出/)).toBeVisible()
  await page.getByRole('button', { name: '使用此样例' }).nth(1).click()
  await expect(page.getByLabel('公开样例').getByText('second expected', { exact: true })).toBeVisible()
  await expect(page.getByTestId('oj-run-result').getByText('first expected', { exact: true })).toBeVisible()
  await page.getByLabel('自定义标准输入').fill('my custom input')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('my custom input')
  await expect(page.getByText(/期望输出/)).toBeVisible()
})

test('no samples stays an empty custom input; SPJ output never shows expected-vs-actual diff', async ({ page }) => {
  await openProblem(page, [])
  await expect(page.getByRole('button', { name: '使用此样例' })).toHaveCount(0)
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('')
  await page.getByLabel('自定义标准输入').fill('custom')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.locator('.sample-diff')).toHaveCount(0)
  await page.goto('/')
  await openProblem(page, [{ input: 'x', output: 'expected' }], { spj: true })
  await page.getByRole('button', { name: '使用此样例' }).click()
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.locator('.sample-diff')).toHaveCount(0)
})

test('workbench restores route-scoped input and selected sample after leaving and returning', async ({ page }) => {
  await openProblem(page)
  await page.getByRole('button', { name: '使用此样例' }).nth(1).click()
  await page.getByLabel('自定义标准输入').fill('restored input')
  await spaNavigate(page, '/')
  await spaNavigate(page, '/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('restored input')
  await expect(page.getByRole('tab', { name: '输入' })).toHaveAttribute('aria-selected', 'true')
})

test('diff uses explicit red/green change labels and narrow viewport does not overflow', async ({ page }) => {
  await openProblem(page)
  await page.getByRole('button', { name: '使用此样例' }).first().click()
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByText('−', { exact: true })).toBeVisible()
  await expect(page.locator('.sample-diff .line-added').first()).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})


test('late samples initialize once and never overwrite edits or restored input', async ({ page }) => {
  await openProblem(page, [])
  await updateSamples(page, [{ input: 'late first', output: 'expected' }])
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('late first')
  await page.getByLabel('自定义标准输入').fill('edited')
  await updateSamples(page, [{ input: 'replacement', output: 'new output' }])
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('edited')
  await spaNavigate(page, '/')
  await spaNavigate(page, '/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('edited')
  await updateSamples(page, [{ input: 'late after restore', output: 'x' }])
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('edited')
})

for (const arrival of ['before-return', 'after-return']) {
  test(`restored untouched empty input is not initialized by samples arriving ${arrival}`, async ({ page }) => {
    await openProblem(page, [])
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('')
    await spaNavigate(page, '/')
    const lateSamples = [{ input: 'late first', output: 'actual line\nadded output' }]
    if (arrival === 'before-return') {
      await page.route('**/api/problems/1', route => route.fulfill({ json: {
        id: 1, logicId: 1, prefix: 'D', title: '工作区', timeLimit: 1000, memoryLimit: 64,
        submits: 0, accepts: 0, hidden: false, tags: [], description: '# Workspace', publicSamples: lateSamples,
      } }))
    }
    await spaNavigate(page, '/problems/1')
    if (arrival === 'after-return') await updateSamples(page, lateSamples)
    await expect(page.getByRole('button', { name: '使用此样例' })).toHaveCount(1)
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('')
    await expect(page.getByRole('button', { name: '使用此样例' })).toHaveAttribute('aria-pressed', 'false')
    // A new explicit choice still replaces the restored custom input.
    await page.getByRole('button', { name: '使用此样例' }).click()
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('late first')
  })
}

test('typing before first late sample keeps custom mode even when text matches', async ({ page }) => {
  await openProblem(page, [])
  await page.getByLabel('自定义标准输入').fill('typed early')
  await updateSamples(page, [{ input: 'typed early', output: 'actual line\nadded output' }])
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('typed early')
  await expect(page.getByRole('button', { name: '使用此样例' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByTestId('oj-run-result')).toContainText('执行成功')
  await expect(page.getByTestId('oj-run-result')).not.toContainText('样例输出一致')
})

test('fullscreen keeps the same run observer and original expected during an in-flight POST', async ({ page }) => {
  await openProblem(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let posts = 0
  let posted: { code: string; stdin: string } | undefined
  let gets = 0
  let waits = 0
  await page.route('**/api/runs', async route => {
    posts++
    posted = route.request().postDataJSON()
    await gate
    await route.fulfill({ json: { id: 'fullscreen-flight', status: 'running', createdAt: 1, expiresAt: 9 } })
  })
  await page.route('**/api/runs/fullscreen-flight', route => { gets++; return route.fulfill({ status: 404 }) })
  await page.route('**/api/runs/fullscreen-flight/wait', route => {
    waits++
    return route.fulfill({ json: { id: 'fullscreen-flight', status: 'completed', createdAt: 1, expiresAt: 9,
      result: { status: 'OK', stdout: 'first expected', stderr: '', exitCode: 0, outputTruncated: false } } })
  })
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect.poll(() => posts).toBe(1)
  const runNode = await page.locator('.run-panel').elementHandle()
  await page.getByRole('button', { name: '全屏编辑代码' }).click()
  await expect(page.getByRole('dialog', { name: '全屏代码编辑器' })).toBeVisible()
  expect(await runNode!.evaluate(el => el === document.querySelector('.run-panel'))).toBe(true)
  await page.getByRole('tab', { name: '输入', exact: true }).click()
  await page.getByLabel('自定义标准输入').fill('edited during POST')
  await page.locator('.cm-content').fill('changed after run')
  expect(posted).toMatchObject({ code: 'int main() { return 0; }', stdin: 'first input' })
  release()
  await expect(page.getByText('样例输出一致', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '退出全屏编辑' }).click()
  await expect(page.getByText('样例输出一致', { exact: true })).toBeVisible()
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('edited during POST')
  expect(posts).toBe(1)
  expect(waits).toBe(1)
  expect(gets).toBe(0)
  await expect(page.locator('.run-panel')).toHaveCount(1)
})

for (const [path, context] of [
  ['/problems/1', {}], ['/course/7/problems/1', { courseId: 7 }], ['/contests/8/problems/1', { contestId: 8 }],
] as const) {
  test(`submission query preserves input and diagnostics navigate in ${path}`, async ({ page }) => {
    await openProblem(page)
    await page.route('**/api/contests/8', route => route.fulfill({ json: { id: 8, title: 'contest', startTime: '2020-01-01', endTime: '2099-01-01', problems: [{ problemId: 1 }] } }))
    if (path !== '/problems/1') await spaNavigate(page, path)
    await mockCompile(page, context)
    await page.getByLabel('自定义标准输入').fill('keep through submit')
    await page.locator('.cm-content').fill(diagnosticCode)
    await page.getByRole('button', { name: '提交代码', exact: true }).click()
    await expect(page).toHaveURL(/submission=42/)
    const jump = page.getByRole('button', { name: /定位首个错误/ })
    await expect(jump).toBeEnabled()
    await jump.click()
    await expect(page.locator('.cm-content')).toBeFocused()
    expect(await page.locator('.cm-content').evaluate(el => {
      const selection = getSelection()!
      const range = document.createRange()
      range.selectNodeContents(el)
      range.setEnd(selection.anchorNode!, selection.anchorOffset)
      return range.toString()
    })).toBe('int main() {  return ')
    await page.getByRole('tab', { name: '输入', exact: true }).click()
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('keep through submit')
    await page.locator('.cm-content').fill('changed')
    await page.getByRole('tab', { name: '正式评测', exact: true }).click()
    await expect(page.getByText('代码已修改，不能定位上次提交的错误。')).toBeVisible()
    await expect(page.getByRole('button', { name: /首个错误（第 2 行/ })).toBeDisabled()
    await page.getByRole('tab', { name: '输入', exact: true }).click()
    await spaNavigate(page, '/')
    await spaNavigate(page, path)
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('keep through submit')
    await expect(page.getByRole('tab', { name: '输入', exact: true })).toHaveAttribute('aria-selected', 'true')
  })
}

test('workspace is memory-only; logout away from problem clears it before same-account login', async ({ page }) => {
  await openProblem(page)
  await page.getByLabel('自定义标准输入').fill('private custom input')
  expect(await page.evaluate(() => Object.entries(sessionStorage).filter(([key]) => key.startsWith('oj-workspace:')))).toEqual([])
  await spaNavigate(page, '/')
  await page.evaluate(() => {
    const auth = (document.querySelector('#__nuxt') as TestApp).__vue_app__.config.globalProperties.$pinia._s.get('auth')!
    auth.logout()
    auth.$patch({ accessToken: 'mock-access-token', user: { id: 1, username: 'testuser', role: 'sa' } })
  })
  await spaNavigate(page, '/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
})

test('changing accounts while away cannot recover previous account workspace', async ({ page }) => {
  await openProblem(page)
  await page.getByLabel('自定义标准输入').fill('account one')
  await spaNavigate(page, '/')
  await page.evaluate(() => (document.querySelector('#__nuxt') as TestApp).__vue_app__.config.globalProperties.$pinia._s.get('auth')!.$patch({ user: { id: 2, username: 'other', role: 'sa' } }))
  await spaNavigate(page, '/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
  await page.getByLabel('自定义标准输入').fill('account two')
  await spaNavigate(page, '/')
  await page.evaluate(() => (document.querySelector('#__nuxt') as TestApp).__vue_app__.config.globalProperties.$pinia._s.get('auth')!.$patch({ user: { id: 1, username: 'testuser', role: 'sa' } }))
  await spaNavigate(page, '/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
})

test('ID-only refresh never invents expected output from current samples', async ({ page }) => {
  await openProblem(page)
  await page.evaluate(() => sessionStorage.setItem('oj-run:1:%2Fproblems%2F1', 'id-only'))
  await page.route('**/api/runs/id-only', route => route.fulfill({ json: { id: 'id-only', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: 'first expected', stderr: '', exitCode: 0, outputTruncated: false } } }))
  await page.reload()
  await expect(page.getByTestId('oj-run-result')).toContainText('first expected')
  await expect(page.getByTestId('oj-run-result')).not.toContainText(/样例输出一致|样例输出不同/)
})


for (const width of [390, 1280]) {
  test(`positions and split restore on browser back at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await openProblem(page, Array.from({ length: 20 }, (_, i) => ({ input: `input ${i}\n${'line\n'.repeat(8)}`, output: `output ${i}` })))
    await page.getByLabel('自定义标准输入').fill('position input')
    if (width === 1280) await page.getByRole('separator', { name: '调整题面与代码区域宽度' }).press('ArrowLeft')
    const before = await page.evaluate(async () => {
      // Let font loading, split reflow and CodeMirror's deferred focus scroll settle
      // before the user scrolls. Record the actual departure position, not an
      // intermediate scrollTop that the browser is still anchoring.
      await document.fonts.ready
      const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      await frame(); await frame()
      const left = document.querySelector('.problem-left')!
      const right = document.querySelector('.problem-right')!
      const outer = document.querySelector('.n-layout-content > .n-layout-scroll-container')!
      left.scrollTop = 300
      right.scrollTop = 80
      outer.scrollTop = 400
      await frame(); await frame()
      return { left: left.scrollTop, right: right.scrollTop, outer: outer.scrollTop, split: left.getBoundingClientRect().width }
    })
    await expect.poll(() => page.locator('.problem-left').evaluate(el => el.scrollTop)).toBe(before.left)
    await page.waitForTimeout(100) // deliver scroll events before route unmount
    await spaNavigate(page, '/')
    await page.goBack()
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('position input')
    await expect.poll(() => page.evaluate(() => ({
      left: document.querySelector('.problem-left')!.scrollTop,
      right: document.querySelector('.problem-right')!.scrollTop,
      outer: document.querySelector('.n-layout-content > .n-layout-scroll-container')!.scrollTop,
      split: document.querySelector('.problem-left')!.getBoundingClientRect().width,
    }))).toEqual(before)
    await page.screenshot({ path: testInfo.outputPath(`restored-${width}.png`), fullPage: true })
  })
}

test('sample action preserves scroll and focus without running at both widths', async ({ page }) => {
  await openProblem(page)
  let posts = 0
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/runs') posts++ })
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('tab', { name: '运行结果', exact: true }).click()
    const action = page.getByRole('button', { name: '使用此样例' }).nth(1)
    await action.scrollIntoViewIfNeeded()
    await action.focus()
    const before = await page.evaluate(() => [...document.querySelectorAll('.problem-left, .problem-right, .n-layout-content > .n-layout-scroll-container')].map(el => el.scrollTop))
    await action.press('Enter')
    await expect(action).toBeFocused()
    await expect(page.getByRole('tab', { name: '输入', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('自定义标准输入')).toHaveValue('second input')
    expect(await page.evaluate(() => [...document.querySelectorAll('.problem-left, .problem-right, .n-layout-content > .n-layout-scroll-container')].map(el => el.scrollTop))).toEqual(before)
  }
  expect(posts).toBe(0)
})

test('diff has bounded balanced changes and escaped text at desktop and mobile widths', async ({ page }, testInfo) => {
  await openProblem(page, [{ input: 'in', output: '<img src=x onerror=alert(1)>\n' + 'old\tvalue\n'.repeat(500) }])
  await page.route('**/api/runs', route => route.fulfill({ json: { id: 'bounded', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: '<script>alert(1)</script>\n' + 'new value\n'.repeat(500), stderr: '', exitCode: 0, outputTruncated: false } } }))
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.locator('.line-removed').first()).toContainText('<img')
  await expect(page.locator('.line-added').first()).toContainText('<script>')
  expect(await page.locator('.diff-lines li').count()).toBeLessThanOrEqual(160)
  await expect(page.locator('.sample-diff script, .sample-diff img')).toHaveCount(0)
  await expect(page.getByText(/并非完整 diff/)).toBeVisible()
  await page.getByRole('checkbox', { name: '显示空白字符' }).check()
  await expect(page.locator('.sample-diff')).toContainText('⇥')
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('.sample-diff').scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ path: testInfo.outputPath(`diff-${width}.png`), fullPage: true })
    await page.locator('.line-added').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`diff-added-${width}.png`), fullPage: true })
  }
})


test('cache enforces byte and count budgets, LRU, oversize rejection and clearing', () => {
  const cache = createSampleWorkspaceCache()
  const state: SampleWorkspaceState = { panel: 'input', selectedSample: null, appliedSample: false, initialized: true, stdin: 'x', leftScrollTop: 0, rightScrollTop: 0, pageScrollTop: 0, splitWidth: null }
  for (let i = 0; i < WORKSPACE_CACHE_LIMIT; i++) cache.set(`key${i}`, state)
  cache.get('key0')
  cache.set('next', state)
  expect(cache.size).toBe(WORKSPACE_CACHE_LIMIT)
  expect(cache.get('key1')).toBeNull()
  expect(cache.get('key0')?.stdin).toBe('x')
  for (let i = 0; i < 30; i++) cache.set(`large${i}`, { ...state, stdin: 'a'.repeat(65536) })
  expect(cache.bytes).toBeLessThanOrEqual(WORKSPACE_CACHE_BYTES)
  expect(cache.size).toBeLessThan(WORKSPACE_CACHE_LIMIT)
  expect(cache.get('large29')?.stdin).toHaveLength(65536)
  expect(cache.set('large29', { ...state, stdin: 'x'.repeat(WORKSPACE_ENTRY_BYTES) })).toBe(false)
  expect(cache.get('large29')).toBeNull()
  cache.clear()
  expect(cache.bytes).toBe(0)
  expect(cache.size).toBe(0)
})

test('oversize input stays editable but is explicitly not cached, never silently truncated', async ({ page }) => {
  await openProblem(page)
  const input = 'x'.repeat(150000)
  await page.getByLabel('自定义标准输入').fill(input)
  await expect(page.getByLabel('自定义标准输入')).toHaveValue(input)
  await expect(page.getByText('输入过大，本次输入不会在离开后恢复。')).toBeVisible()
  await spaNavigate(page, '/')
  await spaNavigate(page, '/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
})

test('all route contexts keep separate sample, custom input and active panel', async ({ page }) => {
  await openProblem(page)
  await page.route('**/api/contests/8', route => route.fulfill({ json: { id: 8, title: 'contest', startTime: '2020-01-01', endTime: '2099-01-01', problems: [{ problemId: 1 }] } }))
  await page.getByRole('button', { name: '使用此样例' }).nth(1).click()
  await page.getByRole('tab', { name: '运行结果', exact: true }).click()
  await spaNavigate(page, '/course/7/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
  await page.getByLabel('自定义标准输入').fill('course custom')
  await spaNavigate(page, '/contests/8/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('first input')
  await page.getByLabel('自定义标准输入').fill('contest custom')
  await spaNavigate(page, '/problems/1')
  await expect(page.getByRole('tab', { name: '运行结果', exact: true })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: '输入', exact: true }).click()
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('second input')
  await expect(page.getByRole('button', { name: '使用此样例' }).nth(1)).toHaveAttribute('aria-pressed', 'true')
  await spaNavigate(page, '/course/7/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('course custom')
  await spaNavigate(page, '/contests/8/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('contest custom')
})

test('help opened in a new tab leaves the current workspace untouched', async ({ page, context }) => {
  // Page routes cover the editor; the new tab also needs a synthetic auth boundary.
  await context.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 401, json: { message: 'Synthetic unauthenticated help tab' } }))
  await openProblem(page)
  await page.getByLabel('自定义标准输入').fill('keep while reading help')
  // Select an existing WASM language through its real selector.
  await page.locator('.oj-language-select .n-base-selection').first().click()
  await page.getByText('C++17 (WASM)', { exact: true }).click()
  const link = page.getByRole('link', { name: '查看 WASM 语言说明' })
  const popup = context.waitForEvent('page')
  await link.click({ button: 'middle' })
  const help = await popup
  await help.waitForURL('**/help/wasm')
  await expect(page).toHaveURL(/\/problems\/1$/)
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('keep while reading help')
  await help.close()
})

test('fullscreen diagnostics target the retained editor and result snapshot survives Escape', async ({ page }, testInfo) => {
  await openProblem(page)
  await mockCompile(page)
  await page.locator('.cm-content').fill(diagnosticCode)
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.locator('.sample-diff')).toBeVisible()
  const editor = await page.locator('.cm-content').elementHandle()
  await page.getByRole('button', { name: '全屏编辑代码' }).click()
  await page.getByRole('button', { name: '提交代码', exact: true }).click()
  await page.getByRole('button', { name: /定位首个错误/ }).click()
  await expect(page.locator('.cm-content')).toBeFocused()
  expect(await editor!.evaluate(el => el === document.querySelector('.cm-content'))).toBe(true)
  await page.getByRole('tab', { name: '运行结果', exact: true }).click()
  await expect(page.locator('.sample-diff')).toBeVisible()
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.locator('.line-added').first().scrollIntoViewIfNeeded()
    const rowBox = await page.locator('.line-added').first().boundingBox()
    expect(rowBox).not.toBeNull()
    expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(900)
    await page.screenshot({ path: testInfo.outputPath(`fullscreen-${width}.png`) })
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '全屏代码编辑器' })).toHaveCount(0)
  await expect(page.locator('.sample-diff')).toBeVisible()
})


test('fullscreen language menu remains operable without losing custom input', async ({ page }) => {
  await openProblem(page)
  await page.getByLabel('自定义标准输入').fill('fullscreen custom')
  await page.getByRole('button', { name: '全屏编辑代码' }).click()
  await page.getByRole('dialog', { name: '全屏代码编辑器' }).locator('.oj-language-select .n-base-selection').click()
  await page.getByText('C++17 (WASM)', { exact: true }).click({ timeout: 3000 })
  await expect(page.getByRole('dialog', { name: '全屏代码编辑器' }).getByRole('link', { name: '查看 WASM 语言说明' })).toBeVisible()
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('fullscreen custom')
})


test('committed route changes cannot overwrite the outgoing workspace with layout scroll', async ({ page }) => {
  await openProblem(page, Array.from({ length: 20 }, (_, i) => ({ input: `input ${i}`, output: `output ${i}` })))
  await spaNavigate(page, '/course/7/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('input 0')
  const scroller = page.locator('.n-layout-content > .n-layout-scroll-container')
  await scroller.evaluate(el => { el.scrollTop = 400; el.dispatchEvent(new Event('scroll')) })
  await page.evaluate(() => {
    const router = (document.querySelector('#__nuxt') as TestApp).__vue_app__.config.globalProperties.$router
    const remove = router.afterEach(to => {
      if (to.path !== '/') return
      // Reproduce a queued/clamped layout scroll after the router commits, while
      // Nuxt's page-scoped useRoute still refers to the outgoing page.
      const element = document.querySelector('.n-layout-content > .n-layout-scroll-container')!
      element.scrollTop = 0
      element.dispatchEvent(new Event('scroll'))
      remove()
    })
  })
  await spaNavigate(page, '/')
  await spaNavigate(page, '/course/7/problems/1')
  await expect(page.getByLabel('自定义标准输入')).toHaveValue('input 0')
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(400)
})

for (const path of ['/course/7/problems/1', '/contests/8/problems/1']) {
  for (const width of [390, 1280]) {
    test(`outer reading position restores for ${path} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await openProblem(page, Array.from({ length: 20 }, (_, i) => ({ input: `input ${i}`, output: `output ${i}` })))
      await page.route('**/api/contests/8', route => route.fulfill({ json: { id: 8, title: 'contest', startTime: '2020-01-01', endTime: '2099-01-01', problems: [{ problemId: 1 }] } }))
      await spaNavigate(page, path)
      await expect(page.getByLabel('自定义标准输入')).toHaveValue('input 0')
      await page.evaluate(() => document.fonts.ready)
      const scroller = page.locator('.n-layout-content > .n-layout-scroll-container')
      await scroller.evaluate(el => { el.scrollTop = 400 })
      await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(400)
      await page.waitForTimeout(100)
      await spaNavigate(page, '/')
      await page.goBack()
      await expect(page.getByLabel('自定义标准输入')).toHaveValue('input 0')
      await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(400)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}
