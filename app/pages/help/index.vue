<template>
  <article>
    <h1>帮助与系统说明</h1>
    <p>Leverage 提供在线评测、Bot 对战和 MCP 工具接口。下列说明面向使用者，描述各部分的用途与当前实现边界。</p>
    <ul class="help-links">
      <li><NuxtLink to="/help/wasm">C/C++ WASM 评测</NuxtLink>：语言选项、限制与运行结果。</li>
      <li><NuxtLink to="/help/botzone">Botzone 对战</NuxtLink>：Bot、裁判和可视化的工作方式。</li>
      <li><NuxtLink to="/help/mcp">MCP 连接</NuxtLink>：通过本地 stdio 客户端访问 Playground API。</li>
    </ul>
    <h2>常规 OJ 约定</h2>
    <p>提交程序应遵循题目描述的输入输出格式，并使用标准输入输出。时间与内存限制按具体题目和所选评测运行时判断。语言选择会随提交一起发送；课程与竞赛题目还会携带对应上下文。</p>
    <p>帮助页面公开可访问；提交、课程与竞赛数据仍按各自页面的登录和权限规则控制。</p>
  </article>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })
useHead({ title: '帮助 — Leverage OJ' })
</script>

<style scoped>
.help-links { padding-left: 22px; }
.help-links li { margin: 10px 0; }
</style>
