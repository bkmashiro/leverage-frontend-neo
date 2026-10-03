import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, setLoggedInViaStorage } from './mocks/api'

async function signedIn(page: Page) {
  await mockAuthApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
}

test('problem list restores supported query state, debounces search, and preserves unrelated query', async ({ page }) => {
  await signedIn(page)
  const requests: URL[] = []
  await page.route(/\/api\/problems(\?.*)?$/, route => {
    requests.push(new URL(route.request().url()))
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/problems?page=3&perPage=50&tagId=12&search=arrays&keep=ok')
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0].searchParams.get('page')).toBe('3')
  expect(requests[0].searchParams.get('perPage')).toBe('50')
  expect(requests[0].searchParams.get('tagId')).toBe('12')
  expect(requests[0].searchParams.get('search')).toBe('arrays')

  const search = page.getByRole('textbox', { name: '搜索题目' })
  await search.fill('a')
  await search.fill('ar')
  await search.fill('array')
  await search.fill('arrays!')
  await expect.poll(() => new URL(page.url()).searchParams.get('search')).toBe('arrays!')
  await expect(page).toHaveURL(/keep=ok/)
  await expect.poll(() => requests.length).toBe(2)
  expect(requests[1].searchParams.get('search')).toBe('arrays!')
  expect(requests[1].searchParams.get('page')).toBe('1')
})

test('invalid known paging and filter query values normalize safely without looping', async ({ page }) => {
  await signedIn(page)
  let requests = 0
  await page.route(/\/api\/submissions(\?.*)?$/, route => {
    requests++
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  await page.goto('/submissions?page=0&perPage=999&problemId=wat&status=999&keep=1')
  await expect.poll(() => requests).toBe(1)
  await expect(page).toHaveURL(/keep=1/)
  await page.waitForTimeout(500)
  expect(requests).toBe(1)
})
