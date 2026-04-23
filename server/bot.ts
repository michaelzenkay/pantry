import Anthropic from '@anthropic-ai/sdk'
import type { Hono } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'

interface TgPhotoSize { file_id: string; width: number; height: number }
interface TgMessage {
  message_id: number
  from?: { id: number; first_name?: string }
  chat: { id: number }
  text?: string
  photo?: TgPhotoSize[]
}
interface TgUpdate { message?: TgMessage }

export function mountBot(
  app: Hono,
  supabase: SupabaseClient,
  telegramUserIdMap: Map<string, string>,
) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
  const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  async function reply(chatId: number, text: string) {
    if (!BOT_TOKEN) return
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })
  }

  async function downloadPhoto(fileId: string): Promise<{ data: string; media_type: 'image/jpeg' | 'image/png' }> {
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
    const { result } = await fileRes.json() as { result: { file_path: string } }
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${result.file_path}`
    const buf = await (await fetch(url)).arrayBuffer()
    const ext = result.file_path.split('.').pop() ?? 'jpg'
    return {
      data: Buffer.from(buf).toString('base64'),
      media_type: ext === 'png' ? 'image/png' : 'image/jpeg',
    }
  }

  async function parseTextIntent(text: string): Promise<{ action: 'add' | 'remove' | 'list'; items: string[] }> {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      tools: [{
        name: 'pantry_action',
        description: 'Manage pantry items',
        input_schema: {
          type: 'object' as const,
          properties: {
            action: { type: 'string', enum: ['add', 'remove', 'list'] },
            items: { type: 'array', items: { type: 'string' }, description: 'Lowercase item names' },
          },
          required: ['action', 'items'],
        },
      }],
      tool_choice: { type: 'any' as const },
      messages: [{
        role: 'user',
        content: `Parse this pantry request and call pantry_action: "${text}"\n\nRules:\n- Adding/bought/got items → action=add\n- Used up/finished/remove/out of → action=remove\n- Asking what's there/list/show → action=list`,
      }],
    })

    const toolUse = msg.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return { action: 'list', items: [] }
    return toolUse.input as { action: 'add' | 'remove' | 'list'; items: string[] }
  }

  async function extractPhotoItems(fileId: string): Promise<string[]> {
    const photo = await downloadPhoto(fileId)
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', ...photo } },
          { type: 'text', text: 'List every distinct food or grocery item visible. Reply with ONLY a JSON array of lowercase strings, no commentary. Example: ["eggs","milk","garlic","olive oil"]' },
        ],
      }],
    })
    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    try { return JSON.parse(raw) } catch { return [] }
  }

  async function addItems(uid: string, names: string[]): Promise<string[]> {
    // Skip names that already exist for this user
    const { data: existing } = await supabase
      .from('pantry')
      .select('name')
      .eq('user_id', uid)
      .in('name', names.map(n => n.toLowerCase().trim()))

    const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name))
    const toInsert = names
      .map(n => n.toLowerCase().trim())
      .filter(n => n && !existingNames.has(n))

    if (toInsert.length) {
      await supabase.from('pantry').insert(
        toInsert.map(name => ({ user_id: uid, name, category: 'pantry' }))
      )
    }
    return toInsert
  }

  async function removeItems(uid: string, names: string[]): Promise<string[]> {
    const removed: string[] = []
    for (const name of names) {
      const { error } = await supabase
        .from('pantry')
        .delete()
        .eq('user_id', uid)
        .ilike('name', name.toLowerCase().trim())
      if (!error) removed.push(name)
    }
    return removed
  }

  app.post('/telegram/webhook', async (c) => {
    if (WEBHOOK_SECRET && c.req.header('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) {
      return c.json({ error: 'forbidden' }, 403)
    }

    const update: TgUpdate = await c.req.json()
    const message = update.message
    if (!message) return c.json({ ok: true })

    const chatId = message.chat.id
    const telegramId = String(message.from?.id ?? '')
    const uid = telegramUserIdMap.get(telegramId)

    if (!uid) {
      await reply(chatId, "You're not registered. Ask the admin to add your Telegram ID.")
      return c.json({ ok: true })
    }

    // Photo: extract items via vision
    if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1]
      await reply(chatId, 'Scanning photo...')
      const items = await extractPhotoItems(largest.file_id)
      if (!items.length) {
        await reply(chatId, "Couldn't spot any food items in that photo.")
        return c.json({ ok: true })
      }
      const added = await addItems(uid, items)
      const skipped = items.length - added.length
      let msg = added.length
        ? `Added ${added.length} item${added.length > 1 ? 's' : ''}:\n${added.map(i => `• ${i}`).join('\n')}`
        : 'All items already in your pantry.'
      if (skipped > 0) msg += `\n(${skipped} already existed)`
      await reply(chatId, msg)
      return c.json({ ok: true })
    }

    // Text: parse intent
    const text = message.text ?? ''
    if (!text) return c.json({ ok: true })

    const { action, items } = await parseTextIntent(text)

    if (action === 'list') {
      const { data } = await supabase
        .from('pantry')
        .select('name,category')
        .eq('user_id', uid)
        .order('category')
        .order('name')
      if (!data?.length) {
        await reply(chatId, 'Your pantry is empty.')
      } else {
        const grouped = (data as { name: string; category: string }[]).reduce<Record<string, string[]>>((acc, row) => {
          const cat = row.category ?? 'other'
          ;(acc[cat] ??= []).push(row.name)
          return acc
        }, {})
        const lines = Object.entries(grouped)
          .map(([cat, names]) => `${cat}:\n${names.map(n => `  • ${n}`).join('\n')}`)
          .join('\n\n')
        await reply(chatId, `Your pantry:\n\n${lines}`)
      }
    } else if (action === 'add') {
      if (!items.length) { await reply(chatId, "What would you like to add?"); return c.json({ ok: true }) }
      const added = await addItems(uid, items)
      const skipped = items.length - added.length
      let msg = added.length ? `Added: ${added.join(', ')}` : 'Already in your pantry.'
      if (skipped > 0 && added.length > 0) msg += ` (${skipped} already existed)`
      await reply(chatId, msg)
    } else if (action === 'remove') {
      if (!items.length) { await reply(chatId, "What would you like to remove?"); return c.json({ ok: true }) }
      const removed = await removeItems(uid, items)
      await reply(chatId, removed.length ? `Removed: ${removed.join(', ')}` : "Couldn't find those items.")
    }

    return c.json({ ok: true })
  })
}
