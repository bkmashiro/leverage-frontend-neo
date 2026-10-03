<template>
  <div class="gamer-page">
    <CompeteAdminViewBanner v-if="!isNew" :admin-path="`/admin/compete/gamer/${gamerId}`" />
    <!-- 面包屑 -->
    <NBreadcrumb style="margin-bottom:12px">
      <NBreadcrumbItem @click="navigateTo('/compete')">竞技场</NBreadcrumbItem>
      <NBreadcrumbItem v-if="game">
        <a v-if="Number.isSafeInteger(Number(game.id)) && Number(game.id) > 0" :href="`/compete/games/${game.id}`">{{ game.title || game.name }}</a>
        <span v-else>{{ game.title || game.name }}</span>
      </NBreadcrumbItem>
      <NBreadcrumbItem>{{ isNew ? '新建 Bot' : gamerForm.type === 'human' ? '我的参赛席位' : (gamerForm.name || `Bot#${gamerId}`) }}</NBreadcrumbItem>
    </NBreadcrumb>
    <NSpin :show="loading">
      <NGrid v-if="game" :cols="12" :x-gap="16" :y-gap="16" item-responsive responsive="screen">
        <!-- 右侧：编辑区 / 真人席位信息 -->
        <NGridItem span="12 m:9">
          <!-- 真人席位：不是 Bot，显示专属信息页 -->
          <NCard v-if="!isNew && currentGamer?.type === 'human'" title="🎮 我的参赛席位" size="small">
            <NDescriptions :column="2" bordered size="small" style="margin-bottom:16px">
              <NDescriptionsItem label="席位名称">{{ currentGamer.name }}</NDescriptionsItem>
              <NDescriptionsItem label="参赛游戏">
                <a v-if="Number.isSafeInteger(Number(game.id)) && Number(game.id) > 0" :href="`/compete/games/${game.id}`">{{ game.title || game.name }}</a>
                <span v-else>{{ game.title || game.name }}</span>
              </NDescriptionsItem>
              <NDescriptionsItem label="类型">
                <NTag type="warning" size="small">🧑 真人</NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="外榜 ELO">
                <NTag type="info" :bordered="false" size="small">⚡ {{ currentGamer.eloExternal ?? 1200 }}</NTag>
              </NDescriptionsItem>
            </NDescriptions>
            <NAlert type="info" :show-icon="false" style="margin-bottom:16px;font-size:13px">
              真人席位无需编辑代码。前往游戏页面点击 <strong>🎮 加入对局</strong> 即可参赛，然后在对局详情页手动落子。
            </NAlert>
            <template #footer>
              <NSpace justify="space-between">
                <NButton type="error" ghost :loading="deleting" @click="confirmDelete">退出参赛</NButton>
                <a v-if="Number.isSafeInteger(Number(game.id)) && Number(game.id) > 0" :href="`/compete/games/${game.id}`" class="entity-action-link">前往游戏页面 →</a>
              </NSpace>
            </template>
          </NCard>

          <!-- 普通 Bot 编辑卡片 -->
          <NCard
            v-else
            :title="isNew ? '创建新 Bot' : `${canEdit ? '编辑' : '查看'} Bot：${gamerForm.name}`"
            size="small"
          >
            <NSpace v-if="canEdit" style="margin-bottom:16px">
              <NButton v-if="gamerForm.type === 'code'" type="primary" :disabled="!gamerForm.code.trim() || saving" @click="openTest">测试当前草稿</NButton>
              <NButton :loading="saving" @click="handleSave">{{ isNew ? '创建 Bot' : '保存新版本' }}</NButton>
            </NSpace>
            <NAlert v-if="!canEdit" type="info" style="margin-bottom:12px">这是其他用户的 Bot。公开代码可查看，但只有作者可以修改。</NAlert>
            <CompeteCodeDraftStatus v-if="canEdit && gamerForm.type === 'code'" :dirty="draft.dirty.value" :restored="draft.restored.value" :storage-error="draft.storageError.value" @discard="draft.discard" />
            <NForm
              ref="formRef"
              :model="gamerForm"
              :rules="formRules"
              :disabled="!canEdit || saving"
              label-placement="top"
              label-width="80"
            >
              <NFormItem label="Bot 名称" path="name">
                <NInput
                  v-model:value="gamerForm.name"
                  placeholder="输入 Bot 名称"
                  style="max-width: 320px"
                />
              </NFormItem>

              <!-- 代码 Bot -->
              <template v-if="gamerForm.type === 'code'">
                <NFormItem label="编程语言" path="language">
                  <NSelect
                    v-model:value="gamerForm.language"
                    :options="languageOptions"
                    style="max-width: 200px"
                    @update:value="onLanguageChange"
                  />
                </NFormItem>
                <NFormItem label="Bot 代码" path="code">
                  <div style="width: 100%">
                    <CodeEditor
                      v-model="gamerForm.code"
                      :readonly="!canEdit || saving"
                      :language="editorLanguage"
                      height="500px"
                    />
                  </div>
                </NFormItem>
              </template>

              <!-- Webhook Bot（被动，服务器调用） -->
              <template v-else-if="gamerForm.type === 'webhook'">
                <NFormItem label="Webhook URL" path="webhookUrl">
                  <NInput v-model:value="gamerForm.webhookUrl" placeholder="https://your-server.com/bot" />
                </NFormItem>
                <NFormItem label="签名密钥">
                  <NInput v-model:value="gamerForm.webhookSecret" placeholder="可选" />
                </NFormItem>
                <NAlert type="warning" :show-icon="false" style="font-size:13px">
                  📡 服务器会主动 POST 到你的 URL，需要公网 IP 或域名。
                </NAlert>
              </template>

              <!-- External Bot（主动轮询） -->
              <template v-else-if="gamerForm.type === 'external'">
                <NAlert type="info" :show-icon="false" style="font-size:13px">
                  🔗 你的程序主动轮询服务器，无需公网 IP。<br>
                  如需刷新 API Key，请联系管理员或重新创建 Bot。
                </NAlert>
              </template>
            </NForm>

            <template #footer>
              <NSpace justify="space-between">
                <NButton v-if="!isNew && canEdit" type="error" ghost :loading="deleting" @click="confirmDelete">
                  删除 Bot
                </NButton>
                <div v-else />
                <a v-if="Number.isSafeInteger(Number(game.id)) && Number(game.id) > 0" :href="`/compete/games/${game.id}`">返回游戏</a>
              </NSpace>
            </template>
          </NCard>
        </NGridItem>

        <!-- 左侧：游戏信息 + Gamer 列表 -->
        <NGridItem span="12 m:3">
          <NSpace vertical :size="12">
            <!-- 游戏信息 -->
            <NCard title="游戏信息" size="small">
              <NDescriptions :column="1" size="small">
                <NDescriptionsItem label="游戏">
                  <a v-if="Number.isSafeInteger(Number(game.id)) && Number(game.id) > 0" :href="`/compete/games/${game.id}`">{{ game.title || game.name }}</a>
                  <span v-else>{{ game.title || game.name }}</span>
                </NDescriptionsItem>
                <NDescriptionsItem v-if="game.description" label="描述">
                  {{ game.description }}
                </NDescriptionsItem>
              </NDescriptions>
            </NCard>

            <!-- Bot 状态 + ELO排名条 -->
            <NCard v-if="!isNew && currentGamer" :title="currentGamer.type === 'human' ? '参赛状态' : 'Bot 状态'" size="small">
              <NDescriptions :column="1" size="small" style="margin-bottom:12px">
                <NDescriptionsItem label="Bot 名称">{{ currentGamer.name }}</NDescriptionsItem>
                <NDescriptionsItem label="ELO 积分">
                  <NTag type="info" :bordered="false" size="medium" style="font-size:15px;font-weight:700">
                    ⚡ {{ currentGamer.elo ?? 1200 }}
                  </NTag>
                </NDescriptionsItem>
                <NDescriptionsItem v-if="eloRankInfo" label="内榜排名">
                  <NText type="success" strong>#{{ eloRankInfo.rank }} / {{ eloRankInfo.total }}</NText>
                </NDescriptionsItem>
              </NDescriptions>

              <!-- ELO 横向分布图 -->
              <div v-if="eloRankInfo && eloRankInfo.total > 1" class="elo-bar-wrapper">
                <div class="elo-bar-label">
                  <span>{{ eloRankInfo.minElo }}</span>
                  <span style="color:#888;font-size:11px">ELO 分布</span>
                  <span>{{ eloRankInfo.maxElo }}</span>
                </div>
                <div class="elo-bar-track">
                  <!-- Other bots -->
                  <div
                    v-for="dot in eloRankInfo.others"
                    :key="dot.id"
                    class="elo-dot other"
                    :style="{ left: dot.pct + '%' }"
                    :title="`${dot.name}: ${dot.elo}`"
                  />
                  <!-- This bot -->
                  <div
                    class="elo-dot self"
                    :style="{ left: eloRankInfo.selfPct + '%' }"
                    :title="`${currentGamer.name}: ${currentGamer.elo ?? 1200}`"
                  />
                </div>
                <div style="text-align:center;font-size:11px;color:#888;margin-top:4px">
                  ● 你的 Bot &nbsp;○ 其他 Bot
                </div>
              </div>
            </NCard>

            <!-- ELO 变化历史折线图 -->
            <NCard v-if="eloHistory.length > 1" title="📈 ELO 变化历史" size="small">
              <svg
                :viewBox="`0 0 ${ELO_W} ${ELO_H}`"
                style="width:100%;height:130px;display:block"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="eloAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#18a058" stop-opacity="0.25" />
                    <stop offset="100%" stop-color="#18a058" stop-opacity="0.02" />
                  </linearGradient>
                </defs>
                <!-- Y 轴网格线 -->
                <line
                  v-for="i in 3" :key="i"
                  :x1="ELO_PAD" :x2="ELO_W - ELO_PAD"
                  :y1="ELO_PAD + ((i - 1) / 2) * (ELO_H - ELO_PAD * 2)"
                  :y2="ELO_PAD + ((i - 1) / 2) * (ELO_H - ELO_PAD * 2)"
                  stroke="#e0e0e0" stroke-width="1"
                />
                <!-- ELO 标签 -->
                <text :x="ELO_PAD - 4" :y="ELO_PAD + 4" text-anchor="end" font-size="10" fill="#aaa">
                  {{ eloChartPoints.maxElo }}
                </text>
                <text :x="ELO_PAD - 4" :y="ELO_H - ELO_PAD + 4" text-anchor="end" font-size="10" fill="#aaa">
                  {{ eloChartPoints.minElo }}
                </text>
                <!-- 面积填充 -->
                <path :d="eloAreaPath" fill="url(#eloAreaGrad)" />
                <!-- 折线 -->
                <polyline
                  :points="eloPolylineStr"
                  fill="none"
                  stroke="#18a058"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <!-- 数据点 -->
                <circle
                  v-for="p in eloChartPoints.points"
                  :key="p.index"
                  :cx="p.x" :cy="p.y" r="4"
                  fill="#18a058"
                  stroke="#fff"
                  stroke-width="1.5"
                  style="cursor:default"
                >
                  <title>第{{ p.index }}场: ELO {{ p.eloBefore }} → {{ p.elo }} ({{ p.delta >= 0 ? '+' : '' }}{{ p.delta }})</title>
                </circle>
              </svg>
            </NCard>

            <!-- 战绩分析 -->
            <NCard v-if="!isNew && gamerStats && gamerStats.totalMatches > 0" title="📊 战绩分析" size="small">
              <!-- 摘要数字 -->
              <NSpace justify="space-around" style="margin-bottom:12px">
                <div style="text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#333">{{ gamerStats.totalMatches }}</div>
                  <div style="font-size:11px;color:#aaa">总场次</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#18a058">{{ gamerStats.wins }}</div>
                  <div style="font-size:11px;color:#aaa">胜</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#e03030">{{ gamerStats.losses }}</div>
                  <div style="font-size:11px;color:#aaa">负</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#888">{{ gamerStats.draws }}</div>
                  <div style="font-size:11px;color:#aaa">平</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:22px;font-weight:700;color:#f0a020">{{ statWinRatePct }}%</div>
                  <div style="font-size:11px;color:#aaa">胜率</div>
                </div>
              </NSpace>

              <!-- SVG 饼图 -->
              <div style="display:flex;justify-content:center;margin-bottom:12px">
                <svg width="120" height="120" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                  <g v-for="sector in statPieSectors" :key="sector.key">
                    <circle
                      v-if="sector.full"
                      cx="60"
                      cy="60"
                      r="50"
                      :fill="sector.color"
                    />
                    <path v-else :d="sector.d" :fill="sector.color" />
                  </g>
                  <!-- 中心圆 -->
                  <circle cx="60" cy="60" r="34" fill="white" />
                  <text x="60" y="58" text-anchor="middle" font-size="14" font-weight="700" fill="#333">{{ statWinRatePct }}%</text>
                  <text x="60" y="72" text-anchor="middle" font-size="9" fill="#aaa">胜率</text>
                </svg>
              </div>

              <!-- 对手表格 (top 5) -->
              <div v-if="gamerStats.opponents && gamerStats.opponents.length > 0">
                <NText depth="3" style="font-size:12px;display:block;margin-bottom:6px">对手分析（按总场次）</NText>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                  <thead>
                    <tr style="color:#aaa;border-bottom:1px solid #eee">
                      <th style="text-align:left;padding:3px 4px;font-weight:500">对手</th>
                      <th style="text-align:center;padding:3px 4px;font-weight:500;color:#18a058">胜</th>
                      <th style="text-align:center;padding:3px 4px;font-weight:500;color:#e03030">负</th>
                      <th style="text-align:center;padding:3px 4px;font-weight:500;color:#888">平</th>
                      <th style="text-align:left;padding:3px 4px;font-weight:500">胜率</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="opp in statTopOpponents"
                      :key="opp.gamerId"
                      style="border-bottom:1px solid #f5f5f5"
                    >
                      <td style="padding:4px">
                        <a v-if="Number.isSafeInteger(Number(opp.gamerId)) && Number(opp.gamerId) > 0" :href="`/compete/gamer/${opp.gamerId}`">{{ opp.name }}</a>
                        <span v-else>{{ opp.name }}</span>
                      </td>
                      <td style="text-align:center;padding:4px;color:#18a058">{{ opp.wins }}</td>
                      <td style="text-align:center;padding:4px;color:#e03030">{{ opp.losses }}</td>
                      <td style="text-align:center;padding:4px;color:#888">{{ opp.draws }}</td>
                      <td style="padding:4px">
                        <div style="display:flex;align-items:center;gap:4px">
                          <div style="width:40px;height:6px;background:#eee;border-radius:3px;overflow:hidden">
                            <div
                              :style="{
                                width: oppWinRatePct(opp) + '%',
                                height: '100%',
                                background: oppWinRatePct(opp) >= 50 ? '#18a058' : '#e03030',
                                borderRadius: '3px',
                              }"
                            />
                          </div>
                          <span style="color:#888;font-size:11px">{{ oppWinRatePct(opp) }}%</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </NCard>

            <!-- 我的 Bot 列表 -->
            <NCard title="我的 Bot" size="small">
              <template #header-extra>
                <NButton
                  size="tiny"
                  type="primary"
                  @click="navigateTo(`/compete/gamer/0?gameId=${game.id}`)"
                >
                  + 新建
                </NButton>
              </template>
              <div v-if="myGamers.length === 0" class="empty-tip">
                <NText depth="3">暂无 Bot</NText>
              </div>
              <NList v-else :show-divider="false" size="small">
                <NListItem
                  v-for="g in myGamers"
                  :key="g.id"
                  :class="{ 'gamer-item-active': g.id === currentGamerId }"
                >
                  <div class="gamer-list-item">
                    <a :href="`/compete/gamer/${g.id}`" class="gamer-name">{{ g.name }}</a>
                    <NTag size="small" :bordered="false">{{
                      g.type === 'webhook' ? 'Webhook' :
                      g.type === 'external' ? '外部轮询' :
                      g.type === 'human' ? '真人' :
                      g.language || '-'
                    }}</NTag>
                  </div>
                </NListItem>
              </NList>
            </NCard>
          </NSpace>
        </NGridItem>

        <!-- 对局记录 Tab（跨整行） -->
        <NGridItem v-if="!isNew" :span="12">
          <NCard title="📋 对局记录" size="small">
            <!-- 加载中状态 -->
            <NSpin :show="gamerMatchesLoading">
              <NEmpty v-if="!gamerMatchesLoading && gamerMatches.length === 0" description="暂无对局记录" style="padding:16px 0" />
              <NDataTable
                v-else
                :columns="gamerMatchColumns"
                :data="gamerMatches"
                :bordered="false"
                :row-key="(row: any) => row.id"
              />
            </NSpin>
            <NPagination
              v-if="gamerMatchesTotal > gamerMatchesPageSize"
              v-model:page="gamerMatchesPage"
              :page-size="gamerMatchesPageSize"
              :item-count="gamerMatchesTotal"
              style="margin-top: 16px; justify-content: flex-end"
            />
          </NCard>
        </NGridItem>
      </NGrid>

      <NResult v-else-if="!loading" status="404" title="未找到相关内容">
        <template #footer>
          <NButton @click="navigateTo('/compete')">返回竞赛列表</NButton>
        </template>
      </NResult>
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { useMessage, useDialog, NButton, NTag } from 'naive-ui'
import type { FormInst, DataTableColumns } from 'naive-ui'
import { useAuthStore } from '~/stores/auth'
import { BOTZONE_LANGUAGE_OPTIONS, botzoneEditorLanguage, botzoneLanguage } from '~/utils/botzone-language'
import type { Game, Gamer, GamerKind } from '~/types/compete'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const queryPagePath = route.path
const gamerId = computed(() => Number(route.params.id))
const queryText = (value: unknown) => typeof value === 'string' ? value : ''
const positiveQueryInt = (value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(queryText(value))
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : fallback
}
let applyingPaginationQuery = false
const isNew = computed(() => gamerId.value === 0)

const competeApi = useCompeteApi()
const authStore = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const deleting = ref(false)

// ─── State ────────────────────────────────────────────────────────────────────
const loading = ref(true)
const saving = ref(false)
const game = ref<Game | null>(null)
const myGamers = ref<Gamer[]>([])
const currentGamerId = computed(() => gamerId.value)
const currentGamer = ref<Gamer | null>(null)
const canEdit = computed(() => isNew.value || currentGamer.value?.userId === authStore.user?.id)

const formRef = ref<FormInst | null>(null)
const gamerForm = reactive({
  name: '',
  language: 'cpp17',
  code: '',
  type: 'code' as GamerKind,
  webhookUrl: '',
  webhookSecret: '',
})

// ─── Language mapping ─────────────────────────────────────────────────────────
const languageOptions = BOTZONE_LANGUAGE_OPTIONS
const editorLanguage = computed(() => botzoneEditorLanguage(gamerForm.language))
const draft = useCodeDraft(
  () => ({ code: gamerForm.code, language: gamerForm.language, title: gamerForm.name }),
  value => { gamerForm.code = value.code; gamerForm.language = value.language; gamerForm.name = value.title },
)
async function openTest() {
  if (!game.value || !gamerForm.code.trim()) return
  await navigateTo({ path: '/compete/playground', query: { gameId: game.value.id, ...(isNew.value ? {} : { gamerId: gamerId.value }), tab: 'bot' } })
}

function onLanguageChange(_lang: string) {
  // Trigger CodeEditor to re-initialize language mode; it watches the prop
}

// ─── Form rules ───────────────────────────────────────────────────────────────
const formRules = {
  name: [{ required: true, message: '请输入 Bot 名称', trigger: 'blur' }],
  language: [{ required: true, message: '请选择编程语言', trigger: 'change' }],
  code: [{ required: true, message: '请输入 Bot 代码', trigger: 'blur' }],
}

// ─── Init ─────────────────────────────────────────────────────────────────────
let loadVersion = 0
onBeforeUnmount(() => { loadVersion++ })
watch(() => [route.params.id, route.query.gameId, authStore.user?.id], async () => {
  const owner = authStore.user?.id
  const version = ++loadVersion
  if (!owner) return
  loading.value = true
  const current = () => version === loadVersion && authStore.user?.id === owner
  try {
    if (isNew.value) {
      const gameId = Number(route.query.gameId)
      if (!Number.isSafeInteger(gameId) || gameId < 1) { message.error('请先选择游戏'); await navigateTo('/compete'); return }
      const { data } = await competeApi.getGame(gameId)
      if (!current()) return
      game.value = data
      currentGamer.value = null
      gamerForm.type = 'code'
      draft.load(`new:${gameId}`, { title: '', language: 'python', code: '' })
      await fetchMyGamers(gameId)
    }
    else {
      const { data: gamer } = await competeApi.getGamer(gamerId.value)
      if (!current()) return
      currentGamer.value = gamer
      game.value = gamer.game ?? null
      gamerForm.type = gamer.type || 'code'
      gamerForm.webhookUrl = gamer.webhookUrl || ''
      gamerForm.webhookSecret = gamer.webhookSecret || ''
      draft.load(`bot:${gamer.id}`, { title: gamer.title, language: botzoneLanguage(gamer.language), code: gamer.code || '' })
      if (game.value) {
        await fetchMyGamers(game.value.id)
        if (!current()) return
        fetchEloRank(game.value.id, gamer.elo ?? 1200, gamer.id)
        fetchEloHistory(gamer.id)
        fetchGamerStats(gamer.id)
        fetchGamerMatches()
      }
    }
  }
  catch { if (current()) message.error('加载失败，请刷新后重试') }
  finally { if (current()) loading.value = false }
}, { immediate: true })

// ─── ELO History ──────────────────────────────────────────────────────────────
const eloHistory = ref<Array<{
  id: number; gamerId: number; matchId: number
  eloBefore: number; eloAfter: number; eloDelta: number; createdAt: string
}>>([])

const ELO_W = 400
const ELO_H = 140
const ELO_PAD = 28

const eloChartPoints = computed(() => {
  const hist = eloHistory.value
  if (hist.length < 2) return { points: [], minElo: 0, maxElo: 0 }
  const elos = hist.map(e => e.eloAfter)
  const rawMin = Math.min(...elos)
  const rawMax = Math.max(...elos)
  const pad2 = Math.max(20, Math.round((rawMax - rawMin) * 0.1))
  const minElo = rawMin - pad2
  const maxElo = rawMax + pad2
  const range = maxElo - minElo || 1
  const n = hist.length
  const points = hist.map((e, i) => ({
    x: (i / (n - 1)) * (ELO_W - ELO_PAD * 2) + ELO_PAD,
    y: ELO_H - ELO_PAD - ((e.eloAfter - minElo) / range) * (ELO_H - ELO_PAD * 2),
    elo: e.eloAfter,
    eloBefore: e.eloBefore,
    delta: e.eloDelta,
    index: i + 1,
  }))
  return { points, minElo, maxElo }
})

const eloPolylineStr = computed(() => {
  const { points } = eloChartPoints.value
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
})

const eloAreaPath = computed(() => {
  const { points } = eloChartPoints.value
  if (!points.length) return ''
  const start = points[0]
  const end = points[points.length - 1]
  const bottom = ELO_H - ELO_PAD
  const ptStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return `M ${start.x.toFixed(1)},${bottom} L ${ptStr} L ${end.x.toFixed(1)},${bottom} Z`
})

// ─── ELO Rank Bar ─────────────────────────────────────────────────────────────
const eloRankInfo = ref<{
  rank: number; total: number; minElo: number; maxElo: number; selfPct: number
  others: { id: number; name: string; elo: number; pct: number }[]
} | null>(null)

async function fetchEloRank(gameId: number, myElo: number, myGamerId: number) {
  try {
    const res = await competeApi.getLeaderboard(gameId, 'inner')
    const board: any[] = Array.isArray(res.data) ? res.data : []
    if (board.length < 2) return

    const elos = board.map((r: any) => Number(r.elo ?? 1200))
    const minElo = Math.min(...elos)
    const maxElo = Math.max(...elos)
    const range = maxElo - minElo || 1

    const pct = (elo: number) => Math.round(((elo - minElo) / range) * 90)  // 0-90% to leave room

    const sorted = [...board].sort((a: any, b: any) => b.elo - a.elo)
    const rank = sorted.findIndex((r: any) => r.gamerId === myGamerId) + 1

    eloRankInfo.value = {
      rank: rank > 0 ? rank : board.length,
      total: board.length,
      minElo, maxElo,
      selfPct: pct(myElo),
      others: board
        .filter((r: any) => r.gamerId !== myGamerId)
        .map((r: any) => ({ id: r.gamerId, name: r.name || `Bot#${r.gamerId}`, elo: Number(r.elo), pct: pct(Number(r.elo)) })),
    }
  } catch (e) { console.error('fetchEloRank', e) }
}

async function fetchEloHistory(id: number) {
  try {
    const res = await competeApi.getEloHistory(id)
    eloHistory.value = Array.isArray(res.data) ? res.data : []
  }
  catch (e) { console.error('fetchEloHistory', e) }
}

// ─── Gamer Stats ──────────────────────────────────────────────────────────────
const gamerStats = ref<{
  gamerId: number
  totalMatches: number
  wins: number
  losses: number
  draws: number
  winRate: number
  opponents: Array<{ gamerId: number; name: string; wins: number; losses: number; draws: number }>
} | null>(null)

async function fetchGamerStats(id: number) {
  try {
    const res = await competeApi.getGamerStats(id)
    gamerStats.value = res.data || null
  }
  catch (e) { console.error('fetchGamerStats', e) }
}

const statWinRatePct = computed(() => {
  if (!gamerStats.value) return 0
  if (gamerStats.value.winRate != null) return Math.round(gamerStats.value.winRate * 100)
  if (!gamerStats.value.totalMatches) return 0
  return Math.round((gamerStats.value.wins / gamerStats.value.totalMatches) * 100)
})

const statTopOpponents = computed(() => {
  if (!gamerStats.value?.opponents) return []
  return [...gamerStats.value.opponents]
    .sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws))
    .slice(0, 5)
})

function oppWinRatePct(opp: { wins: number; losses: number; draws: number }) {
  const total = opp.wins + opp.losses + opp.draws
  if (!total) return 0
  return Math.round((opp.wins / total) * 100)
}

// SVG Pie chart helpers
function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle)
  const end = polarToCartesian(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`
}

const statPieSectors = computed(() => {
  const s = gamerStats.value
  if (!s || !s.totalMatches) return []
  const total = s.totalMatches
  const segments = [
    { key: 'wins', value: s.wins, color: '#18a058' },
    { key: 'losses', value: s.losses, color: '#e03030' },
    { key: 'draws', value: s.draws, color: '#d0d0d0' },
  ]
  const nonZeroSegments = segments.filter(seg => seg.value > 0)
  if (nonZeroSegments.length === 1 && nonZeroSegments[0].value === total) {
    return [{ key: nonZeroSegments[0].key, color: nonZeroSegments[0].color, full: true, d: '' }]
  }

  const sectors: Array<{ key: string; d: string; color: string; full: boolean }> = []
  let currentAngle = -Math.PI / 2
  for (const seg of segments) {
    if (!seg.value) continue
    const sweep = (seg.value / total) * Math.PI * 2
    sectors.push({
      key: seg.key,
      d: arcPath(60, 60, 50, currentAngle, currentAngle + sweep),
      color: seg.color,
      full: false,
    })
    currentAngle += sweep
  }
  return sectors
})

async function fetchMyGamers(gameId: number) {
  try {
    const res = await competeApi.listGamers({ gameId, userId: authStore.user?.id, page: 1, perPage: 100 })
    const all: any[] = res.data.items || []
    myGamers.value = all.filter((g: any) => g.userId === authStore.user?.id)
  }
  catch (e) {
    console.error(e)
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────────
async function handleSave() {
  try {
    await formRef.value?.validate()
  }
  catch {
    return
  }

  saving.value = true
  const snapshot = draft.capture()
  const owner = authStore.user?.id
  try {
    const res = isNew.value
      ? await competeApi.createGamer({ gameId: game.value!.id, title: snapshot.data.title, code: snapshot.data.code, language: snapshot.data.language, opensource: false })
      : await competeApi.updateGamer(gamerId.value, {
          title: snapshot.data.title,
          ...(gamerForm.type === 'code' ? { code: snapshot.data.code, language: snapshot.data.language } : {}),
          ...(gamerForm.type === 'webhook' ? { webhookUrl: gamerForm.webhookUrl, webhookSecret: gamerForm.webhookSecret || undefined } : {}),
        })
    if (authStore.user?.id !== owner) return
    draft.markSaved(snapshot)
    message.success(`已保存 Bot #${res.data.id}${isNew.value ? '' : ' 的新版本'}`)
    if (draft.dirty.value) {
      message.info('保存期间新增的修改仍保留在本地草稿中')
      if (game.value) await fetchMyGamers(game.value.id)
      return
    }
    await navigateTo(`/compete/gamer/${res.data.id}`)
  }
  catch (e: any) { message.error(e?.response?.data?.message || '保存失败，草稿仍保留在本地') }
  finally { saving.value = false }
}

function confirmDelete() {
  dialog.warning({
    title: '删除 Bot',
    content: '确定删除这个 Bot 吗？有对局历史的 Bot 会被禁用（保留历史），无历史的 Bot 将彻底删除。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: handleDelete,
  })
}

async function handleDelete() {
  deleting.value = true
  try {
    const res = await competeApi.deleteGamer(gamerId.value)
    const d = res.data as any
    if (d?.deleted) {
      message.success('Bot 已彻底删除')
    } else {
      message.info('Bot 有对局历史，已禁用（不再参与对局）')
    }
    navigateTo(`/compete/${game.value?.id}`)
  } catch (e: any) {
    message.error(e?.response?.data?.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

// ─── 对局记录 ──────────────────────────────────────────────────────────────────
const gamerMatches = ref<any[]>([])
const gamerMatchesLoading = ref(false)
const gamerMatchesPage = ref(positiveQueryInt(route.query.page, 1))
const gamerMatchesPageSize = ref(positiveQueryInt(route.query.perPage, 10, 100))
const gamerMatchesTotal = ref(0)

async function fetchGamerMatches() {
  if (isNew.value) return
  gamerMatchesLoading.value = true
  try {
    const res = await competeApi.listMatches({
      gamerId: gamerId.value,
      page: gamerMatchesPage.value,
      perPage: gamerMatchesPageSize.value,
    })
    gamerMatches.value = res.data.items ?? []
    gamerMatchesTotal.value = res.data.total ?? 0
  }
  catch (e) {
    console.error('fetchGamerMatches', e)
  }
  finally {
    gamerMatchesLoading.value = false
  }
}

watch([gamerMatchesPage, gamerMatchesPageSize], () => {
  if (applyingPaginationQuery || isNew.value || router.currentRoute.value.path !== queryPagePath) return
  const query = { ...route.query }
  delete query.page
  delete query.perPage
  if (gamerMatchesPage.value > 1) query.page = String(gamerMatchesPage.value)
  if (gamerMatchesPageSize.value !== 10) query.perPage = String(gamerMatchesPageSize.value)
  void router.push({ query })
})

watch(() => route.query, async () => {
  if (router.currentRoute.value.path !== queryPagePath) return
  applyingPaginationQuery = true
  gamerMatchesPage.value = positiveQueryInt(route.query.page, 1)
  gamerMatchesPageSize.value = positiveQueryInt(route.query.perPage, 10, 100)
  await nextTick()
  applyingPaginationQuery = false
  if (!isNew.value) fetchGamerMatches()
}, { deep: true })

const gamerMatchColumns: DataTableColumns<any> = [
  {
    title: '对局 ID',
    key: 'id',
    width: 90,
    render(row) {
      if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) < 1) return h('span', '-')
      return h('a', { href: `/compete/matches/${row.id}` }, `#${row.id}`)
    },
  },
  {
    title: '对手',
    key: 'opponents',
    render(row) {
      const links: any[] = (row.links || []).filter((l: any) => l.gamerId !== gamerId.value)
      if (!links.length) return h('span', { style: 'color:#aaa' }, '-')
      const parts: any[] = []
      links.forEach((l: any, i: number) => {
        if (i > 0) parts.push(h('span', { style: 'color:#999;margin:0 3px' }, 'vs'))
        const gamerId = l.gamerId ?? l.gamer?.id
        const name = l.gamer?.title || l.gamer?.name || (gamerId ? `Bot#${gamerId}` : '-')
        parts.push(Number.isSafeInteger(Number(gamerId)) && Number(gamerId) > 0 ? h('a', { href: `/compete/gamer/${gamerId}` }, name) : h('span', name))
        const userId = l.userId ?? l.gamer?.userId ?? l.gamer?.user?.id
        const username = l.gamer?.user?.username || l.user?.username
        if (Number.isSafeInteger(Number(userId)) && Number(userId) > 0 && username) parts.push(h('a', { href: `/users/${userId}`, style: 'margin-left:4px' }, username))
      })
      return h('span', parts)
    },
  },
  {
    title: '结果',
    key: 'result',
    width: 90,
    render(row) {
      if (row.status !== 2) return h(NTag, { size: 'small', bordered: false }, { default: () => '-' })
      try {
        const fr = typeof row.result === 'string' ? JSON.parse(row.result).finalResult : row.result?.finalResult
        if (!fr) return h(NTag, { size: 'small', bordered: false }, { default: () => '-' })
        const myEntry = Object.entries(fr).find(([id]) => Number(id) === gamerId.value)
        if (!myEntry) return h(NTag, { size: 'small', bordered: false }, { default: () => '-' })
        const myScore = myEntry[1] as number
        const scores = Object.values(fr) as number[]
        const maxScore = Math.max(...scores)
        const allSame = scores.every(s => s === scores[0])
        if (allSame) return h(NTag, { type: 'warning', size: 'small', bordered: false }, { default: () => '平' })
        if (myScore === maxScore) return h(NTag, { type: 'success', size: 'small', bordered: false }, { default: () => '胜' })
        return h(NTag, { type: 'error', size: 'small', bordered: false }, { default: () => '负' })
      }
      catch { return h(NTag, { size: 'small', bordered: false }, { default: () => '-' }) }
    },
  },
  {
    title: 'ELO 变化',
    key: 'eloDelta',
    width: 100,
    render(row) {
      const link = (row.links || []).find((l: any) => l.gamerId === gamerId.value)
      const delta = link?.eloDelta
      if (delta == null) return h('span', { style: 'color:#aaa' }, '-')
      const color = delta > 0 ? '#18a058' : delta < 0 ? '#e03030' : '#aaa'
      return h('span', { style: `color:${color};font-weight:600` }, `${delta > 0 ? '+' : ''}${delta}`)
    },
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 160,
    render(row) {
      if (!row.createdAt) return h('span', '-')
      return h('span', new Date(row.createdAt).toLocaleString('zh-CN'))
    },
  },
]

useHead({ title: 'Bot 详情 — Leverage OJ' })
</script>

<style scoped>
:deep(a[href]) { color: var(--lv-color-accent); text-decoration: none; }
:deep(a[href]:hover) { text-decoration: underline; }
:deep(a[href]:focus-visible) { outline: 2px solid var(--lv-color-accent); outline-offset: 3px; }
.gamer-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-tip {
  padding: 8px 0;
  text-align: center;
}

.gamer-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}

.gamer-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.gamer-item-active {
  background: var(--n-color-hover);
  border-radius: 4px;
}

/* ELO Distribution Bar */
.elo-bar-wrapper {
  padding: 4px 2px;
}
.elo-bar-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #aaa;
  margin-bottom: 4px;
}
.elo-bar-track {
  position: relative;
  height: 16px;
  background: #f0f0f0;
  border-radius: 8px;
  margin: 0 4px;
}
.elo-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  cursor: default;
}
.elo-dot.other {
  background: #d0d0d0;
  border: 1px solid #bbb;
  z-index: 1;
}
.elo-dot.self {
  background: #18a058;
  border: 2px solid #fff;
  width: 14px;
  height: 14px;
  box-shadow: 0 0 0 2px #18a058;
  z-index: 2;
}
</style>
