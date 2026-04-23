import { useState } from 'react'
import { api } from '../lib/api'
import type { PantryItem } from '../types'

const CATEGORIES = ['fridge', 'freezer', 'pantry', 'spices'] as const
type Category = typeof CATEGORIES[number]
type Freshness = 'urgent' | 'dairy' | 'produce' | 'sauce' | 'stable'
type ViewMode = 'freshness' | 'location'
type PantryDraft = Pick<PantryItem, 'name' | 'quantity' | 'category' | 'expiry_date'>

const FRESHNESS_ORDER: Freshness[] = ['urgent', 'dairy', 'produce', 'sauce', 'stable']

const CATEGORY_LABELS: Record<Category, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
  spices: 'Spices',
}

const FRESHNESS_LABELS: Record<Freshness, string> = {
  urgent: 'Use this week',
  dairy: 'Dairy / chilled',
  produce: 'Keeps longer',
  sauce: 'Sauces',
  stable: 'Stable',
}

const FRESHNESS_STYLES: Record<Freshness, { item: string; dot: string; text: string }> = {
  urgent: { item: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700' },
  dairy: { item: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400', text: 'text-orange-700' },
  produce: { item: 'bg-lime-50 border-lime-200', dot: 'bg-lime-500', text: 'text-lime-700' },
  sauce: { item: 'bg-amber-50 border-amber-200', dot: 'bg-amber-700', text: 'text-amber-800' },
  stable: { item: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400', text: 'text-gray-600' },
}

const URGENT_PRODUCE = [
  'gailan', 'gai lan', 'green onion', 'green onions', 'scallion', 'scallions',
  'cilantro', 'parsley', 'bok choy', 'choy sum', 'spinach', 'lettuce', 'cabbage',
  'broccoli', 'mushroom', 'mushrooms', 'tomato', 'cucumber', 'bell pepper',
]
const LONGER_PRODUCE = [
  'carrot', 'carrots', 'onion', 'onions', 'potato', 'potatoes', 'sweet potato',
  'ginger', 'garlic', 'shallot', 'shallots', 'daikon', 'squash',
]
const SAUCES = [
  'soy sauce', 'fish sauce', 'oyster sauce', 'hoisin', 'vinegar', 'black vinegar',
  'rice vinegar', 'chinkiang', 'mirin', 'shaoxing', 'sesame oil', 'chili oil',
  'sriracha', 'ketchup', 'mustard', 'worcestershire', 'black bean paste',
  'black bean sauce', 'gochujang', 'soybean paste', 'white miso', 'miso paste',
  'doenjang', 'doubanjiang', 'chili bean paste',
]
const DAIRY = [
  'milk', 'cream', 'half and half', 'buttermilk', 'butter', 'cheese', 'yogurt',
  'yoghurt', 'sour cream', 'creme fraiche', 'egg', 'eggs', 'tofu',
]
const STABLES = [
  'sugar', 'bay leaf', 'bay leaves', 'noodle', 'noodles', 'rice', 'flour',
  'cornstarch', 'starch', 'salt', 'pepper', 'spice', 'spices', 'herb', 'herbs',
  'oregano', 'thyme', 'cumin', 'paprika', 'cinnamon', 'clove', 'cloves',
  'sourdough starter', 'sourdough',
]

interface Props {
  pantry: PantryItem[]
  onUpdate: (items: PantryItem[]) => void
}

function hasAny(name: string, words: string[]): boolean {
  return words.some(word => name.includes(word))
}

function daysUntil(date: string | null): number | null {
  if (!date) return null
  const end = new Date(`${date}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000)
}

function todayPlusDays(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function getFreshness(item: PantryItem): Freshness {
  const remaining = daysUntil(item.expiry_date)
  if (remaining !== null && remaining <= 7) return 'urgent'
  if (remaining !== null && remaining <= 21) return 'produce'

  const name = item.name.toLowerCase()
  if (hasAny(name, SAUCES)) return 'sauce'
  if (hasAny(name, DAIRY)) return 'dairy'
  if (hasAny(name, URGENT_PRODUCE)) return 'urgent'
  if (hasAny(name, LONGER_PRODUCE)) return 'produce'
  if (item.category === 'spices' || hasAny(name, STABLES)) return 'stable'
  if (item.category === 'fridge') return 'urgent'
  return 'stable'
}

function getDraftFreshness(draft: PantryDraft): Freshness {
  const remaining = daysUntil(draft.expiry_date)
  if (remaining !== null && remaining <= 7) return 'urgent'
  if (remaining !== null && remaining <= 21) return 'produce'

  const name = draft.name.toLowerCase()
  if (hasAny(name, SAUCES)) return 'sauce'
  if (hasAny(name, DAIRY) || draft.category === 'fridge') return 'dairy'
  if (hasAny(name, URGENT_PRODUCE)) return 'urgent'
  if (hasAny(name, LONGER_PRODUCE)) return 'produce'
  return 'stable'
}

function getFreshnessRank(item: PantryItem): number {
  const remaining = daysUntil(item.expiry_date)
  if (remaining !== null) return remaining
  return ({ urgent: 8, dairy: 14, produce: 22, sauce: 200, stable: 300 } as Record<Freshness, number>)[getFreshness(item)]
}

function sortPantry(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => getFreshnessRank(a) - getFreshnessRank(b) || a.name.localeCompare(b.name))
}

export default function PantryPanel({ pantry, onUpdate }: Props) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState<Category>('pantry')
  const [expiryDate, setExpiryDate] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('freshness')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PantryDraft | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = sortPantry(pantry.filter(p => p.category === cat))
    return acc
  }, {} as Record<Category, PantryItem[]>)

  const freshnessGroups = FRESHNESS_ORDER.reduce((acc, freshness) => {
    acc[freshness] = sortPantry(pantry.filter(item => getFreshness(item) === freshness))
    return acc
  }, {} as Record<Freshness, PantryItem[]>)

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      const data = await api.pantry.add({
        name,
        quantity: quantity || null,
        category,
        unit: null,
        expiry_date: expiryDate || null,
        notes: null,
      })
      onUpdate([...pantry, data])
      setName('')
      setQuantity('')
      setExpiryDate('')
    } finally {
      setAdding(false)
    }
  }

  async function removeItem(item: PantryItem) {
    await api.pantry.remove(item.id)
    onUpdate(pantry.filter(p => p.id !== item.id))
  }

  function startEdit(item: PantryItem) {
    setEditingId(item.id)
    setDraft({
      name: item.name,
      quantity: item.quantity ?? '',
      category: item.category,
      expiry_date: item.expiry_date ?? '',
    })
  }

  function updateDraft(patch: Partial<PantryDraft>) {
    setDraft(current => current ? { ...current, ...patch } : current)
  }

  function setDraftFreshness(freshness: Freshness) {
    if (!draft) return
    const patch: Partial<PantryDraft> = {}
    if (freshness === 'urgent') patch.expiry_date = todayPlusDays(7)
    if (freshness === 'dairy') {
      patch.category = 'fridge'
      patch.expiry_date = ''
    }
    if (freshness === 'produce') patch.expiry_date = todayPlusDays(21)
    if (freshness === 'sauce' || freshness === 'stable') {
      patch.category = freshness === 'sauce' ? 'pantry' : draft.category
      patch.expiry_date = ''
    }
    updateDraft(patch)
  }

  async function saveItem(item: PantryItem) {
    if (!draft || !draft.name.trim()) return
    setSavingId(item.id)
    try {
      const data = await api.pantry.update(item.id, {
        name: draft.name,
        quantity: draft.quantity || null,
        category: draft.category,
        expiry_date: draft.expiry_date || null,
      })
      onUpdate(pantry.map(p => p.id === item.id ? data : p))
      setEditingId(null)
      setDraft(null)
    } finally {
      setSavingId(null)
    }
  }

  function renderItem(item: PantryItem, isLast: boolean) {
    const freshness = getFreshness(item)
    const styles = FRESHNESS_STYLES[freshness]
    const remaining = daysUntil(item.expiry_date)
    const isEditing = editingId === item.id && draft
    const draftFreshness = isEditing ? getDraftFreshness(draft) : freshness

    return (
      <div
        key={item.id}
        className={`px-3 py-1.5 border-l-4 ${styles.item} ${isLast ? '' : 'border-b border-b-white/80'}`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(140px,1fr)_110px_120px_150px] gap-2">
              <input
                value={draft.name}
                onChange={e => updateDraft({ name: e.target.value })}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                value={draft.quantity ?? ''}
                onChange={e => updateDraft({ quantity: e.target.value })}
                placeholder="Qty"
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <select
                value={draft.category}
                onChange={e => updateDraft({ category: e.target.value as Category })}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <select
                value={draftFreshness}
                onChange={e => setDraftFreshness(e.target.value as Freshness)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {FRESHNESS_ORDER.map(f => <option key={f} value={f}>{FRESHNESS_LABELS[f]}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-gray-500">
                Use by
                <input
                  type="date"
                  value={draft.expiry_date ?? ''}
                  onChange={e => updateDraft({ expiry_date: e.target.value })}
                  className="ml-2 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </label>
              <button
                onClick={() => saveItem(item)}
                disabled={savingId === item.id || !draft.name.trim()}
                className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingId(null)
                  setDraft(null)
                }}
                className="px-3 py-1 border border-gray-200 rounded-lg text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${styles.dot}`} />
                <span className="text-sm font-medium text-gray-800 capitalize truncate">{item.name}</span>
                {item.quantity && <span className="text-xs text-gray-400 shrink-0">{item.quantity}</span>}
              </div>
              <div className="flex flex-wrap gap-2 pl-4 leading-tight">
                <span className={`text-xs font-medium ${styles.text}`}>{FRESHNESS_LABELS[freshness]}</span>
                <span className="text-xs text-gray-400">{CATEGORY_LABELS[item.category]}</span>
                {remaining !== null && (
                  <span className={`text-xs ${remaining <= 7 ? 'text-green-700' : 'text-gray-400'}`}>
                    {remaining < 0 ? `${Math.abs(remaining)}d past` : remaining === 0 ? 'today' : `${remaining}d left`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <button
                onClick={() => startEdit(item)}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-1.5 py-1"
                title="Edit"
              >
                Edit
              </button>
              <button
                onClick={() => removeItem(item)}
                className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none px-1.5"
                title="Remove"
              >
                x
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addItem} className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-gray-400 mb-1">Item</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. soy sauce"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-400 mb-1">Quantity</label>
          <input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="e.g. 1 bottle"
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-400 mb-1">Location</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="block text-xs text-gray-400 mb-1">Use by</label>
          <input
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="px-4 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {([
            ['freshness', 'Freshness'],
            ['location', 'Location'],
          ] as [ViewMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === mode ? 'bg-green-500 text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {FRESHNESS_ORDER.map(freshness => (
            <span key={freshness} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${FRESHNESS_STYLES[freshness].item} ${FRESHNESS_STYLES[freshness].text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${FRESHNESS_STYLES[freshness].dot}`} />
              {FRESHNESS_LABELS[freshness]}
            </span>
          ))}
        </div>
      </div>

      {viewMode === 'freshness'
        ? FRESHNESS_ORDER.map(freshness => {
            const items = freshnessGroups[freshness]
            if (items.length === 0) return null
            return (
              <div key={freshness}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {FRESHNESS_LABELS[freshness]} ({items.length})
                </h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {items.map((item, i) => renderItem(item, i === items.length - 1))}
                </div>
              </div>
            )
          })
        : CATEGORIES.map(cat => {
            const items = grouped[cat]
            if (items.length === 0) return null
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                  {CATEGORY_LABELS[cat]} ({items.length})
                </h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {items.map((item, i) => renderItem(item, i === items.length - 1))}
                </div>
              </div>
            )
          })}

      {pantry.length === 0 && (
        <p className="text-gray-400 text-sm text-center mt-8">Pantry is empty - add some items above.</p>
      )}
    </div>
  )
}
