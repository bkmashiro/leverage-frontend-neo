<template>
  <div ref="editorEl" class="code-editor" />
</template>

<script setup lang="ts">
import { Compartment, EditorState  } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps<{
  modelValue: string
  language: string // editor mode (OJ IDs and Botzone runtime names)
  readonly?: boolean
  height?: string
  stateKey?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const { isDark } = useTheme()
const STATE_LIMIT = 24
type SavedEditorState = { fingerprint: string; anchor: number; head: number; scrollTop: number; scrollLeft: number }
const savedStates = new Map<string, SavedEditorState>()

const editorEl = ref<HTMLElement>()
let view: EditorView | null = null
let viewOwnerId: number | null = null
const themeCompartment = new Compartment()
const languageCompartment = new Compartment()
const editableCompartment = new Compartment()
// 防止 CM 自身触发的 emit 再被 watcher 回写，形成反馈循环
let internalUpdate = false
const auth = useAuthStore()
function editorStateKey() { return auth.user?.id && props.stateKey ? `${auth.user.id}:${props.stateKey}` : null }
function documentFingerprint(doc: string) {
  let a = 0x811c9dc5; let b = 0x9e3779b9
  for (let i = 0; i < doc.length; i++) { const code = doc.charCodeAt(i); a = Math.imul(a ^ code, 0x01000193); b = Math.imul(b ^ code, 0x85ebca6b) }
  return `${doc.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`
}
function saveEditorState() {
  if (!view || !props.stateKey || !viewOwnerId || auth.user?.id !== viewOwnerId) return
  const key = editorStateKey()
  if (!key) return
  const state = view.state
  savedStates.delete(key)
  savedStates.set(key, { fingerprint: documentFingerprint(state.doc.toString()), anchor: state.selection.main.anchor, head: state.selection.main.head, scrollTop: view.scrollDOM.scrollTop, scrollLeft: view.scrollDOM.scrollLeft })
  while (savedStates.size > STATE_LIMIT) savedStates.delete(savedStates.keys().next().value!)
}
function goToDiagnostic(location: { line: number; column: number }) {
  if (!view || !Number.isSafeInteger(location?.line) || !Number.isSafeInteger(location?.column)) return false
  if (location.line < 1 || location.line > view.state.doc.lines) return false
  const line = view.state.doc.line(location.line)
  if (location.column < 1 || location.column > line.length + 1) return false
  const pos = line.from + location.column - 1
  view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
  view.focus()
  return true
}
defineExpose({ goToDiagnostic })

function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'cpp':
    case 'cpp11':
    case 'cpp14':
    case 'cpp17':
    case 'cpp20':
    case 'c':
      return cpp()
    case 'java':
      return java()
    case 'python':
    case 'python2':
    case 'python3':
      return python()
    case 'javascript':
    case 'typescript':
      return javascript()
    default:
      return []
  }
}

function getThemeExtension(dark: boolean) {
  return dark ? oneDark : EditorView.baseTheme({})
}

function buildUpdateListener() {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      internalUpdate = true
      emit('update:modelValue', update.state.doc.toString())
    }
  })
}

onMounted(() => {
  if (!editorEl.value) return
  viewOwnerId = auth.user?.id ?? null
  const savedKey = editorStateKey()
  const saved = savedKey ? savedStates.get(savedKey) : undefined
  const restore = saved?.fingerprint === documentFingerprint(props.modelValue) ? saved : undefined
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      selection: restore ? { anchor: Math.min(restore.anchor, props.modelValue.length), head: Math.min(restore.head, props.modelValue.length) } : undefined,
      extensions: [
        basicSetup,
        languageCompartment.of(getLanguageExtension(props.language)),
        themeCompartment.of(getThemeExtension(isDark.value)),
        buildUpdateListener(),
        editableCompartment.of(EditorView.editable.of(!props.readonly)),
      ],
    }),
    parent: editorEl.value,
  })
  if (restore) { view.scrollDOM.scrollTop = restore.scrollTop; view.scrollDOM.scrollLeft = restore.scrollLeft }
})

watch(() => props.readonly, value => {
  view?.dispatch({ effects: editableCompartment.reconfigure(EditorView.editable.of(!value)) })
})

// 动态切换主题（暗色/亮色）
watch(isDark, (dark) => {
  if (!view) return
  view.dispatch({
    effects: themeCompartment.reconfigure(getThemeExtension(dark)),
  })
})

// 监听 language 变化，只重配语言扩展
watch(() => props.language, () => {
  if (!view) return
  view.dispatch({
    effects: languageCompartment.reconfigure(getLanguageExtension(props.language)),
  })
})

// 外部 modelValue 变化时同步（避免光标跳动）
// internalUpdate 标记：CM 自身打字触发的 emit 不需要回写
watch(() => props.modelValue, (val) => {
  if (internalUpdate) {
    internalUpdate = false
    return
  }
  if (!view) return
  const docLen = view.state.doc.length
  const current = view.state.doc.toString()
  if (current !== val) {
    try {
      view.dispatch({
        changes: { from: 0, to: docLen, insert: val ?? '' },
      })
    }
    catch {
      // 状态不一致时重建 editor state（极端情况兜底）
      view.setState(EditorState.create({
        doc: val ?? '',
        extensions: [
          basicSetup,
          languageCompartment.of(getLanguageExtension(props.language)),
          themeCompartment.of(getThemeExtension(isDark.value)),
          buildUpdateListener(),
          editableCompartment.of(EditorView.editable.of(!props.readonly)),
        ],
      }))
    }
  }
})

watch(() => auth.user?.id, (user, previous) => {
  if (previous) for (const key of savedStates.keys()) if (key.startsWith(`${previous}:`)) savedStates.delete(key)
  if (user !== previous && view) {
    view.dispatch({ selection: { anchor: 0 } })
    view.scrollDOM.scrollTop = 0
    view.scrollDOM.scrollLeft = 0
    viewOwnerId = user ?? null
  }
})
onUnmounted(() => { saveEditorState(); view?.destroy() })
</script>

<style scoped>
.code-editor {
  height: v-bind('props.height || "400px"');
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}

.code-editor :deep(.cm-editor) {
  height: 100%;
  font-family: var(--lv-font-code);
  font-size: var(--lv-size-code);
  line-height: 1.55;
}

.code-editor :deep(.cm-scroller) {
  overflow: auto;
  font-family: var(--lv-font-code);
  line-height: 1.55;
}
</style>
