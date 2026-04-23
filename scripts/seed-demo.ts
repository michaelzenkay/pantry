import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const sourceUserId = process.argv.find(arg => arg.startsWith('--source='))?.split('=')[1] ?? process.env.USER_ID
const targetUserId = process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1] ?? randomUUID()
const appUrl = process.argv.find(arg => arg.startsWith('--app-url='))?.split('=')[1] ?? 'https://your-app.vercel.app/'
const copyPantry = process.argv.includes('--copy-pantry')
const clearTarget = !process.argv.includes('--keep-existing')

if (!sourceUserId) {
  throw new Error('Missing source user id. Pass --source=<uuid> or set USER_ID in env.')
}

async function cloneTable(table: 'recipes' | 'pantry') {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', sourceUserId)

  if (error) throw error
  if (!data?.length) return 0

  if (clearTarget) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('user_id', targetUserId)
    if (deleteError) throw deleteError
  }

  const rows = data.map(({ id, created_at, updated_at, ...row }) => ({
    ...row,
    user_id: targetUserId,
    updated_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase.from(table).insert(rows)
  if (insertError) throw insertError
  return rows.length
}

async function main() {
  const recipeCount = await cloneTable('recipes')
  const pantryCount = copyPantry ? await cloneTable('pantry') : 0

  const url = new URL(appUrl)
  url.searchParams.set('uid', targetUserId)

  console.log(`Demo user UUID: ${targetUserId}`)
  console.log(`Source user UUID: ${sourceUserId}`)
  console.log(`Recipes copied: ${recipeCount}`)
  console.log(`Pantry copied: ${pantryCount}`)
  console.log('')
  console.log(`Render env:`)
  console.log(`ALLOWED_USER_IDS=${targetUserId}`)
  console.log('')
  console.log(`Onboarding link:`)
  console.log(url.toString())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
