<template>
  <GameEditor />
</template>

<script setup lang="ts">
import GameEditor from '~/components/compete/GameEditor.vue'
definePageMeta({ layout: 'admin', middleware: 'admin' })
</script>
