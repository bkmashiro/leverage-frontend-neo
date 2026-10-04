import { useApi } from '~/composables/useApi'

export function useSettingsApi() {
  const api = useApi()
  return {
    list: () => api.get<any[]>('/settings'),
    public: () => api.get<Record<string, string>>('/settings/public'),
    get: (key: string) => api.get<{ key: string; valueString: string; valueNumber: number | null }>(`/settings/${key}`),
    update: (key: string, value: string) => api.post('/settings', { key, value }),
  }
}
