import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, ScanText, Sparkles } from 'lucide-react'
import { addFood, logFood } from '../../db/repo'
import { encodeImageForAi, type EncodedImage } from '../../lib/image'
import { createAiClient, AiError } from '../../lib/ai'
import { fmt1, pfcToKcal } from '../../lib/nutrition'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { Stepper } from '../../components/ui/Stepper'
import { TextField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { AI_PROVIDERS, type NutritionLabel } from '../../types'
import './AiMealSheet.css'
import './NutritionLabelSheet.css'

const AI_TIMEOUT_MS = 90_000
const CAMERA_AUTO_OPEN_DELAY_MS = 250
const DEFAULT_UNIT = '1食'
const QTY_STEP = 0.5
const QTY_MIN = 0.5
const QTY_MAX = 20
const CONFIDENCE_LABEL = { low: '自信なし', medium: 'まあまあ', high: '自信あり' } as const

interface NutritionLabelSheetProps {
  open: boolean
  onClose: () => void
  date: string
}

type Phase = 'input' | 'loading' | 'result'

interface Draft {
  name: string
  unitLabel: string
  kcal: string
  protein: string
  fat: string
  carbs: string
}

function num(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** basis「1袋(110g)あたり（100gあたりから換算）」→ 単位ラベル「1袋(110g)」 */
function basisToUnit(basis: string): string {
  const unit = basis.replace(/あたり.*$/, '').trim()
  return unit || DEFAULT_UNIT
}

/** 商品パッケージ（栄養成分表示 / 原材料名）を撮って、マイフードに登録・記録する */
export function NutritionLabelSheet({ open, onClose, date }: NutritionLabelSheetProps) {
  const settings = useSettings()
  const toast = useToast()
  const guard = useBusy()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [phase, setPhase] = useState<Phase>('input')
  const [image, setImage] = useState<EncodedImage | null>(null)
  const [hint, setHint] = useState('')
  const [label, setLabel] = useState<NutritionLabel | null>(null)
  const [d, setD] = useState<Draft>({ name: '', unitLabel: DEFAULT_UNIT, kcal: '', protein: '', fat: '', carbs: '' })
  const [qty, setQty] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    setPhase('input')
    setImage(null)
    setHint('')
    setLabel(null)
    setQty(1)
    setError('')
  }, [open])

  // 開いたら即カメラ
  useEffect(() => {
    if (!open || phase !== 'input' || image) return
    const id = window.setTimeout(() => fileRef.current?.click(), CAMERA_AUTO_OPEN_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [open, phase, image])

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

  const read = async () => {
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
      const res = await client.readNutritionLabel({ imageBase64: image.base64, mediaType: image.mediaType, hint }, controller.signal)
      if (controller.signal.aborted) return
      setLabel(res)
      setD({
        name: res.productName === '不明' ? '' : res.productName,
        unitLabel: basisToUnit(res.basis),
        kcal: String(Math.round(res.kcal)),
        protein: round1(res.protein),
        fat: round1(res.fat),
        carbs: round1(res.carbs),
      })
      setPhase('result')
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      setError(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : '読み取りに失敗しました')
      setPhase('input')
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }))
  const canSave = d.name.trim().length > 0

  const save = (log: boolean) =>
    guard(async () => {
      if (!canSave) return
      const kcal = d.kcal.trim() === '' ? pfcToKcal(num(d.protein), num(d.fat), num(d.carbs)) : num(d.kcal)
      const food = await addFood({
        name: d.name.trim(),
        unitLabel: d.unitLabel.trim() || DEFAULT_UNIT,
        kcal: Math.round(kcal),
        protein: num(d.protein),
        fat: num(d.fat),
        carbs: num(d.carbs),
        source: 'ai',
      })
      if (log) await logFood(food, qty, date)
      toast.show(log ? `「${food.name}」を登録して記録しました` : `「${food.name}」を登録しました`, 'success')
      onClose()
    })

  const providerLabel = AI_PROVIDERS[settings.ai.provider].label

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="成分表・原材料から登録"
      tall={phase === 'result'}
      footer={
        phase === 'input' ? (
          <Button variant="primary" size="lg" block icon={<Sparkles size={20} aria-hidden />} onClick={() => void read()} disabled={!image}>
            {providerLabel} で読み取る
          </Button>
        ) : phase === 'result' ? (
          <div className="stack stack--sm">
            <Button variant="primary" size="lg" block onClick={() => void save(true)} disabled={!canSave}>
              登録して {fmt1(qty)} 食分を記録する
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void save(false)} disabled={!canSave}>
              登録だけして今日は記録しない
            </Button>
          </div>
        ) : undefined
      }
    >
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onFile(e)} aria-label="パッケージの写真を選ぶ" />

      {phase !== 'result' && !image && (
        <div className="am__pick">
          <Button variant="primary" size="lg" block icon={<Camera size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>
            成分表示・原材料名を撮る
          </Button>
          <p className="faint nl__tip">
            <ScanText size={14} aria-hidden />
            栄養成分表示があれば数値をそのまま読み取ります。無い商品は原材料名と内容量から推定します
          </p>
          {error && <p className="am__error" role="alert">{error}</p>}
        </div>
      )}

      {phase !== 'result' && image && (
        <div className="stack">
          <div className={`am__preview ${phase === 'loading' ? 'am__preview--loading' : ''}`}>
            <img src={image.dataUrl} alt="パッケージの写真" />
            {phase === 'loading' && (
              <div className="am__scan" aria-live="polite">
                <Sparkles size={22} aria-hidden />
                <span>読み取り中…</span>
              </div>
            )}
          </div>
          {phase === 'input' && (
            <>
              <input type="text" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="補足（任意）例: 内容量は110g、1袋を1食にしたい" aria-label="補足" />
              <Button variant="ghost" size="sm" icon={<RefreshCw size={16} aria-hidden />} onClick={() => fileRef.current?.click()}>
                撮り直す
              </Button>
              {error && <p className="am__error" role="alert">{error}</p>}
            </>
          )}
        </div>
      )}

      {phase === 'result' && label && (
        <div className="stack">
          <p className="am__note">
            <span className={`am__conf am__conf--${label.confidence}`}>{CONFIDENCE_LABEL[label.confidence]}</span>
            <span>
              <span className="nl__source">{label.source === 'label' ? '成分表示から読み取り' : '原材料から推定'}</span>
              {label.basis ? `（${label.basis}）` : ''} {label.note}
            </span>
          </p>
          <TextField label="名前" value={d.name} onChange={set('name')} placeholder="商品名" error={!canSave ? '名前を入力してください' : undefined} />
          <TextField label="1回分の量" value={d.unitLabel} onChange={set('unitLabel')} hint="記録は「この量 × 倍率」で行います" />
          <TextField label="カロリー" type="number" inputMode="decimal" value={d.kcal} onChange={set('kcal')} suffix="kcal" />
          <div className="nl__pfc">
            <TextField label="タンパク質" type="number" inputMode="decimal" value={d.protein} onChange={set('protein')} suffix="g" />
            <TextField label="脂質" type="number" inputMode="decimal" value={d.fat} onChange={set('fat')} suffix="g" />
            <TextField label="炭水化物" type="number" inputMode="decimal" value={d.carbs} onChange={set('carbs')} suffix="g" />
          </div>
          <div className="nl__qty">
            <Stepper label="今日食べた量" value={qty} onChange={setQty} step={QTY_STEP} min={QTY_MIN} max={QTY_MAX} decimals={1} unit="倍" />
          </div>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={16} aria-hidden />} onClick={() => setPhase('input')}>
            撮り直して読み直す
          </Button>
        </div>
      )}
    </Sheet>
  )
}
