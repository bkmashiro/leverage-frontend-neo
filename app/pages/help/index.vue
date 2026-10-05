<template>
  <article>
    <h1>帮助与系统说明</h1>
    <p>Leverage 提供在线评测、Bot 对战和 MCP 工具接口。下列说明面向使用者，描述各部分的用途与当前实现边界。</p>
    <ul class="help-links">
      <li><NuxtLink to="/help/wasm">C/C++ WASM 评测</NuxtLink>：语言选项、限制与运行结果。</li>
      <li><NuxtLink to="/help/botzone">Botzone 对战</NuxtLink>：Bot、裁判和可视化的工作方式。</li>
      <li><NuxtLink to="/help/mcp">MCP 连接</NuxtLink>：通过本地 stdio 客户端访问 Playground API。</li>
    </ul>
    <p>帮助页面公开可访问；提交、课程与竞赛数据仍按各自页面的登录和权限规则控制。</p>

    <nav aria-label="本页内容" class="help-toc">
      <a href="#about">关于 OJ</a>
      <a href="#io">输入输出</a>
      <a href="#compile">编译选项</a>
      <a href="#judge">评测结果说明</a>
      <a href="#languages">支持语言</a>
      <a href="#developers">开发人员</a>
      <a href="#agreement">用户协议</a>
    </nav>

    <section id="about" aria-labelledby="about-heading">
      <h2 id="about-heading">关于 OJ</h2>
      <p>
        Leverage 是一个在线的评测系统。系统提供了题目供使用者练习编程能力与算法技巧。
        另外系统也有完善的比赛与作业系统供日常教学、比赛选拔所用。
        用户需要提交题目的由程序语言实现的解法，由评测系统进行自动地评测之后给出评测的结果。
      </p>
      <p><NuxtLink to="/download">下载中心</NuxtLink></p>
    </section>

    <section id="io" aria-labelledby="io-heading">
      <h2 id="io-heading">输入输出</h2>
      <p>
        由于系统采取无人工的机器评测，用户提交程序的输入输出格式必须与题目中描述的输入输出格式完全一致才能被判对，
        用户不能随意地输出多余无用的信息。另外，评测系统所接纳的程序应采用标准输入输出，
        一切企图读入服务器上其他文件的请求将被评测系统拒绝。
      </p>
      <p><strong>Leverage 判题方式：忽略行末空格和文末回车的全文比较。</strong></p>
      <p>除特别说明外，OJ 题目一律采用多组输入。程序应循环读入直至 EOF。</p>
      <h3>时间限制与内存限制</h3>
      <p>每道题目都有对应的<strong>时间限制（Time Limit）</strong>和<strong>内存限制（Memory Limit）</strong>，通常标注在题面顶部。</p>
      <ul>
        <li>时间限制：程序从开始运行到结束的最大允许时间（单位：毫秒 ms）。超出则返回 TLE。</li>
        <li>内存限制：程序运行过程中可使用的最大内存（单位：MB）。超出则返回 MLE。</li>
        <li>不同语言的限制以题目说明和实际评测环境为准。</li>
      </ul>
    </section>

    <section id="compile" aria-labelledby="compile-heading">
      <h2 id="compile-heading">编译选项</h2>
      <table aria-label="编译选项">
        <thead><tr><th scope="col">语言</th><th scope="col">编译 / 运行命令</th></tr></thead>
        <tbody>
          <tr v-for="lang in compileLangs" :key="lang.name"><td>{{ lang.name }}</td><td><code>{{ lang.cmd }}</code></td></tr>
        </tbody>
      </table>
      <p>WASM 选项的编译环境与限制请查看 <NuxtLink to="/help/wasm">C/C++ WASM 评测</NuxtLink>。</p>
    </section>

    <section id="judge" aria-labelledby="judge-heading">
      <h2 id="judge-heading">评测结果说明</h2>
      <table aria-label="评测结果说明">
        <thead><tr><th scope="col">缩写</th><th scope="col">全称</th><th scope="col">说明</th></tr></thead>
        <tbody>
          <tr v-for="result in judgeResults" :key="result.abbr"><td>{{ result.abbr }}</td><td>{{ result.full }}</td><td>{{ result.desc }}</td></tr>
        </tbody>
      </table>
    </section>

    <section id="languages" aria-labelledby="languages-heading">
      <h2 id="languages-heading">支持语言</h2>
      <p>目前在线评测系统支持以下语言：<strong>C、C++11、C++14、C++17、C++20、Python 3、JavaScript、TypeScript</strong>。用户在提交程序的时候必须选定使用哪一种语言。</p>
      <p>要注意不要使用一些编译器特有的扩展特性，这样会导致程序在用户自己的编译环境中能正确运行，但在评测系统上运行错误。</p>
      <p>此外还提供 C (WASM) 和 C++17 (WASM) 选项。语言选择会随提交一起发送；课程与竞赛题目还会携带对应上下文。</p>
    </section>

    <section id="developers" aria-labelledby="developers-heading">
      <h2 id="developers-heading">开发人员</h2>
      <div v-for="version in ['V1', 'V2', 'V3']" :key="version" class="developer-version">
        <h3>{{ version }}</h3><p>记录暂缺</p>
      </div>
      <div class="developer-version">
        <h3>V4</h3>
        <p>曹梦琦、陈靖宇、陈曦、陈轶军、戴中慧、杜洋涛、耿祥</p>
        <p>黄珂涵、李雷、李雪、刘晶晶、倪文卿、施志强</p>
        <p>王申豪、王旭峰、杨欣妍、张斌杰、张秋雨、张少华、朱孟庆</p>
        <p>（姓名拼音序）</p>
      </div>
      <div class="developer-version">
        <h3>V5</h3>
        <p><strong>Prime Designer：</strong>陈靖宇</p>
        <p><strong>Judge Core：</strong>陈靖宇 王徐旸 胡广 张兴洋</p>
        <p><strong>Front-end &amp; Back-end：</strong>陈靖宇</p>
        <p><strong>FeatureDev：</strong>胡广 张兴洋 谢万城</p>
        <p><strong>Botzone：</strong>张兴洋 施俣喆 庄子昂</p>
      </div>
      <div class="developer-version">
        <h3>V6 (neo)</h3>
        <p><strong>Full-stack Rewrite：</strong>Yuzhe / dylan_233</p>
        <p><strong>Stack：</strong>NestJS + Nuxt 4 + Naive UI + TypeORM + Bull + Redis</p>
      </div>
    </section>

    <section id="agreement" aria-labelledby="agreement-heading">
      <h2 id="agreement-heading">用户协议</h2>
      <p>完整版请查看 <NuxtLink to="/user-agreement">用户协议</NuxtLink></p>
      <ul>
        <li>遵守中华人民共和国宪法和法律法规</li>
        <li>不准开车</li>
        <li>不要做没水平的 DDoS / CC / 暴力提交</li>
        <li>禁止抄袭他人代码，违者封号</li>
      </ul>
    </section>
  </article>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'docs' })
useHead({ title: '帮助 — Leverage OJ' })

const compileLangs = [
  { name: 'C (C11)', cmd: 'gcc -o src src.c -O2 -static -std=gnu11 -lm' },
  { name: 'C++ (C++17)', cmd: 'g++ -o src src.cpp -O2 -static -std=gnu++17' },
  { name: 'Python 3', cmd: 'python3 src.py' },
  { name: 'JavaScript (Node.js)', cmd: 'node src.js' },
  { name: 'TypeScript', cmd: 'TypeScript 经编译后运行（具体版本以评测环境为准）' },
]

const judgeResults = [
  { abbr: 'AC', full: 'Accepted', desc: '答案正确' },
  { abbr: 'WA', full: 'Wrong Answer', desc: '答案错误' },
  { abbr: 'TLE', full: 'Time Limit Exceeded', desc: '程序运行时间超过限制' },
  { abbr: 'MLE', full: 'Memory Limit Exceeded', desc: '程序运行内存超过限制' },
  { abbr: 'RE', full: 'Runtime Error', desc: '程序产生运行时错误（段错误、除零等）' },
  { abbr: 'CE', full: 'Compile Error', desc: '程序编译错误' },
  { abbr: 'SE', full: 'System Error', desc: '评测系统内部错误，请联系管理员' },
  { abbr: 'OLE', full: 'Output Limit Exceeded', desc: '程序输出内容超过限制' },
  { abbr: 'PE', full: 'Presentation Error', desc: '输出格式错误（多余空格/换行）' },
  { abbr: 'Pending', full: 'Queuing / Judging', desc: '等待评测或评测中' },
]
</script>

<style scoped>
.help-links { padding-left: 22px; }
.help-links li { margin: 10px 0; }
.help-toc { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 16px 0; border-block: 1px solid var(--lv-color-border, #e5e7eb); }
section { scroll-margin-top: 140px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid var(--lv-color-border, #e5e7eb); padding: 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
code { white-space: pre-wrap; }
.developer-version { margin-top: 20px; }
.developer-version h3 { margin-bottom: 6px; }
</style>
