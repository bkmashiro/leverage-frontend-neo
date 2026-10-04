import type { Page } from '@playwright/test'

export const mockUser = {
  id: 1,
  username: 'testuser',
  role: 'sa' as const,
  email: 'test@example.com',
  accepts: 42,
  submits: 100,
  createdAt: '2026-01-01T00:00:00Z',
}

export const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
}

/**
 * Mock 认证相关 API：login / refresh / profile
 */
export async function mockAuthApi(page: Page) {
  page.on('pageerror', error => console.error('Browser error:', error.message))
  // Keep fixture tests away from any unrelated service on localhost:3000.
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/messages/count') return route.fulfill({ json: { count: 0 } })
    if (path === '/api/notifications') return route.fulfill({ json: { items: [], total: 0 } })
    return route.fulfill({ status: 404, json: { message: 'No fixture for this endpoint' } })
  })
  // Mock 登录
  await page.route('**/api/auth/login', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    if (body.username === 'testuser' && body.password === 'password') {
      await route.fulfill({ json: mockTokens })
    }
    else {
      await route.fulfill({ status: 401, json: {} })
    }
  })

  // Mock token 刷新（localStorage 有 refreshToken 时 init() 会调用）
  await page.route('**/api/auth/refresh', async (route) => {
    const body = JSON.parse(route.request().postData() || '{}')
    if (body.refreshToken === 'mock-refresh-token') {
      await route.fulfill({ json: { accessToken: 'mock-access-token' } })
    }
    else {
      await route.fulfill({ status: 401, json: {} })
    }
  })

  // Mock 获取用户信息
  await page.route('**/api/auth/profile', async (route) => {
    const auth = route.request().headers()['authorization']
    if (auth?.includes('mock-access-token')) {
      await route.fulfill({ json: mockUser })
    }
    else {
      await route.fulfill({ status: 401, json: {} })
    }
  })
}

/**
 * Mock 题目相关 API：list / detail
 */
export async function mockProblemsApi(page: Page) {
  // 先注册具体路径，避免被通配符覆盖
  await page.route('**/api/problems/1', async (route) => {
    await route.fulfill({
      json: {
        id: 1,
        logicId: 1001,
        prefix: 'A',
        title: '两数之和',
        accepts: 50,
        submits: 100,
        tags: [],
        hidden: false,
        timeLimit: 1000,
        memoryLimit: 64,
        description: '# 题目\n\n给定两个整数，求其和。',
      },
    })
  })

  // 题目列表（可能带 ?page=&perPage= 等查询参数）
  await page.route(/\/api\/problems(\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            id: 1,
            logicId: 1001,
            prefix: 'A',
            title: '两数之和',
            accepts: 50,
            submits: 100,
            tags: [],
            hidden: false,
            timeLimit: 1000,
            memoryLimit: 64,
            description: '# 题目\n\n给定两个整数，求其和。',
          },
          {
            id: 2,
            logicId: 1002,
            prefix: 'A',
            title: '斐波那契数列',
            accepts: 30,
            submits: 80,
            tags: [],
            hidden: false,
            timeLimit: 1000,
            memoryLimit: 64,
            description: '# 题目\n\n求第 n 个斐波那契数。',
          },
        ],
        total: 2,
      },
    })
  })
}

/**
 * 登录辅助：通过 UI 流程完成登录
 */
export async function loginViaUI(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  // NInput 会渲染为标准 input 元素
  const usernameInput = page.locator('input').first()
  const passwordInput = page.locator('input[type="password"]')
  await usernameInput.fill('testuser')
  await passwordInput.fill('password')
  await page.click('button:has-text("登录")')
  await page.waitForURL(/\/problems/, { timeout: 10_000 })
}

/**
 * 通过 localStorage 模拟已登录状态（需搭配 mockAuthApi 使用）
 * 注意：先 goto 任意页面让 localStorage 可访问，再设置
 */
export async function setLoggedInViaStorage(page: Page) {
  await page.evaluate((tokens) => {
    localStorage.setItem('refreshToken', tokens.refreshToken)
  }, mockTokens)
}

// ──────────────────────────────────────────────────────────────
// Messages mock data
// ──────────────────────────────────────────────────────────────

export const mockMessages = [
  {
    id: 1,
    senderId: 0,
    sender: null,
    receiverId: 1,
    receiver: null,
    sessionId: null,
    content: '欢迎使用 Leverage OJ，这是一条系统通知消息。',
    read: false,
    closed: null,
    deleted: null,
    messageUpdatedAt: '2026-01-01T10:00:00Z',
    createdAt: '2026-01-01T10:00:00Z',
    replies: [],
  },
  {
    id: 2,
    senderId: 1,
    sender: { id: 1, username: 'admin' },
    receiverId: 1,
    receiver: null,
    sessionId: null,
    content: '你好，感谢你的反馈，我们已经处理完毕。',
    read: true,
    closed: null,
    deleted: null,
    messageUpdatedAt: '2026-01-02T12:00:00Z',
    createdAt: '2026-01-02T12:00:00Z',
    replies: [],
  },
]

/**
 * Mock 消息相关 API：inbox / count
 */
export async function mockMessagesApi(page: Page) {
  await page.route('**/api/messages/count', async (route) => {
    await route.fulfill({ json: { count: 1 } })
  })

  await page.route(/\/api\/messages(\?.*)?$/, async (route) => {
    await route.fulfill({
      json: { items: mockMessages, total: mockMessages.length },
    })
  })

  await page.route(/\/api\/messages\/contact-admin/, async (route) => {
    await route.fulfill({ json: { id: 3 } })
  })

  await page.route(/\/api\/messages\/\d+$/, async (route) => {
    const url = route.request().url()
    const id = Number(url.split('/').pop())
    const msg = mockMessages.find(m => m.id === id)
    if (msg) {
      await route.fulfill({ json: msg })
    }
    else {
      await route.fulfill({ status: 404, json: {} })
    }
  })
}

// ──────────────────────────────────────────────────────────────
// Ranklist mock data
// ──────────────────────────────────────────────────────────────

export const mockRanklistUsers = [
  { id: 10, username: 'alice', accepts: 120, submits: 200, grade: '2024' },
  { id: 11, username: 'bob', accepts: 90, submits: 150, grade: '2023' },
  { id: 12, username: 'charlie', accepts: 60, submits: 100, grade: null },
]

/**
 * Mock privacy-safe ranking API: /api/users/ranking.
 */
export async function mockRanklistApi(page: Page) {
  await page.route('**/api/users/ranking*', async (route) => {
    await route.fulfill({ json: { items: mockRanklistUsers, total: mockRanklistUsers.length } })
  })
}

// ──────────────────────────────────────────────────────────────
// Admin user mock data
// ──────────────────────────────────────────────────────────────

export const mockAdminUsers = [
  {
    id: 1,
    username: 'testuser',
    role: 'sa',
    email: 'test@example.com',
    studentId: 'S001',
    accepts: 42,
    submits: 100,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    username: 'alice',
    role: 'user',
    email: 'alice@example.com',
    studentId: 'S002',
    accepts: 10,
    submits: 30,
    createdAt: '2026-01-02T00:00:00Z',
  },
]

/**
 * Mock 管理员用户 API：list / get / update
 */
export async function mockAdminUserApi(page: Page) {
  // 具体用户路径需先注册，避免被通配符覆盖
  await page.route(/\/api\/users\/\d+$/, async (route) => {
    const method = route.request().method()
    const url = route.request().url()
    const id = Number(url.split('/').pop())
    if (method === 'GET') {
      const user = mockAdminUsers.find(u => u.id === id) ?? mockAdminUsers[0]
      await route.fulfill({ json: user })
    }
    else if (method === 'PATCH') {
      const body = JSON.parse(route.request().postData() || '{}')
      const user = mockAdminUsers.find(u => u.id === id) ?? mockAdminUsers[0]
      await route.fulfill({ json: { ...user, ...body } })
    }
    else {
      await route.fulfill({ json: {} })
    }
  })

  await page.route(/\/api\/users(\?.*)?$/, async (route) => {
    await route.fulfill({
      json: { items: mockAdminUsers, total: mockAdminUsers.length },
    })
  })

  // submissions under user
  await page.route(/\/api\/users\/\d+\/submissions(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { items: [], total: 0 } })
  })
}
