<template>
  <div class="renderer-tutorial">
    <!-- Step 0: 渲染器是什么 -->
    <div v-if="step === 0">
      <div class="step-intro">
        <h3>🎨 第一步：渲染器是什么？</h3>
        <p class="intro-text">
          渲染器是一个运行在沙箱 iframe 中的 HTML 页面。它通过 <strong>postMessage</strong> 协议
          接收游戏数据，负责把对局历史（回放模式）或当前局面（人类参赛模式）可视化呈现出来。
        </p>
      </div>

      <div class="renderer-diagram">
        <div class="rend-row">
          <div class="rend-node parent">🖥️ 父页面</div>
          <div class="rend-arrows">
            <div class="rarrow">→ postMessage({type:'gameLog', gameLog, round})</div>
            <div class="rarrow reverse">← postMessage({type:'humanMove', move:'...'})</div>
          </div>
          <div class="rend-node iframe">🎨 渲染器 iframe</div>
        </div>
      </div>

      <h4 style="margin-top:16px">消息类型：</h4>
      <div class="msg-table">
        <div class="msg-row header">
          <span>消息</span><span>方向</span><span>含义</span>
        </div>
        <div class="msg-row">
          <code>capabilities</code><span>iframe → 父</span><span>告知父页面渲染器支持的功能（如 interactive）</span>
        </div>
        <div class="msg-row">
          <code>gameLog</code><span>父 → iframe</span><span>完整对局历史（回放模式），包含 round 字段</span>
        </div>
        <div class="msg-row">
          <code>gameState</code><span>父 → iframe</span><span>当前局面 + playerIndex（人类参赛模式）</span>
        </div>
        <div class="msg-row">
          <code>humanMove</code><span>iframe → 父</span><span>玩家的移动（人类参赛模式）</span>
        </div>
      </div>
    </div>

    <!-- Step 1: 最小渲染器 -->
    <div v-if="step === 1">
      <div class="step-intro">
        <h3>✏️ 第二步：写最小渲染器</h3>
        <p class="intro-text">
          先写一个能显示 gameLog 数据的最小渲染器。不需要任何框架，纯 HTML + Vanilla JS 就够了。
        </p>
      </div>

      <WikiCodeBlock
        :code="minimalRenderer"
        lang="html"
        :tryable="true"
        explanation="最小渲染器：监听 gameLog 消息，把每轮数据显示出来。可以直接在 Playground 渲染器 Tab 测试。"
        @try-it="$emit('go-renderer', { html: $event })"
      />

      <NAlert type="info" :show-icon="false" style="margin:12px 0;font-size:13px">
        <strong>调试技巧：</strong> 在 Playground → 渲染器 Tab，左边编辑 HTML，右边实时预览。
        点「发送 gameLog」按钮可以注入测试数据，看渲染效果。
      </NAlert>
    </div>

    <!-- Step 2: 人类互动 -->
    <div v-if="step === 2">
      <div class="step-intro">
        <h3>🖱️ 第三步：支持人类参赛（Interactive）</h3>
        <p class="intro-text">
          想让玩家直接在渲染器里点击操作？实现 interactive 模式：接收 gameState，
          玩家操作后发送 humanMove。
        </p>
      </div>

      <WikiCodeBlock
        :code="interactiveRenderer"
        lang="html"
        :tryable="true"
        explanation="interactive 渲染器：先发 capabilities 告知父页面，接收 gameState 渲染当前局面，玩家操作后发送 humanMove。"
        @try-it="$emit('go-renderer', { html: $event })"
      />

      <div class="protocol-detail">
        <h4>gameState 数据结构：</h4>
        <WikiCodeBlock
          :code="gameStateExample"
          lang="json"
          explanation="gameState 就是标准的 BotInput 格式。playerIndex 告诉你当前是哪个玩家的回合。"
        />
        <h4 style="margin-top:12px">humanMove 格式：</h4>
        <WikiCodeBlock
          :code="humanMoveExample"
          lang="json"
          explanation="move 字段是一个 JSON 字符串（不是对象！），内容是游戏特定的移动格式。"
        />
      </div>
    </div>

    <!-- Step 3: 发布 -->
    <div v-if="step === 3">
      <div class="step-intro">
        <h3>🚀 第四步：发布渲染器到游戏</h3>
        <p class="intro-text">
          渲染器测试 OK 后，直接在 Playground 发布到目标游戏。管理员也可以在后台游戏编辑页更新渲染器。
        </p>
      </div>

      <div class="publish-steps">
        <div class="pub-step">
          <span class="pub-num">1</span>
          <div>
            <strong>Playground → 渲染器 Tab</strong>
            <p>在左侧写 HTML，右侧实时预览效果。用「发送 gameLog」按钮注入测试数据。</p>
          </div>
        </div>
        <div class="pub-step">
          <span class="pub-num">2</span>
          <div>
            <strong>选择目标游戏，点「发布」</strong>
            <p>调用 PATCH /compete/games/:id 更新 rendererHtml 字段。</p>
          </div>
        </div>
        <div class="pub-step">
          <span class="pub-num">3</span>
          <div>
            <strong>在对局详情页验证</strong>
            <p>打开任意一局对局，回放时应该看到你的渲染器显示效果。</p>
          </div>
        </div>
      </div>

      <NAlert type="success" :show-icon="false" style="margin:12px 0;font-size:13px">
        渲染器运行在 sandbox iframe 中，安全隔离。可以随意使用 Canvas、Three.js 等前端库（通过 CDN）。
      </NAlert>

      <div class="final-cta">
        <NButton type="primary" size="large" @click="$emit('go-renderer', {})">
          🎨 去 Playground 写渲染器 →
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NAlert } from 'naive-ui'
import WikiCodeBlock from './WikiCodeBlock.vue'

defineProps<{ step: number }>()
defineEmits<{ 'next': []; 'go-renderer': [any] }>()

const minimalRenderer = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; background: #0f1117; color: #e2e8f0; padding: 16px; }
    .round { border: 1px solid #333; border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    h2 { color: #60a5fa; }
    pre { background: #1e2433; padding: 8px; border-radius: 4px; font-size: 12px; overflow: auto; }
  </style>
</head>
<body>
  <h2>🎮 游戏回放</h2>
  <div id="content">等待游戏数据…</div>

  <script>
    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'gameLog') return;
      
      const { gameLog, round } = event.data;
      const content = document.getElementById('content');
      
      // 显示指定轮次的数据
      const displayRound = gameLog.rounds?.[round] ?? gameLog.rounds?.[0];
      
      content.innerHTML = \`
        <div class="round">
          <strong>轮次 \${round + 1}</strong>
          <pre>\${JSON.stringify(displayRound, null, 2)}</pre>
        </div>
        <div class="round">
          <strong>最终结果</strong>
          <pre>\${JSON.stringify(gameLog.finalResult, null, 2)}</pre>
        </div>
      \`;
    });
  </${'script'}>
</body>
</html>`

const interactiveRenderer = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: sans-serif; background: #0f1117; color: #e2e8f0; padding: 16px; }
    button { background: #2080f0; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
    button:disabled { background: #555; cursor: not-allowed; }
    .status { margin: 12px 0; color: #94a3b8; font-size: 13px; }
  </style>
</head>
<body>
  <h2>🎮 我的回合</h2>
  <div class="status" id="status">等待局面…</div>
  <div id="board"></div>

  <script>
    // 1. 声明支持 interactive 模式
    window.parent.postMessage({ type: 'capabilities', interactive: true }, '*');
    
    let myPlayerIndex = -1;
    let submitted = false;
    
    window.addEventListener('message', (event) => {
      const data = event.data;
      
      if (data?.type === 'gameState') {
        myPlayerIndex = data.playerIndex;
        submitted = false;
        
        // 解析当前局面
        const requests = data.gameState.requests || [];
        const latest = JSON.parse(requests[requests.length - 1] || '{}');
        
        document.getElementById('status').textContent = 
          \`玩家 \${myPlayerIndex} 的回合 | 当前局面: \${JSON.stringify(latest)}\`;
        
        // 渲染操作界面（这里简化为输入框）
        document.getElementById('board').innerHTML = \`
          <p>你的移动：</p>
          <input id="move-input" type="number" placeholder="输入数字..." style="padding:8px;font-size:16px;width:100px" />
          <button id="submit-btn" onclick="submitMove()">提交</button>
        \`;
      }
      
      if (data?.type === 'gameLog') {
        // 回放模式
        document.getElementById('status').textContent = '回放模式';
        document.getElementById('board').innerHTML = 
          \`<pre>\${JSON.stringify(data.gameLog?.finalResult, null, 2)}</pre>\`;
      }
    });
    
    function submitMove() {
      if (submitted) return;
      const input = document.getElementById('move-input').value;
      if (!input) return;
      
      submitted = true;
      document.getElementById('submit-btn').disabled = true;
      
      // 构造移动（游戏特定格式）
      const moveObj = {};
      moveObj[String(myPlayerIndex)] = parseInt(input);
      
      // 2. 发送人类移动
      window.parent.postMessage({
        type: 'humanMove',
        move: JSON.stringify(moveObj)
      }, '*');
    }
  </${'script'}>
</body>
</html>`

const gameStateExample = `{
  "gameState": {
    "requests": ["{\\"round\\": 2, \\"rounds\\": 5}"],  // BotInput.requests
    "responses": ["42"],                              // 历史回应
    "time_limit": 2,
    "memory_limit": 256
  },
  "playerIndex": 0  // 当前玩家索引
}`

const humanMoveExample = `// 发送移动
window.parent.postMessage({
  type: 'humanMove',
  move: '{"0": 42}'   // move 是 JSON 字符串，key=playerIndex, value=移动
}, '*');`
</script>

<style scoped>
.renderer-tutorial { max-width: 800px; }
.step-intro { margin-bottom: 16px; }
.step-intro h3 { font-size: 18px; margin-bottom: 8px; }
.intro-text { font-size: 14px; color: #444; line-height: 1.7; }
.renderer-diagram { padding: 16px; background: #f9f9fb; border-radius: 10px; margin: 14px 0; }
.rend-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rend-node { padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; }
.parent { background: #e6f4ff; color: #2080f0; }
.iframe { background: #fff7e6; color: #d46b08; }
.rend-arrows { flex: 1; display: flex; flex-direction: column; gap: 6px; min-width: 280px; align-items: center; }
.rarrow { font-size: 12px; color: #555; padding: 4px 12px; background: #f5f5f5; border-radius: 4px; width: 100%; text-align: center; }
.rarrow.reverse { color: #d46b08; background: #fff7e6; }
.msg-table { border: 1px solid #e0e0e6; border-radius: 8px; overflow: hidden; margin-top: 10px; }
.msg-row { display: grid; grid-template-columns: 1.5fr 1fr 3fr; gap: 0; }
.msg-row span, .msg-row code { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #e0e0e6; }
.msg-row.header span { background: #f5f5f7; font-weight: 700; color: #666; }
code { font-family: monospace; background: #f0f0f2; }
.protocol-detail { margin-top: 16px; }
.protocol-detail h4 { font-size: 14px; margin-bottom: 6px; }
.publish-steps { display: flex; flex-direction: column; gap: 12px; margin: 14px 0; }
.pub-step { display: flex; gap: 12px; }
.pub-num {
  width: 28px; height: 28px; border-radius: 50%; background: #d46b08; color: #fff;
  display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;
}
.pub-step strong { display: block; font-size: 14px; margin-bottom: 4px; }
.pub-step p { font-size: 12px; color: #666; margin: 0; line-height: 1.6; }
.final-cta { text-align: center; padding: 20px 0; }
</style>
