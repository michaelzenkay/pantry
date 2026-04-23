import type { Day, RecipeWithStatus, WeekPlan } from '../types'
import { DAYS, getSourceUrl } from '../types'
import { getWeekShoppingEntries } from '../lib/shoppingList'

interface Props {
  computed: RecipeWithStatus[]
  weekPlan: WeekPlan
  onRemove: (recipeId: string, day: Day) => void
  onAddMissingToShoppingList: () => void
}

export default function WeekPlanner({ computed, weekPlan, onRemove, onAddMissingToShoppingList }: Props) {
  const recipeMap = Object.fromEntries(computed.map(recipe => [recipe.id, recipe]))
  const shoppingEntries = getWeekShoppingEntries(computed, weekPlan)
  const totalPlanned = DAYS.reduce((sum, day) => sum + (weekPlan[day]?.length ?? 0), 0)

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

                    const missingCount = recipe.ingredientResults.filter(result => result.status === 'missing').length
                    const sourceUrl = getSourceUrl(recipe.notes)

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
                        <div className="flex flex-wrap items-center gap-1.5">
                          {missingCount > 0 && (
                            <span className="text-xs text-orange-500">{missingCount} missing</span>
                          )}
                          {sourceUrl && (
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={event => event.stopPropagation()}
                              className="text-xs text-green-700 hover:text-green-800"
                            >
                              recipe
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => onRemove(entry.recipeId, day)}
                          className="absolute top-1 right-1.5 text-gray-300 hover:text-red-400 font-medium text-sm leading-none"
                        >
                          x
                        </button>
                      </div>
                    )
                  })}
                  {entries.length === 0 && (
                    <p className="text-xs text-gray-200 text-center pt-6">--</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {shoppingEntries.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-700">
              Missing this week
              <span className="ml-2 text-xs font-normal text-gray-400">{shoppingEntries.length} item{shoppingEntries.length === 1 ? '' : 's'}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1 truncate">
              {shoppingEntries.slice(0, 4).map(entry => entry.name).join(', ')}
              {shoppingEntries.length > 4 && ` +${shoppingEntries.length - 4} more`}
            </p>
          </div>
          <button
            onClick={onAddMissingToShoppingList}
            className="px-3 py-1.5 rounded-lg bg-white border border-orange-200 text-sm font-medium text-orange-700 hover:bg-orange-50 transition-colors"
          >
            Add to shopping
          </button>
        </div>
      ) : totalPlanned > 0 ? (
        <div className="hidden">
          <p className="text-green-700 font-medium text-sm">Ready for the week.</p>
        </div>
      ) : (
        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">Add recipes to your week using the <span className="font-medium text-gray-500">+</span> button in the Recipes tab.</p>
        </div>
      )}
    </div>
  )
}
