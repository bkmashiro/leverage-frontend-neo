import { test, expect } from '@playwright/test'
import { mockAuthApi, mockProblemsApi, setLoggedInViaStorage } from './mocks/api'
import { parseCompileDiagnostics } from '../app/utils/compile-diagnostics'

const code = 'int main() {\n  return 0\n}'
const diagnostics = 'main.cpp:2:10: error: expected \' ; \' before \'return\'\n  return 0\n         ^\n/usr/include/c++/bits/header.h:9:1: error: ignored header error\nother.cpp:3:4: error: ignored other file'

test('only parses compiler errors in the known user translation unit', () => {
  const output = ['main.c:4:2: error: missing', 'main.cpp:1:1: warning: warning only', '/usr/include/stdio.h:3:4: error: system header', '/path/main.cpp:7:2: error: path source', 'other.cpp:8:2: error: other translation unit'].join('\n')
  expect(parseCompileDiagnostics(output)).toEqual([{ line: 4, column: 2, message: 'missing', sourceLine: 'main.c:4:2: error: missing' }])
})

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page)
  await mockProblemsApi(page)
  await page.goto('/')
  await setLoggedInViaStorage(page)
})

test('compile diagnostic is escaped, explicit, and only navigates to trusted main.cpp locations', async ({ page }) => {
  await page.route('**/api/submissions', route => route.fulfill({ json: { id: 42, userId: 1, problemId: 1, status: 4, language: 'cpp17', courseId: null, contestId: null, misc: { code, compileErrorMsg: diagnostics, judgeResult: { testcases: [] } } } }))
  await page.route('**/api/submissions/42', route => route.fulfill({ json: { id: 42, userId: 1, problemId: 1, status: 4, language: 'cpp17', courseId: null, contestId: null, misc: { code, compileErrorMsg: diagnostics, judgeResult: { testcases: [] } } } }))
  await page.goto('/problems/1')
  await page.locator('.cm-content').first().fill(code)
  await page.getByRole('button', { name: '提交代码', exact: true }).click()
  await expect(page.getByText(/定位首个错误（第 2 行，第 10 列）/)).toBeVisible()
  await expect(page.locator('.compile-output')).toHaveCount(0)
  await page.getByRole('button', { name: '展开完整编译输出' }).click()
  await expect(page.locator('.compile-output')).toContainText('/usr/include/c++/bits/header.h')
  await expect(page.locator('.compile-output img')).toHaveCount(0)
  await page.getByRole('button', { name: /定位首个错误/ }).click()
  // CodeMirror marks the caret's current line, not every document line.
  // Check the actual focused selection instead of counting active-line nodes.
  const editor = page.locator('.cm-content').first()
  await expect(editor).toBeFocused()
  await expect.poll(() => editor.evaluate(el => {
    const selection = getSelection()
    if (!selection?.isCollapsed || !selection.anchorNode || !el.contains(selection.anchorNode)) return null
    const anchorElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode as Element : selection.anchorNode.parentElement
    const line = anchorElement?.closest('.cm-line')
    if (!line) return null
    const range = document.createRange()
    range.selectNodeContents(line)
    range.setEnd(selection.anchorNode, selection.anchorOffset)
    return { line: Array.from(el.querySelectorAll('.cm-line')).indexOf(line) + 1, column: range.toString().length + 1 }
  })).toEqual({ line: 2, column: 10 })
  await page.locator('.cm-content').first().fill('int main() { return 99; }')
  await expect(page.getByText('代码已修改，不能定位上次提交的错误。')).toBeVisible()
  await expect(page.getByRole('button', { name: /首个错误（第 2 行/ })).toBeDisabled()
  const receipt = await page.evaluate(() => Object.entries(sessionStorage).find(([key]) => key.startsWith('oj-submit:'))?.[1] ?? '')
  expect(receipt).not.toContain(code)
})

test('failure filter excludes pending and preserves order until explicit first-failure action', async ({ page }) => {
  const cases = [
    { id: 1, verdict: 'AC', time: 1, memory: 1024 },
    { id: 2, verdict: '?', time: null, memory: null },
    { id: 3, verdict: 'WA', time: 2, memory: 2048 },
    { id: 4, verdict: 'RE', time: 3, memory: 3072 },
  ]
  await page.route('**/api/submissions/42', route => route.fulfill({ json: { id: 42, userId: 1, problemId: 1, status: 0, language: 'cpp17', courseId: null, contestId: null, misc: { judgeResult: { testcases: cases } } } }))
  await page.goto('/problems/1?submission=42')
  await expect(page.getByRole('button', { name: /未通过 \(2\)/ })).toBeVisible()
  await expect(page.locator('.case-region tbody tr')).toHaveCount(4)
  await page.getByRole('button', { name: /未通过 \(2\)/ }).click()
  await expect(page.locator('.case-region tbody tr')).toHaveCount(2)
  await expect(page.locator('.case-region tbody tr').nth(0)).toContainText('3')
  await expect(page.locator('.case-region tbody tr').nth(1)).toContainText('4')
  await expect(page.locator('.case-region tbody')).not.toContainText('?')
  await page.getByRole('button', { name: '全部 (4)' }).click()
  await expect(page.locator('.case-region tbody tr')).toHaveCount(4)
})
