import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from './lib/api'
import RecipeTable from './components/RecipeTable'
import RecipeFilters, { DEFAULT_FILTERS } from './components/RecipeFilters'
import PantryPanel from './components/PantryPanel'
import WeekPanel from './components/WeekPanel'
import type { Recipe, PantryItem, Day, WeekPlan, RecipeWithStatus } from './types'
import { DAYS, getSource } from './types'
import { computeRecipes, getRecipeProteins } from './lib/matching'
import type { FilterState } from './components/RecipeFilters'

type Tab = 'recipes' | 'pantry'

const WEEK_PLAN_KEY = 'pantry_week_plan'
const OVERRIDES_KEY = 'pantry_overrides'
const PLANNED_KEY   = 'pantry_planned'

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { return new Set() }
}
function saveSet(key: string, s: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...s]))
}
function loadWeekPlan(): WeekPlan {
  try { return JSON.parse(localStorage.getItem(WEEK_PLAN_KEY) ?? '{}') } catch { return {} }
}
function saveWeekPlan(plan: WeekPlan) {
  localStorage.setItem(WEEK_PLAN_KEY, JSON.stringify(plan))
}

export default function App() {
  const [tab, setTab]         = useState<Tab>('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pantry, setPantry]   = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(() => ({ ...DEFAULT_FILTERS, cuisines: new Set(), proteins: new Set(), sources: new Set() }))
  const [weekPlan, setWeekPlan]   = useState<WeekPlan>(loadWeekPlan)
  const [overrides, setOverrides] = useState<Set<string>>(() => loadSet(OVERRIDES_KEY))
  const [planned, setPlanned]     = useState<Set<string>>(() => loadSet(PLANNED_KEY))

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
    () => [...new Set(recipes.map(r => r.cuisine).filter(Boolean) as string[])].sort(),
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

  const statusCounts = useMemo(() => ({
    all:    computed.length,
    green:  computed.filter(r => r.status === 'green').length,
    yellow: computed.filter(r => r.status === 'yellow').length,
    red:    computed.filter(r => r.status === 'red').length,
  }), [computed])

  function addToWeek(recipeId: string, day: Day) {
    setWeekPlan(prev => {
      const dayList = prev[day] ?? []
      const next = dayList.includes(recipeId)
        ? { ...prev, [day]: dayList.filter(id => id !== recipeId) }
        : { ...prev, [day]: [...dayList, recipeId] }
      saveWeekPlan(next)
      return next
    })
  }
  function removeFromWeek(recipeId: string, day: Day) {
    setWeekPlan(prev => {
      const next = { ...prev, [day]: (prev[day] ?? []).filter(id => id !== recipeId) }
      saveWeekPlan(next)
      return next
    })
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
        DAYS.map(day => [day, (prev[day] ?? []).filter(id => id !== recipeId)])
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
            {(['recipes', 'pantry'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                  tab === t ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {t}
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
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <RecipeFilters
              filters={filters}
              onChange={setFilters}
              availableCuisines={availableCuisines}
              availableProteins={availableProteins}
              availableSources={availableSources}
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
            {weekCount > 0 && (
              <div className="order-2 lg:order-3 w-full lg:w-auto">
                <WeekPanel
                  computed={computed}
                  weekPlan={weekPlan}
                  onRemove={removeFromWeek}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl">
            <PantryPanel pantry={pantry} onUpdate={setPantry} />
          </div>
        )}
      </main>
    </div>
  )
}
