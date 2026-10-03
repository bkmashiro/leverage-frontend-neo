import { useApi } from '~/composables/useApi'
import type { OfficialExample } from '~/types/official-example'
import type { EloEntry, Game, GameInput, Gamer, GamerInput, JudgeTestInput, LeaderboardEntry, Match, PageResult } from '~/types/compete'

export function useCompeteApi() {
  const api = useApi()
  return {
    listExamples: () => api.get<{ items: OfficialExample[] }>('/compete/examples'),
    listGames: (params?: { page?: number; perPage?: number }) =>
      api.get<PageResult<Game>>('/compete/games', { params }),
    getGame: (id: number) => api.get<Game>(`/compete/games/${id}`),
    updateGame: (id: number, dto: Partial<GameInput>) => api.patch<Game>(`/compete/games/${id}`, dto),
    runPlaygroundJudge: (gameId: number, dto: JudgeTestInput) =>
      api.post<{ matchId: number; testGamerIds: number[] }>(`/compete/games/${gameId}/playground-judge`, dto),
    runPlayground: (gameId: number, dto: { code: string; language: string; opponentGamerId: number }) =>
      api.post<{ matchId: number; testGamerId: number }>(`/compete/games/${gameId}/playground`, dto),
    deleteGame: (id: number) => api.delete(`/compete/games/${id}`),
    createGame: (dto: GameInput) => api.post<Game>('/compete/games', dto),
    getLeaderboard: (gameId: number, board: 'inner' | 'outer' = 'inner') =>
      api.get<LeaderboardEntry[]>(`/compete/games/${gameId}/leaderboard`, { params: { board } }),
    listGamers: (params: { gameId?: number; userId?: number; page?: number; perPage?: number }) =>
      api.get<PageResult<Gamer>>('/compete/gamers', { params }),
    createGamer: (dto: GamerInput) => api.post<Gamer>('/compete/gamers', dto),
    updateGamer: (id: number, dto: Partial<Omit<GamerInput, 'gameId'>>) => api.patch<Gamer>(`/compete/gamers/${id}`, dto),
    triggerAutoMatch: (gameId: number, topN = 8) =>
      api.post<{ created: number; matchIds: number[] }>(`/compete/games/${gameId}/trigger-auto-match?topN=${topN}`),
    botTurnPoll: (gamerId: number) =>
      api.get<{ turnToken: string; gameState: unknown } | null>('/compete/bot-turn', { params: { gamerId } }),
    botRespond: (turnToken: string, response: string) =>
      api.post<{ ok: boolean }>('/compete/bot-respond', { turnToken, response }),
    getGamer: (id: number) => api.get<Gamer>(`/compete/gamers/${id}`),
    getEloHistory: (gamerId: number) => api.get<EloEntry[]>(`/compete/gamers/${gamerId}/elo-history`),
    getGameJudger: (id: number) => api.get<{ judgerCode: string; judgerLanguage: string }>(`/compete/games/${id}/judger`),
    deleteGamer: (id: number) => api.delete(`/compete/gamers/${id}`),
    listMatches: (params: { gameId?: number; gamerId?: number; page?: number; perPage?: number; status?: number; isTest?: boolean }) =>
      api.get<PageResult<Match>>('/compete/matches', { params }),
    getMatch: (id: number) => api.get<Match>(`/compete/matches/${id}`),
    launchMatch: (gameId: number, gamerIds: number[]) =>
      api.post<Match>('/compete/matches', { gameId, gamerIds }),
    // Rooms retain their separate lifecycle; they are not the default Bot workflow.
    listRooms: (params?: { gameId?: number }) => api.get<any[]>('/compete/rooms', { params }),
    getRoom: (id: number) => api.get<any>(`/compete/rooms/${id}`),
    createRoom: (dto: { gameId: number }) => api.post<any>('/compete/rooms', dto),
    openRoom: (id: number) => api.put<any>(`/compete/rooms/${id}/open`),
    closeRoom: (id: number) => api.put<any>(`/compete/rooms/${id}/close`),
    submitGamerToRoom: (roomId: number, gamerId: number) =>
      api.post<any>(`/compete/rooms/${roomId}/submit`, { gamerId }),
    startRoom: (id: number) => api.post<any>(`/compete/rooms/${id}/start`),
    getGlobalLeaderboard: (params: { gameId?: number; limit?: number; board?: string }) =>
      api.get<LeaderboardEntry[]>('/compete/leaderboard', { params }),
    getGamerStats: (gamerId: number) => api.get<any>(`/compete/gamers/${gamerId}/stats`),
  }
}
