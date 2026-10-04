import { test, expect } from '@playwright/test'
import { mockAuthApi, setLoggedInViaStorage } from './mocks/api'

test('public ranking requests the privacy-safe ranking endpoint and hides private fields', async ({ page }) => {
  await mockAuthApi(page)
  let requestUrl = ''
  await page.route(/\/api\/users\/ranking(\?.*)?$/, async route => {
    requestUrl = route.request().url()
    await route.fulfill({ json: { items: [{ id: 10, username: 'alice', accepts: 120, submits: 200, grade: '2024', realname: 'Private Name', college: 'Private College' }], total: 1 } })
  })
  await page.goto('/ranklist')
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('button', { name: 'alice' })).toBeVisible()
  await expect(page.getByText('Private Name')).toHaveCount(0)
  await expect(page.getByText('Private College')).toHaveCount(0)
  expect(new URL(requestUrl).pathname).toBe('/api/users/ranking')
})

for (const verdict of ['AC', 'Accepted', 'WA']) {
  test(`submission details normalize ${verdict} and preserve zero bytes`, async ({ page }) => {
    const accepted = verdict !== 'WA'
    await mockAuthApi(page)
    await page.goto('/')
    await setLoggedInViaStorage(page)
    await page.route(/\/api\/submissions\/42$/, async route => route.fulfill({ json: {
      id: 42, userId: 1, problemId: 1, language: 'cpp17', status: accepted ? 0 : 1, memory: 0, time: 0,
      createdAt: '2026-01-01T00:00:00Z', code: 'int main(){}',
      misc: { code: 'int main(){}', judgeResult: { testcases: [{ id: 'case-1', verdict, time: 22.518833, memory: 0, actualOutput: 'ok' }] } },
    } }))
    await page.goto('/submissions/42')
    await expect(page.getByText(accepted ? '通过(AC)' : '答案错误(WA)', { exact: true })).toHaveCount(2)
    await expect(page.getByText('0 B', { exact: true })).toHaveCount(2)
    await expect(page.getByText(accepted ? '测试点通过 1 / 1' : '测试点通过 0 / 1', { exact: true })).toBeVisible()
    await expect(page.getByTestId('submission-feedback').locator('table')).toHaveCount(1)
    await expect(page.getByRole('cell', { name: '22.52ms', exact: true })).toBeVisible()
  })
}

test('legacy array judgeResult normalizes kind and extraMessage', async ({ page }) => {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.route('**/api/submissions/43', async route => route.fulfill({ json: {
    id: 43, userId: 1, problemId: 1, language: 'cpp17', status: 1,
    createdAt: '2026-01-01T00:00:00Z',
    misc: { code: 'int main(){}', judgeResult: [{ kind: 'WrongAnswer', time: 12, memory: null, extraMessage: 'legacy detail' }] },
  } }))
  await page.goto('/submissions/43')
  await expect(page.getByText('WA', { exact: true })).toBeVisible()
  await expect(page.getByText('legacy detail')).toBeVisible()
})
