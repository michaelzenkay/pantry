import type { RecipeWithStatus, ShoppingListItem, WeekPlan } from '../types'
import { DAYS } from '../types'

export interface WeekShoppingEntry {
  name: string
  count: number
}

export function normalizeShoppingName(name: string): string {
  return name.trim().toLowerCase()
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `shopping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getWeekShoppingEntries(computed: RecipeWithStatus[], weekPlan: WeekPlan): WeekShoppingEntry[] {
  const recipeMap = new Map(computed.map(recipe => [recipe.id, recipe]))
  const counts = new Map<string, WeekShoppingEntry>()

  for (const day of DAYS) {
    for (const entry of weekPlan[day] ?? []) {
      const recipe = recipeMap.get(entry.recipeId)
      if (!recipe) continue

      for (const ingredient of recipe.ingredientResults) {
        if (ingredient.status !== 'missing') continue
        const key = normalizeShoppingName(ingredient.name)
        const existing = counts.get(key)
        if (existing) {
          existing.count += 1
        } else {
          counts.set(key, { name: ingredient.name.trim(), count: 1 })
        }
      }
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function addManualShoppingItem(existing: ShoppingListItem[], name: string): ShoppingListItem[] {
  const trimmed = name.trim()
  if (!trimmed) return existing

  const key = normalizeShoppingName(trimmed)
  if (existing.some(item => normalizeShoppingName(item.name) === key)) return existing

  return [
    { id: createId(), name: trimmed, count: 1, done: false, source: 'manual' },
    ...existing,
  ]
}

export function mergeWeekShoppingItems(existing: ShoppingListItem[], additions: WeekShoppingEntry[]): ShoppingListItem[] {
  if (additions.length === 0) return existing

  const seen = new Set(existing.map(item => normalizeShoppingName(item.name)))
  const next = [...existing]

  for (const addition of additions) {
    const trimmed = addition.name.trim()
    if (!trimmed) continue
    const key = normalizeShoppingName(trimmed)
    if (seen.has(key)) continue

    next.unshift({
      id: createId(),
      name: trimmed,
      count: Math.max(1, addition.count),
      done: false,
      source: 'week',
    })
    seen.add(key)
  }

  return next
}

export function removeShoppingItemByName(existing: ShoppingListItem[], name: string): ShoppingListItem[] {
  const key = normalizeShoppingName(name)
  return existing.filter(item => normalizeShoppingName(item.name) !== key)
}
