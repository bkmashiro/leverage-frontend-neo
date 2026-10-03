import { test, expect } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

for (const tab of ['judge', 'combo'] as const) {
  test(`${tab} 编译失败无回合也有诊断，账号切换清理结果`, async ({ page }) => {
    await mockAuthApi(page)
    await page.addInitScript(token => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
    const game = { id: 41, title: '示例', disabled: false, gamerQuantity: 2 }
    await page.route('**/api/compete/games**', route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/playground-judge')) return route.fulfill({ json: { matchId: 71, testGamerIds: [91, 92] } })
      return route.fulfill({ json: path.endsWith('/41') ? game : { items: [game], total: 1 } })
    })
    await page.route('**/api/compete/gamers**', route => route.fulfill({ json: { items: [53, 54].map(id => ({ id, gameId: 41, title: `对手${id}`, type: 'code', disabled: false, isTest: false })), total: 2 } }))
    await page.route('**/api/compete/matches/71', route => route.fulfill({ json: { id: 71, gameId: 41, status: 3, result: JSON.stringify({ verdict: 'error', error: 'Compilation failed', compileMessages: { judge: 'SyntaxError: JUDGE_PRIVATE_DIAGNOSTIC', '0': 'BOT_COMPILATION_DIAGNOSTIC' }, rounds: [], finalResult: {} }) } }))
    await page.goto(`/compete/playground?tab=${tab}&gameId=41`)
    if (tab === 'judge') {
      const configuration = page.locator('.n-card').filter({ hasText: '游戏 & Bots' }).first()
      await configuration.locator('.n-base-selection').nth(1).click()
      await page.locator('.n-base-select-option:visible').filter({ hasText: '对手53 (ELO 1200)' }).last().click()
      // Naive keeps retiring option menus mounted; wait before opening another selector.
      await expect(page.locator('.n-base-select-menu:visible')).toHaveCount(0)
      await configuration.locator('.n-base-selection').nth(2).click()
      await page.locator('.n-base-select-option:visible').filter({ hasText: '对手54 (ELO 1200)' }).last().click()
      const template = page.getByRole('button', { name: /插入裁判模板/ })
      await template.click()
      const editor = page.locator('.n-tab-pane:visible .cm-content').first()
      const originalCode = await editor.innerText()
      const editorCard = page.locator('.n-card').filter({ hasText: '裁判代码' }).first()
      for (const language of ['JavaScript', 'C++17', 'TypeScript']) {
        await editorCard.locator('.n-base-selection').click()
        await page.locator('.n-base-select-option:visible').filter({ hasText: language }).last().click()
        await expect(page.locator('.n-base-select-menu:visible')).toHaveCount(0)
        await expect(template).toBeDisabled()
        await expect(page.getByText('裁判示例模板目前仅提供 Python；其他语言可在编辑器中手动编写。', { exact: true })).toBeVisible()
        expect(await editor.innerText()).toBe(originalCode)
      }
      await editorCard.locator('.n-base-selection').click()
      await page.locator('.n-base-select-option:visible').filter({ hasText: 'Python 3' }).last().click()
      await expect(page.locator('.n-base-select-menu:visible')).toHaveCount(0)
      await expect(template).toBeEnabled()
      await page.getByRole('button', { name: /测试裁判/ }).click()
    } else {
      const editors = page.locator('.n-tab-pane:visible .cm-content')
      await expect(editors).toHaveCount(3)
      for (let index = 0; index < 3; index++) await editors.nth(index).fill('import json\nprint("fixture")')
      await page.getByRole('button', { name: /运行组合调试/ }).click()
    }
    const diagnostics = page.getByRole('region', { name: '执行诊断' })
    await expect(diagnostics).toContainText('JUDGE_PRIVATE_DIAGNOSTIC')
    await expect(diagnostics).toContainText('BOT_COMPILATION_DIAGNOSTIC')
    await page.evaluate(() => {
      const nuxt = window as unknown as { useNuxtApp: () => { $pinia: { _s: Map<string, { $patch: (value: unknown) => void }> } } }
      nuxt.useNuxtApp().$pinia._s.get('auth')!.$patch({ user: { id: 2, username: 'second', role: 'user' } })
    })
    await expect(diagnostics).toHaveCount(0)
    await expect(page.getByText('JUDGE_PRIVATE_DIAGNOSTIC', { exact: false })).toHaveCount(0)
  })
}
