import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

const RECENT_WORKOUTS = 10

/** 最近のワークアウトで使った種目IDを新しい順に返す（重複なし） */
export function useRecentExerciseIds(): string[] {
  const ids = useLiveQuery(async () => {
    const recent = await db.workouts.orderBy('startedAt').reverse().limit(RECENT_WORKOUTS).toArray()
    const seen = new Set<string>()
    for (const w of recent) for (const id of w.exerciseIds) seen.add(id)
    return [...seen]
  }, [])
  return ids ?? []
}
