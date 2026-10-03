export interface OfficialExample {
  key: string
  title: string
  status: 'missing' | 'ready' | 'conflict'
  gameId?: number
  opponents: { id: number; title: string }[]
  starter: { language: string; code: string }
  message?: string
}
