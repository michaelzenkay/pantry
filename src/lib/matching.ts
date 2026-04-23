import type { Recipe, PantryItem, RecipeWithStatus, RecipeStatus, IngredientResult } from '../types'

const LIGHT_TRIP_MAX = 3

const ALWAYS_AVAILABLE = ['water', 'warm water', 'cold water', 'ice water', 'boiling water',
  'salt', 'black pepper', 'white pepper', 'pepper']

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
}

export function findMatch(pantryNames: Set<string>, ingredient: string): IngredientResult {
  const ing = ingredient.toLowerCase()

  if (ALWAYS_AVAILABLE.includes(ing)) return { name: ingredient, status: 'exact' }
  if (ing.startsWith('water')) return { name: ingredient, status: 'exact' }
  if (pantryNames.has(ing)) return { name: ingredient, status: 'exact' }

  for (const p of pantryNames) {
    if (p.includes(ing) || ing.includes(p)) return { name: ingredient, status: 'exact' }
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
    if (best) return { name: ingredient, status: 'substitute', substituteWith: best.name, similarity: best.similarity }
  }

  return { name: ingredient, status: 'missing' }
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
