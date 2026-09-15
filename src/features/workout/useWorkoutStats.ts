import type { Exercise, WorkoutSet } from '../../types'

/** セットの表示用テキスト。例: 12回, 45秒, 12回 +5kg */
export function formatSet(set: Pick<WorkoutSet, 'reps' | 'seconds' | 'weightKg'>, ex: Pick<Exercise, 'type'>): string {
  const main = ex.type === 'time' ? `${set.seconds ?? 0}秒` : `${set.reps ?? 0}回`
  return set.weightKg ? `${main} +${set.weightKg}kg` : main
}

/** ワークアウト全体の概要。例: 腕立て伏せ 3set · スクワット 4set */
export function summarizeSets(sets: WorkoutSet[], exercises: Map<string, Exercise>, exerciseIds: string[]): string {
  const present = exerciseIds.flatMap((id) => {
    const ex = exercises.get(id)
    return ex ? [{ name: ex.name, n: sets.filter((s) => s.exerciseId === id).length }] : []
  })
  const withSets = present.filter((p) => p.n > 0)
  // セットを記録した種目だけ出す。まだ何も記録していなければ種目名だけ並べる
  return (withSets.length > 0 ? withSets.map((p) => `${p.name} ${p.n}set`) : present.map((p) => p.name)).join(' · ')
}

export function totalVolume(sets: WorkoutSet[]): { reps: number; seconds: number } {
  return sets.reduce((acc, s) => ({ reps: acc.reps + (s.reps ?? 0), seconds: acc.seconds + (s.seconds ?? 0) }), { reps: 0, seconds: 0 })
}
