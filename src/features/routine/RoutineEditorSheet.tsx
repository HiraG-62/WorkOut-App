import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { addRoutine, DEFAULT_PLAN_REPS, DEFAULT_PLAN_SECONDS, DEFAULT_PLAN_SETS, deleteRoutine, restoreRoutine, updateRoutine } from '../../db/repo'
import { FAVORITE_TOGGLE_DESCRIPTION, FAVORITE_TOGGLE_LABEL } from '../../lib/favorite'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Stepper } from '../../components/ui/Stepper'
import { TextField } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Toggle'
import { useToast } from '../../components/ui/Toast'
import { useBusy } from '../../hooks/useBusy'
import { ExercisePickerSheet } from '../workout/ExercisePickerSheet'
import type { Exercise, Routine, RoutineItem, RoutineSource } from '../../types'
import './RoutineEditorSheet.css'

const SETS_MIN = 1
const SETS_MAX = 20
const REPS_MIN = 1
const REPS_MAX = 500
const SECONDS_STEP = 5
const SECONDS_MIN = 5
const SECONDS_MAX = 3600
const UNDO_MS = 6000

interface RoutineEditorSheetProps {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  /** 編集対象。新規作成なら null */
  routine?: Routine | null
  /** 新規作成時の初期値（ワークアウトから保存する場合など） */
  initial?: { name: string; items: RoutineItem[]; source: RoutineSource; sourceUrl?: string; note?: string }
  onSaved?: (r: Routine) => void
}

/** セットメニューの作成・編集 */
export function RoutineEditorSheet({ open, onClose, exercises, routine = null, initial, onSaved }: RoutineEditorSheetProps) {
  const toast = useToast()
  const guard = useBusy()
  const [name, setName] = useState('')
  const [items, setItems] = useState<RoutineItem[]>([])
  const [favorite, setFavorite] = useState(false)
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const byId = new Map(exercises.map((e) => [e.id, e]))

  // 開いた瞬間だけ初期化する（親の再レンダーで入力中の値を消さない）
  useEffect(() => {
    if (!open) return
    // initial.items があれば編集時でもそれを優先（ワークアウトの実績でメニューを更新する用途）
    setName(routine?.name ?? initial?.name ?? '')
    setItems(initial?.items ?? routine?.items ?? [])
    setFavorite(routine?.favorite ?? false)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routine?.id])

  const addExercises = (ids: string[]) => {
    const existing = new Set(items.map((i) => i.exerciseId))
    const added = ids
      .filter((id) => !existing.has(id))
      .map<RoutineItem>((id) =>
        byId.get(id)?.type === 'time' ? { exerciseId: id, sets: DEFAULT_PLAN_SETS, seconds: DEFAULT_PLAN_SECONDS } : { exerciseId: id, sets: DEFAULT_PLAN_SETS, reps: DEFAULT_PLAN_REPS },
      )
    setItems((s) => [...s, ...added])
  }

  const update = (idx: number, patch: Partial<RoutineItem>) => setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const remove = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx))
  const move = (idx: number, dir: -1 | 1) =>
    setItems((s) => {
      const to = idx + dir
      if (to < 0 || to >= s.length) return s
      const next = [...s]
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })

  const save = () =>
    guard(async () => {
      if (!name.trim()) {
        setError('メニュー名を入力してください')
        return
      }
      if (items.length === 0) {
        setError('種目を1つ以上追加してください')
        return
      }
      const payload = { name: name.trim(), items }
      if (routine) {
        const patch = { ...payload, favorite }
        await updateRoutine(routine.id, patch)
        onSaved?.({ ...routine, ...patch })
        toast.show(`「${payload.name}」を更新しました`, 'success')
      } else {
        const r = await addRoutine({ ...payload, source: initial?.source ?? 'manual', sourceUrl: initial?.sourceUrl, note: initial?.note })
        onSaved?.(r)
        toast.show(`メニュー「${payload.name}」を保存しました`, 'success')
      }
      onClose()
    })

  const removeRoutine = () =>
    guard(async () => {
      if (!routine) return
      const removed = await deleteRoutine(routine.id)
      onClose()
      toast.show(`「${routine.name}」を削除しました`, 'info', { label: '取り消す', onClick: () => void (removed && restoreRoutine(removed)) }, UNDO_MS)
    })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={routine ? 'メニューを編集' : 'メニューを作る'}
      tall
      footer={
        <div className="row">
          {routine && <Button variant="danger" icon={<Trash2 size={18} aria-hidden />} aria-label="このメニューを削除" onClick={() => void removeRoutine()} />}
          <Button variant="primary" block onClick={() => void save()}>
            保存
          </Button>
        </div>
      }
    >
      <div className="stack">
        <TextField label="メニュー名" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 朝の全身 20分" error={error && !name.trim() ? error : undefined} autoFocus={!routine && !initial?.name} />
        {routine && <Toggle checked={favorite} onChange={setFavorite} label={FAVORITE_TOGGLE_LABEL} description={FAVORITE_TOGGLE_DESCRIPTION} />}
        <ol className="re__list" aria-label="メニューの種目">
          {items.map((it, idx) => {
            const ex = byId.get(it.exerciseId)
            if (!ex) return null
            return (
              <li key={it.exerciseId} className="re__item">
                <div className="re__head">
                  <span className="re__order num">{idx + 1}</span>
                  <span className="re__name">{ex.name}</span>
                  <button type="button" className="re__icon" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label={`${ex.name} を上へ`}>
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button type="button" className="re__icon" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label={`${ex.name} を下へ`}>
                    <ArrowDown size={16} aria-hidden />
                  </button>
                  <button type="button" className="re__icon re__icon--danger" onClick={() => remove(idx)} aria-label={`${ex.name} を外す`}>
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <div className="re__steppers">
                  <Stepper label="セット" value={it.sets} onChange={(sets) => update(idx, { sets })} step={1} min={SETS_MIN} max={SETS_MAX} unit="set" name={`${ex.name}のセット数`} editable />
                  {ex.type === 'time' ? (
                    <Stepper label="1セット" value={it.seconds ?? DEFAULT_PLAN_SECONDS} onChange={(seconds) => update(idx, { seconds })} step={SECONDS_STEP} min={SECONDS_MIN} max={SECONDS_MAX} unit="秒" name={`${ex.name}の秒数`} editable />
                  ) : (
                    <Stepper label="1セット" value={it.reps ?? DEFAULT_PLAN_REPS} onChange={(reps) => update(idx, { reps })} step={1} min={REPS_MIN} max={REPS_MAX} unit="回" name={`${ex.name}の回数`} editable />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        {error && items.length === 0 && name.trim() && <p className="re__error" role="alert">{error}</p>}
        <Button block icon={<Plus size={18} aria-hidden />} onClick={() => setPickerOpen(true)}>
          種目を追加
        </Button>
      </div>

      <ExercisePickerSheet open={pickerOpen} onClose={() => setPickerOpen(false)} exercises={exercises} selectedIds={items.map((i) => i.exerciseId)} onConfirm={(ids) => addExercises(ids)} confirmLabel="メニューに追加" />
    </Sheet>
  )
}
