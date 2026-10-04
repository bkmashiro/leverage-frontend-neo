<template>
  <div class="playground-page">
    <NAlert v-if="tutorialMode" type="info" :show-icon="false" class="tutorial-status">
      <NSpace align="center" justify="space-between">
        <span><strong>教程模式</strong> · 示例游戏练习，不影响 ELO；发布已禁用</span>
        <NButton size="tiny" text @click="exitTutorialMode">退出</NButton>
      </NSpace>
    </NAlert>

    <div class="workbench-heading">
      <span class="workbench-context">Bot 测试</span>
      <NSpace>
        <NButton v-if="sourceGamerId || publishedGamerId" @click="navigateTo(`/compete/gamer/${publishedGamerId || sourceGamerId}`)">返回 Bot 编辑</NButton>
        <NButton secondary @click="developerTools = !developerTools; handleTabChange(developerTools ? 'judge' : 'bot')">{{ developerTools ? '返回 Bot 测试' : '游戏开发工具' }}</NButton>
      </NSpace>
    </div>
    <NText v-if="developerTools" depth="3">裁判、组合调试与渲染器面向游戏作者。只编写 Bot 时使用 Bot 工作台即可。</NText>
    <NTabs :value="activeTab" type="card" animated @update:value="handleTabChange">

      <!-- ══════════════════════════════════════
           Tab 1: Bot 测试
      ══════════════════════════════════════ -->
      <NTabPane name="bot" tab="🤖 Bot 测试">
        <NGrid :cols="12" :x-gap="16" :y-gap="12" item-responsive responsive="screen" style="margin-top:12px">

          <!-- 配置面板 -->
          <NGridItem span="12 m:3">
            <NSpace vertical :size="12">
              <NAlert v-if="botError" type="warning" :show-icon="false">{{ botError }} <NButton text size="tiny" @click="loadBotContext(bot.gameId, sourceGamerId)">重新加载</NButton></NAlert>
              <NCard title="游戏 & 对手" size="small">
                <NSpace vertical :size="8">
                  <NSelect :value="bot.gameId" :options="gameOptions" placeholder="选择游戏..." filterable :disabled="tutorialMode" @update:value="onBotGameChange" />
                  <NSelect v-model:value="bot.opponentGamerId" :options="opponentOptions" placeholder="选择对手..." filterable :disabled="!bot.gameId" :loading="opponentsLoading" />
                </NSpace>
              </NCard>

              <NButton type="primary" block :loading="bot.running"
                :disabled="!bot.gameId || !bot.opponentGamerId || !botCode.trim() || opponentsLoading || games.find(g => g.id === bot.gameId)?.gamerQuantity !== 2"
                @click="runBotTest">
                ▶ 运行测试对局
              </NButton>

              <NButton v-if="bot.matchId" block secondary
                @click="navigateTo(`/compete/matches/${bot.matchId}`)">
                查看完整对局 →
              </NButton>

              <NButton v-if="bot.matchId && bot.status === 2 && !tutorialMode && botCode === botCodeAtTest" block type="success" secondary
                @click="publishBotModal = true">
                🚀 发布为 Bot
              </NButton>
            </NSpace>
          </NGridItem>

          <!-- 代码编辑器 -->
          <NGridItem span="12 m:9">
            <NCard size="small">
              <template #header>
                <NSpace align="center" justify="space-between">
                  <span>代码编辑器</span>
                  <NSpace>
                    <NSelect v-model:value="bot.language" :options="BOTZONE_LANGUAGE_OPTIONS" size="small" style="width:130px" @update:value="onBotLangChange" />
                    <NButton size="small" text @click="insertBotTemplate">📋 插入模板</NButton>
                  </NSpace>
                </NSpace>
              </template>
              <CompeteCodeDraftStatus :dirty="botDraft.dirty.value" :restored="botDraft.restored.value" :storage-error="botDraft.storageError.value" @discard="botDraft.discard" />
              <CodeEditor v-model="botCode" :language="botEditorLang" height="400px" :readonly="!bot.gameId || opponentsLoading" />
            </NCard>
          </NGridItem>

          <!-- 测试结果 -->
          <NGridItem v-if="bot.matchId" ref="botResultRegion" class="bot-result-region" :span="12">
            <NCard size="small">
              <template #header>
                <NSpace align="center">
                  <span>📋 测试日志</span>
                  <NTag :type="matchStatusType(bot.status)" size="small">{{ matchStatusLabel(bot.status) }}</NTag>
                  <NTag v-if="bot.status === 2 && botCodeAtTest && botCode !== botCodeAtTest" type="warning" size="small">⚠️ 过时的</NTag>
                  <NSpin v-if="bot.status === 1" size="small" />
                </NSpace>
              </template>
              <MatchDiagnostics :result="bot.result" :bot-names="bot.botNames" />
              <MatchTimeline
                v-if="bot.timeline.length > 0"
                :rounds="bot.timeline"
                :final-result="bot.finalResult"
                :bot-names="bot.botNames"
              />
              <NEmpty v-else-if="bot.status === 1" description="对局运行中..." style="padding:24px 0" />
            </NCard>
          </NGridItem>
        </NGrid>
      </NTabPane>

      <!-- ══════════════════════════════════════
           Tab 2: 裁判测试
      ══════════════════════════════════════ -->
      <NTabPane v-if="developerTools" name="judge" tab="⚖️ 裁判测试">
        <NGrid :cols="12" :x-gap="16" :y-gap="12" item-responsive responsive="screen" style="margin-top:12px">

          <!-- 配置 -->
          <NGridItem span="12 m:3">
            <NSpace vertical :size="12">
              <NCard title="游戏 & Bots" size="small">
                <NSpace vertical :size="8">
                  <NSelect :value="judge.gameId" clearable :options="gameOptions" placeholder="使用哪个游戏的Bots..." filterable :disabled="tutorialMode && tutorialActiveTab === 'judge'" @update:value="onJudgeGameChange" />
                  <NSelect v-model:value="judge.bot0Id" :options="judgeOpponentOptions" placeholder="Bot 0 (先手)..." :loading="judgeOpponentsLoading" />
                  <NSelect v-model:value="judge.bot1Id" :options="judgeOpponentOptions" placeholder="Bot 1 (后手)..." :loading="judgeOpponentsLoading" />
                </NSpace>
              </NCard>
              <NButton type="primary" block :loading="judge.running"
                :disabled="!judgeCode.trim() || !judge.bot0Id || !judge.bot1Id"
                @click="runJudgeTest">
                ▶ 测试裁判
              </NButton>
              <NAlert type="info" :show-icon="false" style="font-size:12px">
                裁判程序将替代游戏内置裁判运行，不影响 ELO
              </NAlert>
            </NSpace>
          </NGridItem>

          <!-- 裁判代码 -->
          <NGridItem span="12 m:9">
            <NCard size="small">
              <template #header>
                <NSpace align="center" justify="space-between">
                  <span>裁判代码</span>
                  <NSpace>
                    <NSelect v-model:value="judge.language" :options="BOTZONE_LANGUAGE_OPTIONS" size="small" style="width:130px" @update:value="onJudgeLangChange" />
                    <NButton size="small" text :disabled="botzoneLanguage(judge.language) !== 'python'" @click="insertJudgeTemplate">插入裁判模板 · Python</NButton>
                  </NSpace>
                </NSpace>
              </template>
              <CompeteCodeDraftStatus :dirty="judgeDraft.dirty.value" :restored="judgeDraft.restored.value" :storage-error="judgeDraft.storageError.value" @discard="judgeDraft.discard" />
              <p v-if="botzoneLanguage(judge.language) !== 'python'" class="judge-template-hint">裁判示例模板目前仅提供 Python；其他语言可在编辑器中手动编写。</p>
              <CodeEditor v-model="judgeCode" :language="judgeEditorLang" height="400px" />
            </NCard>
          </NGridItem>

          <!-- 结果 -->
          <NGridItem v-if="judge.matchId" :span="12">
            <NCard size="small">
              <template #header>
                <NSpace align="center">
                  <span>⚖️ 裁判测试日志</span>
                  <NTag :type="matchStatusType(judge.status)" size="small">{{ matchStatusLabel(judge.status) }}</NTag>
                  <NTag v-if="judge.status === 2 && judgeCodeAtTest && judgeCode !== judgeCodeAtTest" type="warning" size="small">⚠️ 过时的</NTag>
                  <NSpin v-if="judge.status === 1" size="small" />
                </NSpace>
              </template>
              <MatchDiagnostics :result="judge.result" :bot-names="judge.botNames" />
              <MatchTimeline
                v-if="judge.timeline.length > 0"
                :rounds="judge.timeline"
                :final-result="judge.finalResult"
                judger-name="我的裁判"
                :bot-names="judge.botNames"
              />
            </NCard>
          </NGridItem>
        </NGrid>
      </NTabPane>

      <!-- ══════════════════════════════════════
           Tab 3: 组合调试器
      ══════════════════════════════════════ -->
      <NTabPane v-if="developerTools" name="combo" tab="🔬 组合调试">
        <CompeteCodeDraftStatus :dirty="comboDrafts.some(d => d.dirty.value)" :restored="comboDrafts.some(d => d.restored.value)" :storage-error="comboDrafts.some(d => d.storageError.value)" @discard="comboDrafts.forEach(d => d.discard())" />
        <div style="margin-top:12px">
          <NAlert type="info" :show-icon="false" style="margin-bottom:16px;font-size:13px">
            将裁判 + 两个 Bot 组合运行，查看完整通信时序图。可自己编写或引入已有程序。
          </NAlert>

          <!-- 三个 Slot -->
          <NGrid cols="1 m:3" item-responsive responsive="screen" :x-gap="16" style="margin-bottom:16px">
            <NGridItem>
              <ProgramSlot
                label="裁判"
                icon="⚖️"
                :model-value="combo.judgeCode"
                :lang="combo.judgeLang"
                :game-id="combo.gameId"
                slot-type="judge"
                @update:model-value="combo.judgeCode = $event"
                @update:lang="combo.judgeLang = $event"
                @update:imported-id="combo.importedJudgeId = $event"
              />
            </NGridItem>
            <NGridItem>
              <ProgramSlot
                label="Bot 0 (先手)"
                icon="🔵"
                :model-value="combo.bot0Code"
                :lang="combo.bot0Lang"
                :game-id="combo.gameId"
                slot-type="bot"
                @update:model-value="combo.bot0Code = $event"
                @update:lang="combo.bot0Lang = $event"
                @update:imported-id="combo.importedBot0Id = $event"
              />
            </NGridItem>
            <NGridItem>
              <ProgramSlot
                label="Bot 1 (后手)"
                icon="🔴"
                :model-value="combo.bot1Code"
                :lang="combo.bot1Lang"
                :game-id="combo.gameId"
                slot-type="bot"
                @update:model-value="combo.bot1Code = $event"
                @update:lang="combo.bot1Lang = $event"
                @update:imported-id="combo.importedBot1Id = $event"
              />
            </NGridItem>
          </NGrid>

          <!-- 运行控制 -->
          <NCard size="small" style="margin-bottom:16px">
            <NSpace align="center" justify="space-between">
              <NSelect :value="combo.gameId" clearable @update:value="setComboGame" :options="gameOptions" placeholder="参考游戏（用于搜索Bot）..." filterable style="width:280px" />
              <NSpace>
                <NButton
                  type="primary"
                  :loading="combo.running"
                  :disabled="comboNotReady"
                  @click="runCombo"
                >
                  ▶ 运行组合调试
                </NButton>
                <NButton v-if="combo.matchId" @click="navigateTo(`/compete/matches/${combo.matchId}`)">
                  查看原始对局
                </NButton>
              </NSpace>
            </NSpace>
            <NText v-if="comboNotReady" depth="3" style="font-size:12px;display:block;margin-top:6px">
              ⚠️ 裁判和两个 Bot 都需要配置（编写或引入）
            </NText>
          </NCard>

          <!-- 时序图 -->
          <NCard v-if="combo.matchId" title="📡 通信时序图" size="small">
            <template #header-extra>
              <NSpace align="center">
                <NTag :type="matchStatusType(combo.status)" size="small">{{ matchStatusLabel(combo.status) }}</NTag>
                <NSpin v-if="combo.status === 1" size="small" />
              </NSpace>
            </template>
            <MatchDiagnostics :result="combo.result" :bot-names="{ '0': 'Bot 0', '1': 'Bot 1' }" />
            <MatchTimeline
              v-if="combo.timeline.length > 0"
              :rounds="combo.timeline"
              :final-result="combo.finalResult"
              judger-name="自定义裁判"
              :bot-names="{ '0': 'Bot 0', '1': 'Bot 1' }"
            />
            <NEmpty v-else :description="combo.status === 3 ? '评测失败，未产生回合日志' : '等待对局完成...'" style="padding:32px 0" />
          </NCard>
        </div>
      </NTabPane>

      <!-- ══════════════════════════════════════
           Tab 4: 渲染器测试
      ══════════════════════════════════════ -->
      <NTabPane v-if="developerTools" name="renderer" tab="🎨 渲染器">
        <CompeteCodeDraftStatus :dirty="rendererDraft.dirty.value" :restored="rendererDraft.restored.value" :storage-error="rendererDraft.storageError.value" @discard="rendererDraft.discard" />
        <NGrid cols="1 m:2" item-responsive responsive="screen" :x-gap="16" :y-gap="12" style="margin-top:12px">
          <NGridItem>
            <NCard size="small">
              <template #header>
                <NSpace align="center" justify="space-between">
                  <span>渲染器 HTML</span>
                  <NButton size="small" text @click="insertRendererTemplate">最小模板</NButton>
                </NSpace>
              </template>
              <CodeEditor v-model="rendererHtml" language="html" height="420px" />
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard size="small">
              <template #header>
                <NSpace align="center" justify="space-between">
                  <span>实时预览</span>
                  <NSpace>
                    <NButton size="small" @click="sendGameLog">发送 gameLog</NButton>
                    <NButton size="small" @click="sendGameState">发送 gameState</NButton>
                    <NButton size="small" type="primary" @click="reloadRenderer">刷新</NButton>
                  </NSpace>
                </NSpace>
              </template>
              <div style="border:1px solid #e0e0e6;border-radius:6px;overflow:hidden">
                <iframe ref="rendererRef" :srcdoc="rendererPreview" sandbox="allow-scripts"
                  style="width:100%;height:420px;border:none" />
              </div>
            </NCard>
          </NGridItem>

          <!-- Test data -->
          <NGridItem span="1 m:2">
            <NCard title="🧪 测试数据注入" size="small">
              <NGrid cols="1 m:2" item-responsive responsive="screen" :x-gap="12">
                <NGridItem>
                  <NFormItem label="gameLog JSON" style="margin-bottom:0">
                    <NInput v-model:value="testGameLog" type="textarea" :rows="5" style="font-family:monospace;font-size:12px" />
                  </NFormItem>
                </NGridItem>
                <NGridItem>
                  <NFormItem label="gameState / BotInput" style="margin-bottom:0">
                    <NInput v-model:value="testGameState" type="textarea" :rows="5" style="font-family:monospace;font-size:12px" />
                  </NFormItem>
                </NGridItem>
              </NGrid>
              <div style="margin-top:8px">
                <NText depth="3" style="font-size:12px">
                  iframe 最后消息：<code>{{ lastIframeMsg || '—' }}</code>
                </NText>
              </div>
            </NCard>
          </NGridItem>

          <!-- Publish -->
          <NGridItem span="1 m:2">
            <NCard title="发布渲染器到游戏" size="small">
              <NText v-if="!authStore.isAdmin" depth="3">本地预览不受限；发布到游戏需要管理员权限。</NText>
              <NSpace align="center">
                <NSelect :value="rendererTargetGame" clearable @update:value="setRendererGame" :options="gameOptions" placeholder="目标游戏..." style="width:260px" />
                <NButton type="success" :loading="publishingRenderer" :disabled="!authStore.isAdmin || !rendererTargetGame || !rendererHtml || tutorialMode" @click="publishRenderer">
                  🚀 发布
                </NButton>
              </NSpace>
            </NCard>
          </NGridItem>
        </NGrid>
      </NTabPane>

      <!-- ══════════════════════════════════════
           Tab 5: Wiki（交互式教程）
      ══════════════════════════════════════ -->
      <NTabPane name="wiki" tab="📖 教程">
        <div style="margin-top:12px">
          <WikiContent
            :games="games"
            :default-game-id="bot.gameId"
            @go-playground="handleWikiGoPlayground"
            @go-renderer="handleWikiGoRenderer"
          />
        </div>
      </NTabPane>
    </NTabs>

    <!-- Publish Bot Modal -->
    <NModal v-model:show="publishBotModal" title="发布为 Bot" preset="card" style="width:min(440px, calc(100vw - 24px))">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="Bot 名称">
          <NInput v-model:value="publishBotName" placeholder="给 Bot 起个名字" />
        </NFormItem>
        <NFormItem label="是否开源">
          <NSwitch v-model:value="publishBotOpenSource" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="publishBotModal = false">取消</NButton>
          <NButton type="primary" :loading="publishingBot" @click="publishBot">发布</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import exampleRenderer from '~~/examples/botzone/closest-renderer.html?raw'
import previewFixture from '~~/examples/botzone/closest-log.json'
import { normalizeGameLog } from '~/utils/botzone-log'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import {
  NTabs, NTabPane, NGrid, NGridItem, NCard, NSpace, NButton, NSelect, NInput,
  NTag, NText, NAlert, NEmpty, NSpin,
  NModal, NForm, NFormItem, NSwitch,
  useMessage,
} from 'naive-ui'
import { BOTZONE_LANGUAGE_OPTIONS, botzoneEditorLanguage, botzoneLanguage } from '~/utils/botzone-language'
import type { TimelineRound } from '~/components/compete/MatchTimeline.vue'
import ProgramSlot from '~/components/compete/ProgramSlot.vue'
import type { Game, Gamer, Match } from '~/types/compete'
import confetti from 'canvas-confetti'
import MatchTimeline from '~/components/compete/MatchTimeline.vue'
import MatchDiagnostics from '~/components/compete/MatchDiagnostics.vue'
import WikiContent from '~/components/compete/WikiContent.vue'
import { botTemplate } from '~/utils/bot-templates'

const message = useMessage()
const competeApi = useCompeteApi()
const authStore = useAuthStore()
const tutorialHandoff = useTutorialDraftHandoff()

const route = useRoute()
const router = useRouter()
const activeTab = ref('bot')
const developerTools = ref(false)
const tutorialMode = ref(false)
const tutorialActiveTab = ref('bot') // which test tab the tutorial is on
const botResultRegion = ref<{ $el: HTMLElement } | null>(null)

// In tutorial mode, only tutorialActiveTab and 'wiki' are accessible
function handleTabChange(tab: string) {
  if (tutorialMode.value && tab !== 'wiki' && tab !== tutorialActiveTab.value) {
    message.warning('教程模式中请使用教程指定的标签页，或退出教程模式后自由切换')
    return
  }
  activeTab.value = tab
  const id = tab === 'judge' ? judge.value.gameId : tab === 'combo' ? combo.value.gameId : tab === 'renderer' ? rendererTargetGame.value : bot.value.gameId
  void router.replace({ query: { tab, gameId: id ?? undefined, gamerId: tab === 'bot' ? sourceGamerId.value ?? undefined : undefined } })
}

// ── Games ──
const games = ref<Game[]>([])
const gameOptions = computed(() => games.value.map(g => ({ label: g.name || g.title, value: g.id })))

onMounted(async () => {
  try {
    const res = await competeApi.listGames({ page: 1, perPage: 100 })
    games.value = (res.data as any)?.items || res.data || []
  } catch (e) { console.error(e) }
  const pending = tutorialHandoff.consume(authStore.user?.id)
  if (!pending || !pending.gameId) return
  if (!games.value.some(game => game.id === pending.gameId)) {
    try {
      const selected = await competeApi.getGame(pending.gameId)
      if (String(pending.ownerId) !== String(authStore.user?.id)) return
      if (selected.data.disabled) { message.warning('教程游戏暂不可用，未载入代码。'); return }
      games.value.push(selected.data)
    } catch { message.error('教程游戏加载失败，未载入代码。'); return }
  }
  if (games.value.find(game => game.id === pending.gameId)?.disabled) return
  if (pending.targetTab === 'renderer') {
    const currentGameId = rendererTargetGame.value
    if (rendererDraft.dirty.value && (pending.html || pending.gameId !== currentGameId)
      && !window.confirm('切换渲染器游戏或载入教程 HTML 将替换当前未保存草稿，继续吗？')) return
    rendererTargetGame.value = pending.gameId
    await nextTick()
    if (String(pending.ownerId) !== String(authStore.user?.id)) return
    if (pending.html) { rendererHtml.value = pending.html; rendererPreview.value = pending.html }
    developerTools.value = true
    activeTab.value = 'renderer'
    return
  }
  await handleWikiGoPlayground({
    tab: pending.targetTab,
    gameId: pending.gameId,
    code: pending.code,
    lang: pending.lang,
  }, pending.ownerId)
})

// ── Helper: convert match result to timeline ──
function buildTimeline(result: unknown): TimelineRound[] {
  const log = normalizeGameLog(result)
  return (log?.rounds ?? []).map(r => {
    const events: TimelineRound['events'] = []
    const cmd = r.judgeCmd as Record<string, any> | undefined
    for (const [pid, data] of Object.entries(cmd?.content ?? cmd?.commands ?? cmd ?? {})) {
      if (!/^\d+$/.test(pid) || data == null) continue
      events.push({ from: 'Judge', to: `Bot${pid}`, type: 'cmd', data, debug: cmd?.debug ?? r.debug?.judge, stderr: cmd?.stderr ?? r.debug?.judge_stderr })
    }
    for (const [pid, data] of Object.entries(r.botOutputs)) {
      if (/^\d+$/.test(pid)) events.push({ from: `Bot${pid}`, to: 'Judge', type: 'resp', data, debug: r.debug?.[`bot_${pid}`], stderr: r.debug?.[`bot_${pid}_stderr`] })
    }
    return { round: r.round, events, display: r.judgerDisplay }
  })
}

function matchStatusLabel(s: number) {
  return ({ 0: '等待中', 1: '运行中', 2: '已完成', 3: '失败' } as Record<number, string>)[s] || '-'
}
function matchStatusType(s: number): 'default' | 'info' | 'success' | 'error' {
  return ({ 0: 'default', 1: 'info', 2: 'success', 3: 'error' } as Record<number, any>)[s] || 'default'
}

const matchPolling = useMatchPolling()
function startPoll(id: number, update: (match: Match) => void, done: (match: Match) => void, error: (text: string) => void = text => { message.error(text) }) { return matchPolling.start(id, update, done, error) }

// ══════════════════════════════════════
// BOT TEST
// ══════════════════════════════════════
const bot = ref({
  result: null as unknown,
  gameId: null as number | null,
  opponentGamerId: null as number | null,
  language: 'python',
  running: false,
  matchId: null as number | null,
  status: 0,
  timeline: [] as TimelineRound[],
  finalResult: null as any,
  botNames: {} as Record<string, string>,
})
watch(() => bot.value.status, async (status) => {
  if (status !== 2 && status !== 3) return
  await nextTick()
  botResultRegion.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
})
const botCode = ref('')
const botCodeAtTest = ref('')   // code snapshot at time of last test run
const botOpponents = ref<Gamer[]>([])
const opponentsLoading = ref(false)
const publishBotModal = ref(false)
const publishBotName = ref('')
const publishBotOpenSource = ref(false)
const publishingBot = ref(false)

const opponentOptions = computed(() => botOpponents.value.map(g => ({
  label: `${g.title || g.name} (ELO ${g.elo ?? 1200})`,
  value: g.id,
})))

const botEditorLang = computed(() => botzoneEditorLanguage(bot.value.language))

let contextVersion = 0
let loadedContext = ''
let stopBotPoll: (() => void) | undefined
const sourceGamerId = ref<number | null>(null)
const botError = ref('')
const publishedGamerId = ref<number | null>(null)
const botDraft = useCodeDraft(
  () => ({ code: botCode.value, language: bot.value.language, title: publishBotName.value }),
  value => { botCode.value = value.code; bot.value.language = value.language; publishBotName.value = value.title },
)
async function loadBotContext(id: number | null, gamerId: number | null = null) {
  const owner = authStore.user?.id
  loadedContext = `${owner}:${id}:${gamerId}`
  const version = ++contextVersion
  const current = () => version === contextVersion && authStore.user?.id === owner
  stopBotPoll?.()
  bot.value.running = false
  bot.value.matchId = null
  bot.value.timeline = []
  bot.value.opponentGamerId = null
  bot.value.result = null
  botOpponents.value = []
  sourceGamerId.value = gamerId
  botError.value = ''
  publishedGamerId.value = null
  if (!id || !owner) return
  opponentsLoading.value = true
  try {
    const [opponents, selectedGame, selectedBot] = await Promise.all([
      competeApi.listGamers({ gameId: id, page: 1, perPage: 100 }),
      competeApi.getGame(id),
      gamerId ? competeApi.getGamer(gamerId) : Promise.resolve(null),
    ])
    if (!current()) return
    if (selectedBot && selectedBot.data.gameId !== id) throw new Error('Bot 不属于当前游戏')
    if (selectedBot && selectedBot.data.code === undefined) throw new Error('此 Bot 的代码不可读取，请从自己的 Bot 开始测试')
    if (!games.value.some(game => game.id === id)) games.value.push(selectedGame.data)
    botOpponents.value = opponents.data.items.filter(g => g.type === 'code' && !g.disabled && !g.isTest)
    bot.value.opponentGamerId = botOpponents.value.find(g => g.id !== gamerId)?.id ?? null
    const original = selectedBot?.data
    botDraft.load(original ? `bot:${original.id}` : `new:${id}`, {
      code: original?.code ?? '', language: botzoneLanguage(original?.language), title: original?.title ?? '',
    })
    if (selectedGame.data.gamerQuantity !== 2) botError.value = '此测试工作台适用于双人游戏；请保存 Bot 后从游戏页面发起多人对局'
    else if (!botOpponents.value.length) botError.value = '当前没有可用对手，请先在游戏页面创建或启用一个 Bot'
  }
  catch (error: unknown) { if (current()) botError.value = error instanceof Error ? error.message : '加载测试环境失败，请重试' }
  finally { if (current()) opponentsLoading.value = false }
}
async function onBotGameChange(id: number | null) {
  if (!botDraft.canLeave()) return false
  bot.value.gameId = id
  await loadBotContext(id)
  if (id) await router.replace({ query: { ...route.query, gameId: id, gamerId: undefined, tab: 'bot' } })
  return !botError.value
}

function onBotLangChange(lang: string) {
  bot.value.language = lang
}

function insertBotTemplate() {
  botCode.value = botTemplate(bot.value.language) ?? ""
}

async function runBotTest() {
  if (!bot.value.gameId || !bot.value.opponentGamerId) return
  const version = contextVersion
  const owner = authStore.user?.id
  stopBotPoll?.()
  botError.value = ''
  bot.value.matchId = null
  botCodeAtTest.value = botCode.value   // snapshot for staleness check
  bot.value.running = true
  bot.value.timeline = []
  bot.value.finalResult = null
  bot.value.result = null
  try {
    const res = await competeApi.runPlayground(bot.value.gameId, {
      code: botCode.value,
      language: bot.value.language,
      opponentGamerId: bot.value.opponentGamerId,
    })
    if (version !== contextVersion || owner !== authStore.user?.id) return
    const data = res.data
    bot.value.matchId = data.matchId
    bot.value.status = 0
    const testGamerId = data.testGamerId
    const oppGamerId = bot.value.opponentGamerId
    const opp = botOpponents.value.find(g => g.id === oppGamerId)
    bot.value.botNames = { '0': '我的 Bot', '1': opp?.title || opp?.name || 'Opponent' }
    stopBotPoll = startPoll(data.matchId, (m) => { if (version === contextVersion && owner === authStore.user?.id) bot.value.status = m.status },
      (m) => {
        if (version !== contextVersion || owner !== authStore.user?.id) return
        bot.value.running = false
        bot.value.status = m.status
        bot.value.result = m.result
        const r = normalizeGameLog(m.result, m.gameId)
        // finalResult keys are gamer IDs; map to position keys so botNames lookup works
        const rawResult = r?.finalResult as Record<string, number> | undefined
        if (rawResult) {
          const normalized: Record<string, number> = {}
          for (const [k, v] of Object.entries(rawResult)) {
            if (String(k) === String(testGamerId)) normalized['0'] = v
            else if (String(k) === String(oppGamerId)) normalized['1'] = v
            else normalized[k] = v
          }
          bot.value.finalResult = normalized
        } else {
          bot.value.finalResult = rawResult ?? null
        }
        bot.value.timeline = buildTimeline(r)
        if (m.status === 3) botError.value = '评测失败，请查看对局日志后重试'
      }, text => { if (version === contextVersion && owner === authStore.user?.id) { bot.value.running = false; botError.value = text } })
  } catch (e: any) {
    if (version === contextVersion) botError.value = e?.response?.data?.message || e?.message || '运行失败，草稿已保留'
  } finally {
    if (version === contextVersion && !bot.value.matchId) bot.value.running = false
  }
}

async function publishBot() {
  if (!publishBotName.value.trim() || !bot.value.gameId) return
  publishingBot.value = true
  const snapshot = botDraft.capture()
  const owner = authStore.user?.id
  try {
    const res = await competeApi.createGamer({
      gameId: bot.value.gameId,
      title: snapshot.data.title,
      language: snapshot.data.language,
      code: snapshot.data.code,
      type: 'code',
      opensource: publishBotOpenSource.value,
    })
    if (owner !== authStore.user?.id) return
    botDraft.markSaved(snapshot)
    publishedGamerId.value = res.data.id
    message.success(`Bot #${res.data.id} 发布成功！`)
    publishBotModal.value = false
    if (!botDraft.dirty.value) await navigateTo(`/compete/gamer/${res.data.id}`)
  } catch (e: any) {
    message.error(e?.message || '发布失败')
  } finally {
    publishingBot.value = false
  }
}

// ══════════════════════════════════════
// JUDGE TEST
// ══════════════════════════════════════
const judge = ref({
  result: null as unknown,
  gameId: null as number | null,
  bot0Id: null as number | null,
  bot1Id: null as number | null,
  language: 'python',
  running: false,
  matchId: null as number | null,
  status: 0,
  timeline: [] as TimelineRound[],
  finalResult: null as any,
  botNames: {} as Record<string, string>,
})
const judgeCode = ref('')
const judgeCodeAtTest = ref('')
const judgeOpponents = ref<any[]>([])
const judgeOpponentsLoading = ref(false)

const judgeOpponentOptions = computed(() => judgeOpponents.value.map(g => ({
  label: `${g.title || g.name} (ELO ${g.elo ?? 1200})`,
  value: g.id,
})))
const judgeEditorLang = computed(() => botzoneEditorLanguage(judge.value.language))

async function onJudgeGameChange(id: number | null) {
  if (!judgeDraft.canLeave()) return false
  judge.value.gameId = id
  judge.value.bot0Id = null
  judge.value.bot1Id = null
  judgeOpponents.value = []
  if (activeTab.value === 'judge') void router.replace({ query: { tab: 'judge', gameId: id ?? undefined } })
  if (!id) return
  const owner = authStore.user?.id
  judgeOpponentsLoading.value = true
  try {
    const { data } = await competeApi.listGamers({ gameId: id, page: 1, perPage: 100 })
    if (judge.value.gameId === id && authStore.user?.id === owner) judgeOpponents.value = data.items.filter(g => g.type === 'code' && !g.disabled)
  } catch { message.error('无法加载测试对手，请重试') }
  finally { if (judge.value.gameId === id) judgeOpponentsLoading.value = false }
  return judge.value.gameId === id && authStore.user?.id === owner
}

function onJudgeLangChange(lang: string) { judge.value.language = lang }

const JUDGE_TEMPLATE_PY = `import sys
import json

round_num = 0

for line in sys.stdin:
    line = line.strip()
    if not line: continue
    data = json.loads(line)
    round_num = data.get('round', round_num + 1)
    responses = data.get('responses', {})
    
    if not responses:
        # First call: initialize game, send first commands
        result = {
            "commands": {
                "0": {"round": 1, "info": "game start"},
                "1": {"round": 1, "info": "game start"}
            },
            "display": {"round": 1},
            "verdict": "continue",
            "debug": "Game initialized"
        }
    else:
        # Process responses, decide next state
        # responses = {"0": <move_from_bot0>, "1": <move_from_bot1>}
        
        if round_num >= 5:  # Game over condition
            result = {
                "commands": {},
                "display": {"result": responses},
                "verdict": "finish",
                "scores": {"0": 1, "1": 0},  # Your scoring logic
                "debug": f"Game over after {round_num} rounds"
            }
        else:
            result = {
                "commands": {
                    "0": {"round": round_num + 1},
                    "1": {"round": round_num + 1}
                },
                "display": {"round": round_num + 1, "lastMoves": responses},
                "verdict": "continue",
                "debug": f"Round {round_num} done. Moves: {responses}"
            }
    
    print(json.dumps(result))
    sys.stdout.flush()
`

function insertJudgeTemplate() {
  if (botzoneLanguage(judge.value.language) !== 'python') return
  judgeCode.value = JUDGE_TEMPLATE_PY
}

async function runJudgeTest() {
  if (judge.value.running || !judgeCode.value.trim() || !judge.value.bot0Id || !judge.value.bot1Id) return
  const gameId = judge.value.gameId || bot.value.gameId
  if (!gameId) { message.error('请先选择一个游戏'); return }
  const owner = authStore.user?.id
  const version = ++judgeRequestVersion
  const current = () => version === judgeRequestVersion && owner === authStore.user?.id
  stopJudgePoll?.()
  judge.value.result = null
  judge.value.matchId = null
  judgeCodeAtTest.value = judgeCode.value   // snapshot for staleness check
  judge.value.running = true
  judge.value.timeline = []
  judge.value.finalResult = null
  try {
    const res = await competeApi.runPlaygroundJudge(gameId, {
      judgerCode: judgeCode.value,
      judgerLanguage: judge.value.language,
      bot0: { gamerId: judge.value.bot0Id },
      bot1: { gamerId: judge.value.bot1Id },
    })
    if (!current()) return
    const { matchId } = res.data as any
    judge.value.matchId = matchId
    judge.value.status = 0
    const b0 = judgeOpponents.value.find(g => g.id === judge.value.bot0Id)
    const b1 = judgeOpponents.value.find(g => g.id === judge.value.bot1Id)
    judge.value.botNames = { '0': b0?.title || b0?.name || 'Bot0', '1': b1?.title || b1?.name || 'Bot1' }
    const bot0Id = judge.value.bot0Id
    const bot1Id = judge.value.bot1Id
    stopJudgePoll = startPoll(matchId, (m) => { if (current()) judge.value.status = m.status },
      (m) => {
        if (!current()) return
        judge.value.running = false
        judge.value.result = m.result
        judge.value.status = m.status
        const r = normalizeGameLog(m.result, m.gameId)
        const rawResult = r?.finalResult as Record<string, number> | undefined
        if (rawResult) {
          const normalized: Record<string, number> = {}
          for (const [k, v] of Object.entries(rawResult)) {
            if (String(k) === String(bot0Id)) normalized['0'] = v
            else if (String(k) === String(bot1Id)) normalized['1'] = v
            else normalized[k] = v
          }
          judge.value.finalResult = normalized
        } else {
          judge.value.finalResult = rawResult ?? null
        }
        judge.value.timeline = buildTimeline(r)
      }, text => { if (current()) { judge.value.running = false; message.error(text) } })
  } catch (e: any) {
    if (current()) message.error(e?.message || '运行失败')
  } finally {
    if (current() && !judge.value.matchId) judge.value.running = false
  }
}

// ══════════════════════════════════════
// COMBO DEBUGGER
// ══════════════════════════════════════
const combo = ref({
  result: null as unknown,
  gameId: null as number | null,
  judgeCode: '', judgeLang: 'python', importedJudgeId: null as number | null,
  bot0Code: '', bot0Lang: 'python', importedBot0Id: null as number | null,
  bot1Code: '', bot1Lang: 'python', importedBot1Id: null as number | null,
  running: false,
  matchId: null as number | null,
  status: 0,
  timeline: [] as TimelineRound[],
  finalResult: null as any,
})

const comboNotReady = computed(() =>
  (!combo.value.judgeCode.trim() && !combo.value.importedJudgeId) ||
  (!combo.value.bot0Code.trim() && !combo.value.importedBot0Id) ||
  (!combo.value.bot1Code.trim() && !combo.value.importedBot1Id)
)

async function runCombo() {
  if (combo.value.running) return
  const gameId = combo.value.gameId
  if (!gameId) { message.error('请先选择参考游戏'); return }
  const owner = authStore.user?.id
  const version = ++comboRequestVersion
  const current = () => version === comboRequestVersion && owner === authStore.user?.id
  stopComboPoll?.()
  combo.value.result = null
  combo.value.matchId = null
  combo.value.running = true
  combo.value.timeline = []
  combo.value.finalResult = null
  try {

    const bot0Spec = combo.value.importedBot0Id
      ? { gamerId: combo.value.importedBot0Id }
      : { code: combo.value.bot0Code, language: combo.value.bot0Lang }
    const bot1Spec = combo.value.importedBot1Id
      ? { gamerId: combo.value.importedBot1Id }
      : { code: combo.value.bot1Code, language: combo.value.bot1Lang }
    const judgeSpec = combo.value.importedJudgeId
      ? {} // use game's judge
      : { judgerCode: combo.value.judgeCode, judgerLanguage: combo.value.judgeLang }
    const res = await competeApi.runPlaygroundJudge(gameId, { ...judgeSpec, bot0: bot0Spec, bot1: bot1Spec })
    if (!current()) return
    const { matchId } = res.data as any
    combo.value.matchId = matchId
    combo.value.status = 0
    stopComboPoll = startPoll(matchId, (m) => { if (current()) combo.value.status = m.status },
      (m) => {
        if (!current()) return
        combo.value.running = false
        combo.value.result = m.result
        combo.value.status = m.status
        const r = normalizeGameLog(m.result, m.gameId)
        combo.value.finalResult = r?.finalResult
        combo.value.timeline = buildTimeline(r)
      }, text => { if (current()) { combo.value.running = false; message.error(text) } })
  } catch (e: any) {
    if (current()) message.error(e?.message || '运行失败')
  } finally {
    if (current() && !combo.value.matchId) combo.value.running = false
  }
}

// ══════════════════════════════════════
// RENDERER TEST
// ══════════════════════════════════════
let judgeRequestVersion = 0
let comboRequestVersion = 0
let stopJudgePoll: (() => void) | undefined
let stopComboPoll: (() => void) | undefined
watch(() => [judge.value.gameId, authStore.user?.id], () => {
  judgeRequestVersion++
  stopJudgePoll?.()
  judge.value.result = null
  judge.value.matchId = null
  judge.value.timeline = []
  judge.value.finalResult = null
  judge.value.running = false
})
watch(() => [combo.value.gameId, authStore.user?.id], () => {
  comboRequestVersion++
  stopComboPoll?.()
  combo.value.result = null
  combo.value.matchId = null
  combo.value.timeline = []
  combo.value.finalResult = null
  combo.value.running = false
})
onUnmounted(() => { stopJudgePoll?.(); stopComboPoll?.() })

const rendererHtml = ref('')
const rendererPreview = ref('')
const rendererRef = ref<HTMLIFrameElement | null>(null)
const testGameLog = ref(JSON.stringify(previewFixture, null, 2))
const testGameState = ref(JSON.stringify({
  requests: [
    JSON.stringify({ round: 1, rounds: 5 }),
    JSON.stringify({ round: 2, rounds: 5, hint: 'smaller' }),
  ],
  responses: ['50', '30'],
  data: null,
  globaldata: null,
  time_limit: 2,
  memory_limit: 256,
}, null, 2))
const lastIframeMsg = ref('')
const rendererTargetGame = ref<number | null>(null)
const publishingRenderer = ref(false)

// Only code/language is stored. Imported keys, webhook secrets and tokens stay out.
function useScratchDraft(name: string, scope: () => number | null, read: () => { code: string; language: string; title: string }, apply: (value: { code: string; language: string; title: string }) => void) {
  const state = useCodeDraft(read, apply)
  watch([scope, () => authStore.user?.id], ([id]) => {
    state.load(`${name}:${id ?? 'scratch'}`, { code: '', language: name === 'renderer' ? 'html' : 'python', title: '' })
  }, { immediate: true })
  return state
}
const judgeDraft = useScratchDraft('judge', () => judge.value.gameId,
  () => ({ code: judgeCode.value, language: judge.value.language, title: '' }),
  value => { judgeCode.value = value.code; judge.value.language = value.language })
const rendererDraft = useScratchDraft('renderer', () => rendererTargetGame.value,
  () => ({ code: rendererHtml.value, language: 'html', title: '' }),
  value => { rendererHtml.value = value.code })
const comboDrafts = [
  useScratchDraft('combo-judge', () => combo.value.gameId,
    () => ({ code: combo.value.judgeCode, language: combo.value.judgeLang, title: '' }),
    value => { combo.value.judgeCode = value.code; combo.value.judgeLang = value.language; combo.value.importedJudgeId = null }),
  useScratchDraft('combo-bot0', () => combo.value.gameId,
    () => ({ code: combo.value.bot0Code, language: combo.value.bot0Lang, title: '' }),
    value => { combo.value.bot0Code = value.code; combo.value.bot0Lang = value.language; combo.value.importedBot0Id = null }),
  useScratchDraft('combo-bot1', () => combo.value.gameId,
    () => ({ code: combo.value.bot1Code, language: combo.value.bot1Lang, title: '' }),
    value => { combo.value.bot1Code = value.code; combo.value.bot1Lang = value.language; combo.value.importedBot1Id = null }),
]


function setComboGame(id: number | null) {
  if (!comboDrafts.every(draft => draft.canLeave())) return
  combo.value.gameId = id
  void router.replace({ query: { tab: 'combo', gameId: id ?? undefined } })
}
function setRendererGame(id: number | null) {
  if (!rendererDraft.canLeave()) return
  rendererTargetGame.value = id
  void router.replace({ query: { tab: 'renderer', gameId: id ?? undefined } })
}

function insertRendererTemplate() {
  if (rendererHtml.value.trim() && !window.confirm('替换当前 HTML？原有未发布修改将被覆盖。')) return
  rendererHtml.value = exampleRenderer
}

function reloadRenderer() {
  rendererPreview.value = rendererHtml.value
}

function sendGameLog() {
  try {
    const gameLog = normalizeGameLog(JSON.parse(testGameLog.value))
    if (!gameLog) { message.error('日志中没有有效回合'); return }
    rendererRef.value?.contentWindow?.postMessage({ type: 'gameLog', gameLog, round: 0 }, '*')
  } catch { message.error('gameLog JSON 格式错误') }
}

function sendGameState() {
  try {
    const gameState = JSON.parse(testGameState.value)
    rendererRef.value?.contentWindow?.postMessage({ type: 'gameState', gameState, playerIndex: 0 }, '*')
  } catch { message.error('gameState JSON 格式错误') }
}

function onIframeMsg(e: MessageEvent) {
  if (e.source !== rendererRef.value?.contentWindow || !e.data || typeof e.data !== 'object') return
  if (e.data.type === 'humanMove' && typeof e.data.move === 'string') {
    lastIframeMsg.value = JSON.stringify(e.data)
  }
}
onMounted(() => window.addEventListener('message', onIframeMsg))
onUnmounted(() => window.removeEventListener('message', onIframeMsg))
watch(rendererHtml, html => { rendererPreview.value = html })

async function publishRenderer() {
  if (!rendererTargetGame.value || !rendererHtml.value || !authStore.isAdmin) return
  const saved = rendererDraft.capture()
  publishingRenderer.value = true
  try {
    await competeApi.updateGame(rendererTargetGame.value, { rendererHtml: saved.data.code })
    rendererDraft.markSaved(saved)
    message.success('渲染器已发布！')
  } catch (e: any) { message.error(e?.message || '发布失败') }
  finally { publishingRenderer.value = false }
}

// ══════════════════════════════════════
// WIKI
// ══════════════════════════════════════
function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 80, spread: 70, origin: { y: 0.5 }, colors: ['#18a058', '#2080f0', '#f0a020', '#d03050', '#7fe7c4'] })
}

function exitTutorialMode() {
  tutorialMode.value = false
  activeTab.value = 'wiki'
}

async function handleWikiGoPlayground(opts: { tab?: string; code?: string; lang?: string; gameId?: number }, expectedOwnerId?: string | number) {
  if (expectedOwnerId != null && String(expectedOwnerId) !== String(authStore.user?.id)) return
  const targetTab = opts.tab || 'bot'
  const targetGame = opts.gameId || games.value.find(game => game.title === '猜数字')?.id
  if (!targetGame) { message.warning('请先配置或选择与教程匹配的示例游戏'); return }
  tutorialMode.value = false
  if (targetTab === 'judge') {
    developerTools.value = true
    if (!await onJudgeGameChange(targetGame)) return
    if (expectedOwnerId != null && String(expectedOwnerId) !== String(authStore.user?.id)) return
    await nextTick()
    if (opts.code && (judgeDraft.dirty.value || judgeCode.value.trim()) && !window.confirm('用教程代码替换当前裁判草稿？')) return
    if (opts.code) judgeCode.value = opts.code
    if (opts.lang) judge.value.language = botzoneLanguage(opts.lang)
    judge.value.bot0Id = judgeOpponents.value[0]?.id ?? null
    judge.value.bot1Id = judgeOpponents.value[1]?.id ?? null
  } else {
    // A tutorial edits a new-Bot draft, never the caller's existing Bot draft.
    if (!await onBotGameChange(targetGame)) return
    if (expectedOwnerId != null && String(expectedOwnerId) !== String(authStore.user?.id)) return
    if (opts.code && (botDraft.dirty.value || botCode.value.trim()) && !window.confirm('用教程代码替换当前新 Bot 草稿？')) return
    if (opts.code) botCode.value = opts.code
    if (opts.lang) bot.value.language = botzoneLanguage(opts.lang)
  }
  tutorialMode.value = true
  tutorialActiveTab.value = targetTab
  activeTab.value = targetTab
  nextTick(fireConfetti)
}

function handleWikiGoRenderer(opts: { html?: string }) {
  developerTools.value = true
  if (opts.html) { rendererHtml.value = opts.html; rendererPreview.value = opts.html }
  activeTab.value = 'renderer'
}

watch(() => [route.query.gameId, route.query.gamerId, route.query.tab, authStore.user?.id], async () => {
  const id = Number(route.query.gameId)
  const gamer = Number(route.query.gamerId)
  const gameId = Number.isSafeInteger(id) && id > 0 ? id : null
  const gamerId = Number.isSafeInteger(gamer) && gamer > 0 ? gamer : null
  const tab = String(route.query.tab ?? 'bot')
  const queued = tutorialHandoff.peek()
  const queuedTarget = queued && String(queued.ownerId) === String(authStore.user?.id)
    && queued.gameId === gameId && queued.targetTab === tab
  if (['bot', 'judge', 'combo', 'renderer', 'wiki'].includes(tab)) activeTab.value = tab
  if (['judge', 'combo', 'renderer'].includes(tab)) developerTools.value = true
  if (tab === 'judge') {
    if (queuedTarget) return
    if (judge.value.gameId !== gameId) await onJudgeGameChange(gameId)
  } else if (tab === 'combo') combo.value.gameId = gameId
  else if (tab === 'renderer') {
    if (queuedTarget) return
    rendererTargetGame.value = gameId
  }
  else if (tab === 'bot') {
    bot.value.gameId = gameId
    if (queuedTarget) return
    if (loadedContext !== `${authStore.user?.id}:${gameId}:${gamerId}`) await loadBotContext(gameId, gamerId)
  }
}, { immediate: true })
onUnmounted(() => { contextVersion++; stopBotPoll?.() })
</script>

<style scoped>
.playground-page { max-width: 1500px; min-width: 0; margin: 0 auto; }
.tutorial-status { margin-bottom: var(--lv-space-2); }
.workbench-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--lv-space-2); margin-bottom: var(--lv-space-3); }
.workbench-context { color: var(--lv-color-text-secondary); font-size: var(--lv-size-meta); font-weight: 600; }
.bot-result-region { scroll-margin-top: var(--lv-space-3); }
.judge-template-hint { margin: var(--lv-space-2) 0; font-size: 13px; line-height: 1.7; color: var(--lv-color-text-secondary); }
.playground-page :deep(.n-grid > div) { min-width: 0; }
.wiki-code {
  background: #f5f5f5; padding: 12px; border-radius: 6px;
  font-size: 12px; font-family: monospace; overflow: auto;
  max-height: 300px; white-space: pre; margin: 0;
}
</style>
