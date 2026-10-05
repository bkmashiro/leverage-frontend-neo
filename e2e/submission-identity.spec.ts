import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const done = { id: 42, userId: 1, problemId: 1, courseId: null, contestId: null, language: 'cpp17', status: 0, misc: { code: 'int main() {}', judgeResult: { testcases: [{ id: 1, verdict: 'AC', time: 1, memory: 8192 }] } } }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.route('**/api/submissions/42', route => route.fulfill({ json: done }))
  await page.goto('/')
  await setLoggedInViaStorage(page)
})

test('accepted response loss recovers the original submission without another POST', async ({ page }) => {
  const posted: string[] = []
  let lookup = ''
  let persistedBeforeSend = false
  await page.route('**/api/submissions/by-request/*', route => {
    lookup = new URL(route.request().url()).pathname.split('/').pop()!
    return route.fulfill({ json: done })
  })
  await page.route('**/api/submissions', async route => {
    const dto = route.request().postDataJSON()
    posted.push(dto.requestId)
    persistedBeforeSend = await page.evaluate(id => Object.keys(sessionStorage).some(key => key.startsWith('oj-submit:') && sessionStorage.getItem(key)?.includes(id)), dto.requestId)
    await route.abort('connectionreset')
  })
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int main() {}')
  await page.getByRole('button', { name: '提交代码', exact: true }).click()
  await expect.poll(() => posted[0]).toMatch(uuid)
  await expect(page).toHaveURL(/submission=42/)
  await expect(page.getByTestId('submission-feedback')).toContainText('通过(AC)')
  expect(persistedBeforeSend).toBe(true)
  expect(lookup).toBe(posted[0])
  await page.reload()
  await expect(page.getByTestId('submission-feedback')).toContainText('通过(AC)')
  expect(posted).toHaveLength(1)
})

test('manual retry of an unconfirmed identical payload reuses its identity', async ({ page }) => {
  const posted: string[] = []
  await page.route('**/api/submissions/by-request/*', route => route.fulfill({ status: 404 }))
  await page.route('**/api/submissions', route => {
    posted.push(route.request().postDataJSON().requestId)
    return posted.length === 1 ? route.abort('connectionreset') : route.fulfill({ json: done })
  })
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int main() {}')
  const submit = page.getByRole('button', { name: '提交代码', exact: true })
  await submit.click()
  await expect(page.getByTestId('submission-feedback')).toContainText('尚未找到')
  await submit.click()
  await expect(page).toHaveURL(/submission=42/)
  expect(posted).toHaveLength(2)
  expect(posted[0]).toMatch(uuid)
  expect(posted[1]).toBe(posted[0])
})

test('refresh restores an unresolved identity using reads only, without storing source in the receipt', async ({ page }) => {
  let posts = 0
  let reads = 0
  let available = false
  await page.route('**/api/submissions', route => { posts++; return route.abort('connectionreset') })
  await page.route('**/api/submissions/by-request/*', route => {
    reads++
    return available ? route.fulfill({ json: done }) : route.fulfill({ status: 404 })
  })
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int sensitive_source_marker = 123;')
  await page.getByRole('button', { name: '提交代码', exact: true }).click()
  await expect.poll(() => reads).toBeGreaterThan(0)
  const receipts = await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('oj-submit:')).map(key => sessionStorage.getItem(key)))
  expect(receipts).toHaveLength(1)
  expect(receipts[0]).not.toContain('sensitive_source_marker')
  available = true
  await page.reload()
  await expect(page).toHaveURL(/submission=42/)
  expect(posts).toBe(1)
  expect(reads).toBeGreaterThan(1)
})

test('explicit request conflict stops automatic writes and remains recoverable', async ({ page }) => {
  let posts = 0
  await page.route('**/api/submissions', route => { posts++; return route.fulfill({ status: 409 }) })
  await page.route('**/api/submissions/by-request/*', route => route.fulfill({ status: 503 }))
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('int main() {}')
  await page.getByRole('button', { name: '提交代码', exact: true }).click()
  await expect(page.getByTestId('submission-feedback')).toContainText('提交内容不一致，请先找回上次提交。')
  await expect(page.getByRole('button', { name: '找回上次提交' })).toBeVisible()
  await page.waitForTimeout(800)
  expect(posts).toBe(1)
})

test('terminal notification shows fetching until the full authoritative result arrives', async ({ page }) => {
  let reads = 0
  let release: (() => void) | undefined
  await page.route('**/api/submissions/42', async route => {
    if (++reads === 1) return route.fulfill({ json: { ...done, status: 11 } })
    await new Promise<void>(resolve => { release = resolve })
    return route.fulfill({ json: done })
  })
  await page.route('**/api/submissions/42/status/wait**', route => route.fulfill({ json: { status: 0, version: 'a'.repeat(64) } }))
  await page.goto('/submissions/42')
  try {
    await expect(page.getByTestId('submission-feedback')).toContainText('正在读取最终结果')
    await expect(page.getByTestId('submission-feedback')).not.toContainText('评测汇总')
  } finally { release?.() }
  await expect(page.getByTestId('submission-feedback')).toContainText('评测汇总')
})
