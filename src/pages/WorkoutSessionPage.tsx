import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCheck, CopyCheck, Dumbbell, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { addSet, deleteWorkout, finishWorkout, getLastSetsForExercise, reopenWorkout, setWorkoutExercises } from '../db/repo'
import { formatDuration, formatLong, todayKey } from '../lib/date'
import { tapHaptic } from '../lib/feedback'
import { useSettings } from '../hooks/useSettings'
import { useRestTimer } from '../hooks/useRestTimer'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { ExerciseBlock } from '../features/workout/ExerciseBlock'
import { ExercisePickerSheet } from '../features/workout/ExercisePickerSheet'
import { useRecentExerciseIds } from '../features/workout/useRecentExerciseIds'
import { useBusy } from '../hooks/useBusy'
import type { WorkoutSet } from '../types'
import './WorkoutSessionPage.css'

const CLOCK_TICK_MS = 1000

export function WorkoutSessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const timer = useRestTimer()
  const toast = useToast()
  const guard = useBusy()
  const workout = useLiveQuery(async () => (await db.workouts.get(id)) ?? null, [id])
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(id).sortBy('order'), [id])
  const exerciseList = useLiveQuery(() => db.exercises.toArray(), [])
  const recentIds = useRecentExerciseIds()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const exerciseKey = workout?.exerciseIds.join(',') ?? ''
  const active = !!workout && !workout.endedAt

  // 各種目の前回セット（「全種目を前回と同じで記録」用）
  const plannedByExercise = useLiveQuery(async () => {
    const ids = exerciseKey ? exerciseKey.split(',') : []
    const entries = await Promise.all(ids.map(async (exId) => [exId, await getLastSetsForExercise(exId, id)] as const))
    return new Map<string, WorkoutSet[]>(entries)
  }, [exerciseKey, id])

  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => window.clearInterval(t)
  }, [active])

  if (workout === undefined || sets === undefined || exerciseList === undefined) {
    return (
      <div className="page ws" aria-busy="true">
        <div className="skeleton skeleton--header" />
        <div className="skeleton skeleton--card" />
        <div className="skeleton skeleton--card" />
      </div>
    )
  }
  if (workout === null) {
    return (
      <div className="page">
        <PageHeader title="見つかりません" back />
      </div>
    )
  }

  const exerciseIds = workout.exerciseIds
  const isToday = workout.date === todayKey()
  const readOnly = !!workout.endedAt
  const elapsed = (workout.endedAt ?? now) - workout.startedAt
  const totalSets = sets.length
  const setsOf = (exId: string) => sets.filter((s) => s.exerciseId === exId)

  // 直近でセットを記録した種目を「取り組み中」とみなす。まだ無ければ先頭
  const latest = sets.reduce<WorkoutSet | null>((acc, s) => (acc === null || s.completedAt > acc.completedAt ? s : acc), null)
  const activeId = latest?.exerciseId ?? exerciseIds[0]

  const remainingAll = exerciseIds.flatMap((exId) => {
    const planned = plannedByExercise?.get(exId) ?? []
    return planned.slice(setsOf(exId).length).map((s) => ({ exId, s }))
  })

  const finish = async () => {
    timer.stop()
    await finishWorkout(workout.id)
    toast.show(`お疲れさま！ ${totalSets}セット完了`, 'success')
    navigate('/workout', { replace: true })
  }

  const completeAllRemaining = () =>
    guard(async () => {
      for (const { exId, s } of remainingAll) {
        const ex = exercises.get(exId)
        await addSet({
          workoutId: workout.id,
          exerciseId: exId,
          reps: ex?.type === 'time' ? undefined : s.reps,
          seconds: ex?.type === 'time' ? s.seconds : undefined,
          weightKg: ex?.useWeight ? s.weightKg : undefined,
        })
      }
      tapHaptic()
      toast.show(`${remainingAll.length}セットを前回と同じで記録しました`, 'success')
    })

  const addExercises = async (ids: string[]) => {
    await setWorkoutExercises(workout.id, [...exerciseIds, ...ids.filter((x) => !exerciseIds.includes(x))])
  }

  return (
    <div className="page ws">
      <PageHeader
        back
        eyebrow={isToday ? '今日のワークアウト' : formatLong(workout.date)}
        title={readOnly ? '完了' : formatDuration(elapsed)}
        action={
          readOnly ? (
            <Button icon={<RotateCcw size={16} aria-hidden />} onClick={() => void reopenWorkout(workout.id)}>
              再開
            </Button>
          ) : (
            <Button variant="primary" icon={<CheckCheck size={16} aria-hidden />} onClick={() => void finish()}>
              終了
            </Button>
          )
        }
      />

      <div className="ws__meta">
        <span>
          <span className="num">{exerciseIds.length}</span> 種目
        </span>
        <span>
          <span className="num">{totalSets}</span> セット
        </span>
        {readOnly && (
          <span>
            <span className="num">{formatDuration(elapsed)}</span>
          </span>
        )}
      </div>

      {!readOnly && remainingAll.length > 0 && (
        <button type="button" className="ws__all" onClick={() => void completeAllRemaining()}>
          <CopyCheck size={18} aria-hidden />
          全種目を前回と同じで記録（残り{remainingAll.length}セット）
        </button>
      )}

      <div className="ws__blocks">
        {exerciseIds.map((exId) => {
          const ex = exercises.get(exId)
          if (!ex) return null
          return (
            <ExerciseBlock
              key={exId}
              workout={workout}
              exercise={ex}
              sets={setsOf(exId)}
              exercises={exercises}
              restSecDefault={settings.defaultRestSec}
              readOnly={readOnly}
              active={exId === activeId}
            />
          )
        })}
        {exerciseIds.length === 0 && (
          <EmptyState icon={<Dumbbell size={24} />} title="種目がありません" description="種目を追加して始めましょう" action={<Button variant="primary" onClick={() => setPickerOpen(true)}>種目を追加</Button>} />
        )}
      </div>

      {!readOnly && (
        <Button block icon={<Plus size={18} aria-hidden />} onClick={() => setPickerOpen(true)}>
          種目を追加
        </Button>
      )}

      <div className="ws__danger">
        <Button variant="ghost" size="sm" icon={<Trash2 size={16} aria-hidden />} onClick={() => setConfirmDelete(true)}>
          このワークアウトを削除
        </Button>
      </div>

      <ExercisePickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} exercises={exerciseList} selectedIds={exerciseIds} recentIds={recentIds} onConfirm={(ids) => void addExercises(ids)} />

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="ワークアウトを削除"
        footer={
          <div className="row">
            <Button block onClick={() => setConfirmDelete(false)}>
              やめる
            </Button>
            <Button
              block
              variant="danger"
              onClick={() => {
                timer.stop()
                void deleteWorkout(workout.id).then(() => navigate('/workout', { replace: true }))
              }}
            >
              削除する
            </Button>
          </div>
        }
      >
        <p className="muted">記録した {totalSets} セットもすべて消えます。元に戻せません。</p>
      </Sheet>
    </div>
  )
}
