<template>
  <article>
    <h1>MCP 连接</h1>
    <p>Leverage MCP Server 通过标准输入输出（stdio）向兼容客户端提供 Playground API 工具。MCP 客户端启动本地 Node.js 进程，服务进程再通过 HTTP 访问 Leverage 后端；它不会绕过后端的身份验证或权限检查。</p>

    <h2>本地启动</h2>
    <p>需要 Node.js 20+、pnpm，以及正在运行的 Leverage 后端。进入后端项目根目录后，使用项目定义的 <code>pnpm mcp</code> 脚本：</p>
    <pre><code>cd &lt;backend-project-directory&gt;
pnpm install
LEVERAGE_BASE_URL=&lt;backend-url&gt; LEVERAGE_API_KEY=&lt;your-revocable-api-key&gt; pnpm mcp</code></pre>
    <p>命令、脚本名和环境变量与当前后端提供的 MCP 入口一致。API key 应通过客户端的私密环境配置提供，不要提交到代码库或粘贴到公开文档。后端设置页面可创建和撤销 API key。</p>

    <h2>连接参数</h2>
    <ul>
      <li><code>LEVERAGE_BASE_URL</code>：后端 HTTP 地址；默认是本机开发地址。使用适合当前客户端所在机器的地址。</li>
      <li><code>LEVERAGE_API_KEY</code>：推荐的可撤销 API key。</li>
      <li><code>LEVERAGE_TOKEN</code>：旧配置的 JWT 兼容变量，通常有效期较短。</li>
      <li><code>LEVERAGE_HTTP_TIMEOUT_MS</code>：单次 HTTP 请求超时；默认 10 秒，允许范围 1–300 秒。</li>
    </ul>
    <p>只能设置 <code>LEVERAGE_API_KEY</code> 或 <code>LEVERAGE_TOKEN</code> 其中一个。两者同时设置会导致启动配置错误。未设置凭据时，公开只读接口可能仍可用，受保护操作会按后端规则拒绝。</p>
    <p>具体 MCP 客户端的配置文件格式各异：将启动命令设为 <code>pnpm</code>、参数设为 <code>mcp</code>，并让进程在后端项目根目录运行；通过客户端私密环境区配置上述变量。stdio 通道只用于 MCP 协议消息，避免启动命令向标准输出打印其他内容。</p>

    <h2>工具与权限</h2>
    <p>工具包括读取游戏和 Bot、查看榜单与对局、运行测试对局，以及提交 Bot 等操作。部分写操作会持久修改数据或要求更高权限；具体权限由后端判定。调用前确认操作目标，尤其是会保存 Bot 或替换共享裁判、可视化程序的操作。</p>
    <p>MCP 连接适用于本地开发或经过授权的客户端。不要将 API key 放入共享配置；如怀疑泄露，请撤销并重新创建。</p>
    <p><NuxtLink to="/help">返回帮助目录</NuxtLink></p>
  </article>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })
useHead({ title: 'MCP 连接 — 帮助' })
</script>
