import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockTokens } from './mocks/api'

async function setup(page: Page, role: string) {
  await mockAuthApi(page)
  await page.addInitScript(token => { if (window === window.top) localStorage.setItem('refreshToken', token) }, mockTokens.refreshToken)
  await page.route('**/api/auth/profile', route => route.fulfill({ json: { id: 1, username: 'author', role, email: 'fixture@example.test' } }))
  const created: Record<string, unknown>[] = []
  await page.route('**/api/compete/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/compete/games' && route.request().method() === 'POST') {
      created.push(route.request().postDataJSON())
      return route.fulfill({ json: { id: 41, ...created.at(-1) } })
    }
    if (path === '/api/compete/games/41') return route.fulfill({ json: { id: 41, title: '测试游戏', gamerQuantity: 2, disabled: true } })
    if (path.endsWith('/leaderboard')) return route.fulfill({ json: [] })
    return route.fulfill({ json: { items: [], total: 0 } })
  })
  return created
}

for (const role of ['supervisor', 'admin', 'sa']) {
  test(`${role} 创建入口使用独立作者页面与既有 API`, async ({ page }) => {
    const created = await setup(page, role)
    if (role === 'supervisor') await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/compete')
    await page.getByRole('button', { name: '创建游戏', exact: true }).click()
    await expect(page).toHaveURL(/\/compete\/games\/new$/)
    await expect(page.locator('.admin-shell')).toHaveCount(0)
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('输入游戏名称').fill('测试游戏')
    await page.getByText('⚖️ 裁判程序', { exact: true }).click()
    await dialog.locator('.cm-content').pressSequentially('print("fixture judge")')
    if (role === 'supervisor') {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      const bounds = await dialog.boundingBox()
      expect(bounds!.width).toBeLessThanOrEqual(390)
      await page.screenshot({ path: test.info().outputPath('supervisor-create-mobile.png'), animations: 'disabled' })
    }
    await dialog.getByRole('button', { name: '创建', exact: true }).click()
    await expect(page).toHaveURL(/\/compete\/games\/41$/)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ title: '测试游戏', gamerQuantity: 2, memoryLimit: 256, disabled: true, autoMatchEnabled: false, judgerLanguage: 'python', judgerCode: 'print("fixture judge")' })
    await page.goto('/admin')
    if (role === 'supervisor') await expect(page).not.toHaveURL(/\/admin$/)
    else await expect(page).toHaveURL(/\/admin$/)
  })
}

test('普通用户不能显示或进入创建页，也不会发送创建请求', async ({ page }) => {
  const created = await setup(page, 'user')
  await page.goto('/compete')
  await expect(page.getByRole('button', { name: '创建游戏', exact: true })).toHaveCount(0)
  await page.goto('/compete/games/new')
  await expect(page).toHaveURL(/\/compete$/)
  expect(created).toEqual([])
})

test('原后台新建深链仍使用原管理权限与提交动作', async ({ page }) => {
  const created = await setup(page, 'admin')
  await page.goto('/admin/compete/game/new')
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('输入游戏名称').fill('旧链接创建')
  await page.getByText('⚖️ 裁判程序', { exact: true }).click()
  await dialog.locator('.cm-content').pressSequentially('print("judge")')
  await dialog.getByRole('button', { name: '创建', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/compete\/game\/41$/)
  expect(created).toHaveLength(1)
})
