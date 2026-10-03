import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

const markdownFixture = [
  '<div class="legacy-box" data-safe="keep"><strong>Safe HTML</strong></div>',
  '<img src="https://images.example.test/kept.png" alt="safe image" onerror="window.__markdownXss = true">',
  '<img src=x onerror="window.__markdownXss = true">',
  '<script>window.__markdownXss = true</script>',
  '<iframe src="https://attacker.example.test"></iframe>',
  '<a href="javascript:window.__markdownXss = true" onclick="window.__markdownXss = true">bad link</a>',
  '<a href="https://example.test/safe" target="_blank">safe link</a>',
  '<svg onload="window.__markdownXss = true"><circle /></svg>',
  '<svg><foreignObject><img src=x onerror="window.__markdownXss = true"></foreignObject></svg>',
  '',
  '$x^2 + y^2$',
  '',
  '$$\\sqrt{x} + \\widehat{AB} + \\xrightarrow{n} y$$',
  '',
  '```js\nconst safe = true\n```',
  '',
  '| name | value |',
  '| --- | --- |',
  '| alpha | beta |',
  '',
  '- first item',
  '- second item',
].join('\n')

async function openProblem(page: Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    if (new URL(route.request().url()).pathname === '/api/problems/1') {
      return route.fulfill({ json: {
        id: 1,
        logicId: 1001,
        prefix: 'A',
        title: 'Security canary',
        accepts: 0,
        submits: 0,
        tags: [],
        hidden: false,
        timeLimit: 1000,
        memoryLimit: 64,
        description: markdownFixture,
      } })
    }
    return route.fallback()
  })
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.goto('/problems/1')
  await expect(page.locator('.markdown-body')).toBeVisible()
}

test('Markdown rendering sanitizes active content and keeps supported formatting', async ({ page }) => {
  await openProblem(page)

  await expect(page.locator('.markdown-body .legacy-box strong')).toHaveText('Safe HTML')
  await expect(page.locator('.markdown-body img[alt="safe image"]')).toHaveAttribute('src', 'https://images.example.test/kept.png')
  await expect(page.locator('.markdown-body .katex').first()).toBeVisible()
  expect(await page.locator('.markdown-body .katex svg').count()).toBeGreaterThan(0)
  await expect(page.locator('.markdown-body pre code')).toContainText('const safe = true')
  await expect(page.locator('.markdown-body table')).toBeVisible()
  await expect(page.locator('.markdown-body ul li')).toHaveCount(2)
  await expect(page.locator('.markdown-body a[href="https://example.test/safe"]')).toHaveText('safe link')

  await expect(page.locator('.markdown-body script, .markdown-body iframe, .markdown-body foreignObject')).toHaveCount(0)
  await expect(page.locator('.markdown-body [onerror], .markdown-body [onclick], .markdown-body [onload]')).toHaveCount(0)
  await expect(page.locator('.markdown-body a[href^="javascript:"]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as Window & { __markdownXss?: boolean }).__markdownXss)).toBeUndefined()
})

test('notification HTML preview sanitizes content without Markdown conversion', async ({ page }) => {
  await mockAuthApi(page)
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/notifications/1') {
      return route.fulfill({ json: { id: 1, title: 'Canary', content: '<section class="legacy-notice"><h2>Existing HTML</h2><img src=x onerror="window.__notificationXss = true"><iframe src="https://attacker.example.test"></iframe></section>' } })
    }
    return route.fallback()
  })
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.goto('/admin/notifications/1')
  await page.getByText('Markdown 预览', { exact: true }).click()

  const preview = page.locator('.markdown-preview')
  await expect(preview.locator('section.legacy-notice h2')).toHaveText('Existing HTML')
  await expect(preview.locator('iframe, [onerror]')).toHaveCount(0)
  await expect(preview).not.toContainText('## Existing HTML')
  expect(await page.evaluate(() => (window as Window & { __notificationXss?: boolean }).__notificationXss)).toBeUndefined()
})
