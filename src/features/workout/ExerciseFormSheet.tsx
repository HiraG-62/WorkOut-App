import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addExercise, archiveExercise, unarchiveExercise, updateExercise } from '../../db/repo'
import { useToast } from '../../components/ui/Toast'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Segmented, SelectField, TextField } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Toggle'
import { Button } from '../../components/ui/Button'
import { BODY_PARTS, EXERCISE_TYPES, type BodyPart, type Exercise, type ExerciseType } from '../../types'
import { FORM_FAMILIES, type FormFamily } from './formGuide'
import { ExerciseFigure } from './ExerciseFigure'
import { resolveFamily } from './ExerciseGuideSheet'

interface ExerciseFormSheetProps {
  open: boolean
  onClose: () => void
  exercise?: Exercise | null
  allExercises: Exercise[]
  onSaved?: (ex: Exercise) => void
}

interface Draft {
  name: string
  type: ExerciseType
  bodyPart: BodyPart
  useWeight: boolean
  restSec: string
  progressionId: string
  formFamily: string
}

const UNDO_MS = 6000

const EMPTY: Draft = { name: '', type: 'reps', bodyPart: 'chest', useWeight: false, restSec: '', progressionId: '', formFamily: '' }

export function ExerciseFormSheet({ open, onClose, exercise, allExercises, onSaved }: ExerciseFormSheetProps) {
  const toast = useToast()
  const guard = useBusy()
  const [d, setD] = useState<Draft>(EMPTY)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setD(
      exercise
        ? {
            name: exercise.name,
            type: exercise.type,
            bodyPart: exercise.bodyPart,
            useWeight: exercise.useWeight,
            restSec: exercise.restSec ? String(exercise.restSec) : '',
            progressionId: exercise.progressionId ?? '',
            formFamily: resolveFamily(exercise) ?? '',
          }
        : EMPTY,
    )
    setError('')
  }, [open, exercise])

  const save = () =>
    guard(async () => {
      if (!d.name.trim()) {
        setError('種目名を入力してください')
        return
      }
    const rest = Number(d.restSec)
    const payload = {
      name: d.name.trim(),
      type: d.type,
      bodyPart: d.bodyPart,
      useWeight: d.useWeight,
      restSec: Number.isFinite(rest) && rest > 0 ? Math.round(rest) : undefined,
      progressionId: d.progressionId || undefined,
      formFamily: (d.formFamily || undefined) as FormFamily | undefined,
    }
      if (exercise) {
        await updateExercise(exercise.id, payload)
        onSaved?.({ ...exercise, ...payload })
      } else {
        onSaved?.(await addExercise(payload))
      }
      onClose()
    })

  const progressionOptions = [
    { value: '', label: 'なし' },
    ...allExercises.filter((e) => e.id !== exercise?.id && !e.archived).map((e) => ({ value: e.id, label: e.name })),
  ]

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise ? '種目を編集' : '種目を追加'}
      footer={
        <div className="row">
          {exercise && (
            <Button
              variant="danger"
              icon={<Trash2 size={18} aria-hidden />}
              aria-label="この種目を削除"
              onClick={() => {
                void archiveExercise(exercise.id)
                toast.show(`${exercise.name} を削除しました`, 'info', { label: '取り消す', onClick: () => void unarchiveExercise(exercise.id) }, UNDO_MS)
                onClose()
              }}
            />
          )}
          <Button variant="primary" block onClick={() => void save()}>
            保存
          </Button>
        </div>
      }
    >
      <div className="stack">
        <TextField label="種目名" value={d.name} onChange={(e) => setD((s) => ({ ...s, name: e.target.value }))} placeholder="例: リュック加重スクワット" error={error} autoFocus={!exercise} />
        <div className="field">
          <span className="field__label">記録する単位</span>
          <Segmented
            value={d.type}
            onChange={(type) => setD((s) => ({ ...s, type }))}
            options={(Object.keys(EXERCISE_TYPES) as ExerciseType[]).map((k) => ({ value: k, label: EXERCISE_TYPES[k] }))}
            label="記録する単位"
          />
        </div>
        <SelectField
          label="部位"
          value={d.bodyPart}
          onChange={(e) => setD((s) => ({ ...s, bodyPart: e.target.value as BodyPart }))}
          options={(Object.keys(BODY_PARTS) as BodyPart[]).map((k) => ({ value: k, label: BODY_PARTS[k] }))}
        />
        <Toggle checked={d.useWeight} onChange={(useWeight) => setD((s) => ({ ...s, useWeight }))} label="重量も記録する" description="ダンベルやリュック加重をする種目向け" />
        <TextField label="休憩時間（この種目だけ）" type="number" inputMode="numeric" value={d.restSec} onChange={(e) => setD((s) => ({ ...s, restSec: e.target.value }))} suffix="秒" placeholder="全体設定を使う" />
        <div className="stack stack--sm">
          <SelectField
            label="動きのタイプ（図の表示用）"
            value={d.formFamily}
            onChange={(e) => setD((s) => ({ ...s, formFamily: e.target.value }))}
            options={[{ value: '', label: '図なし' }, ...(Object.keys(FORM_FAMILIES) as FormFamily[]).map((k) => ({ value: k, label: FORM_FAMILIES[k] }))]}
          />
          {d.formFamily && (
            <div className="row" style={{ justifyContent: 'center' }}>
              <ExerciseFigure family={d.formFamily as FormFamily} width={140} />
            </div>
          )}
        </div>
        <SelectField label="次のレベルの種目" hint="楽になってきたら、ワークアウト中にワンタップで切り替えられます" value={d.progressionId} onChange={(e) => setD((s) => ({ ...s, progressionId: e.target.value }))} options={progressionOptions} />
      </div>
    </Sheet>
  )
}
