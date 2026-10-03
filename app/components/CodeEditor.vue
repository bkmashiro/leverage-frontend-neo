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
}>()

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const { isDark } = useTheme()

const editorEl = ref<HTMLElement>()
let view: EditorView | null = null
const themeCompartment = new Compartment()
const languageCompartment = new Compartment()
const editableCompartment = new Compartment()
// 防止 CM 自身触发的 emit 再被 watcher 回写，形成反馈循环
let internalUpdate = false

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
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
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

onUnmounted(() => view?.destroy())
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
