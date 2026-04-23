import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env') })

const API = 'http://localhost:3001'

// ─── URL lists ────────────────────────────────────────────────────────────────

const DOOBYDOBAP_URLS = [
  'https://doobydobap.com/recipe/kimchi-101',
  'https://doobydobap.com/recipe/7-korean-egg-dishes',
  'https://doobydobap.com/recipe/gochujang-basque-cheesecake',
  'https://doobydobap.com/recipe/5-ingredient-jjajang-sauce',
  'https://doobydobap.com/recipe/brown-butter-soy-caramel-cookies',
  'https://doobydobap.com/recipe/10685-2',
  'https://doobydobap.com/recipe/mapo-tofu',
  'https://doobydobap.com/recipe/soondubu_shakshuka',
  'https://doobydobap.com/recipe/miso_mashed_potatoes',
  'https://doobydobap.com/recipe/korean-corn-cheese-balls',
  'https://doobydobap.com/recipe/pumpkin-spice-churro',
  'https://doobydobap.com/recipe/korean_donggasu',
  'https://doobydobap.com/recipe/white_sesame_chocolate_cookie',
  'https://doobydobap.com/recipe/honey_butter_french_toast',
  'https://doobydobap.com/recipe/green_onion_oil',
]

const MADEWITHLAU_URLS = [
  'longevity-noodles','ginger-scallion-spaghetti','instant-soy-sauce-chow-mein',
  'stir-fry-sauce','beef-fried-rice','chicken-broth','pan-fried-fish',
  'combination-chow-mein','spinach-tofu-soup','sweet-sour-fish',
  'char-siu-chicken-drumsticks','pineapple-fried-rice','scrambled-eggs-with-chives',
  'zha-jiang-mian','chicken-clay-pot','beef-oyster-sauce','peking-pork-chops',
  'air-fryer-chicken-breast','hokkien-fried-rice','cashew-shrimp',
  'steamed-chicken-with-mushroom','twice-cooked-pork','pan-fried-rice-noodles',
  'sweet-and-sour-chicken','minced-beef-with-rice','pan-fried-tilapia',
  'salted-fish-chicken-fried-rice','air-fryer-char-siu','chicken-stir-fry',
  'stir-fried-vermicelli','steamed-garlic-shrimp','mushroom-tofu-claypot',
  'lamb-chops','chicken-drumsticks','fried-pork-belly','pan-fried-steak',
  'fried-chicken-wings','pan-fried-chicken-breast','broccoli-stir-fry',
  'chinese-green-beans','egg-fried-rice','bok-choy-recipe','steamed-chinese-eggplant',
  'baked-cod','steamed-salmon','sesame-chicken','lo-mein-101','egg-drop-soup',
  'pipa-tofu','chow-mein','lemon-chicken','prawns-with-black-bean-sauce',
  'pan-fried-pork-chops','pan-fried-chicken-thighs','pan-fried-fish-cakes',
  'ginger-scallion-noodles','fried-stuffed-tofu','scallops-and-asparagus',
  'clams-with-black-bean-sauce','smashed-cucumber-salad','curry-chicken',
  'braised-pork-with-potatoes','beef-brisket-in-clear-broth','sliced-fish-congee',
  'crispy-skin-chicken','braised-mushrooms-with-bok-choy','salt-pepper-shrimp',
  'siu-yuk-crispy-pork-belly','cantonese-borscht-soup','west-lake-beef-soup',
  'pan-fried-shrimp-with-garlic','tomato-beef-pan-fried-noodles',
  'chinese-stuffed-eggplant','steamed-stuffed-tofu','chinese-stuffed-peppers',
  'beef-chow-fun-with-gravy','choy-sum-with-garlic','kung-pao-chicken',
  'cantonese-fried-egg','salt-pepper-chicken-wings','mapo-tofu-pork',
  'homemade-chili-oil','steamed-egg-minced-pork','steamed-fish-ginger-scallion',
  'egg-rolls','beef-lo-mein','clay-pot-rice','salt-pepper-tofu','egg-foo-young',
  'shrimp-and-snow-pea-stir-fry','soy-sauce-chicken','tomato-and-eggs',
  'cantonese-scrambled-eggs','yin-yang-fried-rice','orange-chicken','mongolian-beef',
  'salt-pepper-pork-chops','salt-baked-chicken','potstickers',
  'chinese-bbq-spare-ribs','yangzhou-fried-rice','tomato-tofu-soup',
  'beef-chow-fun','beef-broccoli','ramen-chow-mein','hong-kong-style-chow-mein',
  'wonton-noodle-soup','wontons','singapore-noodles','black-pepper-beef-stir-fry',
  'bok-choy-soup','sweet-sour-pork','ginger-scallion-sauce','stir-fried-bok-choy',
  'stir-fried-green-beans','honey-walnut-shrimp','eggplant-with-garlic-sauce',
  'cantonese-chow-mein','general-tsos-chicken','char-siu-chinese-bbq-pork',
  'steamed-fish','white-cut-chicken','chinese-broccoli-oyster-sauce',
  'pan-fried-salmon','hot-sour-soup','chicken-congee','steamed-spare-ribs',
  'vegetable-lo-mein','moo-shu-pork','shrimp-chow-fun','steamed-egg',
  'ginger-fried-rice','mapo-tofu-chicken','rainbow-chicken-stir-fry',
  'chicken-corn-soup','egg-drop-soup-recipe','pan-fried-salmon',
].map(slug => `https://www.madewithlau.com/recipes/${slug}`)

const MIKEG_AIRFRYER_URLS = [
  'https://www.lifebymikeg.com/blogs/all/air-fryer-salmon-teriyaki-easy-10-minute-recipe',
  'https://www.lifebymikeg.com/blogs/all/air-fryer-whole-chicken-rotisserie-style',
  'https://www.lifebymikeg.com/blogs/all/air-fryer-empanadas-pro-home-cooks',
  'https://www.lifebymikeg.com/blogs/all/air-fryer-tortilla-chips-pro-home-cooks',
  'https://www.lifebymikeg.com/blogs/all/can-you-make-a-good-french-fry-in-the-air-fryer',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDuration(iso?: string): number | null {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return null
  return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0')
}

function parseServings(raw?: string | number): number | null {
  if (!raw) return null
  const n = parseInt(String(raw))
  return isNaN(n) ? null : n
}

const UNITS = ['cups?','tbsps?','tablespoons?','tsps?','teaspoons?','oz','ounces?',
  'lbs?','pounds?','g','grams?','kg','ml','liters?','L','pinch(?:es)?','dash(?:es)?',
  'cloves?','whole','slices?','pieces?','bunches?','heads?','stalks?','cans?',
  'packages?','pkgs?','bags?','jars?','bottles?','sprigs?']
const UNIT_RE = new RegExp(`^(${UNITS.join('|')})$`, 'i')
const NUM_RE = /^[\d\/\.\s-]+$/

function parseIngredient(raw: string): { name: string; quantity: string; unit: string } {
  // Strip preparation notes after comma: "2 cloves garlic, minced" → strip ", minced"
  const cleaned = raw.replace(/,\s*.+$/, '').trim()
  const tokens = cleaned.split(/\s+/)

  let quantity = ''
  let unit = ''
  let nameStart = 0

  if (tokens[0] && NUM_RE.test(tokens[0])) {
    quantity = tokens[0]
    nameStart = 1
    if (tokens[1] && UNIT_RE.test(tokens[1])) {
      unit = tokens[1]
      nameStart = 2
    }
  }

  const name = tokens.slice(nameStart).join(' ') || cleaned
  return { name: name.toLowerCase(), quantity: quantity || '1', unit }
}

function parseInstructions(raw?: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.flatMap((step: unknown) => {
      if (typeof step === 'string') return [step.trim()]
      if (typeof step === 'object' && step !== null) {
        const s = step as Record<string, unknown>
        // HowToStep or HowToSection
        if (s['@type'] === 'HowToSection' && Array.isArray(s.itemListElement)) {
          return (s.itemListElement as unknown[]).map((i: unknown) => {
            const item = i as Record<string, unknown>
            return String(item.text ?? '').trim()
          }).filter(Boolean)
        }
        return [String(s.text ?? '').trim()].filter(Boolean)
      }
      return []
    })
  }
  return [String(raw).trim()]
}

function normalizeJsonLd(data: Record<string, unknown>, source: string) {
  const ingredients = (data.recipeIngredient as string[] ?? []).map(parseIngredient)
  const instructions = parseInstructions(data.recipeInstructions)
  const keywords = typeof data.keywords === 'string'
    ? data.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
    : []

  return {
    name: String(data.name ?? '').trim(),
    cuisine: String(data.recipeCuisine ?? '').trim() || null,
    prep_time_minutes: parseDuration(data.prepTime as string),
    cook_time_minutes: parseDuration(data.cookTime as string),
    servings: parseServings(data.recipeYield as string),
    ingredients,
    instructions,
    tags: keywords.slice(0, 10),
    notes: `Source: ${source}`,
  }
}

async function extractJsonLd(page: import('playwright').Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for (const s of scripts) {
      try {
        const parsed = JSON.parse(s.textContent ?? '')
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          if (item?.['@type'] === 'Recipe') return item
          // some sites nest inside @graph
          if (Array.isArray(item?.['@graph'])) {
            const r = item['@graph'].find((n: Record<string, unknown>) => n['@type'] === 'Recipe')
            if (r) return r
          }
        }
      } catch { /* skip */ }
    }
    return null
  })
}

async function extractMikeG(page: import('playwright').Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => {
    const body = document.body.innerText

    // Extract metadata from "Prep Time: X min" patterns
    const prepMatch = body.match(/Prep\s*Time[:\s]+(\d+)\s*min/i)
    const cookMatch = body.match(/Cook\s*Time[:\s]+(\d+)\s*min/i)
    const servesMatch = body.match(/Serves?[:\s]+([\d\s\-–]+)/i)

    // Find ingredients: heading containing "Ingredient" → next UL
    let ingredients: string[] = []
    const allElems = Array.from(document.querySelectorAll('h2,h3,h4,ul,ol'))
    let inIngredients = false
    for (const el of allElems) {
      const tag = el.tagName.toLowerCase()
      if ((tag === 'h2' || tag === 'h3' || tag === 'h4') && /ingredient/i.test(el.textContent ?? '')) {
        inIngredients = true
        continue
      }
      if (inIngredients && tag === 'ul') {
        ingredients = Array.from(el.querySelectorAll('li')).map(li => li.textContent?.trim() ?? '').filter(Boolean)
        break
      }
      if (inIngredients && (tag === 'h2' || tag === 'h3' || tag === 'h4')) break
    }

    // Find instructions: heading containing "Instruction" or "Direction" → next OL/UL
    let instructions: string[] = []
    let inInstructions = false
    for (const el of allElems) {
      const tag = el.tagName.toLowerCase()
      if ((tag === 'h2' || tag === 'h3' || tag === 'h4') && /instruction|direction|method|steps?/i.test(el.textContent ?? '')) {
        inInstructions = true
        continue
      }
      if (inInstructions && (tag === 'ol' || tag === 'ul')) {
        instructions = Array.from(el.querySelectorAll('li')).map(li => li.textContent?.trim() ?? '').filter(Boolean)
        break
      }
      if (inInstructions && (tag === 'h2' || tag === 'h3' || tag === 'h4')) break
    }

    // Recipe name: first H1 or title
    const name = (document.querySelector('h1')?.textContent ?? document.title).trim()

    if (ingredients.length === 0) return null

    return {
      name,
      prepTime: prepMatch ? `PT${prepMatch[1]}M` : undefined,
      cookTime: cookMatch ? `PT${cookMatch[1]}M` : undefined,
      recipeYield: servesMatch ? servesMatch[1].trim() : undefined,
      recipeIngredient: ingredients,
      recipeInstructions: instructions,
      recipeCuisine: '',
      keywords: '',
    }
  })
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function recipeExists(name: string): Promise<boolean> {
  const r = await fetch(`${API}/recipes/exists?name=${encodeURIComponent(name)}`)
  const j = await r.json() as { exists: boolean }
  return j.exists
}

async function saveRecipe(recipe: Record<string, unknown>): Promise<void> {
  const r = await fetch(`${API}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  })
  if (!r.ok) throw new Error(await r.text())
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function scrapeAll() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  const allUrls = [
    ...DOOBYDOBAP_URLS.map(u => ({ url: u, source: 'doobydobap.com', extractor: 'jsonld' as const })),
    ...MADEWITHLAU_URLS.map(u => ({ url: u, source: 'madewithlau.com', extractor: 'jsonld' as const })),
    ...MIKEG_AIRFRYER_URLS.map(u => ({ url: u, source: 'lifebymikeg.com', extractor: 'mikeg' as const })),
  ]

  let added = 0, skipped = 0, failed = 0

  for (const { url, source, extractor } of allUrls) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

      let rawData: Record<string, unknown> | null = null
      if (extractor === 'mikeg') {
        rawData = await extractMikeG(page)
      } else {
        rawData = await extractJsonLd(page)
      }

      if (!rawData) {
        console.log(`⚠  No recipe data — ${url}`)
        failed++
        continue
      }

      const recipe = normalizeJsonLd(rawData, url)

      if (!recipe.name || recipe.ingredients.length === 0) {
        console.log(`⚠  Empty recipe — ${url}`)
        failed++
        continue
      }

      if (await recipeExists(recipe.name)) {
        console.log(`↩  Already exists: ${recipe.name}`)
        skipped++
        continue
      }

      await saveRecipe(recipe)
      console.log(`✓  ${recipe.name} (${recipe.ingredients.length} ingredients)`)
      added++

      await page.waitForTimeout(800) // gentle rate limit
    } catch (err) {
      console.error(`✗  ${url}:`, (err as Error).message)
      failed++
    }
  }

  await browser.close()
  console.log(`\nDone — ${added} added, ${skipped} skipped, ${failed} failed`)
}

scrapeAll()
