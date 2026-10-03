import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync('app/utils/botzone-language.ts', 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const result = {}
vm.runInNewContext(output, { exports: result })
const values = Array.from(result.BOTZONE_LANGUAGE_OPTIONS, option => option.value)
assert.deepEqual(values, ['python', 'cpp', 'javascript', 'typescript'])
assert.equal(result.botzoneLanguage(9), 'python')
assert.equal(result.botzoneLanguage('cpp17'), 'cpp')
assert.equal(result.botzoneLanguage('python3'), 'python')
assert.equal(result.botzoneLanguage('unknown'), 'unknown')
assert.equal(result.botzoneEditorLanguage('javascript'), 'javascript')
for (const file of ['app/components/compete/GameEditor.vue', 'app/pages/compete/playground.vue', 'app/components/compete/ProgramSlot.vue']) {
  const page = fs.readFileSync(file, 'utf8')
  assert.ok(page.includes('BOTZONE_LANGUAGE_OPTIONS'), file)
  assert.ok(!page.includes("import { LANGUAGE_OPTIONS } from '~/types'"), file)
}
const adminEditor = fs.readFileSync('app/pages/admin/compete/game/[id].vue', 'utf8')
const authorEditor = fs.readFileSync('app/pages/compete/games/new.vue', 'utf8')
assert.ok(adminEditor.includes("import GameEditor from '~/components/compete/GameEditor.vue'"))
assert.ok(adminEditor.includes("middleware: 'admin'"), 'old admin routes retain their guard')
assert.ok(authorEditor.includes("import GameEditor from '~/components/compete/GameEditor.vue'"))
assert.ok(authorEditor.includes("middleware: ['auth', 'game-author']"), 'creation-only route retains explicit role scope')
const oj = {}
const ojSource = fs.readFileSync('app/types/index.ts', 'utf8')
vm.runInNewContext(ts.transpileModule(ojSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: oj })
assert.equal(oj.isFinalStatus(12), true, 'OLE must stop submission polling')
assert.equal(oj.isFinalStatus(13), true, 'SC must stop submission polling')
for (const status of [9, 10, 11]) assert.equal(oj.isFinalStatus(status), false)
assert.deepEqual(Array.from(oj.LANGUAGE_OPTIONS, option => option.value), ['c', 'cpp11', 'cpp14', 'cpp17', 'cpp20', 'python3', 'javascript', 'typescript'])
assert.equal(oj.LANGUAGE_LABEL['legacy-java'], 'Java（历史记录）')
assert.equal(oj.LANGUAGE_LABEL['legacy-id-42'], undefined)
assert.equal(oj.ojEditorLanguage('cpp20'), 'cpp')
assert.equal(oj.ojEditorLanguage('typescript'), 'typescript')
assert.equal(oj.ojEditorLanguage('legacy-id-42'), 'text')
assert.deepEqual(Array.from(oj.parseEnabledLanguages('["cpp20","legacy-java",9,"python3"]')), ['cpp20', 'python3'])
assert.deepEqual(Array.from(oj.parseEnabledLanguages('bad JSON')), [])
console.log('PASS Botzone runtime names, OJ string IDs, legacy display and configuration filtering')
