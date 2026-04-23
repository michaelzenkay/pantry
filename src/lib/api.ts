const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function post<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export const api = {
  recipes: {
    list: () => get<import('../types').Recipe[]>('/recipes'),
    update: (id: string, patch: Partial<import('../types').Recipe>) =>
      post<import('../types').Recipe>(`/recipes/${id}`, patch, 'PATCH'),
    remove: (id: string) => del(`/recipes/${id}`),
  },
  pantry: {
    list: (category?: string) =>
      get<import('../types').PantryItem[]>(`/pantry${category ? `?category=${category}` : ''}`),
    add: (item: Omit<import('../types').PantryItem, 'id'>) =>
      post<import('../types').PantryItem>('/pantry', item),
    remove: (id: string) => del(`/pantry/${id}`),
  },
}
