import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { estimateBurnKcal, FALLBACK_WEIGHT_KG } from '../../lib/calories'
import { todayKey } from '../../lib/date'

/** 最新の体重（未記録なら仮の値）と、記録があるかどうか */
export function useWeightInfo(): { kg: number; recorded: boolean } {
  const latest = useLiveQuery(async () => (await db.weights.orderBy('date').reverse().first()) ?? null, [])
  return { kg: latest?.kg ?? FALLBACK_WEIGHT_KG, recorded: latest !== null && latest !== undefined }
}

/** 最新の体重（未記録なら仮の値） */
export function useWeightKg(): number {
  return useWeightInfo().kg
}

/**
 * その日のワークアウトの推定消費カロリー合計。
 * 今日については、日をまたいだ進行中のワークアウトも含める（ホームの扱いに合わせる）
 */
export function useDayBurn(date: string): number {
  const weightKg = useWeightKg()
  const burn = useLiveQuery(async () => {
    const byDate = await db.workouts.where('date').equals(date).toArray()
    const workouts = date === todayKey() ? [...byDate, ...(await db.workouts.filter((w) => !w.endedAt && w.date !== date).toArray())] : byDate
    if (workouts.length === 0) return 0
    const [exerciseList, sets] = await Promise.all([
      db.exercises.toArray(),
      db.sets.where('workoutId').anyOf(workouts.map((w) => w.id)).toArray(),
    ])
    const exercises = new Map(exerciseList.map((e) => [e.id, e]))
    return workouts.reduce(
      (acc, w) => acc + estimateBurnKcal({ workout: w, sets: sets.filter((s) => s.workoutId === w.id), exercises, weightKg }),
      0,
    )
  }, [date, weightKg])
  return burn ?? 0
}
