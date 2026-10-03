import { test, expect } from '@playwright/test'
import { mockAuthApi } from './mocks/api'

test('AI 接口链接与 MCP 配置保留实际代理前缀，并复制完整 URL', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mockAuthApi(page)
  await page.addInitScript(() => {
    if (window !== window.top) return
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { (window as unknown as { __copiedUrl: string }).__copiedUrl = text },
    } })
  })
  await page.goto('/ai')
  const origin = new URL(page.url()).origin
  const apiUrl = `${origin}/api`
  const contextUrl = `${apiUrl}/ai`
  await expect(page.getByRole('link', { name: contextUrl, exact: true })).toHaveAttribute('href', contextUrl)
  const config = page.locator('.n-code').filter({ hasText: 'mcpServers' })
  await expect(config).toContainText(`"LEVERAGE_BASE_URL": "${apiUrl}"`)
  await expect(config).toContainText('"LEVERAGE_API_KEY": "<your-api-key>"')
  await expect(config).not.toContainText('LEVERAGE_TOKEN')
  await expect(config).toContainText('"command": "node"')
  await expect(page.getByRole('link', { name: '管理 API 密钥', exact: true })).toHaveAttribute('href', '/settings/api-keys')
  for (const tool of ['list_examples', 'install_example', 'list_matches', 'get_gamer', 'analyze_match']) {
    await expect(page.getByRole('cell', { name: tool, exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: /复制链接/ }).click()
  expect(await page.evaluate(() => (window as unknown as { __copiedUrl: string }).__copiedUrl)).toBe(contextUrl)
  expect(errors).toEqual([])
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1)
    await page.screenshot({ path: test.info().outputPath(`ai-mcp-${width}.png`), fullPage: true, animations: 'disabled' })
    await config.scrollIntoViewIfNeeded()
    const codeBounds = await config.evaluate(element => ({ right: element.getBoundingClientRect().right, cardRight: element.closest('.n-card')!.getBoundingClientRect().right }))
    expect(codeBounds.right).toBeLessThanOrEqual(codeBounds.cardRight)
    if (width === 390) {
      const scroll = await config.evaluate(element => { element.scrollLeft = element.scrollWidth; return element.scrollLeft })
      expect(scroll).toBeGreaterThan(0)
      await config.evaluate(element => { element.scrollLeft = 0 })
    }
    await page.screenshot({ path: test.info().outputPath(`ai-mcp-config-${width}.png`), animations: 'disabled' })
  }
})
