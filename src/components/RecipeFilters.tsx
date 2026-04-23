import { useState } from 'react'
import type { DishType, RecipeStatus } from '../types'
import { DISH_TYPE_LABELS } from '../lib/matching'

export interface FilterState {
  status: RecipeStatus | 'all'
  cuisines: Set<string>
  timeSort: 'none' | 'asc' | 'desc'
  sourceSort: 'none' | 'asc' | 'desc'
  proteins: Set<string>
  sources: Set<string>
  dishTypes: Set<DishType>
}

export const DEFAULT_FILTERS: FilterState = {
  status: 'all',
  cuisines: new Set(),
  timeSort: 'none',
  sourceSort: 'none',
  proteins: new Set(),
  sources: new Set(),
  dishTypes: new Set(),
}

const STATUS_LABELS: Record<RecipeStatus | 'all', string> = {
  all:    'All',
  green:  'Ready',
  yellow: 'Light trip',
  red:    'Need shopping',
}

const STATUS_DOT: Record<RecipeStatus, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-400',
  red:    'bg-red-500',
}

const PROTEIN_LABELS: Record<string, string> = {
  chicken: 'Chicken',
  beef:    'Beef',
  pork:    'Pork',
  seafood: 'Seafood',
  tofu:    'Tofu',
  lamb:    'Lamb',
  egg:     'Egg',
}

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
  availableCuisines: string[]
  availableProteins: string[]
  availableSources: string[]
  availableDishTypes: DishType[]
  counts: Record<RecipeStatus | 'all', number>
}

export default function RecipeFilters({ filters, onChange, availableCuisines, availableProteins, availableSources, availableDishTypes, counts }: Props) {
  const [cuisineOpen, setCuisineOpen] = useState(false)

  function toggleCuisine(c: string) {
    const next = new Set(filters.cuisines)
    next.has(c) ? next.delete(c) : next.add(c)
    onChange({ ...filters, cuisines: next })
  }

  function toggleProtein(p: string) {
    const next = new Set(filters.proteins)
    next.has(p) ? next.delete(p) : next.add(p)
    onChange({ ...filters, proteins: next })
  }

  function toggleSource(s: string) {
    const next = new Set(filters.sources)
    next.has(s) ? next.delete(s) : next.add(s)
    onChange({ ...filters, sources: next })
  }

  function toggleDishType(dishType: DishType) {
    const next = new Set(filters.dishTypes)
    next.has(dishType) ? next.delete(dishType) : next.add(dishType)
    onChange({ ...filters, dishTypes: next })
  }

  const hasFilters = filters.status !== 'all' || filters.cuisines.size > 0 || filters.timeSort !== 'none' || filters.proteins.size > 0 || filters.sources.size > 0 || filters.dishTypes.size > 0

  return (
    <div className="order-1 w-full lg:w-48 shrink-0 space-y-5 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto pr-0.5">
      {/* Status */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Status</p>
        <div className="space-y-0.5">
          {(['all', 'green', 'yellow', 'red'] as const).map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, status: s })}
              className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors ${
                filters.status === s ? 'bg-gray-100 font-medium text-gray-800' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {s !== 'all' && <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s as RecipeStatus]}`} />}
              {s === 'all' && <span className="w-2 h-2 shrink-0" />}
              <span className="flex-1">{STATUS_LABELS[s]}</span>
              <span className="text-xs text-gray-400">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine */}
      {availableCuisines.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cuisine</p>
          <div className="relative">
            <button
              onClick={() => setCuisineOpen(v => !v)}
              className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 flex justify-between items-center transition-colors"
            >
              <span className="text-gray-600 truncate">
                {filters.cuisines.size === 0 ? 'All cuisines' : `${filters.cuisines.size} selected`}
              </span>
              <span className="text-gray-400 text-xs ml-1">{cuisineOpen ? '▲' : '▼'}</span>
            </button>
            {cuisineOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md max-h-52 overflow-y-auto">
                {availableCuisines.map(c => (
                  <label key={c} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={filters.cuisines.has(c)}
                      onChange={() => toggleCuisine(c)}
                      className="accent-green-500"
                    />
                    <span className="text-gray-700">{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dish type filter */}
      {availableDishTypes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Dish Type</p>
          <div className="space-y-1">
            {availableDishTypes.map(dishType => (
              <label key={dishType} className="flex items-center gap-2 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={filters.dishTypes.has(dishType)}
                  onChange={() => toggleDishType(dishType)}
                  className="accent-green-500 shrink-0"
                />
                <span className="text-sm text-gray-600">{DISH_TYPE_LABELS[dishType]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Time sort */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sort by Time</p>
        <select
          value={filters.timeSort}
          onChange={e => onChange({ ...filters, timeSort: e.target.value as FilterState['timeSort'] })}
          className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
        >
          <option value="none">Default (by status)</option>
          <option value="asc">Fastest first</option>
          <option value="desc">Slowest first</option>
        </select>
      </div>

      {/* Protein filter */}
      {availableProteins.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Protein / Type</p>
          <div className="space-y-1">
            {availableProteins.map(p => (
              <label key={p} className="flex items-center gap-2 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={filters.proteins.has(p)}
                  onChange={() => toggleProtein(p)}
                  className="accent-green-500 shrink-0"
                />
                <span className="text-sm text-gray-600">{PROTEIN_LABELS[p] ?? p}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Source filter */}
      {availableSources.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Source</p>
          <div className="space-y-1">
            {availableSources.map(s => (
              <label key={s} className="flex items-center gap-2 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={filters.sources.has(s)}
                  onChange={() => toggleSource(s)}
                  className="accent-green-500 shrink-0"
                />
                <span className="text-sm text-gray-600">{s}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {hasFilters && (
        <button
          onClick={() => onChange({ ...DEFAULT_FILTERS, cuisines: new Set(), proteins: new Set(), sources: new Set(), dishTypes: new Set() })}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
