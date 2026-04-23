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
  similarity?: number      // 0-1
}

export interface RecipeWithStatus extends Recipe {
  status: RecipeStatus
  ingredientResults: IngredientResult[]
}

function formatSourceHost(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  const root = host.split('.').slice(0, -1).join('.') || host

  const known: Record<string, string> = {
    madewithlau: 'Lau',
    doobydobap: 'Dooby',
    lifebymikeg: 'Mike G',
    seriouseats: 'Kenji',
  }

  if (known[root]) return known[root]

  return root.replace(/[._-]+/g, '')
}

export function getSource(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/Source:\s*(\S+)/)
  if (!m) return ''
  const source = m[1].trim()

  try {
    const url = new URL(source)
    return formatSourceHost(url.hostname)
  } catch {
    return source
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .replace(/\.[a-z]{2,}$/, '')
      .replace(/[._-]+/g, '')
  }
}

export function getSourceUrl(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/Source:\s*(https?:\/\/\S+)/)
  return m?.[1] ?? ''
}

export function getRecipeCuisines(name: string, cuisine: string | null): string[] {
  if (name.toLowerCase().includes('miso mashed potatoes')) return ['Korean', 'Japanese']
  if (!cuisine) return []

  const seen = new Set<string>()
  return cuisine
    .split(/[\/,&+]|(?:\s+and\s+)/i)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase()
      if (lower === 'fusion') return ''
      if (lower === 'baking') return 'Baking'
      return part
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    })
    .filter(Boolean)
    .filter(part => {
      const key = part.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function formatRecipeCuisine(name: string, cuisine: string | null): string {
  const cuisines = getRecipeCuisines(name, cuisine)
  return cuisines.length > 0 ? cuisines.join(' / ') : '--'
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export type Day = typeof DAYS[number]
export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const
export type MealSlot = typeof MEAL_SLOTS[number]
export const COURSE_SLOTS = ['app', 'main'] as const
export type CourseSlot = typeof COURSE_SLOTS[number]

export type DishType = 'app' | 'main' | 'sauce' | 'baked' | 'soup' | 'rice' | 'noodles' | 'veggies'

export interface PlannedRecipe {
  recipeId: string
  meal: MealSlot
  course: CourseSlot
}

export type WeekPlan = Partial<Record<Day, PlannedRecipe[]>>

export interface MadeHistoryEntry {
  id: string
  recipeId: string
  recipeName: string
  day: Day
  meal: MealSlot
  course: CourseSlot
  madeAt: string
  rating: number | null
}

export type RecipeRatings = Record<string, number>

export interface ShoppingListItem {
  id: string
  name: string
  count: number
  done: boolean
  source: 'manual' | 'week'
}

export interface PlannerState {
  weekPlan: WeekPlan
  history: MadeHistoryEntry[]
  overrides: string[]
  planned: string[]
  recipeRatings: RecipeRatings
  shoppingList: ShoppingListItem[]
}
