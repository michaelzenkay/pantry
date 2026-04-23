import type { DishType, Recipe, PantryItem, RecipeWithStatus, RecipeStatus, IngredientResult } from '../types'

const LIGHT_TRIP_MAX = 3

const ALWAYS_AVAILABLE = ['water', 'warm water', 'cold water', 'ice water', 'boiling water',
  'salt', 'black pepper', 'white pepper', 'pepper']
const WATER_WORDS = new Set(['water', 'warm', 'hot', 'cold', 'ice', 'iced', 'boiling'])

// Compound substitutions: ALL listed ingredients together substitute for the key
export const COMPOUND_SUBS: Record<string, { ingredients: string[]; similarity: number }[]> = {
  'mirin': [{ ingredients: ['rice wine', 'sugar'], similarity: 0.9 }],
}

export const SYNONYMS: Record<string, [string, number][]> = {
  'chicken stock':    [['chicken broth', 0.95], ['broth', 0.9]],
  'bread flour':      [['all-purpose flour', 0.85], ['flour', 0.8]],
  'oil':              [['olive oil', 1.0], ['vegetable oil', 1.0], ['canola oil', 1.0], ['sesame oil', 0.7]],
  'neutral oil':      [['olive oil', 1.0], ['vegetable oil', 1.0], ['canola oil', 1.0]],
  'sugar':            [['white sugar', 1.0], ['cane sugar', 1.0]],
  'rock sugar':       [['brown sugar', 0.75], ['brown coconut sugar', 0.75], ['coconut sugar', 0.75], ['palm sugar', 0.7], ['white sugar', 0.6]],
  'scallions':        [['green onions', 1.0], ['spring onions', 1.0]],
  'shaoxing wine':    [['shaoxing rice wine', 1.0], ['shaoxing cooking wine', 1.0], ['rice wine', 0.9], ['cooking wine', 0.9], ['dry sherry', 0.7]],
  'cooking wine':     [['shaoxing cooking wine', 1.0], ['shaoxing wine', 1.0], ['shaoxing rice wine', 1.0], ['rice wine', 0.9]],
  "bird's eye chili": [['chili', 0.9], ['chilli', 0.9], ['sriracha', 0.6], ['chili flakes', 0.5]],
  'heavy cream':      [['whipping cream', 0.95], ['double cream', 0.95]],
  'lime juice':       [['lemon juice', 0.75]],
  'sesame seeds':     [['white sesame seeds', 1.0], ['black sesame seeds', 1.0], ['sesame seed', 1.0]],
  'sesame seed':      [['white sesame seeds', 1.0], ['black sesame seeds', 1.0], ['sesame seeds', 1.0]],
  'soybean paste':    [['white miso', 1.0], ['miso paste', 1.0], ['miso', 0.95], ['doenjang', 0.9]],
  'white miso':       [['soybean paste', 1.0], ['miso paste', 1.0], ['miso', 0.95], ['doenjang', 0.9]],
  'miso paste':       [['white miso', 1.0], ['soybean paste', 1.0], ['miso', 1.0], ['doenjang', 0.9]],
  'black bean sauce': [['black bean paste', 1.0], ['fermented black bean sauce', 1.0], ['ground bean sauce', 0.9], ['black beans', 0.8]],
  'fermented black bean sauce': [['black bean paste', 1.0], ['black bean sauce', 1.0], ['ground bean sauce', 0.9], ['fermented black beans', 0.8]],
  'ground bean sauce': [['black bean paste', 0.9], ['black bean sauce', 0.9], ['fermented black bean sauce', 0.9]],
}

// "gai lan (chinese broccoli)" → ["gai lan", "chinese broccoli"]
const DESCRIPTORS = new Set([
  'a', 'an', 'the', 'fresh', 'frozen', 'dried', 'dry', 'canned', 'can', 'jar',
  'bottle', 'bag', 'box', 'package', 'pkg', 'pack', 'medium', 'large', 'small', 'sized',
  'size', 'whole', 'chopped', 'diced', 'sliced', 'minced', 'crushed', 'peeled',
  'grated', 'shredded', 'cubed', 'ripe', 'raw', 'cooked', 'organic', 'of', 'or',
])

const SINGULARS: Record<string, string> = {
  potatoes: 'potato',
  tomatoes: 'tomato',
  leaves: 'leaf',
  loaves: 'loaf',
  knives: 'knife',
  chilies: 'chili',
  chiles: 'chili',
}

const VARIETY_WORDS: Record<string, string[]> = {
  potato: ['russet', 'yukon', 'gold', 'red'],
  onion: ['yellow', 'white', 'red', 'sweet'],
}

function singularize(word: string): string {
  if (SINGULARS[word]) return SINGULARS[word]
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

function normalizeTerm(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => !/^\d+([./-]\d+)?$/.test(word))
    .map(singularize)
    .filter(word => !DESCRIPTORS.has(word))

  const withoutVarieties = words.filter(word =>
    !Object.entries(VARIETY_WORDS).some(([base, varieties]) => words.includes(base) && varieties.includes(word))
  )
  return withoutVarieties.join(' ')
}

function displayIngredientName(name: string): string {
  return normalizeTerm(name) || name.toLowerCase().trim()
}

function expandTerms(name: string): string[] {
  const lower = name.toLowerCase()
  const base = lower.replace(/\s*\([^)]*\)/g, '').trim()
  const aliases = [...lower.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim())
  return [base, ...aliases]
    .flatMap(term => [term, normalizeTerm(term)])
    .filter(s => s.length > 0)
    .filter((term, index, all) => all.indexOf(term) === index)
}

export function findMatch(pantryNames: Set<string>, ingredient: string): IngredientResult {
  const ing = ingredient.toLowerCase()
  const ingTerms = expandTerms(ingredient)
  const displayName = displayIngredientName(ingredient)

  if (ALWAYS_AVAILABLE.includes(ing)) return { name: displayName, status: 'exact' }
  if (ingTerms.some(term => term.split(/\s+/).every(word => WATER_WORDS.has(word)))) return { name: displayName, status: 'exact' }
  if (pantryNames.has(ing)) return { name: displayName, status: 'exact' }

  for (const p of pantryNames) {
    const pantryTerms = expandTerms(p)
    if (ingTerms.some(it => pantryTerms.some(pt => pt === it || pt.includes(it) || it.includes(pt))))
      return { name: displayName, status: 'exact' }
  }

  for (const { ingredients, similarity } of COMPOUND_SUBS[ing] ?? []) {
    const allPresent = ingredients.every(sub => {
      const subTerms = expandTerms(sub)
      return [...pantryNames].some(p => {
        const pts = expandTerms(p)
        return subTerms.some(st => pts.some(pt => pt === st || pt.includes(st) || st.includes(pt)))
      })
    })
    if (allPresent)
      return { name: displayName, status: 'substitute', substituteWith: ingredients.join(' + '), similarity }
  }

  for (const [canonical, subs] of Object.entries(SYNONYMS)) {
    const allTerms = [canonical, ...subs.map(([s]) => s)]
    if (!allTerms.some(t => t === ing || t.includes(ing) || ing.includes(t))) continue

    let best: { name: string; similarity: number } | null = null
    for (const [sub, sim] of subs) {
      for (const p of pantryNames) {
        if (p === sub || p.includes(sub) || sub.includes(p)) {
          if (!best || sim > best.similarity) best = { name: p, similarity: sim }
        }
      }
    }
    for (const p of pantryNames) {
      if (p === canonical || p.includes(canonical) || canonical.includes(p)) {
        if (!best || 1.0 > best.similarity) best = { name: p, similarity: 1.0 }
      }
    }
    if (best) return { name: displayName, status: 'substitute', substituteWith: best.name, similarity: best.similarity }
  }

  return { name: displayName, status: 'missing' }
}

export function computeRecipes(
  recipes: Recipe[],
  pantry: PantryItem[],
  overrides: Set<string> = new Set(),
): RecipeWithStatus[] {
  const pantryNames = new Set([...pantry.map(p => p.name.toLowerCase()), ...overrides])
  return recipes.map(recipe => {
    const ingredientResults = recipe.ingredients.map(ing => findMatch(pantryNames, ing.name))
    const missing = ingredientResults.filter(r => r.status === 'missing').length
    const status: RecipeStatus = missing === 0 ? 'green' : missing <= LIGHT_TRIP_MAX ? 'yellow' : 'red'
    return { ...recipe, status, ingredientResults }
  })
}

const DISH_TYPE_LABELS: Record<DishType, string> = {
  app: 'Apps',
  main: 'Mains',
  sauce: 'Sauces',
  baked: 'Baked goods',
  soup: 'Soups',
  rice: 'Rice',
  noodles: 'Noodles',
  veggies: 'Veggies',
}

export { DISH_TYPE_LABELS }

function hasAny(text: string, words: string[]): boolean {
  return words.some(word => text.includes(word))
}

export function getDishTypes(recipe: Recipe): DishType[] {
  const text = [
    recipe.name,
    recipe.cuisine ?? '',
    recipe.tags.join(' '),
    recipe.ingredients.map(ingredient => ingredient.name).join(' '),
  ].join(' ').toLowerCase()

  const types = new Set<DishType>()
  if (hasAny(text, ['appetizer', 'starter', 'snack', 'dip', 'dumpling', 'wontons', 'wonton', 'spring roll'])) types.add('app')
  if (hasAny(text, ['sauce', 'dressing', 'vinaigrette', 'chutney', 'salsa', 'aioli', 'gravy', 'paste'])) types.add('sauce')
  if (hasAny(text, ['bread', 'cake', 'cookie', 'cookies', 'biscuit', 'muffin', 'scone', 'tart', 'pie', 'pastry', 'sourdough', 'baked'])) types.add('baked')
  if (hasAny(text, ['soup', 'stew', 'broth', 'congee', 'porridge', 'chowder'])) types.add('soup')
  if (hasAny(text, ['rice', 'risotto', 'pilaf', 'fried rice', 'biryani'])) types.add('rice')
  if (hasAny(text, ['noodle', 'noodles', 'pasta', 'ramen', 'udon', 'soba', 'spaghetti', 'linguine', 'lo mein', 'chow mein'])) types.add('noodles')
  if (hasAny(text, ['vegetable', 'veggie', 'veggies', 'greens', 'broccoli', 'cabbage', 'bok choy', 'gailan', 'gai lan', 'spinach', 'salad'])) types.add('veggies')

  if (types.size === 0 || !types.has('app')) types.add('main')
  if (types.has('sauce') && types.size === 2 && types.has('main')) types.delete('main')
  return [...types]
}

const PROTEIN_KEYWORDS: Record<string, string[]> = {
  chicken:  ['chicken'],
  beef:     ['beef', 'ground beef', 'brisket'],
  pork:     ['pork', 'char siu', 'spare rib', 'bacon', 'ham'],
  seafood:  ['fish', 'salmon', 'shrimp', 'prawn', 'tilapia', 'cod', 'scallop', 'clam', 'crab', 'lobster'],
  tofu:     ['tofu'],
  lamb:     ['lamb'],
  egg:      ['egg'],
}

export function getRecipeProteins(recipe: Recipe): string[] {
  const text = recipe.ingredients.map(i => i.name.toLowerCase()).join(' ')
  return Object.entries(PROTEIN_KEYWORDS)
    .filter(([, kws]) => kws.some(k => text.includes(k)))
    .map(([p]) => p)
}
