import { test, expect } from '@playwright/test'
import { mockAuthApi } from './mocks/api'

const diagnostic = 'main.cpp:3:7: error: expected \';\' before \'}\' token\n  cout << "<script>alert(1)</script>"\n       ^\n'

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await page.addInitScript(() => {
    if (window === window.top) localStorage.setItem('refreshToken', 'mock-refresh-token')
  })
})

test('renders the full nested diagnostic, never the submission/user JSON', async ({ page }) => {
  await page.route('**/api/submissions/ce/15', route => route.fulfill({ json: {
    id: 15, user: { username: 'private-owner', email: 'private@example.test' },
    misc: { compileErrorMsg: diagnostic },
  } }))
  await page.goto('/submissions/ce/15')
  await expect(page.getByText('private-owner', { exact: false })).toHaveCount(0)
  const output = page.getByRole('region', { name: '编译器输出' })
  await expect(output).toBeVisible()
  expect(await output.textContent()).toBe(diagnostic)
  await expect(output.locator('script')).toHaveCount(0)
  await expect(page.getByRole('link', { name: '返回提交详情' })).toHaveAttribute('href', '/submissions/15')
})

for (const payload of [diagnostic, { compileErrorMsg: diagnostic }]) {
  test(`accepts an explicit legacy diagnostic ${typeof payload}`, async ({ page }) => {
    await page.route('**/api/submissions/ce/15', route => route.fulfill({ json: payload }))
    await page.goto('/submissions/ce/15')
    await expect(page.getByRole('region', { name: '编译器输出' })).toHaveText(diagnostic)
  })
}

test('empty or unknown payload does not dump unrelated metadata', async ({ page }) => {
  await page.route('**/api/submissions/ce/15', route => route.fulfill({ json: {
    id: 15, misc: { compileErrorMsg: null }, user: { email: 'private@example.test' },
  } }))
  await page.goto('/submissions/ce/15')
  await expect(page.getByText('未记录编译错误信息')).toBeVisible()
  await expect(page.getByText('private@example.test', { exact: false })).toHaveCount(0)
})

for (const status of [403, 404]) {
  test(`shows the distinct ${status} state without backend JSON`, async ({ page }) => {
    await page.route('**/api/submissions/ce/15', route => route.fulfill({ status, json: { message: 'private server message' } }))
    await page.goto('/submissions/ce/15')
    await expect(page.getByText(status === 403 ? '无权查看' : '提交不存在', { exact: true })).toBeVisible()
    await expect(page.getByText('private server message')).toHaveCount(0)
  })
}

test('temporary request failure can be retried', async ({ page }) => {
  let calls = 0
  await page.route('**/api/submissions/ce/15', route => {
    calls++
    return calls === 1
      ? route.fulfill({ status: 503, json: { message: 'temporary failure' } })
      : route.fulfill({ json: { id: 15, misc: { compileErrorMsg: diagnostic } } })
  })
  await page.goto('/submissions/ce/15')
  await expect(page.getByText('加载失败', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '重试' }).click()
  await expect(page.getByRole('region', { name: '编译器输出' })).toHaveText(diagnostic)
  expect(calls).toBe(2)
})

for (const width of [1280, 390]) {
  test(`long diagnostic stays readable and complete at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    const longDiagnostic = diagnostic + 'x'.repeat(1000) + '\n' + 'note: template instantiation\n'.repeat(400) + 'FINAL DIAGNOSTIC\n'
    await page.route('**/api/submissions/ce/15', route => route.fulfill({ json: { id: 15, misc: { compileErrorMsg: longDiagnostic } } }))
    await page.goto('/submissions/ce/15')
    const output = page.getByRole('region', { name: '编译器输出' })
    await expect(output).toBeVisible()
    expect(await output.textContent()).toBe(longDiagnostic)
    const geometry = await output.evaluate((el) => {
      const style = getComputedStyle(el)
      const luminance = (rgb: string) => {
        const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      }
      const fg = luminance(style.color)
      const bg = luminance(style.backgroundColor)
      return { contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), pageOverflow: document.documentElement.scrollWidth - innerWidth, scrollHeight: el.scrollHeight, height: el.clientHeight }
    })
    expect(geometry.contrast).toBeGreaterThanOrEqual(4.5)
    expect(geometry.pageOverflow).toBeLessThanOrEqual(1)
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.height)
    await page.screenshot({ path: testInfo.outputPath(`ce-${width}.png`), fullPage: true })
    await output.evaluate(el => { el.scrollTop = el.scrollHeight })
    await expect(output).toContainText('FINAL DIAGNOSTIC')
  })
}
