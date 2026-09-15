import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCheck, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { db } from '../db/db'
import { deleteWorkout, finishWorkout, reopenWorkout, setWorkoutExercises } from '../db/repo'
import { formatDuration, formatLong, todayKey } from '../lib/date'
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
import { Dumbbell } from 'lucide-react'
import './WorkoutSessionPage.css'

export function WorkoutSessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const timer = useRestTimer()
  const toast = useToast()
  const workout = useLiveQuery(async () => (await db.workouts.get(id)) ?? null, [id])
  const sets = useLiveQuery(() => db.sets.where('workoutId').equals(id).sortBy('order'), [id])
  const exerciseList = useLiveQuery(() => db.exercises.toArray(), [])
  const recentIds = useRecentExerciseIds()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const active = !!workout && !workout.endedAt

  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [active])

  if (workout === undefined || sets === undefined || exerciseList === undefined) {
    return <div className="page" />
  }
  if (workout === null) {
    return (
      <div className="page">
        <PageHeader title="見つかりません" back />
      </div>
    )
  }

  const isToday = workout.date === todayKey()
  const readOnly = !!workout.endedAt
  const elapsed = (workout.endedAt ?? now) - workout.startedAt
  const totalSets = sets.length

  const finish = async () => {
    timer.stop()
    await finishWorkout(workout.id)
    toast.show(`お疲れさま！ ${totalSets}セット完了`, 'success')
    navigate('/workout', { replace: true })
  }

  const addExercises = async (ids: string[]) => {
    await setWorkoutExercises(workout.id, [...workout.exerciseIds, ...ids.filter((x) => !workout.exerciseIds.includes(x))])
  }

  return (
    <div className="page ws">
      <PageHeader
        back
        eyebrow={isToday ? '今日のワークアウト' : formatLong(workout.date)}
        title={readOnly ? '完了' : formatDuration(elapsed)}
        action={
          readOnly ? (
            <Button size="sm" icon={<RotateCcw size={16} aria-hidden />} onClick={() => void reopenWorkout(workout.id)}>
              再開
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon={<CheckCheck size={16} aria-hidden />} onClick={() => void finish()}>
              終了
            </Button>
          )
        }
      />

      <div className="ws__meta">
        <span>
          <span className="num">{workout.exerciseIds.length}</span> 種目
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

      <div className="ws__blocks">
        {workout.exerciseIds.map((exId) => {
          const ex = exercises.get(exId)
          if (!ex) return null
          return (
            <ExerciseBlock
              key={exId}
              workout={workout}
              exercise={ex}
              sets={sets.filter((s) => s.exerciseId === exId)}
              exercises={exercises}
              restSecDefault={settings.defaultRestSec}
              readOnly={readOnly}
            />
          )
        })}
        {workout.exerciseIds.length === 0 && (
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

      <ExercisePickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} exercises={exerciseList} selectedIds={workout.exerciseIds} recentIds={recentIds} onConfirm={(ids) => void addExercises(ids)} />

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
