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

const app = new Hono()

app.use('*', cors({ origin: CORS_ORIGIN }))

// Recipes
app.get('/recipes', async (c) => {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', USER_ID)
    .order('name')
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.post('/recipes', async (c) => {
  const body = await c.req.json()
  const { data, error } = await supabase
    .from('recipes')
    .insert({ ...body, user_id: USER_ID, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

app.delete('/recipes/:id', async (c) => {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', USER_ID)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

app.patch('/recipes/:id', async (c) => {
  const body = await c.req.json()
  const { data, error } = await supabase
    .from('recipes')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .eq('user_id', USER_ID)
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.get('/recipes/exists', async (c) => {
  const name = c.req.query('name') ?? ''
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .eq('user_id', USER_ID)
    .ilike('name', name)
    .single()
  return c.json({ exists: !!data })
})

// Pantry
app.get('/pantry', async (c) => {
  let query = supabase.from('pantry').select('*').eq('user_id', USER_ID).order('name')
  const category = c.req.query('category')
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.post('/pantry', async (c) => {
  const body = await c.req.json()
  const { data, error } = await supabase
    .from('pantry')
    .insert({ ...body, user_id: USER_ID, name: body.name.trim().toLowerCase() })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

app.delete('/pantry/:id', async (c) => {
  const { error } = await supabase
    .from('pantry')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', USER_ID)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

serve({ fetch: app.fetch, port: PORT }, () =>
  console.log(`API server running on http://localhost:${PORT}`),
)
