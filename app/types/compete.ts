export type GamerKind = 'code' | 'webhook' | 'human' | 'external'
export interface PageResult<T> { items: T[]; total: number }

/** Botzone runtime strings are distinct from the OJ language IDs. */
export interface GameInput {
  title: string
  description: string
  gamerQuantity: number
  timeLimit: number
  memoryLimit: number
  disabled?: boolean
  allowHuman?: boolean
  autoMatchEnabled?: boolean
  judgerCode?: string
  judgerLanguage?: string
  rendererHtml?: string | null
}
export interface Game extends GameInput {
  id: number
  name?: string
  activeBotCount?: number
  createdAt?: string
  updatedAt?: string
}
export interface GamerInput {
  gameId: number
  title: string
  type?: GamerKind
  language?: string
  code?: string
  opensource?: boolean
  webhookUrl?: string
  webhookSecret?: string
  note?: string
}
export interface Gamer extends Omit<GamerInput, 'webhookUrl' | 'webhookSecret'> {
  id: number
  userId: number
  name?: string
  type: GamerKind
  language: string
  elo: number
  eloExternal?: number
  disabled: boolean
  isTest?: boolean
  game?: Game
  user?: { id: number; username: string }
  webhookUrl?: string | null
  webhookSecret?: string | null
  botApiKey?: string
  createdAt?: string
  updatedAt?: string
}
export interface Match {
  id: number
  gameId: number
  game?: Game
  status: number
  isTest?: boolean
  externalJobId?: string | null
  result?: string | Record<string, unknown> | null
  score?: string[] | null
  links?: Array<{ gamerId: number; gamer?: Gamer; won?: boolean }>
  createdAt?: string
  updatedAt?: string
}
export interface LeaderboardEntry {
  gamerId: number
  name: string
  type?: GamerKind
  elo: number
  wins: number
  total: number
  winRate: number
}
export interface InlineBot {
  gamerId?: number
  code?: string
  language?: string
}
export interface JudgeTestInput {
  judgerCode?: string
  judgerLanguage?: string
  bot0: InlineBot
  bot1: InlineBot
}
export interface EloEntry {
  id: number
  gamerId: number
  matchId: number
  eloBefore: number
  eloAfter: number
  eloDelta: number
  createdAt: string
}
