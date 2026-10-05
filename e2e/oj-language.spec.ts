import { test, expect, type Page } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

async function authenticated(page: Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
}

const contest = { id: 7, name: '测试竞赛', type: 'icpc', startTime: '2025-01-01T00:00:00Z', endTime: '2030-01-01T00:00:00Z', problems: [{ problemId: 1 }], enabledLanguageJSON: '["cpp20","python3"]' }

test('普通题目用 canonical 字符串提交 C++20，编辑器切换到 C++', async ({ page }) => {
  await authenticated(page)
  await page.route('**/api/submissions', route => route.fulfill({ json: { id: 31, status: 9 } }))
  await page.goto('/problems/1')
  await expect(page.locator('.cm-editor')).toBeVisible()
  await page.locator('.n-select').first().click()
  await page.getByText('C++20', { exact: true }).last().click()
  await page.locator('.cm-content').first().fill('int main() {}')
  const request = page.waitForRequest(req => req.url().endsWith('/api/submissions') && req.method() === 'POST')
  await page.getByRole('button', { name: '提交代码' }).click()
  expect(JSON.parse((await request).postData() || '{}')).toMatchObject({ problemId: 1, language: 'cpp20', code: 'int main() {}' })
})

for (const context of ['problem', 'contest', 'course'] as const) {
  for (const language of [
    { label: 'C (WASM)', value: 'c-wasm' },
    { label: 'C++17 (WASM)', value: 'cpp17-wasm' },
  ]) {
    test(`${context} 提交 WASM 语言时发送独立 ID ${language.value}`, async ({ page }) => {
      await authenticated(page)
      const pageUrl = context === 'problem' ? '/problems/1' : context === 'contest' ? '/contests/7/problems/1' : '/course/7/problems/1'
      if (context !== 'problem') {
        await page.route(`**/api/${context === 'contest' ? 'contests' : 'courses'}/7`, route => route.fulfill({ json: contest }))
      }
      await page.route('**/api/submissions', route => route.fulfill({ json: { id: 33, status: 9 } }))
      await page.goto(pageUrl)
      await expect(page.locator('.cm-editor')).toBeVisible()
      await page.locator('.n-select').first().click()
      await page.getByText(language.label, { exact: true }).last().click()
      await expect(page.getByRole('link', { name: '查看 WASM 语言说明' })).toHaveAttribute('href', '/help/wasm')
      await page.locator('.cm-content').first().fill('int main() { return 0; }')
      const request = page.waitForRequest(req => req.url().endsWith('/api/submissions') && req.method() === 'POST')
      await page.getByRole('button', { name: '提交代码' }).click()
      expect(JSON.parse((await request).postData() || '{}')).toMatchObject({
        problemId: 1,
        language: language.value,
        ...(context === 'contest' ? { contestId: 7 } : {}),
        ...(context === 'course' ? { courseId: 7 } : {}),
      })
    })
  }
}

test('普通题目 WASM 试运行请求携带 c-wasm，切回原生后不显示帮助图标', async ({ page }) => {
  await authenticated(page)
  await page.route('**/api/runs', route => route.fulfill({ json: { id: 'run-1', status: 'completed', result: { status: 'AC', stdout: '', stderr: '', timeMs: 1, memoryBytes: 0 } } }))
  await page.route('**/api/runs/run-1', route => route.fulfill({ json: { id: 'run-1', status: 'completed', result: { status: 'AC', stdout: '', stderr: '', timeMs: 1, memoryBytes: 0 } } }))
  await page.goto('/problems/1')
  await page.locator('.n-select').first().click()
  await page.getByText('C (WASM)', { exact: true }).last().click()
  await page.locator('.cm-content').first().fill('int main() { return 0; }')
  const request = page.waitForRequest(req => req.url().endsWith('/api/runs') && req.method() === 'POST')
  await page.getByRole('button', { name: '运行', exact: true }).click()
  expect(JSON.parse((await request).postData() || '{}')).toMatchObject({ language: 'c-wasm' })
  await page.locator('.n-select').first().click()
  await page.getByText('C++17', { exact: true }).last().click()
  await expect(page.getByRole('link', { name: '查看 WASM 语言说明' })).toHaveCount(0)
})

test('帮助文章匿名可直达、刷新并通过桌面与窄屏目录导航', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  for (const [path, title] of [['/help', '帮助与系统说明'], ['/help/wasm', 'C/C++ WASM 评测'], ['/help/botzone', 'Botzone 对战'], ['/help/mcp', 'MCP 连接']]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await expect(page.getByRole('navigation', { name: '帮助目录' }).getByRole('link')).toHaveCount(4)
    await page.reload()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  }
  await page.goto('/login')
  await expect(page.getByRole('link', { name: '帮助与系统说明' })).toHaveAttribute('href', '/help')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/help/wasm')
  await expect(page.getByRole('link', { name: 'Botzone', exact: true })).toBeVisible()
  await expect.poll(() => page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: process.env.WASM_HELP_MOBILE_SCREENSHOT ?? test.info().outputPath('help-wasm-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: process.env.WASM_HELP_DESKTOP_SCREENSHOT ?? test.info().outputPath('help-wasm-desktop.png'), fullPage: true })
})

for (const context of ['contest', 'course'] as const) {
  test(`${context} 提交使用字符串语言 ID`, async ({ page }) => {
    await authenticated(page)
    await page.route(`**/api/${context === 'contest' ? 'contests' : 'courses'}/7`, route => route.fulfill({ json: contest }))
    await page.route('**/api/submissions', route => route.fulfill({ json: { id: 32, status: 0 } }))
    await page.goto(`/${context === 'contest' ? 'contests' : 'course'}/7/problems/1`)
    await expect(page.locator('.cm-editor')).toBeVisible()
    await page.locator('.cm-content').fill('print(1)')
    await page.locator('.n-select').first().click()
    await page.getByText('Python 3', { exact: true }).last().click()
    const request = page.waitForRequest(req => req.url().endsWith('/api/submissions') && req.method() === 'POST')
    await page.getByRole('button', { name: '提交代码' }).click()
    expect(JSON.parse((await request).postData() || '{}')).toMatchObject({ problemId: 1, language: 'python3', [`${context}Id`]: 7 })
  })
}

test('历史提交显示 canonical 和只读 legacy，代码模式按字符串选择', async ({ page }) => {
  await authenticated(page)
  const rows = ['cpp20', 'legacy-java', 'legacy-id-42'].map((language, index) => ({ id: index + 1, problemId: 1, userId: 1, status: 0, language, createdAt: '2026-01-01T00:00:00Z' }))
  await page.route(/\/api\/submissions(\?.*)?$/, route => route.fulfill({ json: { items: rows, total: rows.length } }))
  await page.route('**/api/submissions/2', route => route.fulfill({ json: { ...rows[1], misc: { code: 'class Main {}' } } }))
  await page.goto('/submissions')
  await expect(page.getByText('C++20')).toBeVisible()
  await expect(page.getByText('Java（历史记录）')).toBeVisible()
  await expect(page.getByText('legacy-id-42')).toBeVisible()
  await page.goto('/submissions/2')
  await expect(page.getByText('Java（历史记录）')).toBeVisible()
})

for (const context of ['contests', 'courses'] as const) {
  test(`管理员 ${context} 配置回读及写入字符串语言数组`, async ({ page }) => {
    await authenticated(page)
    const endpoint = `/api/${context}/7`
    await page.route(`**${endpoint}`, route => route.fulfill({ json: { ...contest, enabledLanguageJSON: '["cpp20","python3","legacy-java"]' } }))
    await page.goto(`/admin/${context}/7`)
    await page.getByRole('button', { name: context === 'contests' ? '编辑竞赛' : '编辑课程' }).click()
    const modal = page.locator('.n-modal')
    await expect(modal.getByText('C++20', { exact: true })).toBeVisible()
    await expect(modal.getByText('Python 3', { exact: true })).toBeVisible()
    await expect(modal.getByText('legacy-java', { exact: true })).toHaveCount(0)
    const request = page.waitForRequest(req => req.url().endsWith(endpoint) && ['PATCH', 'PUT'].includes(req.method()))
    await modal.getByRole('button', { name: '保存' }).click()
    expect(JSON.parse(JSON.parse((await request).postData() || '{}').enabledLanguageJSON)).toEqual(['cpp20', 'python3'])
  })
}

test('后台旧语言历史记录可见但不能重判', async ({ page }) => {
  await authenticated(page)
  await page.route(/\/api\/submissions(\?.*)?$/, route => route.fulfill({ json: { items: [{ id: 2, language: 'legacy-java', status: 0, userId: 1, problemId: 1, createdAt: '2026-01-01T00:00:00Z' }], total: 1 } }))
  await page.goto('/admin/submissions')
  const row = page.getByRole('row').filter({ hasText: 'Java（历史记录）' })
  await expect(row).toBeVisible()
  await expect(row.getByRole('button', { name: '重判' })).toBeDisabled()
})

test('查重详情展示 legacy 标签，未知 ID 不伪装为 C++', async ({ page }) => {
  await authenticated(page)
  await page.route('**/api/suspicion/hash/demo', route => route.fulfill({ json: { items: [
    { id: 1, status: 0, language: 'legacy-python2', code: 'print 1' },
    { id: 2, status: 0, language: 'legacy-id-42', code: 'unknown' },
  ] } }))
  await page.goto('/admin/submissions/sus/demo')
  await expect(page.getByText('Python 2（历史记录）')).toBeVisible()
  await expect(page.getByText('legacy-id-42')).toBeVisible()
  await expect(page.locator('.cm-editor')).toHaveCount(2)
})

test('WikiTryIt 发起 Botzone 字符串运行请求，菜单没有 OJ/Java 值', async ({ page }) => {
  await authenticated(page)
  await page.route(/\/api\/compete\/games(\?.*)?$/, route => route.fulfill({ json: { items: [{ id: 7, title: '猜数字' }], total: 1 } }))
  await page.route(/\/api\/compete\/gamers(\?.*)?$/, route => route.fulfill({ json: { items: [{ id: 9, gameId: 7, type: 'code', disabled: false }], total: 1 } }))
  await page.route('**/api/compete/games/7/playground', route => route.fulfill({ json: { matchId: 91 } }))
  await page.route('**/api/compete/matches/91', route => route.fulfill({ json: { status: 2, result: { finalResult: { '0': 1, '1': 0 } } } }))
  await page.goto('/compete/playground?tab=wiki')
  await page.getByText('下一步 →').last().click()
  await page.getByText('动手试试').first().click()
  await expect(page.getByRole('button', { name: '运行（测试对局）' }).first()).toBeVisible()
  await page.locator('.tryit-editor .n-select').first().click()
  await expect(page.getByText('C++17', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Java', { exact: true })).toHaveCount(0)
  await page.getByText('TypeScript', { exact: true }).last().click()
  const request = page.waitForRequest(req => req.url().endsWith('/api/compete/games/7/playground') && req.method() === 'POST')
  await page.getByRole('button', { name: '运行（测试对局）' }).first().click()
  expect(JSON.parse((await request).postData() || '{}')).toMatchObject({ language: 'typescript', opponentGamerId: 9 })
  await expect(page.getByText('对局完成')).toBeVisible({ timeout: 10_000 })
})
