import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

async function open(page: import('@playwright/test').Page, expected: string, options: { spj?: boolean, checkerLanguage?: string } = {}) {
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
  await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
  await page.getByText('公开样例 1', { exact: true }).click()
  await page.locator('.cm-content').first().fill('int main() { return 0; }')
  await page.getByRole('button', { name: '运行', exact: true }).click()
}

test('public sample diff points to first normalized differing line and renders whitespace safely', async ({ page }) => {
  await open(page, 'actual value\nlast')
  const alert = page.getByText(/公开样例首次差异/)
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('第 1 行')
  await expect(page.locator('.diff-grid')).toContainText('期望')
  await expect(page.locator('.diff-grid')).toContainText('实际')
  await page.getByRole('checkbox', { name: '显示空白字符' }).check()
  await expect(page.locator('.diff-grid')).toContainText('⇥')
  await expect(page.getByText(/不是正式评测结果/)).toBeVisible()
})

test('line endings and trailing whitespace follow the existing trimEnd comparison contract', async ({ page }) => {
  await open(page, 'actual\tvalue\nlast\n\n')
  await expect(page.getByText(/公开样例输出一致/)).toBeVisible()
  await expect(page.locator('.diff-grid')).toHaveCount(0)
})

test('empty expected output and SPJ/custom inputs never expose answer verdicts', async ({ page }) => {
  await open(page, '', { spj: true })
  await expect(page.getByText(/公开样例首次差异|公开样例输出一致/)).toHaveCount(0)
  await expect(page.getByText(/执行完成.*不做答案判定/)).toBeVisible()
})

test('internal checker without a legacy spjId never uses plain sample comparison', async ({ page }) => {
  await open(page, 'different expected output', { checkerLanguage: 'cpp17' })
  await expect(page.getByText(/公开样例首次差异|公开样例输出一致/)).toHaveCount(0)
  await expect(page.getByText(/执行完成.*不做答案判定/)).toBeVisible()
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
  await expect(page.getByText(/上下文已截断/)).toBeVisible()
  await expect(page.locator('.diff-grid pre')).toHaveCount(2)
  expect(await page.locator('.diff-grid pre').first().evaluate(el => el.textContent?.length ?? 0)).toBeLessThanOrEqual(12000)
  await expect(page.locator('.diff-grid pre').last()).toContainText('different')
  await expect(page.locator('.diff-grid pre').first()).toContainText('<script>')
  await expect(page.locator('.diff-grid script')).toHaveCount(0)
})
