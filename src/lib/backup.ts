import { db } from '../db/db'
import type { Exercise, Food, MealEntry, MealSet, Settings, WeightEntry, Workout, WorkoutSet } from '../types'

const BACKUP_VERSION = 1

interface Backup {
  version: number
  exportedAt: string
  exercises: Exercise[]
  workouts: Workout[]
  sets: WorkoutSet[]
  foods: Food[]
  meals: MealEntry[]
  mealSets: MealSet[]
  weights: WeightEntry[]
  settings: Settings | undefined
}

const EMPTY_KEYS = { claude: '', openai: '', gemini: '' } as const

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
  const safeSettings = settings ? { ...settings, ai: { ...settings.ai, keys: { ...EMPTY_KEYS } } } : undefined
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

function isRecordArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null && typeof (x as { id?: unknown }).id === 'string')
}

function parseBackup(json: string): Backup {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('不正なファイルです')
  const b = parsed as Record<string, unknown>
  if (b.version !== BACKUP_VERSION) throw new Error('対応していないバックアップ形式です')
  const tables = ['exercises', 'workouts', 'sets', 'foods', 'meals', 'mealSets', 'weights'] as const
  for (const t of tables) {
    if (!isRecordArray(b[t])) throw new Error(`データが壊れています: ${t}`)
  }
  // 各テーブルの中身は id を持つオブジェクト配列であることまで確認した上で、型は書き出し時のものを信頼する
  return b as unknown as Backup
}

/** 既存データを全て置き換える。端末に保存済みのAPIキーは維持する */
export async function importBackup(json: string): Promise<void> {
  const b = parseBackup(json)
  const current = await db.settings.get('app')
  await db.transaction('rw', [db.exercises, db.workouts, db.sets, db.foods, db.meals, db.mealSets, db.weights, db.settings], async () => {
    await Promise.all([
      db.exercises.clear(),
      db.workouts.clear(),
      db.sets.clear(),
      db.foods.clear(),
      db.meals.clear(),
      db.mealSets.clear(),
      db.weights.clear(),
    ])
    await Promise.all([
      db.exercises.bulkAdd(b.exercises),
      db.workouts.bulkAdd(b.workouts),
      db.sets.bulkAdd(b.sets),
      db.foods.bulkAdd(b.foods),
      db.meals.bulkAdd(b.meals),
      db.mealSets.bulkAdd(b.mealSets),
      db.weights.bulkAdd(b.weights),
    ])
    if (b.settings) {
      await db.settings.put({ ...b.settings, id: 'app', ai: { ...b.settings.ai, keys: current?.ai.keys ?? { ...EMPTY_KEYS } } })
    }
  })
}
