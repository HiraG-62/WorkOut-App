import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowUpRight, Check, CopyCheck, MoreHorizontal, Play, Square, Trash2 } from 'lucide-react'
import { addSet, deleteSet, getLastSetsForExercise, removeExerciseFromWorkout, setWorkoutExercises, updateSet } from '../../db/repo'
import { db } from '../../db/db'
import { tapHaptic, unlockAudio } from '../../lib/feedback'
import { formatRelative } from '../../lib/date'
import { useRestTimer } from '../../hooks/useRestTimer'
import { Stepper } from '../../components/ui/Stepper'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { formatSet } from './useWorkoutStats'
import type { Exercise, Workout, WorkoutSet } from '../../types'
import './ExerciseBlock.css'

const DEFAULT_REPS = 10
const DEFAULT_SECONDS = 30
const DEFAULT_WEIGHT = 5
const WEIGHT_STEP = 2.5
const SECONDS_STEP = 5
const MAX_REPS = 999
const MAX_SECONDS = 3600
const MAX_WEIGHT = 200
const TIMING_TICK_MS = 250
const FLASH_MS = 600

interface ExerciseBlockProps {
  workout: Workout
  exercise: Exercise
  sets: WorkoutSet[]
  exercises: Map<string, Exercise>
  restSecDefault: number
  readOnly: boolean
  /** 今取り組んでいる種目として ✓ を強調表示する */
  active: boolean
}

interface Draft {
  reps: number
  seconds: number
  weightKg: number
}

type PlannedSet = Pick<WorkoutSet, 'reps' | 'seconds' | 'weightKg'>

export function ExerciseBlock({ workout, exercise, sets, exercises, restSecDefault, readOnly, active }: ExerciseBlockProps) {
  const timer = useRestTimer()
  const lastSets = useLiveQuery(() => getLastSetsForExercise(exercise.id, workout.id), [exercise.id, workout.id])
  const lastWorkout = useLiveQuery(async () => (lastSets && lastSets[0] ? db.workouts.get(lastSets[0].workoutId) : undefined), [lastSets])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState<WorkoutSet | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>({ reps: 0, seconds: 0, weightKg: 0 })
  const [timing, setTiming] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [justDone, setJustDone] = useState(false)
  const draftKey = useRef('')

  const done = sets.length
  const planned = lastSets ?? []
  const isTime = exercise.type === 'time'
  const restSec = exercise.restSec ?? restSecDefault
  const progression = exercise.progressionId ? exercises.get(exercise.progressionId) : undefined

  // 次のセットの初期値: 前回の同じ番目のセット → 前回の最後 → 今回の最後 → デフォルト
  useEffect(() => {
    if (lastSets === undefined) return
    const key = `${exercise.id}:${done}:${lastSets.length}`
    if (draftKey.current === key) return
    draftKey.current = key
    const src = lastSets[done] ?? lastSets[lastSets.length - 1] ?? sets[sets.length - 1]
    setDraft({
      reps: src?.reps ?? DEFAULT_REPS,
      seconds: src?.seconds ?? DEFAULT_SECONDS,
      weightKg: src?.weightKg ?? (exercise.useWeight ? DEFAULT_WEIGHT : 0),
    })
  }, [lastSets, done, sets, exercise.id, exercise.useWeight])

  useEffect(() => {
    if (timing === null) return
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - timing) / 1000)), TIMING_TICK_MS)
    return () => window.clearInterval(id)
  }, [timing])

  useEffect(() => {
    if (!justDone) return
    const id = window.setTimeout(() => setJustDone(false), FLASH_MS)
    return () => window.clearTimeout(id)
  }, [justDone])

  const record = async (s: PlannedSet, startRest: boolean) => {
    await addSet({
      workoutId: workout.id,
      exerciseId: exercise.id,
      reps: isTime ? undefined : s.reps,
      seconds: isTime ? s.seconds : undefined,
      weightKg: exercise.useWeight && s.weightKg ? s.weightKg : undefined,
    })
    setJustDone(true)
    if (startRest) timer.start(restSec, exercise.name)
  }

  const complete = async (d: Draft) => {
    unlockAudio()
    tapHaptic()
    await record(d, true)
  }

  /** ゴースト行（前回のセット）をタップしてその値で完了 */
  const completePlanned = async (s: PlannedSet) => {
    unlockAudio()
    tapHaptic()
    await record(s, true)
  }

  const completeRemaining = async () => {
    for (const s of planned.slice(done)) await record(s, false)
    tapHaptic()
  }

  const startTiming = () => {
    unlockAudio()
    setElapsed(0)
    setTiming(Date.now())
  }

  const stopTiming = async () => {
    if (timing === null) return
    const sec = Math.max(1, Math.round((Date.now() - timing) / 1000))
    setTiming(null)
    tapHaptic()
    await record({ seconds: sec, weightKg: draft?.weightKg }, true)
  }

  const switchToProgression = async () => {
    if (!progression) return
    await setWorkoutExercises(
      workout.id,
      workout.exerciseIds.map((id) => (id === exercise.id ? progression.id : id)),
    )
    setMenuOpen(false)
  }

  const openEdit = (s: WorkoutSet) => {
    setEditing(s)
    setEditDraft({ reps: s.reps ?? 0, seconds: s.seconds ?? 0, weightKg: s.weightKg ?? 0 })
  }

  const saveEdit = async () => {
    if (!editing) return
    await updateSet(editing.id, {
      reps: isTime ? undefined : editDraft.reps,
      seconds: isTime ? editDraft.seconds : undefined,
      weightKg: exercise.useWeight && editDraft.weightKg > 0 ? editDraft.weightKg : undefined,
    })
    setEditing(null)
  }

  const remainingPlanned = planned.slice(done)
  const doneClass = active ? 'xb__done' : 'xb__done xb__done--idle'

  return (
    <section className={`xb ${justDone ? 'xb--flash' : ''} ${active && !readOnly ? 'xb--active' : ''}`} aria-label={exercise.name}>
      <header className="xb__head">
        <div className="xb__title">
          <h2 className="xb__name">{exercise.name}</h2>
          <p className="xb__sub">
            {lastWorkout ? `前回 ${formatRelative(lastWorkout.date)}: ${planned.map((s) => formatSet(s, exercise)).join(' / ')}` : '初めての種目'}
          </p>
        </div>
        {!readOnly && (
          <button type="button" className="xb__menu" onClick={() => setMenuOpen(true)} aria-label={`${exercise.name} のメニュー`}>
            <MoreHorizontal size={20} aria-hidden />
          </button>
        )}
      </header>

      <ol className="xb__sets">
        {sets.map((s, i) => (
          <li key={s.id}>
            <button type="button" className="xb__set xb__set--done" onClick={() => !readOnly && openEdit(s)} disabled={readOnly}>
              <span className="xb__set-no">{i + 1}</span>
              <span className="display xb__set-val">{formatSet(s, exercise)}</span>
              <Check size={18} className="xb__set-check" aria-hidden />
            </button>
          </li>
        ))}
        {!readOnly &&
          remainingPlanned.map((s, i) => (
            <li key={`p${i}`}>
              <button type="button" className="xb__set xb__set--ghost" onClick={() => void completePlanned(s)} aria-label={`セット${done + i + 1}を前回と同じ ${formatSet(s, exercise)} で完了`}>
                <span className="xb__set-no">{done + i + 1}</span>
                <span className="display xb__set-val">{formatSet(s, exercise)}</span>
                <span className="xb__set-hint">タップで完了</span>
              </button>
            </li>
          ))}
      </ol>

      {!readOnly && draft && timing !== null && (
        <>
          <button type="button" className="xb__timing" onClick={() => void stopTiming()} aria-label="計測を止めて記録する">
            <span className="xb__timing-main">
              <span className="display xb__timing-val">{elapsed}</span>
              <span className="xb__timing-unit">秒</span>
            </span>
            <span className="xb__timing-stop">
              <Square size={16} fill="currentColor" aria-hidden />
              タップで停止して記録
            </span>
          </button>
          <button type="button" className="xb__bulk" onClick={() => setTiming(null)}>
            記録せずにやめる
          </button>
        </>
      )}

      {!readOnly && draft && timing === null && (
        <>
          <div className={`xb__input ${exercise.useWeight ? 'xb__input--weight' : ''}`}>
            <div className="xb__steppers">
              {isTime ? (
                <Stepper value={draft.seconds} onChange={(seconds) => setDraft({ ...draft, seconds })} step={SECONDS_STEP} min={SECONDS_STEP} max={MAX_SECONDS} unit="秒" size="lg" name={`${exercise.name}の秒数`} />
              ) : (
                <Stepper value={draft.reps} onChange={(reps) => setDraft({ ...draft, reps })} step={1} min={1} max={MAX_REPS} unit="回" size="lg" name={`${exercise.name}の回数`} />
              )}
              {exercise.useWeight && <Stepper value={draft.weightKg} onChange={(weightKg) => setDraft({ ...draft, weightKg })} step={WEIGHT_STEP} min={0} max={MAX_WEIGHT} decimals={1} unit="kg" name={`${exercise.name}の加重`} />}
            </div>
            <button type="button" className={doneClass} onClick={() => void complete(draft)} aria-label={`${exercise.name} セット${done + 1}を完了`}>
              <Check size={30} strokeWidth={3} aria-hidden />
            </button>
          </div>
          {isTime && (
            <button type="button" className="xb__bulk xb__bulk--play" onClick={startTiming}>
              <Play size={16} fill="currentColor" aria-hidden />
              タイマーで計測して記録
            </button>
          )}
        </>
      )}

      {!readOnly && timing === null && remainingPlanned.length > 0 && (
        <button type="button" className="xb__bulk xb__bulk--copy" onClick={() => void completeRemaining()}>
          <CopyCheck size={18} aria-hidden />
          前回と同じで残り{remainingPlanned.length}セット完了
        </button>
      )}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={exercise.name}>
        <div className="stack stack--sm">
          {progression && (
            <Button block icon={<ArrowUpRight size={18} aria-hidden />} onClick={() => void switchToProgression()} disabled={done > 0}>
              次のレベルへ: {progression.name}
            </Button>
          )}
          {progression && done > 0 && <p className="faint xb__hint">セットを記録した後は切り替えできません</p>}
          <Button
            block
            variant="danger"
            icon={<Trash2 size={18} aria-hidden />}
            onClick={() => {
              void removeExerciseFromWorkout(workout.id, exercise.id)
              setMenuOpen(false)
            }}
          >
            この種目を今日のメニューから外す
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`セット ${editing ? sets.indexOf(editing) + 1 : ''} を編集`}
        footer={
          <div className="row">
            <Button
              variant="danger"
              icon={<Trash2 size={18} aria-hidden />}
              aria-label="このセットを削除"
              onClick={() => {
                if (editing) void deleteSet(editing.id)
                setEditing(null)
              }}
            />
            <Button variant="primary" block onClick={() => void saveEdit()}>
              保存
            </Button>
          </div>
        }
      >
        <div className="xb__edit">
          {isTime ? (
            <Stepper value={editDraft.seconds} onChange={(seconds) => setEditDraft({ ...editDraft, seconds })} step={SECONDS_STEP} min={1} max={MAX_SECONDS} unit="秒" size="lg" name="秒数" />
          ) : (
            <Stepper value={editDraft.reps} onChange={(reps) => setEditDraft({ ...editDraft, reps })} step={1} min={1} max={MAX_REPS} unit="回" size="lg" name="回数" />
          )}
          {exercise.useWeight && <Stepper value={editDraft.weightKg} onChange={(weightKg) => setEditDraft({ ...editDraft, weightKg })} step={WEIGHT_STEP} min={0} max={MAX_WEIGHT} decimals={1} unit="kg" label="加重" />}
        </div>
      </Sheet>
    </section>
  )
}
