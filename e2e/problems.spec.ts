import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, loginViaUI, setLoggedInViaStorage } from './mocks/api'

test.describe('题目列表', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page)
    await mockProblemsApi(page)
    // 先 goto 首页让 localStorage 可用，再通过 UI 登录
    await loginViaUI(page)
    // 登录后重新注册 mock（页面可能重新加载）
    await mockProblemsApi(page)
  })

  test('应显示题目列表', async ({ page }) => {
    await page.goto('/problems')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('两数之和')).toBeVisible({ timeout: 8_000 })
    await expect(page.getByText('斐波那契数列')).toBeVisible({ timeout: 8_000 })
  })

  test('点击题目标题应跳转到详情页', async ({ page }) => {
    await page.goto('/problems')
    await page.waitForLoadState('networkidle')
    const problemLink = page.getByRole('link', { name: '两数之和', exact: true })
    await expect(problemLink).toHaveAttribute('href', '/problems/1')
    await problemLink.click()
    await expect(page).toHaveURL(/\/problems\/1/, { timeout: 10_000 })
  })
})

test.describe('题目详情', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page)
    await mockProblemsApi(page)

    // 先访问一个有效页面让 localStorage 可用
    await page.goto('/')
    // 设置 refreshToken，app init() 会用它换取 accessToken
    await setLoggedInViaStorage(page)
  })

  test('应渲染题目描述', async ({ page }) => {
    await page.goto('/problems/1')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('两数之和')).toBeVisible({ timeout: 8_000 })
    // MarkdownView 渲染出 "题目" 标题（markdown h1）
    await expect(page.getByRole('heading', { name: '题目' })).toBeVisible({ timeout: 8_000 })
  })

  test('应显示代码编辑器和提交按钮', async ({ page }) => {
    await page.goto('/problems/1')
    await page.waitForLoadState('networkidle')
    // CodeMirror 编辑器
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 8_000 })
    // 提交按钮
    await expect(page.getByRole('button', { name: /提交/ })).toBeVisible({ timeout: 8_000 })
  })
})
