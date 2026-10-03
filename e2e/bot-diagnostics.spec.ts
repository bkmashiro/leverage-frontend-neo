import { test, expect } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

for (const shape of ['direct', 'legacy', 'compile', 'long'] as const) {
  test(`Bot 测试显示 ${shape} 结果中的指令或编译诊断`, async ({ page }) => {
    await mockAuthApi(page)
    if (shape === 'long') await page.addInitScript(() => {
      if (window !== window.top) return
      const active = new Set<number>()
      const schedule = window.setTimeout.bind(window)
      const cancel = window.clearTimeout.bind(window)
      window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (typeof callback !== 'function' || !new Error().stack?.includes('MatchTimeline.vue')) return schedule(callback, delay, ...args)
        const id = schedule(() => { active.delete(id); callback(...args) }, delay)
        active.add(id)
        return id
      }) as typeof window.setTimeout
      window.clearTimeout = id => { if (id !== undefined) active.delete(id); cancel(id) }
      ;(window as unknown as { __timelineTimerCount: () => number }).__timelineTimerCount = () => active.size
    })
    if (shape === 'compile' || shape === 'direct') await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(token => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
    const game = { id: 41, title: '示例', disabled: false, gamerQuantity: 2 }
    await page.route('**/api/compete/games**', route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/playground')) return route.fulfill({ json: { matchId: 71, testGamerId: 91 } })
      return route.fulfill({ json: path.endsWith('/41') ? game : { items: [game], total: 1 } })
    })
    await page.route('**/api/compete/gamers**', route => route.fulfill({ json: { items: [{ id: 53, gameId: 41, title: '对手', type: 'code', disabled: false, isTest: false }], total: 1 } }))
    const commands = { '0': { target: 5, marker: 'COMMAND_ONE' }, '1': { target: 5 } }
    const execution = shape === 'compile'
      ? { verdict: 'error', error: 'Compilation failed', compileMessages: { '0': 'SyntaxError: invalid source <img src=x onerror="window.__diagXss=1">' }, rounds: [], finalResult: {} }
      : { verdict: 'OK', rounds: Array.from({ length: shape === 'long' ? 30 : 1 }, (_, index) => ({ round: index + 1, judgeCmd: shape === 'legacy' ? { commands } : commands, botResponses: { '0': 5, '1': 4 }, debug: { judge: 'JUDGE_DEBUG', bot_0: 'BOT_DEBUG', bot_0_stderr: 'STDERR_LINE' } })), finalResult: { '91': 1, '53': 0 } }
    await page.route('**/api/compete/matches/71', route => route.fulfill({ json: { id: 71, gameId: 41, status: shape === 'compile' ? 3 : 2, result: JSON.stringify(execution) } }))
    await page.goto('/compete/playground?gameId=41&tab=bot')
    await expect(page.getByText('对手 (ELO 1200)', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /插入模板/ }).first().click()
    await page.getByRole('button', { name: /运行测试对局/ }).click()
    if (shape === 'compile') {
      await expect(page.getByRole('region', { name: '执行诊断' })).toContainText('SyntaxError: invalid source')
      await expect(page.getByRole('region', { name: '执行诊断' })).toContainText('Compilation failed')
      expect(await page.evaluate(() => (window as unknown as { __diagXss?: number }).__diagXss)).toBeUndefined()
      await expect(page.getByRole('region', { name: '执行诊断' }).locator('img')).toHaveCount(0)
      await expect(page.locator('.cm-content').first()).toContainText('import json')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      await page.getByRole('region', { name: '执行诊断' }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath('compile-diagnostic-mobile.png'), animations: 'disabled' })
      await page.evaluate(() => {
        const nuxt = window as unknown as { useNuxtApp: () => { $pinia: { _s: Map<string, { $patch: (value: unknown) => void }> } } }
        nuxt.useNuxtApp().$pinia._s.get('auth')!.$patch({ user: { id: 2, username: 'second', role: 'user' } })
      })
      await expect(page.getByRole('region', { name: '执行诊断' })).toHaveCount(0)
    } else {
      const timeline = page.locator('.timeline-body')
      await expect(timeline).toContainText('COMMAND_ONE')
      await expect(timeline).toContainText('JUDGE_DEBUG')
      await expect(timeline).toContainText('BOT_DEBUG')
      await expect(timeline).toContainText('STDERR_LINE')
      if (shape === 'long') {
        await expect.poll(() => page.evaluate(() => (window as unknown as { __timelineTimerCount: () => number }).__timelineTimerCount())).toBeGreaterThan(0)
        await page.locator('.timeline-controls').getByRole('button', { name: /继续/ }).click()
        await page.locator('.timeline-controls').getByRole('button', { name: /继续/ }).click()
        expect(await page.evaluate(() => (window as unknown as { __timelineTimerCount: () => number }).__timelineTimerCount())).toBe(1)
        page.once('dialog', dialog => dialog.accept())
        await page.locator('.playground-page .n-breadcrumb-item').first().click()
        await expect(page).toHaveURL(/\/compete$/)
        await expect.poll(() => page.evaluate(() => (window as unknown as { __timelineTimerCount: () => number }).__timelineTimerCount())).toBe(0)
      }
      if (shape === 'direct') {
        const judgeToggle = page.getByRole('button', { name: '裁判日志', exact: true })
        await expect(judgeToggle).toHaveAttribute('aria-pressed', 'true')
        await judgeToggle.focus()
        await page.keyboard.press('Enter')
        await expect(judgeToggle).toHaveAttribute('aria-pressed', 'false')
        await expect(timeline).not.toContainText('COMMAND_ONE')
        await expect(timeline).toContainText('BOT_DEBUG')
        await page.keyboard.press('Space')
        await expect(judgeToggle).toHaveAttribute('aria-pressed', 'true')
        await expect(timeline).toContainText('COMMAND_ONE')
        const font = await timeline.locator('.event-data').first().evaluate(element => ({ size: getComputedStyle(element).fontSize, family: getComputedStyle(element).fontFamily }))
        expect(font.size).toBe('14px')
        expect(font.family).toContain('Menlo')
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
        await page.locator('.timeline-container').scrollIntoViewIfNeeded()
        await page.screenshot({ path: test.info().outputPath('timeline-mobile.png'), animations: 'disabled' })
      }
    }
  })
}
