<template>
  <div class="help-page">
    <NH2 style="text-align: center">帮助</NH2>
    <NDivider />

    <NCard style="max-width: 860px; margin: 0 auto">
      <NTabs type="card" animated>
        <!-- 关于 OJ -->
        <NTabPane name="about" tab="关于 OJ">
          <NP>
            Leverage 是一个在线的评测系统。系统提供了题目供使用者练习编程能力与算法技巧。
            另外系统也有完善的比赛与作业系统供日常教学、比赛选拔所用。
            用户需要提交题目的由程序语言实现的解法，由评测系统进行自动地评测之后给出评测的结果。
          </NP>
          <NP>
            <NButton text tag="a" href="/download" type="primary">下载中心</NButton>
          </NP>
        </NTabPane>

        <!-- 输入输出 -->
        <NTabPane name="io" tab="输入输出">
          <NP>
            由于系统采取无人工的机器评测，用户提交程序的输入输出格式必须与题目中描述的输入输出格式完全一致才能被判对，
            用户不能随意地输出多余无用的信息。另外，评测系统所接纳的程序应采用标准输入输出，
            一切企图读入服务器上其他文件的请求将被评测系统拒绝。
          </NP>
          <NP>
            <strong>Leverage 判题方式：忽略行末空格和文末回车的全文比较。</strong>
          </NP>
          <NP>
            除特别说明外，OJ 题目一律采用多组输入。程序应循环读入直至 EOF。
          </NP>

          <NDivider />
          <NH4>时间限制与内存限制</NH4>
          <NP>
            每道题目都有对应的<strong>时间限制（Time Limit）</strong>和<strong>内存限制（Memory Limit）</strong>，
            通常标注在题面顶部。
          </NP>
          <NUl>
            <NLi>时间限制：程序从开始运行到结束的最大允许时间（单位：毫秒 ms）。超出则返回 TLE。</NLi>
            <NLi>内存限制：程序运行过程中可使用的最大内存（单位：MB）。超出则返回 MLE。</NLi>
            <NLi>不同语言的限制以题目说明和实际评测环境为准。</NLi>
          </NUl>
        </NTabPane>

        <!-- 编译选项 -->
        <NTabPane name="compile" tab="编译选项">
          <NTable size="small" :bordered="true">
            <thead>
              <tr>
                <th>语言</th>
                <th>编译 / 运行命令</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lang in compileLangs" :key="lang.name">
                <td><NTag size="small">{{ lang.name }}</NTag></td>
                <td><NCode :code="lang.cmd" language="bash" /></td>
              </tr>
            </tbody>
          </NTable>
        </NTabPane>

        <!-- 评测结果说明 -->
        <NTabPane name="judge" tab="评测结果说明">
          <NTable size="small" :bordered="true">
            <thead>
              <tr>
                <th>缩写</th>
                <th>全称</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in judgeResults" :key="r.abbr">
                <td><NTag :type="r.type as any" size="small">{{ r.abbr }}</NTag></td>
                <td>{{ r.full }}</td>
                <td>{{ r.desc }}</td>
              </tr>
            </tbody>
          </NTable>
        </NTabPane>

        <!-- 使用语言 -->
        <NTabPane name="language" tab="支持语言">
          <NP>
            目前在线评测系统支持以下语言：
            <strong>C、C++11、C++14、C++17、C++20、Python 3、JavaScript、TypeScript</strong>。
            用户在提交程序的时候必须选定使用哪一种语言。
          </NP>
          <NP>
            要注意不要使用一些编译器特有的扩展特性，这样会导致程序在用户自己的编译环境中能正确运行，但在评测系统上运行错误。
          </NP>
        </NTabPane>

        <!-- 开发人员 -->
        <NTabPane name="developers" tab="开发人员">
          <NTabs type="segment" size="small" style="margin-bottom: 12px">
            <NTabPane name="v1" tab="V1">
              <NP depth="3">记录暂缺</NP>
            </NTabPane>
            <NTabPane name="v2" tab="V2">
              <NP depth="3">记录暂缺</NP>
            </NTabPane>
            <NTabPane name="v3" tab="V3">
              <NP depth="3">记录暂缺</NP>
            </NTabPane>
            <NTabPane name="v4" tab="V4">
              <NP>曹梦琦、陈靖宇、陈曦、陈轶军、戴中慧、杜洋涛、耿祥</NP>
              <NP>黄珂涵、李雷、李雪、刘晶晶、倪文卿、施志强</NP>
              <NP>王申豪、王旭峰、杨欣妍、张斌杰、张秋雨、张少华、朱孟庆</NP>
              <NP depth="3">（姓名拼音序）</NP>
            </NTabPane>
            <NTabPane name="v5" tab="V5">
              <NP><strong>Prime Designer：</strong>陈靖宇</NP>
              <NP><strong>Judge Core：</strong>陈靖宇 王徐旸 胡广 张兴洋</NP>
              <NP><strong>Front-end &amp; Back-end：</strong>陈靖宇</NP>
              <NP><strong>FeatureDev：</strong>胡广 张兴洋 谢万城</NP>
              <NP><strong>Botzone：</strong>张兴洋 施俣喆 庄子昂</NP>
            </NTabPane>
            <NTabPane name="v6" tab="V6 (neo)">
              <NP><strong>Full-stack Rewrite：</strong>Yuzhe / dylan_233</NP>
              <NP><strong>Stack：</strong>NestJS + Nuxt 4 + Naive UI + TypeORM + Bull + Redis</NP>
            </NTabPane>
          </NTabs>
        </NTabPane>

        <!-- 用户协议摘要 -->
        <NTabPane name="agreement" tab="用户协议">
          <NP>完整版请查看 <NButton text tag="a" href="/user-agreement" type="primary">用户协议</NButton></NP>
          <NUl>
            <NLi>遵守中华人民共和国宪法和法律法规</NLi>
            <NLi>不准开车</NLi>
            <NLi>不要做没水平的 DDoS / CC / 暴力提交</NLi>
            <NLi>禁止抄袭他人代码，违者封号</NLi>
          </NUl>
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const compileLangs = [
  { name: 'C (C11)', cmd: 'gcc -o src src.c -O2 -static -std=gnu11 -lm' },
  { name: 'C++ (C++17)', cmd: 'g++ -o src src.cpp -O2 -static -std=gnu++17' },
  { name: 'Python 3', cmd: 'python3 src.py' },
  { name: 'JavaScript (Node.js)', cmd: 'node src.js' },
  { name: 'TypeScript', cmd: 'TypeScript 经编译后运行（具体版本以评测环境为准）' },
]

const judgeResults = [
  { abbr: 'AC', full: 'Accepted', desc: '答案正确', type: 'success' },
  { abbr: 'WA', full: 'Wrong Answer', desc: '答案错误', type: 'error' },
  { abbr: 'TLE', full: 'Time Limit Exceeded', desc: '程序运行时间超过限制', type: 'warning' },
  { abbr: 'MLE', full: 'Memory Limit Exceeded', desc: '程序运行内存超过限制', type: 'warning' },
  { abbr: 'RE', full: 'Runtime Error', desc: '程序产生运行时错误（段错误、除零等）', type: 'error' },
  { abbr: 'CE', full: 'Compile Error', desc: '程序编译错误', type: 'error' },
  { abbr: 'SE', full: 'System Error', desc: '评测系统内部错误，请联系管理员', type: 'default' },
  { abbr: 'OLE', full: 'Output Limit Exceeded', desc: '程序输出内容超过限制', type: 'warning' },
  { abbr: 'PE', full: 'Presentation Error', desc: '输出格式错误（多余空格/换行）', type: 'warning' },
  { abbr: 'Pending', full: 'Queuing / Judging', desc: '等待评测或评测中', type: 'info' },
]

useHead({ title: '帮助 — Leverage OJ' })
</script>

<style scoped>
.help-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}
</style>
