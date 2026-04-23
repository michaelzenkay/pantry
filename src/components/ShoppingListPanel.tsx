import { useMemo, useState } from 'react'
import type { ShoppingListItem } from '../types'
import type { WeekShoppingEntry } from '../lib/shoppingList'

interface Props {
  items: ShoppingListItem[]
  weekSuggestions: WeekShoppingEntry[]
  onAddItem: (name: string) => void
  onAddWeekSuggestions: () => void
  onToggleItem: (id: string) => void
  onRemoveItem: (id: string) => void
  onClearDone: () => void
}

export default function ShoppingListPanel({
  items,
  weekSuggestions,
  onAddItem,
  onAddWeekSuggestions,
  onToggleItem,
  onRemoveItem,
  onClearDone,
}: Props) {
  const [draft, setDraft] = useState('')

  const activeItems = useMemo(() => items.filter(item => !item.done), [items])
  const doneItems = useMemo(() => items.filter(item => item.done), [items])

  function submit() {
    const value = draft.trim()
    if (!value) return
    onAddItem(value)
    setDraft('')
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Shopping</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {activeItems.length} to buy
            {doneItems.length > 0 && `, ${doneItems.length} done`}
          </p>
        </div>
        {doneItems.length > 0 && (
          <button
            onClick={onClearDone}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors"
          >
            Clear done
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') submit()
            }}
            placeholder="Add an item..."
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
          >
            Add
          </button>
        </div>

        {weekSuggestions.length > 0 && (
          <div className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-800">Missing from this week</p>
                <p className="text-xs text-gray-500 mt-0.5">{weekSuggestions.length} item{weekSuggestions.length === 1 ? '' : 's'} ready to add</p>
              </div>
              <button
                onClick={onAddWeekSuggestions}
                className="px-3 py-1.5 rounded-lg bg-white border border-orange-200 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
              >
                Add missing
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {weekSuggestions.slice(0, 12).map(entry => (
                <span
                  key={entry.name}
                  className="px-2 py-1 rounded-lg border border-orange-200 bg-white text-xs text-orange-800 capitalize"
                >
                  {entry.name}
                  {entry.count > 1 && <span className="ml-1 text-orange-500">x{entry.count}</span>}
                </span>
              ))}
              {weekSuggestions.length > 12 && (
                <span className="px-2 py-1 rounded-lg border border-orange-200 bg-white text-xs text-orange-700">
                  +{weekSuggestions.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">List</h3>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">Add groceries here or pull in the missing items from your week.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {[...activeItems, ...doneItems].map(item => (
              <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggleItem(item.id)}
                  className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center text-xs ${
                    item.done
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-gray-300 bg-white text-transparent hover:border-green-400'
                  }`}
                  aria-label={item.done ? `Mark ${item.name} not done` : `Mark ${item.name} done`}
                >
                  x
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm capitalize ${item.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {item.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                    {item.count > 1 && <span>x{item.count}</span>}
                    <span className="uppercase tracking-wide">{item.source}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="text-gray-300 hover:text-red-500 text-lg leading-none"
                  aria-label={`Remove ${item.name}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
