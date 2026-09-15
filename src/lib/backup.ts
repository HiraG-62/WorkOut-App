import { db } from '../db/db'
import type { Settings } from '../types'

const BACKUP_VERSION = 1

interface Backup {
  version: number
  exportedAt: string
  exercises: unknown[]
  workouts: unknown[]
  sets: unknown[]
  foods: unknown[]
  meals: unknown[]
  mealSets: unknown[]
  weights: unknown[]
  settings: Settings | undefined
}

export async function exportBackup(): Promise<string> {
  const [exercises, workouts, sets, foods, meals, mealSets, weights, settings] = await Promise.all([
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.sets.toArray(),
    db.foods.toArray(),
    db.meals.toArray(),
    db.mealSets.toArray(),
    db.weights.toArray(),
    db.settings.get('app'),
  ])
  // APIキーはバックアップに含めない
  const safeSettings = settings
    ? { ...settings, ai: { ...settings.ai, keys: { claude: '', openai: '', gemini: '' } } }
    : undefined
  const backup: Backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    workouts,
    sets,
    foods,
    meals,
    mealSets,
    weights,
    settings: safeSettings,
  }
  return JSON.stringify(backup)
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v)
}

/** 既存データを全て置き換える */
export async function importBackup(json: string): Promise<void> {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('不正なファイルです')
  const b = parsed as Partial<Backup>
  if (b.version !== BACKUP_VERSION) throw new Error('対応していないバックアップ形式です')
  const tables = ['exercises', 'workouts', 'sets', 'foods', 'meals', 'mealSets', 'weights'] as const
  for (const t of tables) {
    if (!isArray(b[t])) throw new Error(`データが壊れています: ${t}`)
  }
  const current = await db.settings.get('app')
  await db.transaction('rw', [db.exercises, db.workouts, db.sets, db.foods, db.meals, db.mealSets, db.weights, db.settings], async () => {
    for (const t of tables) {
      await db[t].clear()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db[t] as any).bulkAdd(b[t])
    }
    if (b.settings) {
      // 端末に保存済みのAPIキーは維持する
      await db.settings.put({ ...b.settings, ai: { ...b.settings.ai, keys: current?.ai.keys ?? b.settings.ai.keys } })
    }
  })
}
