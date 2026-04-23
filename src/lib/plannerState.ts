import type { CourseSlot, Day, MadeHistoryEntry, MealSlot, PlannerState, PlannedRecipe, RecipeRatings, ShoppingListItem, WeekPlan } from '../types'
import { COURSE_SLOTS, DAYS, MEAL_SLOTS } from '../types'

const WEEK_PLAN_KEY = 'pantry_week_plan'
const OVERRIDES_KEY = 'pantry_overrides'
const PLANNED_KEY = 'pantry_planned'
const HISTORY_KEY = 'pantry_made_history'
const RECIPE_RATINGS_KEY = 'pantry_recipe_ratings'
const SHOPPING_LIST_KEY = 'pantry_shopping_list'

function normalizeDay(value: unknown): Day | null {
  return typeof value === 'string' && DAYS.includes(value as Day) ? value as Day : null
}

function normalizeMeal(value: unknown): MealSlot {
  return typeof value === 'string' && MEAL_SLOTS.includes(value as MealSlot) ? value as MealSlot : 'dinner'
}

function normalizeCourse(value: unknown): CourseSlot {
  return typeof value === 'string' && COURSE_SLOTS.includes(value as CourseSlot) ? value as CourseSlot : 'main'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean))]
}

export function normalizeWeekPlan(raw: unknown): WeekPlan {
  const next: WeekPlan = {}
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}

  for (const day of DAYS) {
    const value = source[day]
    if (!Array.isArray(value)) continue

    next[day] = value
      .map((entry): PlannedRecipe | null => {
        if (typeof entry === 'string') return { recipeId: entry, meal: 'dinner', course: 'main' }
        if (entry && typeof entry === 'object' && 'recipeId' in entry) {
          const candidate = entry as Partial<PlannedRecipe>
          if (typeof candidate.recipeId !== 'string' || !candidate.recipeId.trim()) return null
          return {
            recipeId: candidate.recipeId,
            meal: normalizeMeal(candidate.meal),
            course: normalizeCourse(candidate.course),
          }
        }
        return null
      })
      .filter((entry): entry is PlannedRecipe => !!entry)
  }

  return next
}

function normalizeHistory(raw: unknown): MadeHistoryEntry[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry): MadeHistoryEntry | null => {
      if (!entry || typeof entry !== 'object') return null
      const candidate = entry as Partial<MadeHistoryEntry>
      if (typeof candidate.id !== 'string' || typeof candidate.recipeId !== 'string' || typeof candidate.recipeName !== 'string' || typeof candidate.madeAt !== 'string') {
        return null
      }

      const day = normalizeDay(candidate.day)
      if (!day) return null

      return {
        id: candidate.id,
        recipeId: candidate.recipeId,
        recipeName: candidate.recipeName,
        day,
        meal: normalizeMeal(candidate.meal),
        course: normalizeCourse(candidate.course),
        madeAt: candidate.madeAt,
        rating: typeof candidate.rating === 'number' && Number.isFinite(candidate.rating) ? candidate.rating : null,
      }
    })
    .filter((entry): entry is MadeHistoryEntry => !!entry)
}

function normalizeRecipeRatings(raw: unknown): RecipeRatings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  return Object.fromEntries(
    Object.entries(raw)
      .filter((entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number' && Number.isFinite(entry[1]))
      .map(([recipeId, rating]) => [recipeId, Math.max(1, Math.min(5, Math.round(rating)))]),
  )
}

function normalizeShoppingList(raw: unknown): ShoppingListItem[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry, index): ShoppingListItem | null => {
      if (!entry || typeof entry !== 'object') return null
      const candidate = entry as Partial<ShoppingListItem>
      if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null

      const source = candidate.source === 'week' ? 'week' : 'manual'
      const count = typeof candidate.count === 'number' && Number.isFinite(candidate.count)
        ? Math.max(1, Math.round(candidate.count))
        : 1

      return {
        id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : `shopping-${index}-${candidate.name.trim().toLowerCase()}`,
        name: candidate.name.trim(),
        count,
        done: candidate.done === true,
        source,
      }
    })
    .filter((entry): entry is ShoppingListItem => !!entry)
}

function mergeLegacyPlannedItems(items: ShoppingListItem[], plannedNames: string[]): ShoppingListItem[] {
  if (plannedNames.length === 0) return items

  const seen = new Set(items.map(item => item.name.trim().toLowerCase()))
  const next = [...items]

  for (const name of plannedNames) {
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue

    next.push({
      id: `planned-${key}`,
      name: trimmed,
      count: 1,
      done: false,
      source: 'manual',
    })
    seen.add(key)
  }

  return next
}

export function createEmptyPlannerState(): PlannerState {
  return {
    weekPlan: {},
    history: [],
    overrides: [],
    planned: [],
    recipeRatings: {},
    shoppingList: [],
  }
}

export function normalizePlannerState(raw: Partial<PlannerState> | null | undefined): PlannerState {
  const shoppingList = normalizeShoppingList(raw?.shoppingList)
  const planned = normalizeStringArray(raw?.planned)

  return {
    weekPlan: normalizeWeekPlan(raw?.weekPlan),
    history: normalizeHistory(raw?.history),
    overrides: [],
    planned: [],
    recipeRatings: normalizeRecipeRatings(raw?.recipeRatings),
    shoppingList: mergeLegacyPlannedItems(shoppingList, planned),
  }
}

export function isPlannerStateEmpty(state: PlannerState): boolean {
  const hasWeekPlan = DAYS.some(day => (state.weekPlan[day] ?? []).length > 0)
  return !hasWeekPlan
    && state.history.length === 0
    && Object.keys(state.recipeRatings).length === 0
    && state.shoppingList.length === 0
}

export function loadPlannerStateLocal(): PlannerState {
  try {
    const rawWeekPlan = JSON.parse(localStorage.getItem(WEEK_PLAN_KEY) ?? '{}') as unknown
    const rawHistory = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as unknown
    const rawOverrides = JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '[]') as unknown
    const rawPlanned = JSON.parse(localStorage.getItem(PLANNED_KEY) ?? '[]') as unknown
    const rawRecipeRatings = JSON.parse(localStorage.getItem(RECIPE_RATINGS_KEY) ?? '{}') as unknown
    const rawShoppingList = JSON.parse(localStorage.getItem(SHOPPING_LIST_KEY) ?? '[]') as unknown

    return normalizePlannerState({
      weekPlan: normalizeWeekPlan(rawWeekPlan),
      history: normalizeHistory(rawHistory),
      overrides: normalizeStringArray(rawOverrides),
      planned: normalizeStringArray(rawPlanned),
      recipeRatings: normalizeRecipeRatings(rawRecipeRatings),
      shoppingList: normalizeShoppingList(rawShoppingList),
    })
  } catch {
    return createEmptyPlannerState()
  }
}

export function savePlannerStateLocal(state: PlannerState) {
  localStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(state.weekPlan))
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history))
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(state.overrides))
  localStorage.setItem(PLANNED_KEY, JSON.stringify(state.planned))
  localStorage.setItem(RECIPE_RATINGS_KEY, JSON.stringify(state.recipeRatings))
  localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(state.shoppingList))
}
