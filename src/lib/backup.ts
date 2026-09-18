import { db, DEFAULT_SETTINGS } from '../db/db'
import type { CoachThread, DailyMetric, Exercise, Food, MealEntry, MealSet, Routine, Settings, WeeklyReview, WeightEntry, Workout, WorkoutSet } from '../types'

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
  /** v1 のバックアップには無い */
  weeklyReviews?: WeeklyReview[]
  routines?: Routine[]
  coachThreads?: CoachThread[]
  /** v1 のバックアップには無い */
  dailyMetrics?: DailyMetric[]
  settings: Settings | undefined
}

const EMPTY_KEYS = { claude: '', openai: '', gemini: '' } as const

function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

export async function exportBackup(): Promise<string> {
  const [exercises, workouts, sets, foods, meals, mealSets, weights, weeklyReviews, routines, coachThreads, dailyMetrics, settings] = await Promise.all([
    db.exercises.toArray(),
    db.workouts.toArray(),
    db.sets.toArray(),
    db.foods.toArray(),
    db.meals.toArray(),
    db.mealSets.toArray(),
    db.weights.toArray(),
    db.weeklyReviews.toArray(),
    db.routines.toArray(),
    db.coachThreads.toArray(),
    db.dailyMetrics.toArray(),
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
    weeklyReviews,
    routines,
    coachThreads,
    dailyMetrics,
    settings: safeSettings,
  }
  return JSON.stringify(backup)
}

/** iOS のスタンドアロン PWA では download が効かないため、共有シートが使えるならそちらを優先 */
export async function saveTextFile(filename: string, text: string): Promise<void> {
  const file = new File([text], filename, { type: 'application/json' })
  if (isIos() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      // ユーザーがキャンセルした場合はそのまま終了
      if (e instanceof DOMException && e.name === 'AbortError') return
    }
  }
  downloadText(filename, text)
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

function parseJsonOrNull(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function parseBackup(json: string): Backup {
  // JSON として読めないファイル（別形式・途中で切れた等）も日本語で伝える
  const parsed = parseJsonOrNull(json)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('バックアップファイルとして読み込めません')
  const b = parsed as Record<string, unknown>
  if (b.version !== BACKUP_VERSION) throw new Error('対応していないバックアップ形式です')
  const tables = ['exercises', 'workouts', 'sets', 'foods', 'meals', 'mealSets', 'weights'] as const
  for (const t of tables) {
    if (!isRecordArray(b[t])) throw new Error(`データが壊れています: ${t}`)
  }
  if (b.weeklyReviews !== undefined && !isRecordArray(b.weeklyReviews)) {
    throw new Error('データが壊れています: weeklyReviews')
  }
  if (b.routines !== undefined && !isRecordArray(b.routines)) {
    throw new Error('データが壊れています: routines')
  }
  if (b.coachThreads !== undefined && !isRecordArray(b.coachThreads)) {
    throw new Error('データが壊れています: coachThreads')
  }
  if (b.dailyMetrics !== undefined && !isRecordArray(b.dailyMetrics)) {
    throw new Error('データが壊れています: dailyMetrics')
  }
  // 各テーブルの中身は id を持つオブジェクト配列であることまで確認した上で、型は書き出し時のものを信頼する
  return b as unknown as Backup
}

/** 既存データを全て置き換える。端末に保存済みのAPIキーは維持する。設定を書き換えたかを返す */
export async function importBackup(json: string): Promise<{ settingsRestored: boolean }> {
  const b = parseBackup(json)
  // 体重・日次コンディションは日付ユニーク。重複していたら後のものを残す
  b.weights = [...new Map(b.weights.map((w) => [w.date, w])).values()]
  const dailyMetrics = [...new Map((b.dailyMetrics ?? []).map((m) => [m.date, m])).values()]
  const current = await db.settings.get('app')
  await db.transaction(
    'rw',
    [db.exercises, db.workouts, db.sets, db.foods, db.meals, db.mealSets, db.weights, db.weeklyReviews, db.routines, db.coachThreads, db.dailyMetrics, db.settings],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.workouts.clear(),
        db.sets.clear(),
        db.foods.clear(),
        db.meals.clear(),
        db.mealSets.clear(),
        db.weights.clear(),
        db.weeklyReviews.clear(),
        db.routines.clear(),
        db.coachThreads.clear(),
        db.dailyMetrics.clear(),
      ])
      await Promise.all([
        db.exercises.bulkAdd(b.exercises),
        db.workouts.bulkAdd(b.workouts),
        db.sets.bulkAdd(b.sets),
        db.foods.bulkAdd(b.foods),
        db.meals.bulkAdd(b.meals),
        db.mealSets.bulkAdd(b.mealSets),
        db.weights.bulkAdd(b.weights),
        db.weeklyReviews.bulkAdd(b.weeklyReviews ?? []),
        db.routines.bulkAdd(b.routines ?? []),
        db.coachThreads.bulkAdd(b.coachThreads ?? []),
        db.dailyMetrics.bulkAdd(dailyMetrics),
      ])
      if (b.settings) {
        // 古い/欠けたフィールドは既定値で補う
        const merged: Settings = {
          ...DEFAULT_SETTINGS,
          ...b.settings,
          id: 'app',
          profile: { ...DEFAULT_SETTINGS.profile, ...b.settings.profile },
          targets: { ...DEFAULT_SETTINGS.targets, ...b.settings.targets },
          ai: {
            ...DEFAULT_SETTINGS.ai,
            ...b.settings.ai,
            models: { ...DEFAULT_SETTINGS.ai.models, ...b.settings.ai?.models },
            keys: current?.ai.keys ?? { ...EMPTY_KEYS },
          },
        }
        await db.settings.put(merged)
      }
    },
  )
  return { settingsRestored: !!b.settings }
}
