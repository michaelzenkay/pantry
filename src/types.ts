export interface Ingredient {
  name: string
  quantity: string
  unit: string
}

export interface Recipe {
  id: string
  name: string
  cuisine: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  servings: number | null
  ingredients: Ingredient[]
  instructions: string[]
  tags: string[]
  rating: number | null
  notes: string | null
}

export interface PantryItem {
  id: string
  name: string
  quantity: string | null
  unit: string | null
  category: 'fridge' | 'freezer' | 'pantry' | 'spices'
  expiry_date: string | null
  notes: string | null
}

export type RecipeStatus = 'green' | 'yellow' | 'red'

export interface IngredientResult {
  name: string
  status: 'exact' | 'substitute' | 'missing'
  substituteWith?: string  // what's in the pantry that covers it
  similarity?: number      // 0–1
}

export interface RecipeWithStatus extends Recipe {
  status: RecipeStatus
  ingredientResults: IngredientResult[]
}

export function getSource(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/Source:\s*(\S+)/)
  if (!m) return ''
  const d = m[1].toLowerCase()
  if (d.includes('madewithlau')) return 'Lau'
  if (d.includes('doobydobap'))  return 'Dooby'
  if (d.includes('lifebymikeg')) return 'Mike G'
  if (d.includes('seriouseats')) return 'Kenji'
  return d
}

export function getSourceUrl(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/Source:\s*(https?:\/\/\S+)/)
  return m?.[1] ?? ''
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export type Day = typeof DAYS[number]
export type WeekPlan = Partial<Record<Day, string[]>>
