import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from './lib/api'
import RecipeTable from './components/RecipeTable'
import RecipeFilters, { DEFAULT_FILTERS } from './components/RecipeFilters'
import PantryPanel from './components/PantryPanel'
import CalendarPanel from './components/CalendarPanel'
import ShoppingListPanel from './components/ShoppingListPanel'
import WeekPlanner from './components/WeekPlanner'
import type { DishType, MadeHistoryEntry, PlannerState, PlannedRecipe, RecipeRatings, Recipe, PantryItem, Day, WeekPlan, RecipeWithStatus, ShoppingListItem } from './types'
import { DAYS, getRecipeCuisines, getSource } from './types'
import { computeRecipes, getDishTypes, getRecipeProteins } from './lib/matching'
import type { FilterState } from './components/RecipeFilters'
import { isPlannerStateEmpty, loadPlannerStateLocal, savePlannerStateLocal } from './lib/plannerState'
import { addManualShoppingItem, getWeekShoppingEntries, mergeWeekShoppingItems, normalizeShoppingName, removeShoppingItemByName } from './lib/shoppingList'

type Tab = 'recipes' | 'shopping' | 'calendar' | 'pantry'

export default function App() {
  const initialPlannerState = useMemo(() => loadPlannerStateLocal(), [])
  const [tab, setTab]         = useState<Tab>('recipes')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pantry, setPantry]   = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterState>(() => ({ ...DEFAULT_FILTERS, cuisines: new Set(), proteins: new Set(), sources: new Set(), dishTypes: new Set() }))
  const [weekPlan, setWeekPlan] = useState<WeekPlan>(initialPlannerState.weekPlan)
  const [history, setHistory] = useState(initialPlannerState.history)
  const [recipeRatings, setRecipeRatings] = useState<RecipeRatings>(initialPlannerState.recipeRatings)
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>(initialPlannerState.shoppingList)
  const [plannerReady, setPlannerReady] = useState(false)
  const [plannerRemoteEnabled, setPlannerRemoteEnabled] = useState(false)

  const applyPlannerState = useCallback((state: PlannerState) => {
    setWeekPlan(state.weekPlan)
    setHistory(state.history)
    setRecipeRatings(state.recipeRatings)
    setShoppingList(state.shoppingList)
    savePlannerStateLocal(state)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadApp() {
      const localPlannerState = loadPlannerStateLocal()

      try {
        const plannerStatePromise = api.plannerState.get().then(state => ({ ok: true as const, state })).catch(() => ({ ok: false as const, state: null }))
        const [recipeData, pantryData, remotePlannerState] = await Promise.all([
          api.recipes.list(),
          api.pantry.list(),
          plannerStatePromise,
        ])

        if (cancelled) return

        setRecipes(recipeData)
        setPantry(pantryData)
        setLoadError(null)
        setPlannerRemoteEnabled(remotePlannerState.ok)

        if (remotePlannerState.ok && remotePlannerState.state && !isPlannerStateEmpty(remotePlannerState.state)) {
          applyPlannerState(remotePlannerState.state)
        } else {
          applyPlannerState(localPlannerState)
          if (remotePlannerState.ok && !isPlannerStateEmpty(localPlannerState)) {
            void api.plannerState.update(localPlannerState).catch(() => {})
          }
        }
      } catch (err: unknown) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Unable to load pantry data.')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setPlannerReady(true)
        }
      }
    }

    void loadApp()
    return () => {
      cancelled = true
    }
  }, [applyPlannerState])

  const plannerState = useMemo<PlannerState>(() => ({
    weekPlan,
    history,
    overrides: [],
    planned: [],
    recipeRatings,
    shoppingList,
  }), [weekPlan, history, recipeRatings, shoppingList])

  useEffect(() => {
    if (!plannerReady) return

    savePlannerStateLocal(plannerState)
    if (!plannerRemoteEnabled) return
    const timeout = window.setTimeout(() => {
      void api.plannerState.update(plannerState).catch(() => {})
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [plannerState, plannerReady, plannerRemoteEnabled])

  const recipesWithRatings = useMemo(
    () => recipes.map(recipe => ({
      ...recipe,
      rating: recipeRatings[recipe.id] ?? recipe.rating,
    })),
    [recipes, recipeRatings]
  )
  const computed = useMemo(() => computeRecipes(recipesWithRatings, pantry), [recipesWithRatings, pantry])
  const shoppingNames = useMemo(
    () => new Set(shoppingList.filter(item => !item.done).map(item => normalizeShoppingName(item.name))),
    [shoppingList]
  )

  // Compute what changes if one more ingredient were available
  const computeImpact = useCallback((ingredient: string): RecipeWithStatus[] => {
    const hypothetical = computeRecipes(recipesWithRatings, pantry, new Set([ingredient.toLowerCase()]))
    return hypothetical.filter(h => {
      const current = computed.find(c => c.id === h.id)
      if (!current) return false
      const order: Record<string, number> = { green: 0, yellow: 1, red: 2 }
      return order[h.status] < order[current.status]
    })
  }, [recipesWithRatings, pantry, computed])

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
      return dayList.some(entry => entry.recipeId === recipeId)
        ? { ...prev, [day]: dayList.filter(entry => entry.recipeId !== recipeId) }
        : { ...prev, [day]: [...dayList, { recipeId, meal: 'dinner', course: 'main' } satisfies PlannedRecipe] }
    })
  }
  function removeFromWeek(recipeId: string, day: Day) {
    setWeekPlan(prev => {
      return { ...prev, [day]: (prev[day] ?? []).filter(entry => entry.recipeId !== recipeId) }
    })
  }

  async function markMade(recipe: RecipeWithStatus, day: Day, rating: number | null) {
    const effectiveRating = rating ?? recipeRatings[recipe.id] ?? recipe.rating ?? null
    if (rating !== null) {
      setRecipeRatings(prev => ({ ...prev, [recipe.id]: rating }))
    }
    const plannedEntry = (weekPlan[day] ?? []).find(entry => entry.recipeId === recipe.id)
    const entry: MadeHistoryEntry = {
      id: `${Date.now()}-${recipe.id}`,
      recipeId: recipe.id,
      recipeName: recipe.name,
      day,
      meal: plannedEntry?.meal ?? 'dinner',
      course: plannedEntry?.course ?? 'main',
      madeAt: new Date().toISOString(),
      rating: effectiveRating,
    }
    setHistory(prev => {
      return [entry, ...prev].slice(0, 100)
    })
    removeFromWeek(recipe.id, day)
  }

  function clearHistory() {
    setHistory([])
  }

  async function updateRecipe(recipeId: string, patch: Partial<Recipe>) {
    const updated = await api.recipes.update(recipeId, patch)
    setRecipes(prev => prev.map(recipe => recipe.id === recipeId ? updated : recipe))
  }

  async function deleteRecipe(recipeId: string) {
    await api.recipes.remove(recipeId)
    setRecipes(prev => prev.filter(recipe => recipe.id !== recipeId))
    setWeekPlan(prev => {
      return Object.fromEntries(
        DAYS.map(day => [day, (prev[day] ?? []).filter(entry => entry.recipeId !== recipeId)])
      ) as WeekPlan
    })
    setRecipeRatings(prev => {
      const next = { ...prev }
      delete next[recipeId]
      return next
    })
  }

  const weekCount = DAYS.reduce((sum, d) => sum + (weekPlan[d]?.length ?? 0), 0)
  const weekShoppingSuggestions = useMemo(
    () => getWeekShoppingEntries(computed, weekPlan),
    [computed, weekPlan]
  )
  const shoppingPendingCount = useMemo(
    () => shoppingList.filter(item => !item.done).length,
    [shoppingList]
  )

  function addShoppingItem(name: string) {
    setShoppingList(prev => addManualShoppingItem(prev, name))
  }

  async function addIngredientToPantry(name: string) {
    const normalized = normalizeShoppingName(name)
    if (pantry.some(item => item.name.toLowerCase() === normalized)) {
      setShoppingList(prev => removeShoppingItemByName(prev, name))
      return
    }

    const created = await api.pantry.add({
      name,
      quantity: null,
      unit: null,
      category: 'pantry',
      expiry_date: null,
      notes: null,
    })

    setPantry(prev => [...prev, created])
    setShoppingList(prev => removeShoppingItemByName(prev, name))
  }

  function addWeekSuggestionsToShoppingList() {
    setShoppingList(prev => mergeWeekShoppingItems(prev, weekShoppingSuggestions))
    setTab('shopping')
  }

  function toggleShoppingItem(id: string) {
    setShoppingList(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item))
  }

  function removeShoppingItem(id: string) {
    setShoppingList(prev => prev.filter(item => item.id !== id))
  }

  function removeShoppingItemByIngredient(name: string) {
    setShoppingList(prev => removeShoppingItemByName(prev, name))
  }

  function clearDoneShoppingItems() {
    setShoppingList(prev => prev.filter(item => !item.done))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Pantry</h1>
          <nav className="flex gap-1">
            {(['recipes', 'shopping', 'calendar', 'pantry'] as Tab[]).map(t => (
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
                {t === 'shopping' && shoppingPendingCount > 0 && (
                  <span className="ml-1.5 text-xs opacity-70">{shoppingPendingCount}</span>
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
            <span className="inline-block">...</span> Loading...
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
            <div className="sticky top-[73px] z-20 space-y-2 bg-gray-50/95 backdrop-blur pb-2">
              {weekCount > 0 && (
                <div className="border-b border-gray-100 pt-1 pb-2">
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">This Week</h2>
                  <WeekPlanner
                    computed={computed}
                    weekPlan={weekPlan}
                    onRemove={removeFromWeek}
                    onAddMissingToShoppingList={addWeekSuggestionsToShoppingList}
                  />
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
                  shoppingNames={shoppingNames}
                  onAddToWeek={addToWeek}
                  onAddToPantry={addIngredientToPantry}
                  onAddToShopping={addShoppingItem}
                  onRemoveFromShopping={removeShoppingItemByIngredient}
                  computeImpact={computeImpact}
                  onUpdateRecipe={updateRecipe}
                  onDeleteRecipe={deleteRecipe}
                />
              </div>
            </div>
          </div>
        ) : tab === 'shopping' ? (
          <ShoppingListPanel
            items={shoppingList}
            weekSuggestions={weekShoppingSuggestions}
            onAddItem={addShoppingItem}
            onAddWeekSuggestions={addWeekSuggestionsToShoppingList}
            onToggleItem={toggleShoppingItem}
            onRemoveItem={removeShoppingItem}
            onClearDone={clearDoneShoppingItems}
          />
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
