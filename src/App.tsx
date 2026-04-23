import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from './lib/api'
import RecipeTable from './components/RecipeTable'
import RecipeFilters, { DEFAULT_FILTERS } from './components/RecipeFilters'
import PantryPanel from './components/PantryPanel'
import CalendarPanel from './components/CalendarPanel'
import WeekPlanner from './components/WeekPlanner'
import type { DishType, MadeHistoryEntry, PlannedRecipe, Recipe, PantryItem, Day, WeekPlan, RecipeWithStatus } from './types'
import { DAYS, getRecipeCuisines, getSource } from './types'
import { computeRecipes, getDishTypes, getRecipeProteins } from './lib/matching'
import type { FilterState } from './components/RecipeFilters'

type Tab = 'recipes' | 'calendar' | 'pantry'

const WEEK_PLAN_KEY = 'pantry_week_plan'
const OVERRIDES_KEY = 'pantry_overrides'
const PLANNED_KEY   = 'pantry_planned'
const HISTORY_KEY   = 'pantry_made_history'

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { return new Set() }
}
function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]))
}
function loadWeekPlan(): WeekPlan {
  try {
    const raw = JSON.parse(localStorage.getItem(WEEK_PLAN_KEY) ?? '{}') as Record<string, unknown>
    const next: WeekPlan = {}
    for (const day of DAYS) {
      const value = raw[day]
      if (!Array.isArray(value)) continue
      next[day] = value
        .map((entry): PlannedRecipe | null => {
          if (typeof entry === 'string') return { recipeId: entry, meal: 'dinner', course: 'main' }
          if (entry && typeof entry === 'object' && 'recipeId' in entry) {
            const candidate = entry as Partial<PlannedRecipe>
            return {
              recipeId: String(candidate.recipeId),
              meal: candidate.meal ?? 'dinner',
              course: candidate.course ?? 'main',
            }
          }
          return null
        })
        .filter((entry): entry is PlannedRecipe => !!entry)
    }
    return next
  } catch { return {} }
}
function saveWeekPlan(plan: WeekPlan) {
  localStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(plan))
}
function loadHistory(): MadeHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}
function saveHistory(history: MadeHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export default function App() {
  const [tab, setTab]         = useState<Tab>('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pantry, setPantry]   = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(() => ({ ...DEFAULT_FILTERS, cuisines: new Set(), proteins: new Set(), sources: new Set(), dishTypes: new Set() }))
  const [weekPlan, setWeekPlan]   = useState<WeekPlan>(loadWeekPlan)
  const [overrides, setOverrides] = useState<Set<string>>(() => loadSet(OVERRIDES_KEY))
  const [planned, setPlanned]     = useState<Set<string>>(() => loadSet(PLANNED_KEY))
  const [history, setHistory]     = useState<MadeHistoryEntry[]>(loadHistory)

  useEffect(() => {
    Promise.all([api.recipes.list(), api.pantry.list()])
      .then(([r, p]) => {
        setRecipes(r)
        setPantry(p)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Unable to load pantry data.')
      })
      .finally(() => setLoading(false))
  }, [])

  const allOverrides = useMemo(() => new Set([...overrides, ...planned]), [overrides, planned])
  const computed = useMemo(() => computeRecipes(recipes, pantry, allOverrides), [recipes, pantry, allOverrides])

  // Compute what changes if one more ingredient were available
  const computeImpact = useCallback((ingredient: string): RecipeWithStatus[] => {
    const hypothetical = computeRecipes(recipes, pantry, new Set([...allOverrides, ingredient.toLowerCase()]))
    return hypothetical.filter(h => {
      const current = computed.find(c => c.id === h.id)
      if (!current) return false
      const order: Record<string, number> = { green: 0, yellow: 1, red: 2 }
      return order[h.status] < order[current.status]
    })
  }, [recipes, pantry, computed, allOverrides])

  function markHave(ingredient: string) {
    setOverrides(prev => {
      const next = new Set([...prev, ingredient.toLowerCase()])
      saveSet(OVERRIDES_KEY, next)
      return next
    })
    setPlanned(prev => {
      const next = new Set(prev)
      next.delete(ingredient.toLowerCase())
      saveSet(PLANNED_KEY, next)
      return next
    })
  }

  function markPlanned(ingredient: string) {
    setPlanned(prev => {
      const next = new Set([...prev, ingredient.toLowerCase()])
      saveSet(PLANNED_KEY, next)
      return next
    })
    setOverrides(prev => {
      const next = new Set(prev)
      next.delete(ingredient.toLowerCase())
      saveSet(OVERRIDES_KEY, next)
      return next
    })
  }

  function unmark(ingredient: string) {
    const key = ingredient.toLowerCase()
    setOverrides(prev => { const n = new Set(prev); n.delete(key); saveSet(OVERRIDES_KEY, n); return n })
    setPlanned(prev => { const n = new Set(prev); n.delete(key); saveSet(PLANNED_KEY, n); return n })
  }

  const availableCuisines = useMemo(
    () => [...new Set(recipes.flatMap(r => getRecipeCuisines(r.name, r.cuisine)))].sort(),
    [recipes]
  )
  const availableProteins = useMemo(() => {
    const all = new Set<string>()
    computed.forEach(r => getRecipeProteins(r).forEach(p => all.add(p)))
    return [...all].sort()
  }, [computed])
  const availableSources = useMemo(
    () => [...new Set(recipes.map(r => getSource(r.notes)).filter(Boolean))].sort(),
    [recipes]
  )
  const availableDishTypes = useMemo(() => {
    const all = new Set<DishType>()
    computed.forEach(recipe => getDishTypes(recipe).forEach(dishType => all.add(dishType)))
    return [...all].sort()
  }, [computed])
  const maxMissingCount = useMemo(
    () => computed.reduce((max, recipe) => Math.max(max, recipe.ingredientResults.filter(result => result.status === 'missing').length), 0),
    [computed]
  )

  const statusCounts = useMemo(() => ({
    all:    computed.length,
    green:  computed.filter(r => r.status === 'green').length,
    yellow: computed.filter(r => r.status === 'yellow').length,
    red:    computed.filter(r => r.status === 'red').length,
  }), [computed])

  function addToWeek(recipeId: string, day: Day) {
    setWeekPlan(prev => {
      const dayList = prev[day] ?? []
      const next = dayList.some(entry => entry.recipeId === recipeId)
        ? { ...prev, [day]: dayList.filter(entry => entry.recipeId !== recipeId) }
        : { ...prev, [day]: [...dayList, { recipeId, meal: 'dinner', course: 'main' } satisfies PlannedRecipe] }
      saveWeekPlan(next)
      return next
    })
  }
  function removeFromWeek(recipeId: string, day: Day) {
    setWeekPlan(prev => {
      const next = { ...prev, [day]: (prev[day] ?? []).filter(entry => entry.recipeId !== recipeId) }
      saveWeekPlan(next)
      return next
    })
  }

  async function markMade(recipe: RecipeWithStatus, day: Day, rating: number | null) {
    if (rating !== null) await updateRecipe(recipe.id, { rating })
    const plannedEntry = (weekPlan[day] ?? []).find(entry => entry.recipeId === recipe.id)
    const entry: MadeHistoryEntry = {
      id: `${Date.now()}-${recipe.id}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      day,
      meal: plannedEntry?.meal ?? 'dinner',
      course: plannedEntry?.course ?? 'main',
      madeAt: new Date().toISOString(),
      rating,
    }
    setHistory(prev => {
      const next = [entry, ...prev].slice(0, 100)
      saveHistory(next)
      return next
    })
    removeFromWeek(recipe.id, day)
  }

  function clearHistory() {
    setHistory([])
    saveHistory([])
  }

  async function updateRecipe(recipeId: string, patch: Partial<Recipe>) {
    const updated = await api.recipes.update(recipeId, patch)
    setRecipes(prev => prev.map(recipe => recipe.id === recipeId ? updated : recipe))
  }

  async function deleteRecipe(recipeId: string) {
    await api.recipes.remove(recipeId)
    setRecipes(prev => prev.filter(recipe => recipe.id !== recipeId))
    setWeekPlan(prev => {
      const next = Object.fromEntries(
        DAYS.map(day => [day, (prev[day] ?? []).filter(entry => entry.recipeId !== recipeId)])
      ) as WeekPlan
      saveWeekPlan(next)
      return next
    })
  }

  const weekCount = DAYS.reduce((sum, d) => sum + (weekPlan[d]?.length ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Pantry</h1>
          <nav className="flex gap-1">
            {(['recipes', 'calendar', 'pantry'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  tab === t ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t}
                {t === 'calendar' && weekCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">{weekCount}</span>
                )}
                {t === 'pantry' && !loading && (
                  <span className="ml-1.5 text-xs opacity-70">{pantry.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="px-6 py-6 max-w-screen-xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center mt-16 text-gray-400 text-sm gap-2">
            <span className="animate-spin inline-block">⟳</span> Loading...
          </div>
        ) : loadError ? (
          <div className="max-w-xl mx-auto mt-16 bg-white border border-red-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-red-700">Could not reach the pantry API</h2>
            <p className="text-sm text-gray-600 mt-2">{loadError}</p>
            <p className="text-xs text-gray-400 mt-3">
              Frontend API URL: {import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}
            </p>
          </div>
        ) : tab === 'recipes' ? (
          <div className="space-y-4">
            {weekCount > 0 && (
              <div className="sticky top-[73px] z-20 bg-gray-50/95 backdrop-blur border-b border-gray-100 pt-1 pb-2">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">This Week</h2>
                <WeekPlanner computed={computed} weekPlan={weekPlan} onRemove={removeFromWeek} />
              </div>
            )}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <label className="block">
                <span className="sr-only">Search recipes</span>
                <input
                  value={filters.query}
                  onChange={e => setFilters(prev => ({ ...prev, query: e.target.value }))}
                  placeholder="Search recipes, ingredients, tags, cuisine, or source..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </label>
            </div>
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <RecipeFilters
                filters={filters}
                onChange={setFilters}
                maxMissingCount={maxMissingCount}
                availableCuisines={availableCuisines}
                availableProteins={availableProteins}
                availableSources={availableSources}
                availableDishTypes={availableDishTypes}
                counts={statusCounts}
              />
              <div className="order-3 lg:order-2 flex-1 min-w-0 w-full">
                <RecipeTable
                  computed={computed}
                  filters={filters}
                  weekPlan={weekPlan}
                  overrides={overrides}
                  planned={planned}
                  onAddToWeek={addToWeek}
                  onMarkHave={markHave}
                  onMarkPlanned={markPlanned}
                  onUnmark={unmark}
                  computeImpact={computeImpact}
                  onUpdateRecipe={updateRecipe}
                  onDeleteRecipe={deleteRecipe}
                />
              </div>
            </div>
          </div>
        ) : tab === 'calendar' ? (
          <CalendarPanel
            computed={computed}
            pantry={pantry}
            weekPlan={weekPlan}
            history={history}
            onRemove={removeFromWeek}
            onMarkMade={markMade}
            onClearHistory={clearHistory}
          />
        ) : (
          <div className="max-w-3xl">
            <PantryPanel pantry={pantry} onUpdate={setPantry} />
          </div>
        )}
      </main>
    </div>
  )
}
