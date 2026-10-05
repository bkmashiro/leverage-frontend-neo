<template>
  <article>
    <h1>Botzone 对战</h1>
    <p>Botzone 是 Leverage 的独立程序对抗模块：用户提交的 Bot 按某个游戏规则与其他 Bot 或对手进行对局。本站的 Bot 对战区域围绕游戏、Bot、裁判和回放可视化组织流程。</p>

    <h2>一场对局的组成</h2>
    <ul>
      <li><strong>Bot</strong>：实现游戏策略的选手程序。Bot 读取裁判提供的当前局面信息，输出本回合行动。</li>
      <li><strong>裁判（judge）</strong>：运行游戏规则，校验行动并推进对局状态；裁判与 Bot 是不同的程序角色。</li>
      <li><strong>可视化（renderer）</strong>：根据回合状态展示棋盘或过程，供用户查看对局；它不替代裁判结果。</li>
    </ul>
    <p>服务端按游戏协议组织程序输入输出，并保存对局结果与可查看的回合信息。Bot 使用本站对战功能支持的原生语言与运行协议，不会继承 OJ 的 WASM 语言选项。</p>

    <h2>学习资料</h2>
    <p><NuxtLink to="/compete/learn?track=bot&amp;step=1">Bot 学习中心</NuxtLink>提供本站的入门材料和可交互示例，也可以从主导航进入。</p>
    <p>示例运行属于测试对局，持久提交 Bot 或修改共享程序仍按当前权限和页面确认规则执行。</p>
    <p><NuxtLink to="/help">返回帮助目录</NuxtLink></p>
  </article>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })
useHead({ title: 'Botzone 对战 — 帮助' })
</script>
