import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Dumbbell, ListPlus, Play, Repeat } from 'lucide-react'
import { db } from '../db/db'
import { createWorkout } from '../db/repo'
import { formatDuration, formatRelative, todayKey } from '../lib/date'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, Section } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { ExercisePickerSheet } from '../features/workout/ExercisePickerSheet'
import { useRecentExerciseIds } from '../features/workout/useRecentExerciseIds'
import { summarizeSets } from '../features/workout/useWorkoutStats'
import './WorkoutPage.css'

const HISTORY_LIMIT = 20

export function WorkoutPage() {
  const navigate = useNavigate()
  const today = todayKey()
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().limit(HISTORY_LIMIT).toArray(), [])
  const exerciseList = useLiveQuery(() => db.exercises.toArray(), [])
  const allSets = useLiveQuery(() => db.sets.toArray(), [])
  const recentIds = useRecentExerciseIds()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickerOpen, setPickerOpen] = useState(searchParams.get('pick') === '1')
  const closePicker = () => {
    setPickerOpen(false)
    if (searchParams.has('pick')) setSearchParams({}, { replace: true })
  }

  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  // 日をまたいだ進行中のワークアウトも「今日の」扱いにする
  const todayWorkout = workouts?.find((w) => !w.endedAt) ?? workouts?.find((w) => w.date === today)
  const lastWorkout = workouts?.find((w) => w.id !== todayWorkout?.id)
  const setsOf = (id: string) => (allSets ?? []).filter((s) => s.workoutId === id)
  const history = (workouts ?? []).filter((w) => w.id !== todayWorkout?.id)

  const startFromLast = async () => {
    if (!lastWorkout) return
    const w = await createWorkout(lastWorkout.exerciseIds.filter((id) => exercises.get(id) && !exercises.get(id)?.archived))
    navigate(`/workout/${w.id}`)
  }

  const startWith = async (ids: string[]) => {
    const w = await createWorkout(ids)
    navigate(`/workout/${w.id}`)
  }

  if (!workouts || !exerciseList || !allSets) {
    return (
      <div className="page wp" aria-busy="true">
        <div className="skeleton skeleton--header" />
        <div className="skeleton skeleton--row" />
        <div className="skeleton skeleton--card" />
      </div>
    )
  }

  return (
    <div className="page wp">
      <PageHeader title="トレーニング" />

      {todayWorkout ? (
        <Card accent className="wp__today" onClick={() => navigate(`/workout/${todayWorkout.id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/workout/${todayWorkout.id}`)}>
          <div className="wp__today-head">
            <span className="wp__today-title">{todayWorkout.endedAt ? '今日は完了' : '進行中'}</span>
            {todayWorkout.endedAt && <span className="num wp__today-time">{formatDuration(todayWorkout.endedAt - todayWorkout.startedAt)}</span>}
          </div>
          <p className="wp__today-summary">{summarizeSets(setsOf(todayWorkout.id), exercises, todayWorkout.exerciseIds) || '種目未選択'}</p>
          <div className="wp__today-cta">
            <span>{todayWorkout.endedAt ? '記録を見る' : '続きから'}</span>
            <ChevronRight size={18} aria-hidden />
          </div>
        </Card>
      ) : (
        <div className="stack">
          {lastWorkout ? (
            <button type="button" className="wp__start wp__start--primary" onClick={() => void startFromLast()}>
              <span className="wp__start-icon">
                <Repeat size={22} aria-hidden />
              </span>
              <span className="wp__start-text">
                <span className="wp__start-title">前回と同じで開始</span>
                <span className="wp__start-sub">
                  {formatRelative(lastWorkout.date)} · {lastWorkout.exerciseIds.map((id) => exercises.get(id)?.name).filter(Boolean).join('、')}
                </span>
              </span>
              <Play size={20} fill="currentColor" aria-hidden />
            </button>
          ) : null}
          <button type="button" className={`wp__start ${lastWorkout ? '' : 'wp__start--primary'}`} onClick={() => setPickerOpen(true)}>
            <span className="wp__start-icon">
              <ListPlus size={22} aria-hidden />
            </span>
            <span className="wp__start-text">
              <span className="wp__start-title">種目を選んで開始</span>
              <span className="wp__start-sub">今日やる種目を自由に組む</span>
            </span>
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>
      )}

      {(history.length > 0 || workouts.length === 0) && (
      <Section title="履歴">
        {history.length === 0 ? (
          <EmptyState icon={<Dumbbell size={24} />} title="まだ記録がありません" description="最初のワークアウトを始めると、次回から「前回と同じ」で一撃で始められます" />
        ) : (
          <ul className="wp__history">
            {history.map((w) => {
              const s = setsOf(w.id)
              return (
                <li key={w.id}>
                  <button type="button" className="wp__hist" onClick={() => navigate(`/workout/${w.id}`)}>
                    <span className="wp__hist-date">{formatRelative(w.date)}</span>
                    <span className="wp__hist-body">
                      <span className="wp__hist-summary">{summarizeSets(s, exercises, w.exerciseIds) || '記録なし'}</span>
                      <span className="wp__hist-meta">
                        {w.exerciseIds.length}種目 · {s.length}セット{w.endedAt ? ` · ${formatDuration(w.endedAt - w.startedAt)}` : ' · 進行中'}
                      </span>
                    </span>
                    <ChevronRight size={18} className="faint" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
      )}

      <ExercisePickerSheet open={pickerOpen} onClose={closePicker} exercises={exerciseList} selectedIds={[]} recentIds={recentIds} onConfirm={(ids) => void startWith(ids)} confirmLabel="選んで開始" />
    </div>
  )
}
