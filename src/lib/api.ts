// On first visit with ?uid=, persist to localStorage and clean the URL
function initUserId(): string {
  const params = new URLSearchParams(window.location.search)
  const uid = params.get('uid')
  if (uid) {
    localStorage.setItem('pantry_uid', uid)
    const url = new URL(window.location.href)
    url.searchParams.delete('uid')
    window.history.replaceState({}, '', url.toString())
  }
  return localStorage.getItem('pantry_uid') ?? ''
}

const USER_ID = initUserId()
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (USER_ID) h['x-user-id'] = USER_ID
  return h
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: headers() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() })
  if (!res.ok) throw new Error(await res.text())
}

export const api = {
  recipes: {
    list: () => get<import('../types').Recipe[]>('/recipes'),
    update: (id: string, patch: Partial<import('../types').Recipe>) =>
      post<import('../types').Recipe>(`/recipes/${id}`, patch, 'PATCH'),
    remove: (id: string) => del(`/recipes/${id}`),
  },
  plannerState: {
    get: () => get<import('../types').PlannerState>('/planner-state'),
    update: (state: import('../types').PlannerState) =>
      post<import('../types').PlannerState>('/planner-state', state, 'PATCH'),
  },
  pantry: {
    list: (category?: string) =>
      get<import('../types').PantryItem[]>(`/pantry${category ? `?category=${category}` : ''}`),
    add: (item: Omit<import('../types').PantryItem, 'id'>) =>
      post<import('../types').PantryItem>('/pantry', item),
    update: (id: string, patch: Partial<import('../types').PantryItem>) =>
      post<import('../types').PantryItem>(`/pantry/${id}`, patch, 'PATCH'),
    remove: (id: string) => del(`/pantry/${id}`),
  },
}
