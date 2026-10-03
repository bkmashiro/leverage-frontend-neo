import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

const game = { id: 41, title: '猜数字', name: '猜数字', disabled: false, gamerQuantity: 2, timeLimit: 2000, memoryLimit: 128 }

async function setup(page: Page, loggedIn = false) {
  await mockAuthApi(page)
  await page.route('**/api/compete/games**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/compete/games/41') return route.fulfill({ json: game })
    await route.fulfill({ json: { items: [game], total: 1 } })
  })
  await page.route('**/api/compete/gamers**', route => route.fulfill({ json: {
    items: [{ id: 53, gameId: 41, title: '对手', type: 'code', disabled: false, isTest: false }], total: 1,
  } }))
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { accessToken: mockTokens.accessToken } }))
  await page.route('**/api/auth/profile', route => route.fulfill({ json: {
    id: 1, username: 'testuser', role: 'sa', email: 'test@example.com',
  } }))
  if (loggedIn) await page.addInitScript((token) => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
}

async function capture(page: Page, name: string) {
  const directory = process.env.UI_VISUAL_ARTIFACT_DIR
  if (!directory) return
  const { mkdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: join(directory, name), fullPage: true })
}

test('公开章节深链可阅读、前进后退同步 URL，坏参数规范化', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await setup(page)
  await page.goto('/compete/learn?track=judge&step=4&gameId=41')
  await page.waitForTimeout(1500) // Let the Nuxt client hydrate before exercising navigation.
  await expect(page.getByRole('heading', { name: /第四步：在 Playground 测试并发布游戏/ })).toBeVisible()
  await expect(page).toHaveURL(/track=judge.*step=4.*gameId=41/)
  await page.getByRole('button', { name: '← 上一步' }).click()
  await expect(page).toHaveURL(/step=3/)
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/step=4/)

  await page.goto('/compete/learn?track=unknown&step=999&gameId=wat')
  await expect(page).toHaveURL(/track=bot.*step=1/)
  await expect(page.getByRole('heading', { name: /Bot 是如何工作的/ })).toBeVisible()
  await capture(page, 'learn-desktop.png')
  await page.getByRole('button', { name: /自定义游戏渲染器/ }).click()
  await expect(page).toHaveURL(/track=renderer.*step=1/)
  await expect(page.getByRole('heading', { name: /渲染器是什么/ })).toBeVisible()
  await page.getByRole('link', { name: /写最小渲染器/ }).click()
  await expect(page).toHaveURL(/track=renderer.*step=2/)
  await expect(page.getByRole('heading', { name: /第二步：写最小渲染器/ })).toBeVisible()
})

test('手机章节目录可展开、深链切换且不横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto('/compete/learn?track=bot&step=1&gameId=41')
  await expect(page.getByRole('heading', { name: /Bot 是如何工作的/ })).toBeVisible()
  await capture(page, 'learn-mobile.png')
  const directory = page.locator('.chapter-directory')
  await expect(directory).not.toHaveAttribute('open')
  await directory.locator('summary').click()
  await page.getByRole('link', { name: /理解 BotInput/ }).click()
  await expect(page).toHaveURL(/track=bot.*step=4.*gameId=41/)
  await expect(page.getByRole('heading', { name: /第四步：理解 BotInput/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('教程代码复制反馈成功或失败，代码使用统一等宽字体', async ({ page }) => {
  await setup(page)
  await page.addInitScript(() => {
    if (window !== window.top) return
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (text: string) => { (window as unknown as { __lastCopied: string }).__lastCopied = text },
    } })
  })
  await page.goto('/compete/learn?track=bot&step=2&gameId=41')
  const block = page.locator('.wiki-code-block').first()
  await expect(block).toBeVisible()
  const font = await block.locator('.n-code').evaluate(element => ({
    size: getComputedStyle(element).fontSize, family: getComputedStyle(element).fontFamily,
  }))
  expect(font.size).toBe('14px')
  expect(font.family).toContain('Menlo')
  await block.getByRole('button', { name: '复制', exact: true }).click()
  await expect(block.getByRole('button', { name: '已复制', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { __lastCopied: string }).__lastCopied.length)).toBeGreaterThan(0)
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('fixture clipboard denied') } })
  await block.getByRole('button', { name: '已复制', exact: true }).click()
  await expect(block.getByRole('alert')).toContainText('无法复制')
  await expect(block.getByRole('button', { name: '复制', exact: true })).toBeVisible()
})

test('不可用游戏不会暂存并转交教程草稿', async ({ page }) => {
  await setup(page, true)
  await page.goto('/compete/learn?track=bot&step=2&gameId=999')
  await page.getByRole('button', { name: /在 Playground 测试/ }).first().click()
  await expect(page.getByText('所选游戏暂不可用，请选择一个可用游戏后再打开工作台。', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/compete\/learn/)
})

test('游戏列表为空或失败时仍可阅读章节并显示明确状态', async ({ page }) => {
  await setup(page)
  await page.route('**/api/compete/games**', route => route.fulfill({ json: { items: [], total: 0 } }))
  await page.goto('/compete/learn?track=bot&step=1')
  await expect(page.getByText(/暂时没有可用游戏/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Bot 是如何工作的/ })).toBeVisible()

  await page.route('**/api/compete/games**', route => route.fulfill({ status: 503, json: { message: 'offline' } }))
  await page.reload()
  await expect(page.locator('.learn-page .state.error')).toContainText('游戏列表加载失败')
  await expect(page.getByRole('heading', { name: /Bot 是如何工作的/ })).toBeVisible()
})

test('未登录试用只提示登录，不缓存教程代码', async ({ page }) => {
  await setup(page)
  await page.goto('/compete/learn?track=bot&step=2&gameId=41')
  await page.getByRole('button', { name: /在 Playground 测试/ }).first().click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('tutorial')))).toEqual([])
})

test('登录 handoff 使用当前账号/游戏并尊重拒绝覆盖的草稿', async ({ page }) => {
  await setup(page, true)
  await page.addInitScript(() => { if (window === window.top) localStorage.setItem('leverage:code-draft:1:new:41', JSON.stringify({
    code: 'MY UNSAVED BOT', language: 'python', title: '本地草稿',
  })) })
  page.on('dialog', dialog => dialog.dismiss())
  await page.goto('/compete/learn?track=bot&step=2')
  await page.getByRole('button', { name: /在 Playground 测试/ }).first().click()
  await expect(page).toHaveURL(/\/compete\/playground\?.*gameId=41/)
  await expect(page.locator('.cm-content')).toContainText('MY UNSAVED BOT')
  await expect(page.locator('.cm-content')).not.toContainText('random.randint')
})

test('切换账号会丢弃未消费的教程交接', async ({ page }) => {
  await setup(page, true)
  await page.goto('/compete/learn?track=bot&step=2&gameId=41')
  await expect(page.getByText('练习游戏（可选）')).toBeVisible()
  await page.route('**/api/compete/games**', async route => {
    await new Promise(resolve => setTimeout(resolve, 900))
    const path = new URL(route.request().url()).pathname
    if (path === '/api/compete/games/41') return route.fulfill({ json: game })
    await route.fulfill({ json: { items: [game], total: 1 } })
  })
  await page.getByRole('button', { name: /在 Playground 测试/ }).first().click()
  await expect(page).toHaveURL(/\/compete\/playground/)
  await page.evaluate(() => {
    const nuxt = window as any
    const auth = nuxt.useNuxtApp().$pinia._s.get('auth')
    auth.$patch({ user: { id: 2, username: 'second', role: 'user' } })
  })
  await expect(page.locator('.cm-content')).not.toContainText('random.randint')
  await expect.poll(() => page.evaluate(() => (window as any).__NUXT__.state?.['tutorial-draft-handoff'] ?? null)).toBeNull()
})

test('renderer 草稿切换和教程 HTML 都要经覆盖确认', async ({ page }) => {
  await setup(page, true)
  await page.addInitScript(() => { if (window === window.top) localStorage.setItem('leverage:code-draft:1:renderer:scratch', JSON.stringify({
    code: '<!doctype html><title>KEEP RENDERER DRAFT</title>', language: 'html', title: '',
  })) })
  page.on('dialog', dialog => dialog.dismiss())
  await page.goto('/compete/learn?track=renderer&step=2&gameId=41')
  await page.getByRole('button', { name: /在 Playground 测试/ }).first().click()
  await expect(page).toHaveURL(/\/compete\/playground\?tab=renderer/)
  await expect(page.locator('.cm-content')).toContainText('KEEP RENDERER DRAFT')
  await expect(page.locator('.cm-content')).not.toContainText('<!DOCTYPE html>')
})

test('旧 playground Wiki tab 深链仍显示原教程内容', async ({ page }) => {
  await setup(page, true)
  await page.goto('/compete/playground?tab=wiki')
  await expect(page.locator('.wiki-content')).toBeVisible()
  await expect(page.getByText('我的第一个 Bot')).toBeVisible()
})
