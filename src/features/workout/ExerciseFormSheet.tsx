import { useEffect, useRef, useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import { addExercise, archiveExercise, unarchiveExercise, updateExercise } from '../../db/repo'
import { FAVORITE_TOGGLE_DESCRIPTION, FAVORITE_TOGGLE_LABEL } from '../../lib/favorite'
import { useToast } from '../../components/ui/Toast'
import { createAiClient, AiError, isAiConfigured } from '../../lib/ai'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Segmented, SelectField, TextField } from '../../components/ui/Field'
import { Toggle } from '../../components/ui/Toggle'
import { Button } from '../../components/ui/Button'
import { AI_PROVIDERS, BODY_PARTS, EXERCISE_TYPES, type BodyPart, type Exercise, type ExerciseGuideText, type ExerciseType } from '../../types'
import { FORM_FAMILIES, resolveFamily, type FormFamily } from './formGuide'
import { ExerciseFigure } from './ExerciseFigure'
import './ExerciseFormSheet.css'
import { defaultMetFor, MET_MAX, MET_MIN } from '../../lib/calories'

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
  met: string
}

const UNDO_MS = 6000
const AI_TIMEOUT_MS = 45_000

const EMPTY: Draft = { name: '', type: 'reps', bodyPart: 'chest', useWeight: false, restSec: '', progressionId: '', formFamily: '', met: '' }

export function ExerciseFormSheet({ open, onClose, exercise, allExercises, onSaved }: ExerciseFormSheetProps) {
  const toast = useToast()
  const guard = useBusy()
  const settings = useSettings()
  const abortRef = useRef<AbortController | null>(null)
  const timedOutRef = useRef(false)
  const [d, setD] = useState<Draft>(EMPTY)
  const [favorite, setFavorite] = useState(false)
  const [error, setError] = useState('')
  const [metError, setMetError] = useState('')
  const [guide, setGuide] = useState<ExerciseGuideText | undefined>(undefined)
  const [aiNote, setAiNote] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const aiReady = isAiConfigured(settings.ai)

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
            met: exercise.met !== undefined ? String(exercise.met) : '',
          }
        : EMPTY,
    )
    setFavorite(exercise?.favorite ?? false)
    setError('')
    setMetError('')
    setGuide(exercise?.guide)
    setAiNote('')
  }, [open, exercise])

  // 閉じたら進行中の判定を止める（トーストは出さない）
  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
    setAiBusy(false)
  }, [open])

  // 名前から AI に単位・部位・MET・フォームのコツを判定させ、フォームに流し込む（あとから直せる）
  const classify = async () => {
    const name = d.name.trim()
    if (!name) {
      setError('種目名を入力してください')
      return
    }
    const client = await createAiClient(settings.ai)
    if (!client) {
      toast.show('設定画面で AI の API キーを登録してください', 'error')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    timedOutRef.current = false
    const timeout = window.setTimeout(() => {
      timedOutRef.current = true
      controller.abort()
    }, AI_TIMEOUT_MS)
    setAiBusy(true)
    try {
      const res = await client.classifyExercise({ name, hint: '' }, controller.signal)
      if (controller.signal.aborted) return
      setD((s) => ({
        ...s,
        type: res.type,
        bodyPart: res.bodyPart,
        useWeight: res.useWeight,
        restSec: res.restSec > 0 ? String(Math.round(res.restSec)) : s.restSec,
        formFamily: res.formFamily === 'none' ? '' : res.formFamily,
        met: String(Math.round(res.met * 10) / 10),
      }))
      setGuide({ tips: res.tips.filter((t) => t.trim()), avoid: res.avoid.trim() || undefined })
      setAiNote(res.description)
      setMetError('')
      setError('')
      toast.show('判定結果を反映しました。あとから直せます', 'success')
    } catch (err) {
      // 閉じた・別の判定を始めた場合は黙って終える
      if (controller.signal.aborted && !timedOutRef.current) return
      toast.show(timedOutRef.current ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : 'AI の呼び出しに失敗しました', 'error')
    } finally {
      window.clearTimeout(timeout)
      if (abortRef.current === controller) setAiBusy(false)
    }
  }

  const save = () =>
    guard(async () => {
      if (!d.name.trim()) {
        setError('種目名を入力してください')
        return
      }
    const rest = Number(d.restSec)
    const metText = d.met.trim()
    const met = Number(metText)
    if (metText !== '' && (!Number.isFinite(met) || met < MET_MIN || met > MET_MAX)) {
      setMetError(`${MET_MIN}〜${MET_MAX} の数値で入力してください（空欄なら既定値）`)
      return
    }
    const payload = {
      name: d.name.trim(),
      type: d.type,
      bodyPart: d.bodyPart,
      useWeight: d.useWeight,
      restSec: Number.isFinite(rest) && rest > 0 ? Math.round(rest) : undefined,
      progressionId: d.progressionId || undefined,
      formFamily: (d.formFamily || undefined) as FormFamily | undefined,
      met: metText === '' ? undefined : Math.round(met * 10) / 10,
      guide: guide && guide.tips.length > 0 ? guide : undefined,
    }
      if (exercise) {
        const patch = { ...payload, favorite }
        await updateExercise(exercise.id, patch)
        onSaved?.({ ...exercise, ...patch })
      } else {
        onSaved?.(await addExercise(payload))
      }
      onClose()
    })

  // 動きのタイプ未選択の初期種目はガイド定義から既定値を引く
  const placeholderMet = defaultMetFor({ id: exercise?.id ?? '', formFamily: (d.formFamily || undefined) as FormFamily | undefined })

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
        <div className="stack stack--sm">
          <Button variant={aiReady ? 'accent-soft' : 'secondary'} icon={<Sparkles size={18} aria-hidden />} onClick={() => void classify()} loading={aiBusy} disabled={!aiReady || !d.name.trim()} block>
            名前から {AI_PROVIDERS[settings.ai.provider].label} で判定
          </Button>
          {!aiReady && <p className="faint xf__note">設定で AI の API キーを登録すると、単位・部位・強度・フォームのコツを自動で埋められます</p>}
          {aiNote && <p className="xf__ai-note" role="status">{aiNote}</p>}
        </div>
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
        {exercise && <Toggle checked={favorite} onChange={setFavorite} label={FAVORITE_TOGGLE_LABEL} description={FAVORITE_TOGGLE_DESCRIPTION} />}
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
        <TextField
          label="運動強度（MET）"
          type="number"
          inputMode="decimal"
          value={d.met}
          onChange={(e) => {
            setMetError('')
            setD((s) => ({ ...s, met: e.target.value }))
          }}
          placeholder={String(placeholderMet)}
          hint={`消費カロリーの目安に使います。空欄なら動きのタイプの既定値（${placeholderMet}）。${MET_MIN}〜${MET_MAX}`}
          error={metError}
        />
        {guide && guide.tips.length > 0 && (
          <div className="xf__guide">
            <span className="field__label">フォームのコツ（フォームガイドに表示）</span>
            <ol className="xf__tips">
              {guide.tips.map((t, i) => (
                <li key={`${i}-${t}`}>{t}</li>
              ))}
            </ol>
            {guide.avoid && <p className="xf__avoid">NG: {guide.avoid}</p>}
            <Button variant="ghost" size="sm" onClick={() => setGuide(undefined)}>
              コツを消す
            </Button>
          </div>
        )}
        <SelectField label="次のレベルの種目" hint="楽になってきたら、ワークアウト中にワンタップで切り替えられます" value={d.progressionId} onChange={(e) => setD((s) => ({ ...s, progressionId: e.target.value }))} options={progressionOptions} />
      </div>
    </Sheet>
  )
}
