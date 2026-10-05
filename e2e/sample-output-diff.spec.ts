import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

async function open(page: import('@playwright/test').Page, expected: string, options: { spj?: boolean, checkerLanguage?: string, custom?: boolean } = {}) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: {
    id: 1, logicId: 1, prefix: 'D', title: '输出差异', timeLimit: 1000, memoryLimit: 64,
    submits: 0, accepts: 0, hidden: false, tags: [], description: '# diff',
    spjId: options.spj ? 9 : null,
    checkerLanguage: options.checkerLanguage ?? null,
    publicSamples: [{ input: 'in', output: expected }],
  } }))
  await page.route('**/api/runs', route => route.fulfill({ json: {
    id: 'diff-run', status: 'completed', createdAt: 1, expiresAt: 9,
    result: { status: 'OK', stdout: 'actual\tvalue\nlast  ', stderr: '', exitCode: 0, outputTruncated: false },
  } }))
  await page.goto('/problems/1')
  if (options.custom) await page.getByRole('textbox', { name: '自定义标准输入' }).fill('custom input')
  else {
    await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
    await page.getByText('公开样例 1', { exact: true }).click()
  }
  await page.locator('.cm-content').first().fill('int main() { return 0; }')
  await page.getByRole('button', { name: '运行', exact: true }).click()
}

test('public sample diff points to first normalized differing line and renders whitespace safely', async ({ page }, testInfo) => {
  await open(page, 'actual value\nlast')
  const alert = page.getByText(/样例输出不同/)
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('第 1 行')
  await expect(page.locator('.diff-grid')).toContainText('期望')
  await expect(page.locator('.diff-grid')).toContainText('实际')
  await page.getByRole('checkbox', { name: '显示空白字符' }).check()
  await expect(page.locator('.diff-grid')).toContainText('⇥')
  await expect(page.getByTestId('oj-run-result')).not.toContainText(/客户端对照|不是正式评测|仅供对照/)
  await page.locator('.workbench').screenshot({ path: testInfo.outputPath('sample-difference.png') })
})

test('line endings and trailing whitespace follow the existing trimEnd comparison contract', async ({ page }, testInfo) => {
  await open(page, 'actual\tvalue\nlast\n\n')
  await expect(page.getByText(/样例输出一致/)).toBeVisible()
  await expect(page.locator('.diff-grid')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.workbench').screenshot({ path: testInfo.outputPath('sample-match-mobile.png') })
})

test('empty expected output on SPJ never exposes answer verdicts', async ({ page }) => {
  await open(page, '', { spj: true })
  await expect(page.getByText(/样例输出不同|样例输出一致/)).toHaveCount(0)
  await expect(page.getByText('SPJ 结果请提交评测。', { exact: true })).toBeVisible()
})

test('internal checker without a legacy spjId never uses plain sample comparison', async ({ page }) => {
  await open(page, 'different expected output', { checkerLanguage: 'cpp17' })
  await expect(page.getByText(/样例输出不同|样例输出一致/)).toHaveCount(0)
  await expect(page.getByText('SPJ 结果请提交评测。', { exact: true })).toBeVisible()
})

test('custom input shows execution output without a sample verdict or explanatory paragraph', async ({ page }) => {
  await open(page, 'expected sample', { custom: true })
  const result = page.getByTestId('oj-run-result')
  await expect(result).toContainText('执行成功')
  await expect(result).toContainText('actual\tvalue')
  await expect(result.locator('.run-note')).toHaveCount(0)
  await expect(result).not.toContainText(/样例输出一致|样例输出不同|客户端对照|不是正式评测/)
  await expect(result.getByText('AC', { exact: true })).toHaveCount(0)
})

test('huge line difference has bounded, escaped comparison context', async ({ page }) => {
  const expected = `${'A'.repeat(16000)}<script>alert(1)</script>`
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route('**/api/problems/1', route => route.fulfill({ json: { id: 1, logicId: 1, prefix: 'D', title: 'long', timeLimit: 1, memoryLimit: 64, submits: 0, accepts: 0, tags: [], description: 'x', publicSamples: [{ input: '', output: expected }] } }))
  await page.route('**/api/runs', route => route.fulfill({ json: { id: 'long-diff', status: 'completed', createdAt: 1, expiresAt: 9, result: { status: 'OK', stdout: `${'A'.repeat(16000)}different`, stderr: '', exitCode: 0, outputTruncated: false } } }))
  await page.goto('/problems/1')
  await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
  await page.getByText('公开样例 1', { exact: true }).click()
  await page.locator('.cm-content').first().fill('int main() { return 0; }')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  await expect(page.getByText(/对照内容已截断/)).toBeVisible()
  await expect(page.locator('.diff-grid pre')).toHaveCount(2)
  expect(await page.locator('.diff-grid pre').first().evaluate(el => el.textContent?.length ?? 0)).toBeLessThanOrEqual(12000)
  await expect(page.locator('.diff-grid pre').last()).toContainText('different')
  await expect(page.locator('.diff-grid pre').first()).toContainText('<script>')
  await expect(page.locator('.diff-grid script')).toHaveCount(0)
})
