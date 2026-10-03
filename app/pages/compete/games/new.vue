<template>
  <div class="game-author-page"><GameEditor create-only return-path="/compete" /></div>
</template>
<script setup lang="ts">
import GameEditor from '~/components/compete/GameEditor.vue'
definePageMeta({ layout: 'default', middleware: ['auth', 'game-author'] })
</script>
<style scoped>
.game-author-page { max-width: var(--lv-width-workspace); margin: 0 auto; min-width: 0; }
</style>
