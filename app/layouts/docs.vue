<template>
  <div class="docs-shell">
    <header class="docs-header">
      <NuxtLink to="/help" class="docs-brand">Leverage 帮助</NuxtLink>
      <nav aria-label="帮助目录" class="docs-nav">
        <NuxtLink to="/help">概览</NuxtLink>
        <NuxtLink to="/help/wasm">WASM</NuxtLink>
        <NuxtLink to="/help/botzone">Botzone</NuxtLink>
        <NuxtLink to="/help/mcp">MCP</NuxtLink>
      </nav>
    </header>
    <main class="docs-main"><slot /></main>
    <footer class="docs-footer"><NuxtLink to="/">返回 Leverage OJ</NuxtLink></footer>
  </div>
</template>

<style>
.docs-shell {
  min-height: 100vh;
  background: var(--lv-color-background, #f6f8fb);
  color: var(--lv-color-text, #20242a);
}
.docs-header {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px max(20px, calc((100vw - 980px) / 2));
  border-bottom: 1px solid var(--lv-color-border, #e5e7eb);
  background: var(--lv-color-surface, #fff);
}
.docs-brand { font-weight: 700; white-space: nowrap; text-decoration: none; color: inherit; }
.docs-nav { display: flex; gap: 16px; flex-wrap: wrap; }
.docs-nav a, .docs-footer a { color: var(--lv-color-primary, #1769aa); text-decoration: none; }
.docs-nav a:hover, .docs-footer a:hover { text-decoration: underline; }
.docs-main { box-sizing: border-box; width: min(100% - 32px, 860px); margin: 28px auto; padding: 28px; border: 1px solid var(--lv-color-border, #e5e7eb); border-radius: 10px; background: var(--lv-color-surface, #fff); line-height: 1.7; }
.docs-main h1 { margin: 0 0 10px; font-size: clamp(1.5rem, 4vw, 2rem); line-height: 1.25; }
.docs-main h2 { margin: 26px 0 8px; font-size: 1.18rem; }
.docs-main p { margin: 10px 0; }
.docs-main ul { padding-left: 22px; }
.docs-main code { overflow-wrap: anywhere; padding: 2px 5px; border-radius: 4px; background: #f0f2f5; }
.docs-main pre { overflow-x: auto; padding: 14px; border-radius: 6px; background: #f0f2f5; line-height: 1.5; }
.docs-footer { width: min(100% - 32px, 860px); margin: 0 auto; padding: 0 0 24px; }
@media (max-width: 600px) {
  .docs-header { align-items: flex-start; flex-direction: column; gap: 8px; padding: 10px 16px; }
  .docs-nav { width: 100%; gap: 12px 18px; }
  .docs-main { width: calc(100% - 20px); margin: 12px auto; padding: 18px; }
  .docs-footer { width: calc(100% - 20px); }
}
</style>
