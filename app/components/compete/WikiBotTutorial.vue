<template>
  <div class="bot-tutorial">
    <!-- Step 0: 了解 Bot 输入 -->
    <div v-if="step === 0">
      <div class="step-intro">
        <h3>第一步：了解 Bot 是如何工作的</h3>
        <p class="intro-text">
          CodeBot 每轮是一个新进程：按游戏约定从 stdin 读取当前 command，在 stdout 写一行响应并 flush。
          command 可以是原始文本或 JSON；「最接近 5」示例 使用 JSON command。
        </p>
      </div>

      <div class="concept-diagram">
        <div class="diagram-box judge-box">⚖️ 裁判</div>
        <div class="diagram-arrows">
          <div class="arrow-row">
            <span class="arrow-label stdin">局面 JSON → stdin</span>
            <span class="arrow-right">→</span>
          </div>
          <div class="arrow-row">
            <span class="arrow-left">←</span>
            <span class="arrow-label stdout">stdout → 你的移动</span>
          </div>
        </div>
        <div class="diagram-box bot-box">🤖 你的 Bot</div>
      </div>

      <NAlert type="info" :show-icon="false" style="margin:12px 0;font-size:13px">
        <strong>关键规则：</strong>
        <ul style="margin:6px 0 0 16px;line-height:2">
          <li>每轮从 stdin 读取游戏指定的当前 command（示例为 JSON）</li>
          <li>向 stdout 写一行符合游戏约定的响应并 flush</li>
          <li>Bot 进程每轮重启；需要的历史由裁判写进当前 command</li>
          <li>可以写 stderr 输出调试信息（不影响对局）</li>
        </ul>
      </NAlert>

      <div class="example-section">
        <h4>以 「最接近 5」示例 为例：</h4>
        <p style="font-size:13px;color:#555;margin-bottom:8px">
          本例 judge 将 JSON command <code>{"target":5}</code> 传给 Bot；Bot 按游戏约定输出 JSON move。
        </p>
        <WikiCodeBlock
          :code="closestInputExample"
          lang="json"
          explanation="这是本示例游戏的当前 command，不是所有游戏通用的外层包装"
        />
        <p style="font-size:13px;color:#555;margin-bottom:8px">这个确定性示例 的预期回应是 move=5：</p>
        <WikiCodeBlock :code="closestOutputExample" lang="json" explanation="「最接近 5」示例 将此 JSON 响应解析为 move 5" />
      </div>

    </div>

    <!-- Step 1: 第一个 Bot -->
    <div v-if="step === 1">
      <div class="step-intro">
        <h3>第二步：写你的第一个 Bot</h3>
        <p class="intro-text">
          先从可信的确定性示例开始：读取 command 中的 target，并原样作为 move 返回。
        </p>
      </div>

      <WikiCodeBlock
        :code="simpleBotPy"
        lang="python"
        :tryable="true"
        explanation="「最接近 5」示例 Bot：读取 target=5 并输出 move=5；每轮 flush stdout。"
        @try-it="$emit('go-playground', { tab: 'bot', code: $event, lang: 'python' })"
      />

      <NDivider style="margin:16px 0">用其他语言？</NDivider>

      <NCollapse>
        <NCollapseItem title="C++ 版本" name="cpp">
          <WikiCodeBlock
            :code="simpleBotCpp"
            lang="cpp"
            :tryable="true"
            @try-it="$emit('go-playground', { tab: 'bot', code: $event, lang: 'cpp' })"
          />
        </NCollapseItem>
      </NCollapse>

      <WikiTryIt
        :initial-code="simpleBotPy"
        initial-lang="python"
        :game-id="defaultGameId"
        :opponent-gamer-id="defaultOpponentId"
        hint="调整输入解析或响应方式，比较各自的测试效果"
        @try-code="(c, l) => $emit('go-playground', { tab: 'bot', code: c, lang: l })"
      />
    </div>

    <!-- Step 2: 了解输出格式 -->
    <div v-if="step === 2">
      <div class="step-intro">
        <h3>第三步：带调试信息的 JSON 输出</h3>
        <p class="intro-text">
          简单输出只能打印数字/字符串。如果你想要更多控制，可以输出 JSON 格式，
          加入 <code>debug</code> 字段——这些信息会出现在时序图里，帮你分析 Bot 的思考过程。
        </p>
      </div>

      <div class="format-compare">
        <div class="format-col">
          <div class="format-label">💬 简单输出</div>
          <WikiCodeBlock :code="simpleOutput" lang="text" explanation="适合快速写，不能以 { 开头" />
        </div>
        <div class="format-divider">vs</div>
        <div class="format-col">
          <div class="format-label">📦 JSON 输出（推荐）</div>
          <WikiCodeBlock :code="jsonOutput" lang="json" explanation="move 是你的移动，debug 在时序图显示" />
        </div>
      </div>

      <NAlert type="warning" :show-icon="false" style="margin:12px 0;font-size:12px">
        ⚠️ 简单输出<strong>不能以 { 开头</strong>。如果你的移动恰好是 JSON 字符串，请改用 JSON 输出格式。
      </NAlert>

      <h4 style="margin-top:16px">进阶 CodeBot：只使用本轮 command</h4>
      <WikiCodeBlock
        :code="smartBotPy"
        lang="python"
        :tryable="true"
        explanation="每轮进程独立：只根据 judge 本轮给出的 command 做决定，不依赖未传入的历史或全局变量。"
        @try-it="$emit('go-playground', { tab: 'bot', code: $event, lang: 'python' })"
      />

      <WikiTryIt
        :initial-code="smartBotPy"
        initial-lang="python"
        :game-id="defaultGameId"
        :opponent-gamer-id="defaultOpponentId"
        hint="尝试从当前 command 中读取策略所需字段，不依赖未传入的历史"
        @try-code="(c, l) => $emit('go-playground', { tab: 'bot', code: c, lang: l })"
      />
    </div>

    <!-- Step 3: 读入/输出规范 -->
    <div v-if="step === 3">
      <div class="step-intro">
        <h3>第四步：理解 BotInput 格式</h3>
        <p class="intro-text">
          不同游戏的 BotInput 格式不同。这是裁判定义的——裁判给你什么，你就收什么。
          在 CodeBot 中 stdin 是裁判本轮给该玩家的 command；每轮是新进程。需要历史时，裁判必须把它放进下一轮 command。裁判自身的输入/输出协议不同，见下方说明。
        </p>
      </div>

      <h4>CodeBot 本轮命令示例</h4>
      <WikiCodeBlock :code="closestInputExample" lang="json" explanation="judge 通过 commands[player] 将此 command 作为该 Bot 的 stdin" />
      <NAlert type="warning" :show-icon="false" style="margin:12px 0;font-size:13px">
        <strong>不要混淆协议：</strong> judge 每轮读 <code>{round,responses}</code> 并输出 <code>{commands,display,verdict,scores?}</code>；Bot 每轮只读自己的 command。人类/外部 webhook 的 GameState 才可能带 requests/responses 包装，它不是默认 CodeBot stdin。
      </NAlert>
      <WikiCodeBlock :code="judgeProtocolExample" lang="json" explanation="这是裁判进程协议，不是 Bot stdin；commands 中对应玩家的值会传给该 Bot" />

      <h4 style="margin-top:16px">游戏特定协议查询：</h4>
      <NSelect
        :value="wikiGameId"
        :options="[{label:'选择游戏...',value:null},...gameOptions]"
        placeholder="选择游戏查看协议"
        clearable
        style="max-width:300px"
        @update:value="wikiGameId = $event"
      />
      <div v-if="wikiGameId" style="margin-top:10px">
        <div v-if="selectedGame" class="game-proto-card">
          <div class="proto-title">{{ selectedGame.name || selectedGame.title }} · 输入协议</div>
          <div class="proto-desc">{{ selectedGame.description || '暂无协议说明，请联系游戏作者。' }}</div>
        </div>
      </div>
    </div>

    <!-- Step 4: 发布 -->
    <div v-if="step === 4">
      <div class="step-intro">
        <h3>第五步：测试并发布你的 Bot</h3>
        <p class="intro-text">
          在 Playground 测试完成后可选择发布。测试结果不会改变 ELO；只有符合资格的评级对局影响 ELO。
          自动匹配可能由管理员触发，发布本身不保证自动加入排行榜或开始对战。
        </p>
      </div>

      <div class="publish-steps">
        <div class="pub-step">
          <div class="pub-num">1</div>
          <div>
            <strong>在 Playground → Bot 测试 Tab 运行测试</strong>
            <p>选择游戏和对手，贴上代码，点「运行测试对局」。时序图会展示每轮通信详情。</p>
          </div>
        </div>
        <div class="pub-step">
          <div class="pub-num">2</div>
          <div>
            <strong>查看时序图，分析 Bug</strong>
            <p>时序图里可以看每轮你的 debug 输出和 stderr，快速定位问题。</p>
          </div>
        </div>
        <div class="pub-step">
          <div class="pub-num">3</div>
          <div>
            <strong>点「发布为 Bot」</strong>
            <p>给 Bot 起个名字，选择是否开源，一键提交。发布后可以在「我的 Bot」页面管理。</p>
          </div>
        </div>
        <div class="pub-step">
          <div class="pub-num">4</div>
          <div>
            <strong>了解评级与自动匹配</strong>
            <p>Playground 测试不改变 ELO。只有符合资格的评级对局更新 ELO；自动匹配可能由管理员触发，发布不保证自动加入排行榜或对战。</p>
          </div>
        </div>
      </div>

      <div class="final-cta">
        <NButton type="primary" size="large" @click="$emit('go-playground', { tab: 'bot' })">
          🤖 去 Playground 写第一个 Bot →
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NButton, NAlert, NDivider, NCollapse, NCollapseItem, NSelect } from 'naive-ui'
import WikiCodeBlock from './WikiCodeBlock.vue'
import WikiTryIt from './WikiTryIt.vue'

const props = defineProps<{
  step: number
  games: any[]
  defaultGameId?: number | null
  lookupOpponent?: boolean
}>()

defineEmits<{
  'next': []
  'go-playground': [{ tab: string; code?: string; lang?: string }]
}>()

const wikiGameId = ref<number | null>(null)
const gameOptions = computed(() => props.games.map(g => ({ label: g.name || g.title, value: g.id })))
const selectedGame = computed(() => props.games.find(g => g.id === wikiGameId.value))

const competeApi = useCompeteApi()
const defaultGameId = computed(() => props.defaultGameId ?? props.games.find(g => g.title === '猜数字')?.id ?? null)
const defaultOpponentId = ref<number | null>(null)
watch(defaultGameId, async (gameId, _previous, onCleanup) => {
  defaultOpponentId.value = null
  if (!gameId || props.lookupOpponent === false) return
  let cancelled = false
  onCleanup(() => { cancelled = true })
  try {
    const { data } = await competeApi.listGamers({ gameId, page: 1, perPage: 100 })
    if (!cancelled) defaultOpponentId.value = data.items.find(g => g.type === 'code' && !g.disabled)?.id ?? null
  }
  catch { /* No available opponent: keep the Playground fallback. */ }
}, { immediate: true })

// Code examples
const closestInputExample = `{"target":5}`
const closestOutputExample = `{"move":5}`
const judgeProtocolExample = `{"round":1,"responses":{}} → {"commands":{"0":{"target":5},"1":{"target":5}},"display":{},"verdict":"continue"}`

const simpleBotPy = `import json
import sys

for line in sys.stdin:
    command = json.loads(line)
    move = command["target"]  # 「最接近 5」示例 sends {"target":5}
    print(json.dumps({"move": move}), flush=True)  # emits {"move":5}`

const simpleBotCpp = `#include <iostream>
#include <string>
#include <regex>

int main() {
    std::string line;
    while (std::getline(std::cin, line)) {
        std::smatch match;
        if (!std::regex_search(line, match, std::regex(R"REGEX("target"[[:space:]]*:[[:space:]]*(-?[0-9]+))REGEX"))) return 1;
        std::cout << R"JSON({"move":)JSON" << match[1] << R"JSON(})JSON" << std::endl;
    }
}`


const simpleOutput = `5`

const jsonOutput = `{"move": 5, "debug": "using current command"}`

const smartBotPy = `import json
import sys

for line in sys.stdin:
    command = json.loads(line)
    # This process is fresh every turn: use only data included in command.
    move = command["target"]
    print(json.dumps({"move": move, "debug": "using current command"}), flush=True)`



</script>

<style scoped>
.bot-tutorial { max-width: 800px; }
.step-intro { margin-bottom: 16px; }
.step-intro h3 { font-size: 18px; margin-bottom: 8px; }
.intro-text { font-size: 14px; color: #444; line-height: 1.7; }
.concept-diagram {
  display: flex; align-items: center; justify-content: center;
  gap: 0; padding: 20px; background: #f9f9fb; border-radius: 10px; margin: 14px 0;
}
.diagram-box {
  padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 15px;
}
.judge-box { background: #f0e6ff; color: #722ed1; }
.bot-box { background: #e6f4ff; color: #2080f0; }
.diagram-arrows { display: flex; flex-direction: column; gap: 6px; padding: 0 16px; align-items: center; }
.arrow-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.arrow-label { font-size: 11px; font-weight: 600; }
.stdin { color: #722ed1; }
.stdout { color: #2080f0; }
.arrow-right, .arrow-left { font-size: 16px; color: #888; }
.example-section { margin-top: 16px; }
.example-section h4 { font-size: 14px; margin-bottom: 8px; }
.next-hint { margin-top: 20px; display: flex; justify-content: flex-end; }
.format-compare { display: flex; align-items: flex-start; gap: 12px; margin: 12px 0; }
.format-col { flex: 1; }
.format-label { font-size: 12px; font-weight: 700; color: #666; margin-bottom: 6px; }
.format-divider { padding-top: 40px; font-weight: 700; color: #888; flex-shrink: 0; }
.game-proto-card {
  padding: 12px; background: #f6f8fa; border-radius: 8px; border: 1px solid #e0e0e6;
}
.proto-title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
.proto-desc { font-size: 12px; color: #555; line-height: 1.7; white-space: pre-wrap; }
.publish-steps { display: flex; flex-direction: column; gap: 14px; margin: 14px 0; }
.pub-step { display: flex; gap: 12px; align-items: flex-start; }
.pub-num {
  width: 28px; height: 28px; border-radius: 50%; background: #2080f0; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.pub-step strong { font-size: 14px; display: block; margin-bottom: 4px; }
.pub-step p { font-size: 12px; color: #666; margin: 0; line-height: 1.6; }
.final-cta { text-align: center; padding: 20px 0; }
</style>
