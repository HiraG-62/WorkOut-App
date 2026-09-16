import { useEffect, useRef, useState } from 'react'
import { ScanText, Sparkles, Trash2 } from 'lucide-react'
import { addFood, archiveFood, unarchiveFood, updateFood } from '../../db/repo'
import { FAVORITE_TOGGLE_DESCRIPTION, FAVORITE_TOGGLE_LABEL } from '../../lib/favorite'
import { useToast } from '../../components/ui/Toast'
import { useBusy } from '../../hooks/useBusy'
import { useSettings } from '../../hooks/useSettings'
import { pfcToKcal, fmt1 } from '../../lib/nutrition'
import { createAiClient, AiError, isAiConfigured } from '../../lib/ai'
import { Sheet } from '../../components/ui/Sheet'
import { TextField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { Toggle } from '../../components/ui/Toggle'
import { AI_PROVIDERS, type Food, type FoodEstimate } from '../../types'
import { encodeImageForAi } from '../../lib/image'
import './FoodFormSheet.css'

const DEFAULT_UNIT = '1食'
const UNDO_MS = 6000
const AI_TIMEOUT_MS = 60_000

interface FoodFormSheetProps {
  open: boolean
  onClose: () => void
  /** 編集対象。未指定なら新規作成 */
  food?: Food | null
  onSaved?: (food: Food) => void
}

interface Draft {
  name: string
  unitLabel: string
  kcal: string
  protein: string
  fat: string
  carbs: string
}

const EMPTY: Draft = { name: '', unitLabel: DEFAULT_UNIT, kcal: '', protein: '', fat: '', carbs: '' }

function num(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function round1(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** AI の推定結果（複数品目なら合算）をフォームの値にする */
function estimateToDraft(name: string, est: FoodEstimate): Partial<Draft> {
  const total = est.items.reduce(
    (acc, it) => ({ kcal: acc.kcal + it.kcal, protein: acc.protein + it.protein, fat: acc.fat + it.fat, carbs: acc.carbs + it.carbs }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  )
  return {
    name: name.trim(),
    unitLabel: est.items.length === 1 && est.items[0].amount ? est.items[0].amount : DEFAULT_UNIT,
    kcal: String(Math.round(total.kcal)),
    protein: round1(total.protein),
    fat: round1(total.fat),
    carbs: round1(total.carbs),
  }
}

export function FoodFormSheet({ open, onClose, food, onSaved }: FoodFormSheetProps) {
  const toast = useToast()
  const guard = useBusy()
  const settings = useSettings()
  const [d, setD] = useState<Draft>(EMPTY)
  const [favorite, setFavorite] = useState(false)
  const [error, setError] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiNote, setAiNote] = useState('')
  /** AI に伝える材料・内容。空なら名前から推定する */
  const [aiText, setAiText] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const labelFileRef = useRef<HTMLInputElement>(null)
  const aiReady = isAiConfigured(settings.ai)

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      abortRef.current = null
      return
    }
    setD(
      food
        ? {
            name: food.name,
            unitLabel: food.unitLabel,
            kcal: String(food.kcal),
            protein: String(food.protein),
            fat: String(food.fat),
            carbs: String(food.carbs),
          }
        : EMPTY,
    )
    setFavorite(food?.favorite ?? false)
    setError('')
    setAiNote('')
    setAiText('')
    setAiBusy(false)
  }, [open, food])

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }))

  const fillKcal = () => setD((s) => ({ ...s, kcal: String(pfcToKcal(num(s.protein), num(s.fat), num(s.carbs))) }))

  /** 材料・内容（未入力なら名前）から AI に栄養を推定させて埋める */
  const fillByAi = async () => {
    const name = d.name.trim()
    const source = aiText.trim() || name
    if (!source) {
      setError('名前か、材料・内容を入力してください')
      return
    }
    const client = await createAiClient(settings.ai)
    if (!client) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    setAiBusy(true)
    setError('')
    setAiNote('')
    try {
      const est = await client.estimateFoodFromText({ text: source }, controller.signal)
      if (controller.signal.aborted) return
      setD((s) => ({ ...s, ...estimateToDraft(name || source, est) }))
      setAiNote(est.items.length > 1 ? `${est.items.length}品目の合計です。${est.note}` : est.note)
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      setError(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : '推定に失敗しました')
    } finally {
      window.clearTimeout(timeout)
      if (abortRef.current === controller) setAiBusy(false)
    }
  }

  /** 栄養成分表示の写真から数値を読み取ってフォームに入れる */
  const fillByLabel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const client = await createAiClient(settings.ai)
    if (!client) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    setAiBusy(true)
    setError('')
    setAiNote('')
    try {
      const img = await encodeImageForAi(file)
      const label = await client.readNutritionLabel({ imageBase64: img.base64, mediaType: img.mediaType, hint: '' }, controller.signal)
      if (controller.signal.aborted) return
      setD((s) => ({
        ...s,
        name: s.name.trim() || (label.productName !== '不明' ? label.productName : ''),
        unitLabel: label.basis.replace(/あたり.*$/, '') || DEFAULT_UNIT,
        kcal: String(Math.round(label.kcal)),
        protein: round1(label.protein),
        fat: round1(label.fat),
        carbs: round1(label.carbs),
      }))
      setAiNote(`${label.source === 'label' ? '成分表示から読み取り' : '原材料から推定'}（${label.basis}）。${label.note}`)
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      setError(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : '読み取りに失敗しました')
    } finally {
      window.clearTimeout(timeout)
      if (abortRef.current === controller) setAiBusy(false)
    }
  }

  const save = () =>
    guard(async () => {
      if (!d.name.trim()) {
        setError('名前を入力してください')
        return
      }
      // カロリー未入力なら PFC から補完する
      const kcal = d.kcal.trim() === '' ? pfcToKcal(num(d.protein), num(d.fat), num(d.carbs)) : num(d.kcal)
      const payload = {
        name: d.name.trim(),
        unitLabel: d.unitLabel.trim() || DEFAULT_UNIT,
        kcal: Math.round(kcal),
        protein: num(d.protein),
        fat: num(d.fat),
        carbs: num(d.carbs),
      }
      if (food) {
        const patch = { ...payload, favorite }
        await updateFood(food.id, patch)
        onSaved?.({ ...food, ...patch })
      } else {
        const created = await addFood({ ...payload, source: aiNote ? 'ai' : 'manual' })
        onSaved?.(created)
      }
      onClose()
    })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={food ? 'フードを編集' : 'フードを登録'}
      footer={
        <div className="row">
          {food && (
            <Button
              variant="danger"
              icon={<Trash2 size={18} aria-hidden />}
              aria-label="このフードを削除"
              onClick={() => {
                void archiveFood(food.id)
                toast.show(`${food.name} を削除しました`, 'info', { label: '取り消す', onClick: () => void unarchiveFood(food.id) }, UNDO_MS)
                onClose()
              }}
            />
          )}
          <Button variant="primary" block onClick={() => void save()} disabled={aiBusy}>
            保存
          </Button>
        </div>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <TextField label="名前" value={d.name} onChange={set('name')} placeholder="例: 鶏むね肉 100g、セブンのサラダチキン" error={error} autoFocus={!food} enterKeyHint="next" />
        {food && <Toggle checked={favorite} onChange={setFavorite} label={FAVORITE_TOGGLE_LABEL} description={FAVORITE_TOGGLE_DESCRIPTION} />}
        {aiReady && (
          <div className="ff__ai">
            <label className="field">
              <span className="field__label">材料や内容を AI に伝える（任意）</span>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="例: 鶏むね肉200g、ブロッコリー、玄米150g、オリーブオイル少々"
                rows={2}
                className="ff__ai-text"
              />
              <span className="field__hint">空欄なら名前から推定します</span>
            </label>
            <div className="ff__ai-buttons">
              <Button variant="accent-soft" block icon={<Sparkles size={18} aria-hidden />} onClick={() => void fillByAi()} loading={aiBusy} disabled={!d.name.trim() && !aiText.trim()}>
                {AI_PROVIDERS[settings.ai.provider].label} に推定してもらう
              </Button>
              <Button variant="secondary" block icon={<ScanText size={18} aria-hidden />} onClick={() => labelFileRef.current?.click()} disabled={aiBusy}>
                成分表・原材料を撮る
              </Button>
            </div>
            <input ref={labelFileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void fillByLabel(e)} aria-label="栄養成分表示の写真" />
            {aiNote && <p className="ff__ai-note">{aiNote}</p>}
          </div>
        )}
        <div className={aiBusy ? 'stack ff__fields--busy' : 'stack'}>
          <TextField label="1回分の量" value={d.unitLabel} onChange={set('unitLabel')} placeholder="例: 1個, 100g, 1杯" hint="記録は「この量 × 倍率」で行います" />
          <TextField label="カロリー" type="number" inputMode="decimal" value={d.kcal} onChange={set('kcal')} suffix="kcal" placeholder="0" hint="空欄なら PFC から自動計算します" />
          <div className="ff__pfc">
            <TextField label="タンパク質" type="number" inputMode="decimal" value={d.protein} onChange={set('protein')} suffix="g" placeholder="0" />
            <TextField label="脂質" type="number" inputMode="decimal" value={d.fat} onChange={set('fat')} suffix="g" placeholder="0" />
            <TextField label="炭水化物" type="number" inputMode="decimal" value={d.carbs} onChange={set('carbs')} suffix="g" placeholder="0" enterKeyHint="done" />
          </div>
          {d.protein && d.fat && d.carbs && (
            <p className="faint ff__pfc-kcal">PFC からの計算値: {fmt1(pfcToKcal(num(d.protein), num(d.fat), num(d.carbs)))} kcal</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fillKcal}>
          PFC からカロリーを計算
        </Button>
        <button type="submit" className="sr-only" tabIndex={-1}>
          保存
        </button>
      </form>
    </Sheet>
  )
}
