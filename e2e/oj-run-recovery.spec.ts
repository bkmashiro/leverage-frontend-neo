import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'

async function prepare(page: import('@playwright/test').Page) {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill('print(42)')
}

test.describe('OJ run refresh and recovery', () => {
  test('one click creates once; reload resumes the same id using GET and wait, without resubmitting code', async ({ page }) => {
    await prepare(page)
    let creates = 0
    let terminal = false
    const gets: string[] = []
    let waits = 0
    await page.route('**/api/runs', async route => {
      if (route.request().method() === 'POST') {
        creates++
        await route.fulfill({ json: { id: 'resume-1', status: 'running', createdAt: 1, expiresAt: 9999999999999 } })
      }
      else await route.fulfill({ json: {} })
    })
    await page.route('**/api/runs/resume-1', async route => {
      if (route.request().method() === 'GET') {
        gets.push(route.request().method())
        await route.fulfill({ json: { id: 'resume-1', status: 'running', createdAt: 1, expiresAt: 9999999999999 } })
      }
      else await route.fallback()
    })
    await page.route('**/api/runs/resume-1/wait', async route => {
      waits++
      if (!terminal) {
        await new Promise(resolve => setTimeout(resolve, 120))
        await route.fulfill({ json: { id: 'resume-1', status: 'running', createdAt: 1, expiresAt: 9 } })
      }
      else await route.fulfill({ json: { id: 'resume-1', status: 'completed', createdAt: 1, expiresAt: 2, result: { status: 'OK', stdout: '42\\n', stderr: '', exitCode: 0, outputTruncated: false } } })
    })
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText('运行中', { exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('oj-run:')).length)).toBe(1)
    await page.reload()
    terminal = true
    await expect(page.getByText(/42/)).toBeVisible({ timeout: 10000 })
    expect(creates).toBe(1)
    expect(gets.length).toBeGreaterThan(0)
    expect(waits).toBeGreaterThan(0)
    const stored = await page.evaluate(() => Object.entries(sessionStorage).filter(([k]) => k.startsWith('oj-run:')).map(([, value]) => value))
    expect(stored).toEqual(['resume-1'])
    expect(JSON.stringify(stored)).not.toContain('print(42)')
  })

  test('offline pauses wait; online recovers with same run id and terminal status stops waiting', async ({ page }, testInfo) => {
    await prepare(page)
    let creates = 0
    let waits = 0
    let terminal = false
    await page.route('**/api/runs', async route => {
      creates++
      await route.fulfill({ json: { id: 'online-1', status: 'running', createdAt: 1, expiresAt: 9 } })
    })
    await page.route('**/api/runs/online-1/wait', async route => {
      waits++
      if (!terminal) await route.abort('failed')
      else await route.fulfill({ json: { id: 'online-1', status: 'completed', createdAt: 1, expiresAt: 2, result: { status: 'OK', stdout: 'done', stderr: '', exitCode: 0, outputTruncated: false } } })
    })
    await page.getByRole('button', { name: '运行' }).click()
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect(page.getByText(/网络不可用/)).toBeVisible({ timeout: 5000 })
    const callsWhileOffline = waits
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    terminal = true
    await expect(page.getByText('done', { exact: true })).toBeVisible({ timeout: 10000 })
    expect(creates).toBe(1)
    expect(waits).toBeGreaterThan(callsWhileOffline)
    const terminalWaits = waits
    await page.waitForTimeout(700)
    expect(waits).toBe(terminalWaits)
    await expect(page.getByText(/正在自动重连|网络已恢复/)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('offline-recovered.png'), fullPage: true })
  })

  test('403 from wait stops polling and clears the recovery id', async ({ page }) => {
    await prepare(page)
    let creates = 0
    let waits = 0
    await page.route('**/api/runs', async route => {
      creates++
      await route.fulfill({ json: { id: `run-${creates}`, status: 'running', createdAt: 1, expiresAt: 9 } })
    })
    await page.route(/\/api\/runs\/run-\d+\/wait$/, async route => { waits++; await route.fulfill({ status: 403, json: {} }) })
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText(/登录状态已失效或无权访问/)).toBeVisible({ timeout: 8000 })
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('oj-run:')).length)).toBe(0)
    const stoppedAt = waits
    await page.waitForTimeout(700)
    expect(stoppedAt).toBeGreaterThan(0)
    expect(waits).toBe(stoppedAt)
  })

  test('404 while refreshing an expired run clears its id and explains expiry', async ({ page }) => {
    await prepare(page)
    let creates = 0
    await page.route('**/api/runs', async route => {
      creates++
      await route.fulfill({ json: { id: 'expired-run', status: 'running', createdAt: 1, expiresAt: 9 } })
    })
    await page.route('**/api/runs/expired-run/wait', async route => route.abort('failed'))
    let reads = 0
    await page.route('**/api/runs/expired-run', async route => {
      if (route.request().url().endsWith('/wait')) return route.fallback()
      reads++
      await route.fulfill({ status: 404, json: { message: 'expired' } })
    })
    const runButton = page.getByRole('button', { name: '运行' })
    await runButton.dblclick()
    await expect(page.getByText('运行中', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /运行/ }).first()).toBeDisabled()
    await expect.poll(() => creates).toBe(1)
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('oj-run:1:%2Fproblems%2F1'))).toBe('expired-run')
    await page.reload()
    await expect.poll(() => reads).toBe(1)
    await expect(page.getByText('运行记录已过期或不可访问。')).toBeVisible({ timeout: 8000 })
    expect(creates).toBe(1)
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('oj-run:')).length)).toBe(0)
  })

  test('a terminal run restored by GET renders its result without starting a wait request', async ({ page }) => {
    await prepare(page)
    let waits = 0
    await page.evaluate(() => sessionStorage.setItem('oj-run:1:%2Fproblems%2F1', 'terminal-1'))
    await page.route('**/api/runs/terminal-1/wait', async route => {
      waits++
      await route.fulfill({ json: { id: 'terminal-1', status: 'running', createdAt: 1, expiresAt: 9 } })
    })
    await page.route('**/api/runs/terminal-1', async route => route.fulfill({ json: {
      id: 'terminal-1', status: 'completed', createdAt: 1, expiresAt: 2,
      result: { status: 'OK', stdout: 'already done', stderr: '', exitCode: 0, outputTruncated: false },
    } }))
    await page.reload()
    await expect(page.getByText('already done', { exact: true })).toBeVisible({ timeout: 8000 })
    expect(waits).toBe(0)
    await page.reload()
    await expect(page.getByText('already done', { exact: true })).toBeVisible()
    expect(waits).toBe(0)
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('oj-run:')).length)).toBe(1)
  })

  test('starting a new run keeps the prior output visible but explicitly marks it as previous', async ({ page }) => {
    await prepare(page)
    let creates = 0
    await page.route('**/api/runs', async route => {
      creates++
      if (creates === 1) {
        await route.fulfill({ json: { id: 'prior-1', status: 'completed', createdAt: 1, expiresAt: 2, result: { status: 'OK', stdout: 'prior output', stderr: '', exitCode: 0, outputTruncated: false } } })
      }
      else await route.fulfill({ json: { id: 'next-1', status: 'running', createdAt: 1, expiresAt: 9 } })
    })
    await page.route('**/api/runs/next-1/wait', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({ json: { id: 'next-1', status: 'running', createdAt: 1, expiresAt: 9 } })
    })
    await page.getByRole('button', { name: '运行' }).click()
    await expect(page.getByText('prior output', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /运行/ }).first().click()
    await expect(page.getByText('上次运行结果', { exact: true })).toBeVisible()
    await expect(page.getByText('prior output', { exact: true })).toBeVisible()
    await expect(page.getByText('运行中', { exact: true })).toBeVisible()
    expect(creates).toBe(2)
  })

  test('restore retries a failed GET without inventing a running state', async ({ page }) => {
    await prepare(page)
    await page.evaluate(() => sessionStorage.setItem('oj-run:1:%2Fproblems%2F1', 'restore-failure'))
    let gets = 0
    let waits = 0
    await page.route('**/api/runs/restore-failure', async route => {
      gets++
      if (gets === 1) return route.fulfill({ status: 503 })
      return route.fulfill({ json: { id: 'restore-failure', status: 'completed', createdAt: 1, expiresAt: 9, result: { status: 'OK', stdout: 'restored', stderr: '', exitCode: 0, outputTruncated: false } } })
    })
    await page.route('**/api/runs/restore-failure/wait', route => { waits++; return route.fulfill({ status: 500 }) })
    await page.reload()
    await expect(page.getByText('正在恢复运行状态…')).toBeVisible()
    await expect(page.getByText('运行中', { exact: true })).toHaveCount(0)
    await expect(page.getByText('restored', { exact: true })).toBeVisible()
    expect(gets).toBe(2)
    expect(waits).toBe(0)
  })

  test('failed cancel re-reads the same run instead of leaving an unobserved active job', async ({ page }) => {
    await prepare(page)
    await page.route('**/api/runs', route => route.fulfill({ json: { id: 'cancel-failure', status: 'running', createdAt: 1, expiresAt: 9 } }))
    await page.route('**/api/runs/cancel-failure/wait', async route => {
      await new Promise(resolve => setTimeout(resolve, 300))
      await route.fulfill({ json: { id: 'cancel-failure', status: 'running', createdAt: 1, expiresAt: 9 } }).catch(() => {})
    })
    let reads = 0
    await page.route('**/api/runs/cancel-failure', route => {
      if (route.request().method() === 'DELETE') return route.fulfill({ status: 503 })
      reads++
      return route.fulfill({ json: { id: 'cancel-failure', status: 'completed', createdAt: 1, expiresAt: 9, result: { status: 'OK', stdout: 'finished during cancellation', stderr: '', exitCode: 0, outputTruncated: false } } })
    })
    await page.getByRole('button', { name: '运行', exact: true }).click()
    await page.getByRole('button', { name: '取消运行', exact: true }).click()
    await expect(page.getByText('finished during cancellation', { exact: true })).toBeVisible()
    expect(reads).toBe(1)
    await expect(page.getByText(/正在重新读取|正在自动重连/)).toHaveCount(0)
  })

  test('result region is stable, output scrolls internally, and reduced motion disables entrance transition', async ({ page }, testInfo) => {
    await prepare(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/api/runs', async route => route.fulfill({ json: {
      id: 'layout-1', status: 'completed', createdAt: 1, expiresAt: 2,
      result: { status: 'OK', stdout: 'x\n'.repeat(500), stderr: '', exitCode: 0, outputTruncated: false },
    } }))
    await page.getByRole('button', { name: '运行' }).click()
    const region = page.locator('[data-testid="oj-run-result"]')
    await expect(region).toBeVisible()
    const metrics = await region.evaluate(el => {
      const rect = el.getBoundingClientRect()
      const pre = el.querySelector('pre')!
      const style = getComputedStyle(el)
      return { height: rect.height, minHeight: style.minHeight, transition: style.transitionDuration, resultAnimation: getComputedStyle(el.querySelector('.result-content')!).animationDuration, preHeight: pre.clientHeight, preScroll: pre.scrollHeight, pageWidth: document.documentElement.scrollWidth }
    })
    expect(metrics.minHeight).not.toBe('0px')
    expect(metrics.preScroll).toBeGreaterThan(metrics.preHeight)
    expect(metrics.pageWidth).toBeLessThanOrEqual(await page.evaluate(() => innerWidth))
    await region.locator('pre').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('reduced-motion-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    const mobileWidth = await region.evaluate(el => el.getBoundingClientRect().width)
    expect(mobileWidth).toBeLessThanOrEqual(390)
    await region.locator('pre').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('reduced-motion-mobile.png'), fullPage: true })
    expect(metrics.resultAnimation).toBe('0s')
    expect(metrics.transition).toBe('0s')
  })
})
