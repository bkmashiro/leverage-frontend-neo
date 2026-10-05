import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

for (const width of [390, 1440]) {
  test(`设计基础在 ${width}px 登录后页面与 body 弹层一致`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await mockAuthApi(page)
    await mockProblemsApi(page)
    await page.goto('/')
    await setLoggedInViaStorage(page)
    await page.goto('/problems/1')
    await expect(page.locator('.cm-content')).toBeVisible()
    await page.locator('.cm-content').fill('int main() { return 0; }')
    await expect(page.getByRole('button', { name: '运行', exact: true })).toBeEnabled()
    const actual = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      const code = getComputedStyle(document.querySelector('.cm-content')!)
      const prose = getComputedStyle(document.querySelector('.markdown-body')!)
      // Run is the primary action; formal submission deliberately uses its secondary variant.
      const primary = Array.from(document.querySelectorAll('button')).find(element => element.textContent?.trim() === '运行')!
      return { accent: style.getPropertyValue('--lv-color-accent').trim(),
        uiFont: getComputedStyle(document.body).fontFamily, bodySize: getComputedStyle(document.body).fontSize,
        codeFont: code.fontFamily, codeSize: code.fontSize, proseSize: prose.fontSize,
        buttonColor: getComputedStyle(primary).backgroundColor, scheme: style.colorScheme,
        documentWidth: document.documentElement.scrollWidth }
    })
    expect(actual.accent).toBe('#426b96')
    expect(actual.bodySize).toBe('15px')
    expect(actual.proseSize).toBe('16px')
    expect(actual.codeSize).toBe('14px')
    expect(actual.codeFont).toContain('Menlo')
    expect(actual.buttonColor).toBe('rgb(66, 107, 150)')
    expect(actual.scheme).toBe('light')
    expect(actual.documentWidth).toBeLessThanOrEqual(width)
    await page.getByRole('button', { name: '全屏编辑代码' }).click()
    await expect(page.getByRole('dialog', { name: '全屏代码编辑器' })).toBeVisible()
    const fullscreen = await page.locator('.fullscreen-editor').evaluate(element => ({
      color: getComputedStyle(element).backgroundColor,
      codeFont: getComputedStyle(element.querySelector('.cm-content')!).fontFamily,
    }))
    expect(fullscreen.color).toBe('rgb(255, 255, 255)')
    expect(fullscreen.codeFont).toContain('Menlo')
    await page.getByRole('button', { name: '退出全屏编辑' }).click()
    if (width < 768) await page.getByRole('button', { name: '打开导航菜单' }).click()
    await page.getByRole('menu').getByText('Bot 学习中心', { exact: true }).click()
    await expect(page).toHaveURL(/\/compete\/learn/)
    expect(errors).toEqual([])
  })
}
