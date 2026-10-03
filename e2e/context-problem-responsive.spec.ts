import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const contest = {
  id: 7,
  name: '响应式竞赛',
  type: 'icpc',
  startTime: '2025-01-01T00:00:00Z',
  endTime: '2030-01-01T00:00:00Z',
  problems: [{ problemId: 1 }],
  enabledLanguageJSON: '["cpp20","python3"]',
}
const problem = {
  id: 1,
  logicId: 1001,
  prefix: 'A',
  title: '阅读优先响应式题目',
  accepts: 50,
  submits: 100,
  tags: [],
  hidden: false,
  timeLimit: 1000,
  memoryLimit: 64,
  content: '# 题目描述\n\n'.concat('完整题面段落。'.repeat(100)),
}

async function prepare(page: Page, context: 'contest' | 'course', width = 390) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route(url => url.pathname === '/api/problems/1', route => route.fulfill({ json: problem }))
  await page.route(url => url.pathname === `/${context === 'contest' ? 'api/contests' : 'api/courses'}/7`, route => route.fulfill({ json: contest }))
  await page.route(url => url.pathname === '/api/submissions', route => route.fulfill({ json: { id: 32, status: 0 } }))
  if (context === 'contest') {
    await page.evaluate(() => localStorage.setItem('contestToken_7', 'test-contest-scoped-token'))
  }
  await page.setViewportSize({ width, height: 844 })
  await page.goto(context === 'contest' ? '/contests/7/problems/1' : '/course/7/problems/1')
}

for (const context of ['contest', 'course'] as const) {
  test(`${context} mobile reading-first layout reaches editor and preserves submission contract`, async ({ page }, testInfo) => {
    await prepare(page, context)
    await expect(page.getByRole('heading', { name: /阅读优先响应式题目/ })).toBeVisible()
    await expect(page.getByText('完整题面段落。', { exact: false }).first()).toBeVisible()
    const editor = page.locator('.cm-editor')
    await expect(editor).toBeVisible()
    const layout = await page.locator(context === 'contest' ? '.problem-content-area' : '.problem-page').evaluate(element => ({
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length,
      editorWidth: element.querySelector('.problem-right')?.getBoundingClientRect().width ?? 0,
      viewportWidth: document.documentElement.clientWidth,
    }))
    expect(layout.display).toBe('grid')
    expect(layout.columns, 'mobile context page must stack reading above editing').toBe(1)
    expect(layout.editorWidth, 'editor should be wide enough to work on a phone').toBeGreaterThan(layout.viewportWidth * 0.8)
    if (context === 'contest') await expect(page.getByText('距结束')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`${context}-${testInfo.project.name}-390.png`), fullPage: true })
    await page.locator('.submit-area').scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: '提交代码' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`${context}-${testInfo.project.name}-390-editor.png`) })

    await page.locator('.cm-content').fill('int answer = 42;')
    await page.locator('.n-select').first().click()
    await page.getByText('Python 3', { exact: true }).last().click()
    await expect(page.locator('.cm-content').first()).toContainText('int answer = 42;')
    const submitRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/submissions' && request.method() === 'POST')
    await page.getByRole('button', { name: '提交代码' }).click()
    const request = await submitRequest
    expect(JSON.parse(request.postData() || '{}')).toMatchObject({
      problemId: 1,
      language: 'python3',
      code: 'int answer = 42;',
      [`${context}Id`]: 7,
    })
    expect(request.headers().authorization).toBe('Bearer mock-access-token')
    if (context === 'contest') {
      await expect.poll(() => page.evaluate(() => localStorage.getItem('contestToken_7'))).toBe('test-contest-scoped-token')
    }
    await page.keyboard.press('Escape')
    await expect(page.locator('.n-base-select-menu')).toBeHidden()

    for (const width of [360, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const dimensions = await page.evaluate((routeKind) => {
        const layout = document.querySelector(routeKind === 'contest' ? '.problem-content-area' : '.problem-page')!
        return {
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
          columns: getComputedStyle(layout).gridTemplateColumns.trim().split(/\s+/).length,
        }
      }, context)
      expect(dimensions.document, `${context}: horizontal overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
      expect(dimensions.columns, `${context}: layout columns at ${width}px`).toBe(width <= 900 ? 1 : 2)
    }
    await page.screenshot({ path: testInfo.outputPath(`${context}-${testInfo.project.name}-1440.png`), fullPage: true })
  })

  test(`${context} permission errors show a locked state rather than a missing-problem state`, async ({ page }) => {
    await mockAuthApi(page)
    await mockProblemsApi(page)
    await page.goto('/')
    await setLoggedInViaStorage(page)
    await page.route(url => url.pathname === '/api/problems/1', route => route.fulfill({ status: 403, json: { message: 'Forbidden' } }))
    await page.route(url => url.pathname === `/${context === 'contest' ? 'api/contests' : 'api/courses'}/7`, route => route.fulfill({ json: contest }))
    await page.goto(context === 'contest' ? '/contests/7/problems/1' : '/course/7/problems/1')
    await expect(page.getByText('暂时无法访问该题目', { exact: true })).toBeVisible()
    await expect(page.getByText(context === 'contest' ? '请确认你已登录并拥有竞赛访问权限。' : '请确认你已登录并拥有课程访问权限。')).toBeVisible()
    await expect(page.getByRole('button', { name: context === 'contest' ? '返回竞赛' : '返回课程' })).toBeVisible()
  })
}
