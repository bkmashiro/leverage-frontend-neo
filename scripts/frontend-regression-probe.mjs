import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const read = path => fs.readFileSync(new URL(path, root), 'utf8')
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
const require = createRequire(import.meta.url)
function load(source, mocks = {}) {
  const module = { exports: {} }
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name)
  const factory = vm.runInNewContext(`(function(exports, require, module) { ${compile(source)}\n})`, {
    Promise, Object, Error, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  })
  factory(module.exports, localRequire, module)
  return module.exports
}

async function testRefreshInterceptor() {
  let onRejected
  let refreshCalls = 0
  let resolveRefresh
  const refreshPending = new Promise(resolve => { resolveRefresh = resolve })
  const authStore = {
    accessToken: 'new-access-token',
    refreshAccessToken() { refreshCalls++; return refreshPending },
    logout() { throw new Error('unexpected logout') },
  }
  const instance = Object.assign(config => Promise.resolve({ replayed: config.url }), {
    interceptors: {
      request: { use() {} },
      response: { use(_success, rejected) { onRejected = rejected } },
    },
  })
  const api = load(read('app/composables/useApi.ts'), {
    axios: { create: () => instance },
    '~/stores/auth': { useAuthStore: () => authStore },
  })
  api.createApiInstance('/api')

  const refreshError = { response: { status: 401 }, config: { url: '/auth/refresh' } }
  await assert.rejects(onRejected(refreshError), error => error === refreshError)
  assert.equal(refreshCalls, 0, '401 from refresh endpoint must not start another refresh')

  const first = { response: { status: 401 }, config: { url: '/problems', headers: {} } }
  const second = { response: { status: 401 }, config: { url: '/courses', headers: {} } }
  const firstResult = onRejected(first)
  const secondResult = onRejected(second)
  assert.equal(refreshCalls, 1, 'concurrent 401s must share one refresh')
  resolveRefresh()
  const results = await Promise.all([firstResult, secondResult])
  assert.deepEqual(results.map(result => result.replayed), ['/problems', '/courses'])
  assert.equal(first.config.headers.Authorization, 'Bearer new-access-token')
}

async function testPollingRecovery() {
  const timers = new Map()
  let timerId = 0
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  globalThis.setTimeout = (callback, delay) => {
    const id = ++timerId
    timers.set(id, { callback, delay })
    return id
  }
  globalThis.clearTimeout = id => timers.delete(id)
  try {
    const { effectScope } = await import('vue')
    const { useSubmissionPolling } = load(read('app/composables/useSubmissionPolling.ts'))
    const scope = effectScope()
    let calls = 0
    const seen = []
    const polling = scope.run(() => useSubmissionPolling(async () => {
      calls++
      if (calls === 1) throw new Error('temporary network failure')
      return { data: { status: calls === 2 ? 1 : 2 } }
    }, status => seen.push(status), status => status === 2))

    polling.start(41, 0)
    assert.deepEqual([...timers.values()].map(timer => timer.delay), [2000])
    const runNext = async () => {
      const [id, timer] = timers.entries().next().value
      timers.delete(id)
      timer.callback()
      await Promise.resolve()
      await Promise.resolve()
    }
    await runNext()
    assert.equal(calls, 1)
    assert.deepEqual([...timers.values()].map(timer => timer.delay), [4000], 'transient failure retries with backoff')
    await runNext()
    assert.deepEqual(seen, [1])
    assert.deepEqual([...timers.values()].map(timer => timer.delay), [2000], 'successful nonterminal poll returns to normal cadence')
    await runNext()
    assert.deepEqual(seen, [1, 2])
    assert.equal(polling.polling.value, false, 'terminal result stops polling')
    assert.equal(timers.size, 0)
    polling.start(42, 0)
    assert.equal(timers.size, 1, 'new submission starts its own poll timer')
    scope.stop()
    assert.equal(timers.size, 0, 'scope disposal cancels pending polling')
  }
  finally {
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
}

async function testSelfPasswordRoute() {
  const posts = []
  const api = { post: async (path, body) => { posts.push({ path, body }) } }
  const { useAuthApi } = load(read('app/composables/api/auth.ts'), {
    '~/composables/useApi': { useApi: () => api },
  })
  await useAuthApi().changePassword(37, 'prior-value', 'new-value')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].path, '/users/37/password')
  assert.equal(posts[0].body.oldPassword, 'prior-value')
  assert.equal(posts[0].body.newPassword, 'new-value')
}

function testSseAndIframeContracts() {
  const matchPage = read('app/pages/compete/matches/[id].vue')
  const nginx = read('nginx.conf')
  assert.match(matchPage, /useRuntimeConfig\(\)\.public\.apiBase/)
  assert.match(matchPage, /new EventSource\(url\.toString\(\)\)/)
  assert.doesNotMatch(matchPage, /hostname}:3000/)
  assert.match(nginx, /human-sse[\s\S]*?proxy_buffering off;/)
  assert.match(matchPage, /e\.source !== humanRendererRef\.value\?\.contentWindow/)
  assert.match(matchPage, /typeof e\.data\.move === 'string'/)
  assert.match(matchPage, /sandbox="allow-scripts"/)
  assert.doesNotMatch(matchPage, /allow-same-origin/)
  const sseBlock = matchPage.slice(matchPage.indexOf('function connectHumanSSE()'), matchPage.indexOf('async function submitHumanMove()'))
  assert.doesNotMatch(sseBlock, /console\.(?:log|warn|error)/, 'SSE logs must not expose tokens or event contents')
}

await testRefreshInterceptor()
await testPollingRecovery()
await testSelfPasswordRoute()
testSseAndIframeContracts()
console.log('frontend regression probe passed: refresh, polling, own-password route, SSE and iframe contracts')
