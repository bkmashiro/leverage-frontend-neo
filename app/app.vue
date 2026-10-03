<template>
  <NConfigProvider :theme="lightTheme" :theme-overrides="themeOverrides" :hljs="hljs" style="height: 100%">
    <NuxtLoadingIndicator color="var(--lv-color-accent)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { lightTheme } from 'naive-ui'
import { getThemeOverrides } from '~/utils/naive-theme'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import cpp from 'highlight.js/lib/languages/cpp'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import plaintext from 'highlight.js/lib/languages/plaintext'

const themeOverrides = getThemeOverrides()

hljs.registerLanguage('python', python)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('text', plaintext)
hljs.registerLanguage('plaintext', plaintext)

</script>
