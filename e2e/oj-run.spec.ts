import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

test.describe('OJ试运行', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page)
    await mockProblemsApi(page)
    await page.goto('/')
    await setLoggedInViaStorage(page)
  })

  test('立即running时通过事件长轮询获得终态，只显示样例对照结果', async ({ page }) => {
    let postBody: { language?: string; code?: string; stdin?: string } | undefined
    let waitCalls = 0
    await page.route('**/api/problems/1', async route => route.fulfill({ json: {
      id: 1, logicId: 1001, prefix: 'A', title: '两数之和', timeLimit: 1000, memoryLimit: 64,
      submits: 0, accepts: 0, hidden: false, tags: [], description: '# 题目',
      publicSamples: [{ input: '4 7\n', output: '11\n' }],
    } }))
    await page.route('**/api/runs', async route => {
      postBody = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({ json: { id: 'run-1', status: 'running', createdAt: Date.now(), expiresAt: Date.now() + 900000 } })
    })
    await page.route('**/api/runs/run-1/wait', async route => {
      waitCalls++
      await route.fulfill({ json: { id: 'run-1', status: 'completed', createdAt: 1, expiresAt: 2, result: { status: 'OK', stdout: '11\n', stderr: '', exitCode: 0, timeMs: 4.123456789, memoryBytes: 0, outputTruncated: false } } })
    })
    await page.goto('/problems/1')
    await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
    await page.getByText('公开样例 1', { exact: true }).click()
    await page.locator('.cm-content').first().fill('print(1 + 10)')
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText(/样例输出一致/)).toBeVisible({ timeout: 8000 })
    expect(waitCalls).toBeGreaterThan(0)
    expect(postBody).toEqual({ language: 'cpp17', code: 'print(1 + 10)', stdin: '4 7\n' })
    await expect(page.getByText('11', { exact: true })).toBeVisible()
    await expect(page.getByText('耗时 4.12 ms', { exact: true })).toBeVisible()
    expect(await page.locator('.problem-right > .code-editor').evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(450)
    await expect(page.getByText('样例输出一致', { exact: true })).toBeVisible()
    await expect(page.getByTestId('oj-run-result')).not.toContainText(/客户端对照|不是正式评测|仅供对照/)
    await expect(page.getByTestId('oj-run-result').getByText('AC', { exact: true })).toHaveCount(0)
  })

  test('公开样例按每行尾空白比较，切换样例不篡改已完成的运行结果', async ({ page }) => {
    await page.route('**/api/problems/1', route => route.fulfill({ json: {
      id: 1, logicId: 1001, prefix: 'A', title: '多行样例', timeLimit: 1000, memoryLimit: 64,
      submits: 0, accepts: 0, tags: [], content: 'Example',
      publicSamples: [{ input: 'first', output: 'a\nb\n' }, { input: 'second', output: 'different' }],
    } }))
    await page.route('**/api/runs', route => route.fulfill({ json: {
      id: 'snapshot-run', status: 'completed', createdAt: 1, expiresAt: 2,
      result: { status: 'OK', stdout: 'a  \nb\n\n', stderr: '', exitCode: 0, outputTruncated: false },
    } }))
    await page.goto('/problems/1')
    await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
    await page.getByText('公开样例 1', { exact: true }).click()
    await page.locator('.cm-content').first().fill('print(1)')
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText(/样例输出一致/)).toBeVisible()
    await page.getByTestId('public-sample-select').locator('.n-base-selection-label').click()
    await page.getByText('公开样例 2', { exact: true }).click()
    await expect(page.getByText(/样例输出一致/)).toBeVisible()
  })

  test('SPJ题只显示执行完成，不展示AC或公开样例判定', async ({ page }) => {
    await page.route('**/api/problems/1', async route => route.fulfill({ json: {
      id: 1, logicId: 1001, prefix: 'A', title: 'SPJ题', timeLimit: 1000, memoryLimit: 64,
      submits: 0, accepts: 0, hidden: false, tags: [], description: '# 题目', spjId: 9,
      publicSamples: [{ input: 'x\\n', output: 'ok\\n' }],
    } }))
    await page.route('**/api/runs', async route => route.fulfill({ json: {
      id: 'spj-run', status: 'completed', createdAt: 1, expiresAt: 2,
      result: { status: 'OK', stdout: 'ok\\n', stderr: '', exitCode: 0, outputTruncated: false },
    } }))
    await page.goto('/problems/1')
    await page.locator('.cm-content').first().fill('print("ok")')
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText('执行成功')).toBeVisible()
    await expect(page.getByText('SPJ 结果请提交评测。', { exact: true })).toBeVisible()
    await expect(page.getByTestId('oj-run-result').getByText('AC', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/样例输出一致|样例输出不同/)).toHaveCount(0)
  })

  test('限流错误应给出可重试说明而非伪装为编译错误', async ({ page }) => {
    await page.route('**/api/runs', async route => route.fulfill({ status: 429, json: { message: '稍后重试：运行配额仍在释放' } }))
    await page.goto('/problems/1')
    await expect(page.getByRole('textbox', { name: '自定义标准输入' })).toBeVisible()
    await page.locator('.cm-content').first().fill('print(1)')
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText('稍后重试：运行配额仍在释放')).toBeVisible({ timeout: 5000 })
  })
})
