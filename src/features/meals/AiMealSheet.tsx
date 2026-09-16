import { useEffect, useRef, useState } from 'react'
import { Camera, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react'
import { addFood, logFood, logQuickMeal } from '../../db/repo'
import { encodeImageForAi, type EncodedImage } from '../../lib/image'
import { createAiClient, AiError, type AiClient } from '../../lib/ai'
import { fmt1 } from '../../lib/nutrition'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { AI_PROVIDERS, type FoodEstimate, type FoodEstimateItem } from '../../types'
import './AiMealSheet.css'

const AI_TIMEOUT_MS = 90_000
const CAMERA_AUTO_OPEN_DELAY_MS = 250
const DEFAULT_UNIT = '1食'
const CONFIDENCE_LABEL = { low: '自信なし', medium: 'まあまあ', high: '自信あり' } as const
const TEXT_EXAMPLES = ['牛丼の並盛とサラダ、缶コーヒー', '鮭おにぎり2個とみそ汁', 'ラーメン大盛りと餃子6個'] as const

/** photo: 写真から推定 / text: 食べたものを文章で伝えて推定 */
export type AiMealMode = 'photo' | 'text'

interface AiMealSheetProps {
  open: boolean
  onClose: () => void
  date: string
  mode: AiMealMode
}

type Phase = 'input' | 'loading' | 'result'

interface ResultItem extends FoodEstimateItem {
  include: boolean
  saveAsFood: boolean
}

export function AiMealSheet({ open, onClose, date, mode }: AiMealSheetProps) {
  const settings = useSettings()
  const toast = useToast()
  const guard = useBusy()
  const fileRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [phase, setPhase] = useState<Phase>('input')
  const [image, setImage] = useState<EncodedImage | null>(null)
  const [text, setText] = useState('')
  const [hint, setHint] = useState('')
  const [result, setResult] = useState<FoodEstimate | null>(null)
  const [items, setItems] = useState<ResultItem[]>([])
  const [error, setError] = useState('')

  // 閉じたら進行中の推定を打ち切る（遅れて届いた結果が次回に混ざらないように）
  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    setPhase('input')
    setImage(null)
    setText('')
    setHint('')
    setResult(null)
    setItems([])
    setError('')
  }, [open])

  // 写真モードは開いたら即カメラ、文章モードは即入力欄へ（タップ数を減らす）
  useEffect(() => {
    if (!open || phase !== 'input') return
    const id = window.setTimeout(() => {
      if (mode === 'photo' && !image) fileRef.current?.click()
      if (mode === 'text') textRef.current?.focus()
    }, CAMERA_AUTO_OPEN_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [open, phase, mode, image])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setImage(await encodeImageForAi(file))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像を読み込めませんでした')
    }
  }

  const canEstimate = mode === 'photo' ? image !== null : text.trim().length > 0

  const callAi = (client: AiClient, signal: AbortSignal): Promise<FoodEstimate> => {
    if (mode === 'photo' && image) {
      return client.estimateFood({ imageBase64: image.base64, mediaType: image.mediaType, hint }, signal)
    }
    return client.estimateFoodFromText({ text: text.trim() }, signal)
  }

  const estimate = async () => {
    if (!canEstimate) return
    const client = await createAiClient(settings.ai)
    if (!client) {
      setError('設定画面で AI の API キーを登録してください')
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    setPhase('loading')
    setError('')
    try {
      const res = await callAi(client, controller.signal)
      if (controller.signal.aborted) return
      setResult(res)
      setItems(res.items.map((it) => ({ ...it, include: true, saveAsFood: false })))
      setPhase('result')
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      setError(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : '推定に失敗しました')
      setPhase('input')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const toggle = (i: number, key: 'include' | 'saveAsFood') =>
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, [key]: !it[key] } : it)))

  const commit = () =>
    guard(async () => {
      const selected = items.filter((it) => it.include)
      if (selected.length === 0) return
      for (const it of selected) {
        if (it.saveAsFood) {
          const food = await addFood({ name: it.name, unitLabel: it.amount || DEFAULT_UNIT, kcal: Math.round(it.kcal), protein: it.protein, fat: it.fat, carbs: it.carbs, source: 'ai' })
          await logFood(food, 1, date)
        } else {
          await logQuickMeal({ name: it.name, kcal: Math.round(it.kcal), protein: it.protein, fat: it.fat, carbs: it.carbs }, date)
        }
      }
      toast.show(`${selected.length}品を記録しました`, 'success')
      onClose()
    })

  const total = items.filter((it) => it.include).reduce((s, it) => s + it.kcal, 0)
  const providerLabel = AI_PROVIDERS[settings.ai.provider].label
  const title = mode === 'photo' ? '写真から推定' : '食べたものを伝えて推定'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      tall={phase === 'result'}
      footer={
        phase === 'input' ? (
          <Button variant="primary" size="lg" block icon={<Sparkles size={20} aria-hidden />} onClick={() => void estimate()} disabled={!canEstimate}>
            {providerLabel} で推定する
          </Button>
        ) : phase === 'result' ? (
          <Button variant="primary" size="lg" block onClick={() => void commit()} disabled={items.every((it) => !it.include)}>
            合計 {Math.round(total)} kcal を記録する
          </Button>
        ) : undefined
      }
    >
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e)} aria-label="写真を選ぶ" />

      {phase !== 'result' && mode === 'text' && (
        <div className="stack">
          <div className={`am__textwrap ${phase === 'loading' ? 'am__textwrap--loading' : ''}`}>
            <textarea
              ref={textRef}
              className="am__text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`例: ${TEXT_EXAMPLES[0]}`}
              rows={4}
              disabled={phase === 'loading'}
              aria-label="食べたもの"
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void estimate()
              }}
            />
            {phase === 'loading' && (
              <div className="am__scan" aria-live="polite">
                <Sparkles size={22} aria-hidden />
                <span>解析中…</span>
              </div>
            )}
          </div>
          {phase === 'input' && (
            <>
              <p className="faint am__tip">量（並盛・2個・大盛りなど）も書くと精度が上がります。ざっくりで大丈夫です。</p>
              <div className="am__examples" role="group" aria-label="入力例">
                {TEXT_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className="am__example" onClick={() => setText(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
              {error && <p className="am__error" role="alert">{error}</p>}
            </>
          )}
        </div>
      )}

      {phase !== 'result' && mode === 'photo' && !image && (
        <div className="am__pick">
          <Button variant="primary" size="lg" block icon={<Camera size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>
            写真を撮る / 選ぶ
          </Button>
          {error && <p className="am__error" role="alert">{error}</p>}
        </div>
      )}

      {phase !== 'result' && mode === 'photo' && image && (
        <div className="stack">
          <div className={`am__preview ${phase === 'loading' ? 'am__preview--loading' : ''}`}>
            <img src={image.dataUrl} alt="選択した食事の写真" />
            {phase === 'loading' && (
              <div className="am__scan" aria-live="polite">
                <Sparkles size={22} aria-hidden />
                <span>解析中…</span>
              </div>
            )}
          </div>
          {phase === 'input' && (
            <>
              <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="補足（任意）例: ご飯は大盛り" aria-label="補足" />
              <Button variant="ghost" size="sm" icon={<RefreshCw size={16} aria-hidden />} onClick={() => fileRef.current?.click()}>
                撮り直す
              </Button>
              {error && <p className="am__error" role="alert">{error}</p>}
            </>
          )}
        </div>
      )}

      {phase === 'result' && result && (
        <div className="stack">
          <p className="am__note">
            <span className={`am__conf am__conf--${result.confidence}`}>{CONFIDENCE_LABEL[result.confidence]}</span>
            {result.note}
          </p>
          <ul className="am__items">
            {items.map((it, i) => (
              <li key={i} className={`am__item ${it.include ? '' : 'am__item--off'}`}>
                <label className="am__check">
                  <input type="checkbox" checked={it.include} onChange={() => toggle(i, 'include')} />
                  <span className="am__item-body">
                    <span className="am__item-name">{it.name}</span>
                    <span className="am__item-meta">
                      {it.amount} · <span className="num">{Math.round(it.kcal)}</span> kcal · P{fmt1(it.protein)} F{fmt1(it.fat)} C{fmt1(it.carbs)}
                    </span>
                  </span>
                </label>
                <label className={`am__save ${it.saveAsFood ? 'am__save--on' : ''}`}>
                  <input type="checkbox" checked={it.saveAsFood} onChange={() => toggle(i, 'saveAsFood')} disabled={!it.include} />
                  マイフードに保存
                </label>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon={mode === 'photo' ? <RefreshCw size={16} aria-hidden /> : <MessageSquareText size={16} aria-hidden />} onClick={() => setPhase('input')}>
            {mode === 'photo' ? '補足を足して再推定' : '文章を直して再推定'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
