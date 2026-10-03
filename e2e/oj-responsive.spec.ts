import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const longStatement = [
  '# 移动端题面回归',
  '',
  '题面正文必须在代码编辑器之前阅读。',
  '',
  '公式：\\(a^2 + b^2 = c^2\\)',
  '',
  '```cpp\nint add(int a, int b) { return a + b; }\n```',
  ...Array.from({ length: 18 }, (_, index) => `第 ${index + 1} 段：输入两个整数，输出它们的和。`),
].join('\n\n')

async function openProblem(page: Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: {
    id: 1,
    logicId: 1001,
    prefix: 'A',
    title: '移动端题面回归',
    accepts: 50,
    submits: 100,
    tags: [],
    hidden: false,
    timeLimit: 1000,
    memoryLimit: 64,
    content: longStatement,
  } }))
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.goto('/problems/1')
  await expect(page.locator('.problem-header h2')).toContainText('移动端题面回归')
  await expect(page.locator('.cm-editor')).toBeVisible()
}

for (const width of [360, 390, 768, 1280, 1440]) {
  test(`题目页在 ${width}px 视口可读、可编辑且无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await openProblem(page)

    const measurements = await page.evaluate(() => {
      const page = document.querySelector<HTMLElement>('.problem-page')!
      const left = document.querySelector<HTMLElement>('.problem-left')!
      const right = document.querySelector<HTMLElement>('.problem-right')!
      const title = document.querySelector<HTMLElement>('.problem-header')!
      const editor = document.querySelector<HTMLElement>('.code-editor')!
      return {
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        pageWidth: page.getBoundingClientRect().width,
        leftWidth: left.getBoundingClientRect().width,
        pageHeight: page.getBoundingClientRect().height,
        leftTop: left.getBoundingClientRect().top,
        leftBottom: left.getBoundingClientRect().bottom,
        leftClientHeight: left.clientHeight,
        leftScrollHeight: left.scrollHeight,
        markdownTop: document.querySelector<HTMLElement>('.markdown-body')!.getBoundingClientRect().top,
        markdownBottom: document.querySelector<HTMLElement>('.markdown-body')!.getBoundingClientRect().bottom,
        rightTop: right.getBoundingClientRect().top,
        titleTop: title.getBoundingClientRect().top,
        editorTop: editor.getBoundingClientRect().top,
        contentScroller: (() => { const el = document.querySelector<HTMLElement>('.content-shell .n-layout-scroll-container')!; return { height: el.clientHeight, scrollHeight: el.scrollHeight } })(),
      }
    })
    const artifactDir = process.env.OJ_ARTIFACT_DIR
    if (artifactDir) {
      const { mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      mkdirSync(artifactDir, { recursive: true })
      await page.screenshot({ path: join(artifactDir, `oj-${width}-initial.png`), fullPage: true })
      await import('node:fs/promises').then(fs => fs.writeFile(join(artifactDir, `oj-${width}-measurements.json`), JSON.stringify(measurements, null, 2)))
    }

    expect(measurements.documentWidth, 'the page must not overflow horizontally').toBeLessThanOrEqual(width)
    if (width < 768) {
      expect(measurements.rightTop, 'mobile editor must follow the complete statement, not just the title').toBeGreaterThanOrEqual(measurements.leftBottom)
      expect(measurements.leftScrollHeight, 'the problem pane must not trap statement scrolling internally').toBeLessThanOrEqual(measurements.leftClientHeight + 2)
      expect(measurements.contentScroller.scrollHeight, 'mobile content must extend the existing content scroller').toBeGreaterThan(measurements.contentScroller.height)
      const statement = await page.getByText('题面正文必须在代码编辑器之前阅读。').boundingBox()
      expect(statement?.y).toBeGreaterThanOrEqual(0)
      expect((statement?.y ?? 844) + (statement?.height ?? 0)).toBeLessThan(844)
      await expect(page.getByText('题面正文必须在代码编辑器之前阅读。')).toBeVisible()
      await page.locator('.cm-content').fill('int main() { return 0; }')
      await expect(page.locator('.cm-content')).toContainText('int main() { return 0; }')
    }
    else {
      expect(Math.abs(measurements.leftTop - measurements.rightTop), 'desktop panes must remain side by side').toBeLessThan(8)
      if (width >= 1280) {
        expect(measurements.leftWidth / measurements.pageWidth, 'initial statement column must not be stuck at its minimum width').toBeGreaterThan(0.45)
      }
    }
  })
}

test('桌面分栏可拖动；手机编辑、切换语言后代码仍可提交', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await openProblem(page)
  const before = await page.locator('.problem-left').evaluate(el => el.getBoundingClientRect().width)
  const divider = await page.locator('.drag-divider').boundingBox()
  if (!divider) throw new Error('drag divider is missing')
  await page.mouse.move(divider.x + divider.width / 2, divider.y + 40)
  await page.mouse.down()
  await page.mouse.move(divider.x + 90, divider.y + 40)
  await page.mouse.up()
  const after = await page.locator('.problem-left').evaluate(el => el.getBoundingClientRect().width)
  expect(after).toBeGreaterThan(before + 40)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
  const separator = page.getByRole('separator', { name: '调整题面与代码区域宽度' })
  await separator.focus()
  await separator.press('ArrowLeft')
  const keyboardWidth = await page.locator('.problem-left').evaluate(el => el.getBoundingClientRect().width)
  expect(keyboardWidth).toBeLessThan(after - 20)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.cm-content').fill('int main() { return 0; }')
  await page.getByRole('button', { name: '全屏编辑代码' }).click()
  const fullscreen = page.getByRole('dialog', { name: '全屏代码编辑器' })
  await expect(fullscreen).toBeVisible()
  await expect(fullscreen.locator('.cm-content')).toContainText('int main() { return 0; }')
  expect(await fullscreen.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)')
  await page.getByRole('button', { name: '退出全屏编辑' }).click()
  await expect(fullscreen).toBeHidden()
  await expect(page.locator('.cm-content')).toContainText('int main() { return 0; }')
  await page.locator('.n-select').first().click()
  await page.getByText('C++20', { exact: true }).last().click()
  await expect(page.locator('.cm-content')).toContainText('int main() { return 0; }')
  await page.route('**/api/submissions', route => route.fulfill({ json: { id: 31, status: 9 } }))
  const request = page.waitForRequest(req => req.url().endsWith('/api/submissions') && req.method() === 'POST')
  await page.getByRole('button', { name: '提交代码' }).click()
  expect(JSON.parse((await request).postData() || '{}')).toMatchObject({ problemId: 1, language: 'cpp20', code: 'int main() { return 0; }' })
})
