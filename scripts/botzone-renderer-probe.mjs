// Run with: node scripts/botzone-renderer-probe.mjs
// Starts a local Nuxt server, uses mock API/SSE boundaries, drives real Chrome srcdoc frames.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import vm from 'node:vm'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const exampleRendererHtml = fs.readFileSync(new URL('../examples/botzone/closest-renderer.html', import.meta.url), 'utf8')
// An attacker-controlled renderer can execute in its frame, not in the parent origin.
const hostileRendererHtml = `<!doctype html><body>
<a id="escape" href="/compete/playground" target="_top">escape sandbox</a>
<script>
  document.body.dataset.scriptRan = 'yes';
  try { parent.document.body.dataset.rendererXss = 'yes'; } catch { document.body.dataset.parentDenied = 'yes'; }
  try { localStorage.setItem('rendererXss', 'yes'); } catch { document.body.dataset.storageDenied = 'yes'; }
</script></body>`
const fixture = {
  verdict: 'OK', roundCount: 1,
  rounds: [{ round: 1, judgeCmd: { display: { target: 5, moves: { '0': 5, '1': 4 } }, verdict: 'finish', content: { '0': null } }, botResponses: { '0': 5, '1': 4 }, debug: { judge: 'test' } }],
  finalResult: { '0': 1, '1': 0 },
}
function checkNormalizer() {
  const source = fs.readFileSync(new URL('../app/utils/botzone-log.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(`(function(exports,module){${compiled}\n})`)(module.exports, module)
  const normalize = module.exports.normalizeGameLog
  const log = normalize(JSON.stringify(fixture), 7)
  assert.equal(log.gameId, '7')
  assert.equal(log.rounds[0].judgerDisplay.target, 5)
  assert.equal(log.rounds[0].judgeCmd.verdict, 'finish')
  assert.equal(log.rounds[0].botResponses['1'], 4)
  assert.equal(log.rounds[0].debug.judge, 'test')
  assert.equal(log.roundCount, 1)
  assert.equal(normalize('{bad'), null)
  assert.equal(normalize({ rounds: [] }), null)
  const legacy = normalize({ rounds: [{ display: { marker: 'legacy' }, botOutputs: { '0': 2 } }], finalResult: {} })
  assert.equal(legacy.rounds[0].round, 1)
  assert.equal(legacy.rounds[0].botResponses['0'], 2)
  assert.equal(legacy.rounds[0].judgerDisplay.marker, 'legacy')
}
async function freePort() {
  const server = net.createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
async function waitServer(url, child) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Nuxt exited: ${child.exitCode}`)
    try { if ((await fetch(url)).ok) return }
    catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error('Nuxt did not start within 60 seconds')
}
async function main() {
  checkNormalizer()
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const child = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let serverOutput = ''
  child.stdout.on('data', data => { serverOutput = (serverOutput + data).slice(-4000) })
  child.stderr.on('data', data => { serverOutput = (serverOutput + data).slice(-4000) })
  let browser
  try {
    await waitServer(url, child)
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext()
    await context.addInitScript(() => {
      if (window !== window.top) return
      localStorage.setItem('refreshToken', 'mock-refresh-token')
      window.EventSource = class {
        constructor() { window.__probeSSE = this }
        close() {}
      }
    })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', error => pageErrors.push(String(error)))
    page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()) })
    const posts = []
    let status = 2
    let rendererHtml = exampleRendererHtml
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (!path.startsWith('/api/')) return route.continue()
      if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: 'mock-access-token' } })
      if (path === '/api/auth/profile') return route.fulfill({ json: { id: 1, username: 'probe', role: 'sa' } })
      if (path === '/api/compete/matches/7') return route.fulfill({ json: {
        id: 7, gameId: 3, status, result: status === 2 ? JSON.stringify(fixture) : null,
        game: { id: 3, name: 'Closest', rendererHtml },
        links: [{ index: 0, gamerId: 12, gamer: { id: 12, title: 'Human', type: 'human', userId: 1 } }, { index: 1, gamerId: 13, gamer: { id: 13, title: 'Bot', type: 'code' } }],
      } })
      if (path === '/api/compete/bot-respond') {
        posts.push(route.request().postDataJSON())
        return route.fulfill({ json: { ok: true } })
      }
      return route.fulfill({ json: {} })
    })
    // Replay uses the actual match component -> BotzoneGameRenderer -> sandboxed iframe.
    await page.goto(`${url}/compete/matches/7`)
    const replay = page.frameLocator('.renderer-iframe')
    try { await replay.locator('#board').getByText('"target": 5').waitFor({ timeout: 15_000 }) }
    catch (error) {
      console.error('Replay diagnostic:', page.url(), (await page.locator('body').innerText()).slice(0, 1500), await page.locator('iframe').count(), pageErrors, serverOutput)
      throw error
    }
    assert.equal(await page.locator('.renderer-iframe').getAttribute('sandbox'), 'allow-scripts')
    assert.match(await replay.locator('#board').innerText(), /"moves"/)

    // The same API field can contain hostile executable HTML. It must stay in an
    // opaque-origin frame even though srcdoc inherits the embedding page URL.
    rendererHtml = hostileRendererHtml
    await page.reload()
    await replay.locator('body[data-script-ran="yes"]').waitFor({ timeout: 15_000 })
    assert.equal(await replay.locator('body').getAttribute('data-parent-denied'), 'yes')
    assert.equal(await replay.locator('body').getAttribute('data-storage-denied'), 'yes')
    assert.equal(await replay.locator('body').evaluate(() => location.origin), 'null')
    assert.equal(await page.evaluate(() => document.body.dataset.rendererXss), undefined)
    assert.equal(await page.evaluate(() => localStorage.getItem('rendererXss')), null)
    await replay.locator('#escape').click()
    await page.waitForTimeout(200)
    assert.equal(page.url(), `${url}/compete/matches/7`, 'sandbox must block top-level navigation')

    // Running match: same actual component and real srcdoc iframe; SSE is the mocked boundary.
    rendererHtml = exampleRendererHtml
    status = 1
    await page.reload()
    await page.locator('iframe[style*="420px"]').waitFor({ state: 'attached', timeout: 15_000 })
    await page.waitForFunction(() => !!window.__probeSSE?.onmessage)
    await page.evaluate(() => window.__probeSSE.onmessage({ data: JSON.stringify({ type: 'your-turn', turnToken: 'probe-turn', gameState: { requests: ['{"target":5}'], responses: [] } }) }))
    const human = page.frameLocator('iframe[style*="420px"]')
    await human.locator('#board').getByText('目标：5').waitFor({ timeout: 10_000 })
    assert.equal(await page.locator('iframe[style*="420px"]').getAttribute('sandbox'), 'allow-scripts')
    // Malformed message from real iframe and valid-shaped spoof from unrelated source both rejected.
    await human.locator('body').evaluate(() => parent.postMessage({ type: 'humanMove', move: 5 }, '*'))
    await page.evaluate(() => window.postMessage({ type: 'humanMove', move: '{"0":8}' }, '*'))
    await page.evaluate(() => new Promise(resolve => {
      const other = document.createElement('iframe')
      other.setAttribute('sandbox', 'allow-scripts')
      other.srcdoc = '<script>parent.postMessage({type:"humanMove",move:"9"},"*")</script>'
      other.onload = resolve
      document.body.appendChild(other)
    }))
    await page.waitForTimeout(200)
    assert.equal(posts.length, 0)
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/compete/bot-respond'), { timeout: 10_000 }),
      human.getByRole('button', { name: '出手' }).click(),
    ])
    assert.equal(posts.length, 1)
    assert.deepEqual(posts[0], { turnToken: 'probe-turn', response: '{"0":5}' })
    await context.close()
    console.log('Botzone probe passed: normalization, hostile replay srcdoc isolation/top-nav denial, human iframe source/shape rejection + move POST (mock API/SSE, not a judge run)')
  } finally {
    await browser?.close()
    try { process.kill(-child.pid, 'SIGTERM') } catch { /* already exited */ }
  }
}
await main()
