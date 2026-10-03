<template>
  <NuxtLink v-if="validUserId(userId)" :to="`/users/${userId}`" class="user-link">
    {{ username }}
  </NuxtLink>
  <span v-else>{{ username }}</span>
</template>

<script setup lang="ts">
defineProps<{
  userId: number
  username: string
}>()

function validUserId(value: number) {
  return Number.isSafeInteger(value) && value > 0
}
</script>

<style scoped>
.user-link {
  font-weight: 500;
  color: var(--lv-color-accent, #426b96);
  text-decoration: none;
}
.user-link:hover { text-decoration: underline; }
.user-link:focus-visible { outline: 2px solid var(--lv-color-accent, #426b96); outline-offset: 3px; border-radius: 2px; }
</style>
