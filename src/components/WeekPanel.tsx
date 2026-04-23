import { useState } from 'react'
import type { RecipeWithStatus, Day, WeekPlan } from '../types'
import { DAYS, getSourceUrl } from '../types'

interface Props {
  computed: RecipeWithStatus[]
  weekPlan: WeekPlan
  onRemove: (recipeId: string, day: Day) => void
}

export default function WeekPanel({ computed, weekPlan, onRemove }: Props) {
  const [showShopping, setShowShopping] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithStatus | null>(null)
  const recipeMap = Object.fromEntries(computed.map(r => [r.id, r]))

  const shoppingMap = new Map<string, number>()
  for (const day of DAYS) {
    for (const id of weekPlan[day] ?? []) {
      const recipe = recipeMap[id]
      if (!recipe) continue
      for (const ir of recipe.ingredientResults) {
        if (ir.status === 'missing') {
          shoppingMap.set(ir.name, (shoppingMap.get(ir.name) ?? 0) + 1)
        }
      }
    }
  }

  const totalPlanned = DAYS.reduce((sum, d) => sum + (weekPlan[d]?.length ?? 0), 0)

  function formatIngredientAmount(ingredient: RecipeWithStatus['ingredients'][number]): string {
    return [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ').trim()
  }

  return (
    <>
    {selectedRecipe && (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setSelectedRecipe(null)}>
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 space-y-4"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">{selectedRecipe.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                {selectedRecipe.servings && <span>{selectedRecipe.servings} serving{selectedRecipe.servings === 1 ? '' : 's'}</span>}
                {getSourceUrl(selectedRecipe.notes) && (
                  <a
                    href={getSourceUrl(selectedRecipe.notes)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-green-700 hover:text-green-800 font-medium"
                  >
                    Original recipe
                  </a>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedRecipe(null)} className="text-gray-300 hover:text-gray-600 text-xl leading-none">x</button>
          </div>

          {selectedRecipe.ingredients.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Ingredients</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {selectedRecipe.ingredients.map((ingredient, index) => (
                  <div key={`${ingredient.name}-${index}`} className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                    {formatIngredientAmount(ingredient) && (
                      <span className="text-gray-400 mr-1 tabular-nums">{formatIngredientAmount(ingredient)}</span>
                    )}
                    <span className="font-medium capitalize">{ingredient.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedRecipe.instructions?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recipe</p>
              <ol className="space-y-1.5">
                {selectedRecipe.instructions.map((step, index) => (
                  <li key={index} className="flex gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                    <span className="text-gray-400 tabular-nums">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    )}
    <div className="w-full lg:w-52 shrink-0 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-104px)] flex flex-col bg-white lg:bg-transparent border border-gray-200 lg:border-0 rounded-xl lg:rounded-none p-3 lg:p-0">
      <div className="flex-1 lg:overflow-y-auto space-y-1 pr-0.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">This Week</p>
        {DAYS.map(day => {
          const ids = weekPlan[day] ?? []
          return (
            <div key={day} className="space-y-1">
              <p className="text-xs font-semibold text-gray-500">{day}</p>
              {ids.length === 0 ? (
                <div className="h-6 rounded border border-dashed border-gray-200" />
              ) : (
                ids.map(id => {
                  const recipe = recipeMap[id]
                  if (!recipe) return null
                  const missing = recipe.ingredientResults.filter(r => r.status === 'missing').length
                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedRecipe(recipe)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedRecipe(recipe)
                      }}
                      className={`flex items-start gap-1 px-2 py-1 rounded-lg border text-xs group ${
                        missing === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                      } w-full text-left hover:border-gray-300 transition-colors`}
                    >
                      <span className="flex-1 leading-snug text-gray-700 line-clamp-2 min-w-0">{recipe.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(id, day) }}
                        className="text-gray-300 hover:text-red-400 shrink-0 leading-none mt-0.5 font-medium"
                      >
                        ×
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>

      {totalPlanned > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 shrink-0">
          <button
            onClick={() => setShowShopping(v => !v)}
            className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span className="font-semibold">
              Shopping list
              {shoppingMap.size > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">{shoppingMap.size}</span>
              )}
            </span>
            <span className="text-gray-400">{showShopping ? '▲' : '▼'}</span>
          </button>

          {showShopping && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {shoppingMap.size === 0 ? (
                <p className="text-xs text-green-600">✓ All set!</p>
              ) : (
                [...shoppingMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name} className="flex items-center gap-1 text-xs text-red-700">
                    <span className="flex-1 capitalize">{name}</span>
                    {count > 1 && <span className="text-red-400 shrink-0">×{count}</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  )
}
