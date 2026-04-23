import type { CourseSlot, Day, MadeHistoryEntry, MealSlot, PantryItem, RecipeWithStatus, WeekPlan } from '../types'
import { DAYS, getSourceUrl } from '../types'

interface Props {
  computed: RecipeWithStatus[]
  pantry: PantryItem[]
  weekPlan: WeekPlan
  history: MadeHistoryEntry[]
  onRemove: (recipeId: string, day: Day) => void
  onMarkMade: (recipe: RecipeWithStatus, day: Day, rating: number | null) => void
  onClearHistory: () => void
}

const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

const COURSE_LABELS: Record<CourseSlot, string> = {
  app: 'App',
  main: 'Main',
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const end = new Date(`${date}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(recipe: RecipeWithStatus): string {
  const total = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)
  if (!total) return ''
  if (total >= 60) return `${Math.floor(total / 60)}h ${total % 60 ? `${total % 60}m` : ''}`.trim()
  return `${total}m`
}

export default function CalendarPanel({
  computed,
  pantry,
  weekPlan,
  history,
  onRemove,
  onMarkMade,
  onClearHistory,
}: Props) {
  const recipeMap = Object.fromEntries(computed.map(recipe => [recipe.id, recipe]))
  const useThisWeek = pantry
    .map(item => ({ item, remaining: daysUntil(item.expiry_date) }))
    .filter(({ remaining }) => remaining !== null && remaining <= 7)
    .sort((a, b) => (a.remaining ?? 0) - (b.remaining ?? 0) || a.item.name.localeCompare(b.item.name))

  const pantryByDay = DAYS.reduce((acc, day) => {
    acc[day] = [] as typeof useThisWeek
    return acc
  }, {} as Record<Day, typeof useThisWeek>)

  useThisWeek.forEach((entry, index) => {
    pantryByDay[DAYS[index % DAYS.length]].push(entry)
  })

  const totalPlanned = DAYS.reduce((sum, day) => sum + (weekPlan[day]?.length ?? 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Calendar</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {totalPlanned} planned recipe{totalPlanned === 1 ? '' : 's'}
            {useThisWeek.length > 0 && `, ${useThisWeek.length} pantry item${useThisWeek.length === 1 ? '' : 's'} to use`}
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-7 gap-2 min-w-[860px]">
          {DAYS.map(day => {
            const plannedEntries = weekPlan[day] ?? []
            const pantryItems = pantryByDay[day]

            return (
              <div key={day} className="bg-white border border-gray-200 rounded-xl min-h-[300px] flex flex-col">
                <div className="px-3 py-2 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{day}</h3>
                </div>

                <div className="flex-1 p-2 space-y-2">
                  {plannedEntries.map(entry => {
                    const recipe = recipeMap[entry.recipeId]
                    if (!recipe) return null
                    const missing = recipe.ingredientResults.filter(result => result.status === 'missing').length
                    const sourceUrl = getSourceUrl(recipe.notes)

                    return (
                      <div
                        key={entry.recipeId}
                        className={`rounded-lg border p-2 space-y-2 ${
                          missing === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-gray-800 leading-snug">{recipe.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1 text-[11px] text-gray-500">
                            {formatTime(recipe) && <span>{formatTime(recipe)}</span>}
                            {missing > 0 && <span>{missing} missing</span>}
                            {sourceUrl && (
                              <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:text-green-800">
                                recipe
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onMarkMade(recipe, day, null)}
                            className="flex-1 px-2 py-1 rounded-md bg-white/90 border border-white text-xs font-medium text-green-700 hover:border-green-300"
                          >
                            Made
                          </button>
                          <button
                            onClick={() => onRemove(recipe.id, day)}
                            className="px-2 py-1 rounded-md bg-white/80 text-xs text-gray-400 hover:text-red-500"
                            title="Remove"
                          >
                            x
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {pantryItems.map(({ item, remaining }) => (
                    <div key={item.id} className="rounded-lg border border-lime-200 bg-lime-50 px-2 py-1.5">
                      <p className="text-xs font-medium text-lime-900 capitalize leading-snug">{item.name}</p>
                      <p className="text-[11px] text-lime-700">
                        {remaining !== null && remaining < 0
                          ? `${Math.abs(remaining)}d past`
                          : remaining === 0
                          ? 'Use today'
                          : `Use in ${remaining}d`}
                      </p>
                    </div>
                  ))}

                  {plannedEntries.length === 0 && pantryItems.length === 0 && (
                    <div className="h-24 rounded-lg border border-dashed border-gray-100 flex items-center justify-center">
                      <span className="text-xs text-gray-300">Open</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Made History</h3>
          <span className="text-xs text-gray-400">{history.length} item{history.length === 1 ? '' : 's'}</span>
        </div>
        {history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Rate a planned recipe from the calendar to add it here.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.slice(0, 20).map(entry => (
              <div key={entry.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-gray-800 flex-1 min-w-[180px]">{entry.recipeName}</span>
                <span className="text-xs text-gray-400">{entry.day}</span>
                <span className="text-xs text-gray-400">{MEAL_LABELS[entry.meal]} / {COURSE_LABELS[entry.course]}</span>
                <span className="text-xs text-gray-400">{formatDate(entry.madeAt)}</span>
                {entry.rating !== null && (
                  <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                    {entry.rating}/5
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
