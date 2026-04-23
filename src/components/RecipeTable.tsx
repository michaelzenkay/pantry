import { useState, useRef, useEffect } from 'react'
import type { Recipe, RecipeWithStatus, RecipeStatus, Day, WeekPlan } from '../types'
import { DAYS, getSource, getSourceUrl } from '../types'
import type { FilterState } from './RecipeFilters'
import { DISH_TYPE_LABELS, getDishTypes, getRecipeProteins } from '../lib/matching'

const STATUS_CONFIG: Record<RecipeStatus, { dot: string; row: string }> = {
  green:  { dot: 'bg-green-500',  row: 'hover:bg-green-50' },
  yellow: { dot: 'bg-yellow-400', row: 'hover:bg-yellow-50' },
  red:    { dot: 'bg-red-500',    row: 'hover:bg-red-50' },
}
const STATUS_ORDER: Record<RecipeStatus, number> = { green: 0, yellow: 1, red: 2 }

function formatTime(prep: number | null, cook: number | null): string {
  const total = (prep ?? 0) + (cook ?? 0)
  if (!total) return '—'
  if (total >= 60) return `${Math.floor(total / 60)}h ${total % 60 > 0 ? `${total % 60}m` : ''}`.trim()
  return `${total}m`
}

function formatIngredientAmount(ingredient: Recipe['ingredients'][number]): string {
  return [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ').trim()
}

// ─── Ingredient chip with popover ────────────────────────────────────────────

interface ChipProps {
  name: string
  overrides: Set<string>
  planned: Set<string>
  computeImpact: (ingredient: string) => RecipeWithStatus[]
  onMarkHave: (ingredient: string) => void
  onMarkPlanned: (ingredient: string) => void
  onUnmark: (ingredient: string) => void
}

function IngredientChip({ name, overrides, planned, computeImpact, onMarkHave, onMarkPlanned, onUnmark }: ChipProps) {
  const [open, setOpen] = useState(false)
  const [impact, setImpact] = useState<RecipeWithStatus[] | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const key = name.toLowerCase()
  const isOverride = overrides.has(key)
  const isPlanned = planned.has(key)

  useEffect(() => {
    if (!open) return
    setImpact(computeImpact(name))
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, name, computeImpact])

  const chipClass = isOverride
    ? 'bg-green-50 border-green-300 text-green-700'
    : isPlanned
    ? 'bg-blue-50 border-blue-300 text-blue-700'
    : 'bg-red-50 border-red-200 text-red-700 hover:border-red-400 hover:bg-red-100'

  return (
    <span ref={ref} className="relative inline-block" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`px-1.5 py-0.5 border rounded text-xs transition-colors cursor-pointer ${chipClass}`}
      >
        {isOverride && <span className="mr-0.5 text-green-500">✓</span>}
        {isPlanned && <span className="mr-0.5">🛒</span>}
        {name}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-gray-200 rounded-xl shadow-xl w-64 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700">{name}</p>
          </div>

          <div className="p-2 space-y-1">
            {(isOverride || isPlanned) ? (
              <button
                onClick={() => { onUnmark(name); setOpen(false) }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
              >
                ✕ Remove override
              </button>
            ) : (
              <>
                <button
                  onClick={() => { onMarkHave(name); setOpen(false) }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-green-700 hover:bg-green-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-base leading-none">✓</span>
                  <span>Got it — I have this</span>
                </button>
                <button
                  onClick={() => { onMarkPlanned(name); setOpen(false) }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-base leading-none">🛒</span>
                  <span>Will buy — someone's grabbing it</span>
                </button>
              </>
            )}
          </div>

          {impact !== null && impact.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-1.5">
                Buying this also unlocks {impact.length} more recipe{impact.length > 1 ? 's' : ''}:
              </p>
              <div className="space-y-1">
                {impact.slice(0, 4).map(r => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.status === 'green' ? 'bg-green-500' : 'bg-yellow-400'}`} />
                    <span className="text-xs text-gray-600 truncate">{r.name}</span>
                  </div>
                ))}
                {impact.length > 4 && (
                  <p className="text-xs text-gray-400 pl-3">+{impact.length - 4} more</p>
                )}
              </div>
            </div>
          )}

          {impact !== null && impact.length === 0 && !isOverride && !isPlanned && (
            <div className="border-t border-gray-100 px-3 py-2">
              <p className="text-xs text-gray-400">No other recipes unlock with just this ingredient.</p>
            </div>
          )}
        </div>
      )}
    </span>
  )
}

// ─── Day picker ───────────────────────────────────────────────────────────────

function DayPicker({ recipeId, weekPlan, onAdd }: { recipeId: string; weekPlan: WeekPlan; onAdd: (day: Day) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const addedDays = DAYS.filter(d => (weekPlan[d] ?? []).some(entry => entry.recipeId === recipeId))

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Add to week"
        className={`w-7 h-7 rounded-full text-sm font-semibold transition-colors flex items-center justify-center ${
          addedDays.length > 0 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
      >
        {addedDays.length > 0 ? addedDays.length : '+'}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex gap-1.5 whitespace-nowrap">
          {DAYS.map(day => {
            const added = (weekPlan[day] ?? []).some(entry => entry.recipeId === recipeId)
            return (
              <button
                key={day}
                onClick={() => { onAdd(day); setOpen(false) }}
                className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                  added ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100 text-gray-700 hover:bg-green-100'
                }`}
              >
                {day}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RecipeEditor({
  recipe,
  onSave,
  onCancel,
}: {
  recipe: Recipe
  onSave: (patch: Partial<Recipe>) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(recipe.name)
  const [cuisine, setCuisine] = useState(recipe.cuisine ?? '')
  const [prepTime, setPrepTime] = useState(recipe.prep_time_minutes?.toString() ?? '')
  const [cookTime, setCookTime] = useState(recipe.cook_time_minutes?.toString() ?? '')
  const [servings, setServings] = useState(recipe.servings?.toString() ?? '')
  const [tags, setTags] = useState(recipe.tags.join(', '))
  const [notes, setNotes] = useState(recipe.notes ?? '')
  const [saving, setSaving] = useState(false)

  const parseNumber = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        cuisine: cuisine.trim() || null,
        prep_time_minutes: parseNumber(prepTime),
        cook_time_minutes: parseNumber(cookTime),
        servings: parseNumber(servings),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        notes: notes.trim() || null,
      })
      onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onCancel}>
      <form
        onSubmit={save}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-lg p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit recipe</h2>
            <p className="text-xs text-gray-400 mt-0.5">Quick metadata edits for browsing and planning.</p>
          </div>
          <button type="button" onClick={onCancel} className="text-gray-300 hover:text-gray-600 text-xl leading-none">x</button>
        </div>

        <label className="block">
          <span className="block text-xs text-gray-400 mb-1">Name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block col-span-2">
            <span className="block text-xs text-gray-400 mb-1">Cuisine</span>
            <input
              value={cuisine}
              onChange={e => setCuisine(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-400 mb-1">Prep</span>
            <input
              value={prepTime}
              onChange={e => setPrepTime(e.target.value)}
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-400 mb-1">Cook</span>
            <input
              value={cookTime}
              onChange={e => setCookTime(e.target.value)}
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="block text-xs text-gray-400 mb-1">Servings</span>
            <input
              value={servings}
              onChange={e => setServings(e.target.value)}
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
          <label className="block col-span-2">
            <span className="block text-xs text-gray-400 mb-1">Tags</span>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="weeknight, chicken"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-xs text-gray-400 mb-1">Notes / Source</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main table ───────────────────────────────────────────────────────────────

interface Props {
  computed: RecipeWithStatus[]
  filters: FilterState
  weekPlan: WeekPlan
  overrides: Set<string>
  planned: Set<string>
  onAddToWeek: (recipeId: string, day: Day) => void
  onMarkHave: (ingredient: string) => void
  onMarkPlanned: (ingredient: string) => void
  onUnmark: (ingredient: string) => void
  computeImpact: (ingredient: string) => RecipeWithStatus[]
  onUpdateRecipe: (recipeId: string, patch: Partial<Recipe>) => Promise<void>
  onDeleteRecipe: (recipeId: string) => Promise<void>
}

export default function RecipeTable({
  computed, filters, weekPlan,
  overrides, planned,
  onAddToWeek, onMarkHave, onMarkPlanned, onUnmark, computeImpact,
  onUpdateRecipe, onDeleteRecipe,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<RecipeWithStatus | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  let filtered = computed.filter(r => {
    if (filters.status !== 'all' && r.status !== filters.status) return false
    if (filters.cuisines.size > 0 && (!r.cuisine || !filters.cuisines.has(r.cuisine))) return false
    if (filters.sources.size > 0 && !filters.sources.has(getSource(r.notes))) return false
    if (filters.dishTypes.size > 0) {
      const dishTypes = getDishTypes(r)
      if (!dishTypes.some(dishType => filters.dishTypes.has(dishType))) return false
    }
    if (filters.proteins.size > 0) {
      const proteins = getRecipeProteins(r)
      if (!proteins.some(p => filters.proteins.has(p))) return false
    }
    return true
  })

  if (filters.timeSort === 'asc') {
    filtered = [...filtered].sort((a, b) => ((a.prep_time_minutes ?? 0) + (a.cook_time_minutes ?? 0)) - ((b.prep_time_minutes ?? 0) + (b.cook_time_minutes ?? 0)))
  } else if (filters.timeSort === 'desc') {
    filtered = [...filtered].sort((a, b) => ((b.prep_time_minutes ?? 0) + (b.cook_time_minutes ?? 0)) - ((a.prep_time_minutes ?? 0) + (a.cook_time_minutes ?? 0)))
  } else {
    filtered = [...filtered].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])
  }

  if (computed.length === 0) return <p className="text-gray-400 text-sm mt-8 text-center">No recipes yet.</p>
  if (filtered.length === 0) return <p className="text-gray-400 text-sm mt-8 text-center">No recipes match the selected filters.</p>

  async function deleteRecipe(recipe: RecipeWithStatus) {
    const ok = window.confirm(`Delete "${recipe.name}"?`)
    if (!ok) return
    setDeletingId(recipe.id)
    try {
      await onDeleteRecipe(recipe.id)
      if (expanded === recipe.id) setExpanded(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
    {editing && (
      <RecipeEditor
        recipe={editing}
        onCancel={() => setEditing(null)}
        onSave={patch => onUpdateRecipe(editing.id, patch)}
      />
    )}
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 text-xs text-gray-400">
        {filtered.length} recipe{filtered.length !== 1 ? 's' : ''}
        {filtered.length !== computed.length && ` (of ${computed.length})`}
        {(overrides.size > 0 || planned.size > 0) && (
          <span className="ml-3 text-blue-500">
            {[overrides.size > 0 && `${overrides.size} on hand`, planned.size > 0 && `${planned.size} planned`]
              .filter(Boolean).join(', ')} — overrides active
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
            <th className="text-left px-4 py-3 w-5"></th>
            <th className="text-left px-4 py-3">Recipe</th>
            <th className="text-left px-4 py-3 hidden sm:table-cell">Src</th>
            <th className="text-left px-4 py-3 hidden lg:table-cell">Cuisine</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Time</th>
            <th className="text-left px-4 py-3">Missing</th>
            <th className="text-left px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(recipe => {
            const cfg = STATUS_CONFIG[recipe.status]
            const isExpanded = expanded === recipe.id
            const missingItems = recipe.ingredientResults.filter(r => r.status === 'missing')
            const subItems = recipe.ingredientResults.filter(r => r.status === 'substitute')
            const sourceUrl = getSourceUrl(recipe.notes)

            return (
              <>
                <tr
                  key={recipe.id}
                  onClick={() => setExpanded(isExpanded ? null : recipe.id)}
                  className={`border-b border-gray-50 cursor-pointer transition-colors ${cfg.row} ${isExpanded ? 'bg-gray-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px]">
                    <span className="line-clamp-2 leading-snug">{recipe.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {getSource(recipe.notes) && (
                      sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-medium whitespace-nowrap hover:bg-gray-200 hover:text-gray-700"
                        >
                          {getSource(recipe.notes)}
                        </a>
                      ) : (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-medium whitespace-nowrap">
                        {getSource(recipe.notes)}
                      </span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">{recipe.cuisine ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">
                    {formatTime(recipe.prep_time_minutes, recipe.cook_time_minutes)}
                  </td>
                  <td className="px-4 py-3">
                    {missingItems.length === 0 && subItems.length === 0 ? (
                      <span className="text-green-600 text-xs font-medium">✓ All set</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {missingItems.slice(0, 3).map(r => (
                          <IngredientChip
                            key={r.name}
                            name={r.name}
                            overrides={overrides}
                            planned={planned}
                            computeImpact={computeImpact}
                            onMarkHave={onMarkHave}
                            onMarkPlanned={onMarkPlanned}
                            onUnmark={onUnmark}
                          />
                        ))}
                        {missingItems.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-red-50 border border-red-200 rounded text-xs text-red-500">
                            +{missingItems.length - 3}
                          </span>
                        )}
                        {missingItems.length === 0 && subItems.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                            {subItems.length} sub
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <DayPicker recipeId={recipe.id} weekPlan={weekPlan} onAdd={day => onAddToWeek(recipe.id, day)} />
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${recipe.id}-exp`} className="bg-gray-50 border-b border-gray-100">
                    <td colSpan={7} className="px-4 py-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          {recipe.servings && <span>{recipe.servings} serving{recipe.servings === 1 ? '' : 's'}</span>}
                          {getDishTypes(recipe).map(dishType => (
                            <span key={dishType} className="px-1.5 py-0.5 rounded bg-white border border-gray-100 text-gray-500">
                              {DISH_TYPE_LABELS[dishType]}
                            </span>
                          ))}
                          {formatTime(recipe.prep_time_minutes, recipe.cook_time_minutes) !== 'â€”' && (
                            <span>{formatTime(recipe.prep_time_minutes, recipe.cook_time_minutes)}</span>
                          )}
                          {sourceUrl && (
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-green-700 hover:text-green-800 font-medium"
                            >
                              Original recipe
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setEditing(recipe)}
                            className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRecipe(recipe)}
                            disabled={deletingId === recipe.id}
                            className="px-2.5 py-1 rounded-lg bg-white border border-red-100 text-xs font-medium text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-40"
                          >
                            {deletingId === recipe.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {recipe.ingredients.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Ingredients</p>
                          <div className="grid sm:grid-cols-2 gap-1.5">
                            {recipe.ingredients.map((ingredient, index) => (
                              <div key={`${ingredient.name}-${index}`} className="text-xs text-gray-600 bg-white border border-gray-100 rounded-lg px-2 py-1.5">
                                {formatIngredientAmount(ingredient) && (
                                  <span className="text-gray-400 mr-1 tabular-nums">
                                    {formatIngredientAmount(ingredient)}
                                  </span>
                                )}
                                <span className="font-medium capitalize">{ingredient.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(recipe.instructions?.length ?? 0) > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recipe</p>
                          <ol className="space-y-1.5">
                            {recipe.instructions.map((step, index) => (
                              <li key={index} className="flex gap-2 text-xs text-gray-600 bg-white border border-gray-100 rounded-lg px-2 py-1.5">
                                <span className="text-gray-400 tabular-nums">{index + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {missingItems.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Need to buy</p>
                          <div className="flex flex-wrap gap-1.5">
                            {missingItems.map(r => (
                              <IngredientChip
                                key={r.name}
                                name={r.name}
                                overrides={overrides}
                                planned={planned}
                                computeImpact={computeImpact}
                                onMarkHave={onMarkHave}
                                onMarkPlanned={onMarkPlanned}
                                onUnmark={onUnmark}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {subItems.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Substitutions</p>
                          <div className="flex flex-wrap gap-1.5">
                            {subItems.map(r => (
                              <span
                                key={r.name}
                                className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-1"
                                style={{ opacity: 0.4 + (r.similarity ?? 0.7) * 0.6 }}
                                title={`${Math.round((r.similarity ?? 0) * 100)}% match`}
                              >
                                <span className="line-through text-gray-400">{r.name}</span>
                                <span>→ {r.substituteWith}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {recipe.tags.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
