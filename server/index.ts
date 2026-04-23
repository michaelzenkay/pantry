import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const USER_ID = process.env.USER_ID!
const PORT = Number(process.env.PORT ?? 3001)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

function parseCsv(value: string | undefined): string[] {
  return (value ?? '').split(',').map(v => v.trim()).filter(Boolean)
}

function parseDiscordUserMap(value: string | undefined): Map<string, string> {
  const entries = parseCsv(value)
  return new Map(entries.flatMap(entry => {
    const [discordId, userId] = entry.split(':').map(v => v.trim())
    return discordId && userId ? [[discordId, userId] as const] : []
  }))
}

const DISCORD_USER_ID_MAP = parseDiscordUserMap(process.env.DISCORD_USER_ID_MAP)
const SHARED_RECIPE_USER_IDS = [USER_ID, ...parseCsv(process.env.SHARED_RECIPE_USER_IDS)]
const ALLOWED_USER_IDS = new Set([
  USER_ID,
  ...parseCsv(process.env.ALLOWED_USER_IDS),
  ...DISCORD_USER_ID_MAP.values(),
])

function resolveUserId(c: { req: { header: (k: string) => string | undefined; query: (k: string) => string | undefined } }): string {
  const discordUserId = c.req.header('x-discord-user-id') ?? c.req.query('discord_user_id')
  const mappedDiscordUserId = discordUserId ? DISCORD_USER_ID_MAP.get(discordUserId) : undefined
  if (mappedDiscordUserId && ALLOWED_USER_IDS.has(mappedDiscordUserId)) return mappedDiscordUserId

  const id = c.req.header('x-user-id')
  return id && ALLOWED_USER_IDS.has(id) ? id : USER_ID
}

const app = new Hono()

app.use('*', cors({
  origin: CORS_ORIGIN,
  allowHeaders: ['Content-Type', 'x-user-id', 'x-discord-user-id'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}))

app.get('/health', (c) => c.json({ ok: true }))

// Recipes
app.get('/recipes', async (c) => {
  const uid = resolveUserId(c)
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .in('user_id', [...new Set([uid, ...SHARED_RECIPE_USER_IDS])])
    .order('name')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.post('/recipes', async (c) => {
  const uid = resolveUserId(c)
  const body = await c.req.json()
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...body, user_id: uid, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

app.delete('/recipes/:id', async (c) => {
  const uid = resolveUserId(c)
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', uid)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

app.patch('/recipes/:id', async (c) => {
  const uid = resolveUserId(c)
  const body = await c.req.json()
  const recipeId = c.req.param('id')
  const { data, error } = await supabase
    .from('recipes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', recipeId)
    .eq('user_id', uid)
    .select()
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (data) return c.json(data)

  const bodyKeys = Object.keys(body)
  const isRatingOnly = bodyKeys.length === 1 && bodyKeys[0] === 'rating'
  if (isRatingOnly) {
    const { data: sharedRecipe, error: sharedError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .in('user_id', SHARED_RECIPE_USER_IDS)
      .maybeSingle()
    if (sharedError) return c.json({ error: sharedError.message }, 500)
    if (sharedRecipe) return c.json(sharedRecipe)
  }

  return c.json({ error: 'Recipe not found for user' }, 404)
})

app.get('/recipes/exists', async (c) => {
  const uid = resolveUserId(c)
  const name = c.req.query('name') ?? ''
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .in('user_id', [...new Set([uid, ...SHARED_RECIPE_USER_IDS])])
    .ilike('name', name)
    .single()
  return c.json({ exists: !!data })
})

// Pantry
app.get('/pantry', async (c) => {
  const uid = resolveUserId(c)
  let query = supabase.from('pantry').select('*').eq('user_id', uid).order('name')
  const category = c.req.query('category')
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.post('/pantry', async (c) => {
  const uid = resolveUserId(c)
  const body = await c.req.json()
  const { data, error } = await supabase
    .from('pantry')
    .insert({ ...body, user_id: uid, name: body.name.trim().toLowerCase() })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

app.patch('/pantry/:id', async (c) => {
  const uid = resolveUserId(c)
  const body = await c.req.json()
  const patch = { ...body }
  if (typeof patch.name === 'string') patch.name = patch.name.trim().toLowerCase()

  const { data, error } = await supabase
    .from('pantry')
    .update(patch)
    .eq('id', c.req.param('id'))
    .eq('user_id', uid)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.delete('/pantry/:id', async (c) => {
  const uid = resolveUserId(c)
  const { error } = await supabase
    .from('pantry')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', uid)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

serve({ fetch: app.fetch, port: PORT }, () =>
  console.log(`API server running on http://localhost:${PORT}`),
)
