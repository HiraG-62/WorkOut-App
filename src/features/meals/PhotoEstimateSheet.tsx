import { useEffect, useRef, useState } from 'react'
import { Camera, Sparkles, RefreshCw } from 'lucide-react'
import { addFood, logFood, logQuickMeal } from '../../db/repo'
import { encodeImageForAi, type EncodedImage } from '../../lib/image'
import { createAiClient, AiError } from '../../lib/ai'
import { fmt1 } from '../../lib/nutrition'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { AI_PROVIDERS, type FoodEstimate, type FoodEstimateItem } from '../../types'
import './PhotoEstimateSheet.css'

const AI_TIMEOUT_MS = 90_000
const CONFIDENCE_LABEL = { low: '自信なし', medium: 'まあまあ', high: '自信あり' } as const

interface PhotoEstimateSheetProps {
  open: boolean
  onClose: () => void
  date: string
}

type Phase = 'pick' | 'preview' | 'loading' | 'result'

interface ResultItem extends FoodEstimateItem {
  include: boolean
  saveAsFood: boolean
}

export function PhotoEstimateSheet({ open, onClose, date }: PhotoEstimateSheetProps) {
  const settings = useSettings()
  const toast = useToast()
  const guard = useBusy()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [image, setImage] = useState<EncodedImage | null>(null)
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
    setPhase('pick')
    setImage(null)
    setHint('')
    setResult(null)
    setItems([])
    setError('')
  }, [open])

  // 開いたら即カメラを起動する（タップ数を減らす）
  useEffect(() => {
    if (open && phase === 'pick') {
      const id = window.setTimeout(() => fileRef.current?.click(), 250)
      return () => window.clearTimeout(id)
    }
  }, [open, phase])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const enc = await encodeImageForAi(file)
      setImage(enc)
      setPhase('preview')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '画像を読み込めませんでした')
    }
  }

  const estimate = async () => {
    if (!image) return
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
      const res = await client.estimateFood({ imageBase64: image.base64, mediaType: image.mediaType, hint }, controller.signal)
      if (controller.signal.aborted) return
      setResult(res)
      setItems(res.items.map((it) => ({ ...it, include: true, saveAsFood: false })))
      setPhase('result')
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      setError(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : '推定に失敗しました')
      setPhase('preview')
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
        const food = await addFood({ name: it.name, unitLabel: it.amount || '1食', kcal: Math.round(it.kcal), protein: it.protein, fat: it.fat, carbs: it.carbs, source: 'ai' })
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="写真から推定"
      tall={phase === 'result'}
      footer={
        phase === 'preview' ? (
          <Button variant="primary" size="lg" block icon={<Sparkles size={20} aria-hidden />} onClick={() => void estimate()}>
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

      {phase === 'pick' && (
        <div className="pe__pick">
          <Button variant="primary" size="lg" block icon={<Camera size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>
            写真を撮る / 選ぶ
          </Button>
          {error && <p className="pe__error" role="alert">{error}</p>}
        </div>
      )}

      {(phase === 'preview' || phase === 'loading') && image && (
        <div className="stack">
          <div className={`pe__preview ${phase === 'loading' ? 'pe__preview--loading' : ''}`}>
            <img src={image.dataUrl} alt="選択した食事の写真" />
            {phase === 'loading' && (
              <div className="pe__scan" aria-live="polite">
                <Sparkles size={22} aria-hidden />
                <span>解析中…</span>
              </div>
            )}
          </div>
          {phase === 'preview' && (
            <>
              <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="補足（任意）例: ご飯は大盛り" aria-label="補足" />
              <Button variant="ghost" size="sm" icon={<RefreshCw size={16} aria-hidden />} onClick={() => fileRef.current?.click()}>
                撮り直す
              </Button>
              {error && <p className="pe__error" role="alert">{error}</p>}
            </>
          )}
        </div>
      )}

      {phase === 'result' && result && (
        <div className="stack">
          <p className="pe__note">
            <span className={`pe__conf pe__conf--${result.confidence}`}>{CONFIDENCE_LABEL[result.confidence]}</span>
            {result.note}
          </p>
          <ul className="pe__items">
            {items.map((it, i) => (
              <li key={i} className={`pe__item ${it.include ? '' : 'pe__item--off'}`}>
                <label className="pe__check">
                  <input type="checkbox" checked={it.include} onChange={() => toggle(i, 'include')} />
                  <span className="pe__item-body">
                    <span className="pe__item-name">{it.name}</span>
                    <span className="pe__item-meta">
                      {it.amount} · <span className="num">{Math.round(it.kcal)}</span> kcal · P{fmt1(it.protein)} F{fmt1(it.fat)} C{fmt1(it.carbs)}
                    </span>
                  </span>
                </label>
                <label className={`pe__save ${it.saveAsFood ? 'pe__save--on' : ''}`}>
                  <input type="checkbox" checked={it.saveAsFood} onChange={() => toggle(i, 'saveAsFood')} disabled={!it.include} />
                  マイフードに保存
                </label>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} aria-hidden />} onClick={() => setPhase('preview')}>
            補足を足して再推定
          </Button>
        </div>
      )}
    </Sheet>
  )
}
