import type { RecipeWithStatus, Day, WeekPlan } from '../types'
import { DAYS } from '../types'

interface Props {
  computed: RecipeWithStatus[]
  weekPlan: WeekPlan
  onRemove: (recipeId: string, day: Day) => void
}

export default function WeekPlanner({ computed, weekPlan, onRemove }: Props) {
  const recipeMap = Object.fromEntries(computed.map(r => [r.id, r]))

  const shoppingMap = new Map<string, number>()
  for (const day of DAYS) {
    for (const entry of weekPlan[day] ?? []) {
      const recipe = recipeMap[entry.recipeId]
      if (!recipe) continue
      for (const ir of recipe.ingredientResults) {
        if (ir.status === 'missing') {
          shoppingMap.set(ir.name, (shoppingMap.get(ir.name) ?? 0) + 1)
        }
      }
    }
  }

  const totalPlanned = DAYS.reduce((sum, d) => sum + (weekPlan[d]?.length ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className="grid grid-cols-7 gap-2" style={{ minWidth: '700px' }}>
          {DAYS.map(day => {
            const entries = weekPlan[day] ?? []
            return (
              <div key={day} className="space-y-1">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center pb-0.5 border-b border-gray-100">
                  {day}
                </h3>
                <div className="min-h-10 space-y-1">
                  {entries.map(entry => {
                    const recipe = recipeMap[entry.recipeId]
                    if (!recipe) return null
                    const missingCount = recipe.ingredientResults.filter(r => r.status === 'missing').length
                    return (
                      <div
                        key={entry.recipeId}
                        className={`bg-white rounded-lg border px-2 py-1.5 relative group ${
                          missingCount === 0 ? 'border-green-200' : 'border-orange-200'
                        }`}
                      >
                        <p className="text-xs font-medium text-gray-800 leading-snug pr-4 line-clamp-2">
                          {recipe.name}
                        </p>
                        {missingCount > 0 && (
                          <p className="text-xs text-orange-500">{missingCount} missing</p>
                        )}
                        <button
                          onClick={() => onRemove(entry.recipeId, day)}
                          className="absolute top-1 right-1.5 text-gray-300 hover:text-red-400 font-medium text-sm leading-none"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                  {entries.length === 0 && (
                    <p className="text-xs text-gray-200 text-center pt-6">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {shoppingMap.size > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Shopping List
            <span className="ml-2 text-xs font-normal text-gray-400">{shoppingMap.size} items to buy</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {[...shoppingMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                <span className="text-sm text-red-700 font-medium flex-1 capitalize">{name}</span>
                {count > 1 && <span className="text-xs text-red-400 shrink-0">×{count}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : totalPlanned > 0 ? (
        <div className="hidden">
          <p className="text-green-700 font-medium text-sm">✓ All set! You have everything for your week.</p>
        </div>
      ) : (
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">Add recipes to your week using the <span className="font-medium text-gray-500">+</span> button in the Recipes tab.</p>
        </div>
      )}
    </div>
  )
}
