import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, Sparkles, SquarePlay } from 'lucide-react'
import { addExercise, addRoutine, DEFAULT_PLAN_REPS, DEFAULT_PLAN_SECONDS } from '../../db/repo'
import { createAiClient, canWatchVideo, AiError } from '../../lib/ai'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { SelectField, TextField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { AI_PROVIDERS, BODY_PARTS, type Exercise, type ParsedWorkout, type Routine, type RoutineItem } from '../../types'
import { extractYoutubeId, fetchVideoTitle, findExerciseByName, normalizeName, youtubeWatchUrl } from './routineUtils'
import './RoutineImportSheet.css'

const AI_TIMEOUT_MS = 120_000
const NEW_EXERCISE = '__new__'
const CONFIDENCE_LABEL = { low: '自信なし', medium: 'まあまあ', high: '自信あり' } as const

interface RoutineImportSheetProps {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  onImported?: (r: Routine) => void
}

type Phase = 'input' | 'loading' | 'result'

/** YouTube の筋トレ動画からメニューを読み取って保存する */
export function RoutineImportSheet({ open, onClose, exercises, onImported }: RoutineImportSheetProps) {
  const settings = useSettings()
  const toast = useToast()
  const guard = useBusy()
  const abortRef = useRef<AbortController | null>(null)
  const timedOutRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('input')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParsedWorkout | null>(null)
  const [name, setName] = useState('')
  /** 読み取った各種目をどの既存種目に対応させるか（NEW_EXERCISE なら新規作成） */
  const [mapping, setMapping] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [watched, setWatched] = useState(false)
  /** 名寄せが部分一致だった種目のインデックス（誤対応に気づけるよう注意を出す） */
  const [fuzzy, setFuzzy] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState('')

  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    setPhase('input')
    setUrl('')
    setDescription('')
    setError('')
    setParsed(null)
    setName('')
    setMapping([])
    setVideoUrl('')
    setFuzzy(new Set())
    setProgress('')
  }, [open])

  const providerLabel = AI_PROVIDERS[settings.ai.provider].label
  const canWatch = canWatchVideo(settings.ai.provider)

  const read = async () => {
    const id = extractYoutubeId(url)
    if (!id) {
      setError('YouTube の動画 URL を入力してください（watch?v=… / youtu.be/… / shorts/…）')
      return
    }
    const client = await createAiClient(settings.ai)
    if (!client) {
      setError('設定画面で AI の API キーを登録してください')
      return
    }
    const watchUrl = youtubeWatchUrl(id)
    const controller = new AbortController()
    abortRef.current = controller
    timedOutRef.current = false
    const timeout = window.setTimeout(() => {
      timedOutRef.current = true
      controller.abort()
    }, AI_TIMEOUT_MS)
    setPhase('loading')
    setError('')
    try {
      setProgress('動画のタイトルを取得中…')
      const title = await fetchVideoTitle(watchUrl, controller.signal)
      setProgress(`${providerLabel} が${canWatch ? '動画を' : 'タイトルと説明文を'}読み取り中…`)
      const res = await client.parseWorkoutVideo({ url: watchUrl, title, description }, controller.signal)
      if (controller.signal.aborted) return
      if (res.items.length === 0) {
        setError('種目を読み取れませんでした。説明欄やチャプターの文章を貼り付けてもう一度試してください')
        setPhase('input')
        return
      }
      setParsed(res)
      setName(res.name || title || 'YouTube のメニュー')
      const matches = res.items.map((it) => findExerciseByName(it.name, exercises))
      setMapping(matches.map((m) => m?.id ?? NEW_EXERCISE))
      setFuzzy(new Set(matches.flatMap((m, i) => (m && normalizeName(m.name) !== normalizeName(res.items[i].name) ? [i] : []))))
      setVideoUrl(watchUrl)
      setWatched(res.watched)
      setPhase('result')
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      // 手動キャンセルは無言で入力に戻す
      setError(controller.signal.aborted ? (timedOutRef.current ? '時間がかかりすぎたため中断しました' : '') : err instanceof AiError ? err.message : '読み取りに失敗しました')
      setPhase('input')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const save = () =>
    guard(async () => {
      if (!parsed) return
      if (!name.trim()) {
        setError('メニュー名を入力してください')
        return
      }
      const items: RoutineItem[] = []
      const seen = new Set<string>()
      /** 同じ動画内で同名の未登録種目が複数回出ても、作るのは 1 つ */
      const createdByName = new Map<string, string>()
      for (const [i, it] of parsed.items.entries()) {
        let exerciseId = mapping[i]
        if (exerciseId === NEW_EXERCISE && createdByName.has(normalizeName(it.name))) {
          exerciseId = createdByName.get(normalizeName(it.name)) ?? NEW_EXERCISE
        }
        if (exerciseId === NEW_EXERCISE) {
          const ex = await addExercise({
            name: it.name,
            type: it.type,
            bodyPart: it.bodyPart,
            useWeight: it.useWeight,
            formFamily: it.formFamily === 'none' ? undefined : it.formFamily,
            met: it.met,
          })
          exerciseId = ex.id
          createdByName.set(normalizeName(it.name), ex.id)
        }
        // 同じ種目が複数回出てきたら最初のものにまとめる
        if (seen.has(exerciseId)) continue
        seen.add(exerciseId)
        const ex = exercises.find((e) => e.id === exerciseId)
        const isTime = ex ? ex.type === 'time' : it.type === 'time'
        items.push(isTime ? { exerciseId, sets: it.sets, seconds: it.seconds || it.reps || DEFAULT_PLAN_SECONDS } : { exerciseId, sets: it.sets, reps: it.reps || it.seconds || DEFAULT_PLAN_REPS })
      }
      const r = await addRoutine({ name: name.trim(), items, source: 'youtube', sourceUrl: videoUrl, note: parsed.note })
      toast.show(`メニュー「${r.name}」を取り込みました`, 'success')
      onImported?.(r)
      onClose()
    })

  const exerciseOptions = exercises.filter((e) => !e.archived).map((e) => ({ value: e.id, label: e.name }))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="YouTube から取り込む"
      tall
      footer={
        phase === 'input' ? (
          <Button variant="primary" size="lg" block icon={<Sparkles size={20} aria-hidden />} onClick={() => void read()} disabled={!url.trim()}>
            {providerLabel} で読み取る
          </Button>
        ) : phase === 'result' ? (
          <Button variant="primary" size="lg" block onClick={() => void save()} disabled={!name.trim()}>
            メニューとして保存
          </Button>
        ) : (
          <Button variant="secondary" size="lg" block onClick={() => abortRef.current?.abort()}>
            読み取り中… キャンセル
          </Button>
        )
      }
    >
      {phase !== 'result' && (
        <div className="stack">
          <TextField label="動画の URL" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoCapitalize="off" autoCorrect="off" spellCheck={false} disabled={phase === 'loading'} />
          <div className="field">
            <label className="field__label" htmlFor="ri-desc">
              説明欄・チャプター（{canWatch ? '任意' : '推奨'}）
            </label>
            <textarea id="ri-desc" className="ri__text" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={'YouTube の説明欄やチャプターをコピーして貼り付け\n例: 0:30 スクワット 30秒 / 1:10 腕立て伏せ 10回 ×3'} disabled={phase === 'loading'} />
            <p className="faint ri__hint">
              {canWatch ? 'Gemini は動画そのものを読めるので URL だけでも取り込めます。説明欄を貼るとより正確になります' : `${providerLabel} は動画本体を見られないため、タイトルと貼り付けた文章から判定します。Gemini に切り替えると動画そのものを読めます`}
            </p>
          </div>
          {phase === 'loading' && (
            <p className="ri__progress" role="status" aria-live="polite">
              <Loader2 size={18} className="ri__spinner" aria-hidden />
              {progress}
            </p>
          )}
          {error && <p className="ri__error" role="alert">{error}</p>}
        </div>
      )}

      {phase === 'result' && parsed && (
        <div className="stack">
          <p className="ri__note">
            <span className={`ri__conf ri__conf--${parsed.confidence}`}>{CONFIDENCE_LABEL[parsed.confidence]}</span>
            <span>
              {watched ? '動画を読んで' : 'タイトルと説明文から'}判定しました。{parsed.note}
            </span>
          </p>
          <TextField label="メニュー名" value={name} onChange={(e) => setName(e.target.value)} error={!name.trim() ? 'メニュー名を入力してください' : undefined} />
          <ol className="ri__items" aria-label="読み取った種目">
            {parsed.items.map((it, i) => (
              <li key={`${it.name}-${i}`} className="ri__item">
                <div className="ri__item-head">
                  <span className="ri__item-name">{it.name}</span>
                  <span className="ri__item-target num">
                    {it.sets}×{it.type === 'time' ? `${it.seconds || it.reps}秒` : `${it.reps}回`}
                  </span>
                </div>
                <SelectField
                  label="登録先"
                  hint={fuzzy.has(i) && mapping[i] !== NEW_EXERCISE ? '名前が似ている既存の種目を選びました。違えば変えてください' : undefined}
                  value={mapping[i] ?? NEW_EXERCISE}
                  onChange={(e) => {
                    const value = e.target.value
                    setMapping((m) => m.map((v, j) => (j === i ? value : v)))
                    setFuzzy((f) => {
                      const next = new Set(f)
                      next.delete(i)
                      return next
                    })
                  }}
                  options={[{ value: NEW_EXERCISE, label: `新しい種目として作る（${BODY_PARTS[it.bodyPart]}）` }, ...exerciseOptions]}
                />
              </li>
            ))}
          </ol>
          <a className="ri__video" href={videoUrl} target="_blank" rel="noopener noreferrer">
            <SquarePlay size={16} aria-hidden />
            動画を開く
            <ExternalLink size={14} aria-hidden />
          </a>
          <Button variant="ghost" size="sm" onClick={() => setPhase('input')}>
            URL を変えて読み直す
          </Button>
        </div>
      )}
    </Sheet>
  )
}
