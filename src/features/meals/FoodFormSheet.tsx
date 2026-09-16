import { useEffect, useRef, useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import { addFood, archiveFood, unarchiveFood, updateFood } from '../../db/repo'
import { useToast } from '../../components/ui/Toast'
import { useBusy } from '../../hooks/useBusy'
import { useSettings } from '../../hooks/useSettings'
import { pfcToKcal, fmt1 } from '../../lib/nutrition'
import { createAiClient, AiError, isAiConfigured } from '../../lib/ai'
import { Sheet } from '../../components/ui/Sheet'
import { TextField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { AI_PROVIDERS, type Food, type FoodEstimate } from '../../types'
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
  const [error, setError] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiNote, setAiNote] = useState('')
  const abortRef = useRef<AbortController | null>(null)
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
    setError('')
    setAiNote('')
    setAiBusy(false)
  }, [open, food])

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }))

  const fillKcal = () => setD((s) => ({ ...s, kcal: String(pfcToKcal(num(s.protein), num(s.fat), num(s.carbs))) }))

  /** 名前（例: 鶏むね肉 100g、セブンのサラダチキン）から AI に栄養を推定させて埋める */
  const fillByAi = async () => {
    const name = d.name.trim()
    if (!name) {
      setError('先に名前を入力してください')
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
      const est = await client.estimateFoodFromText({ text: name }, controller.signal)
      if (controller.signal.aborted) return
      setD((s) => ({ ...s, ...estimateToDraft(name, est) }))
      setAiNote(est.items.length > 1 ? `${est.items.length}品目の合計です。${est.note}` : est.note)
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) return
      setError(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : err instanceof AiError ? err.message : '推定に失敗しました')
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
        await updateFood(food.id, payload)
        onSaved?.({ ...food, ...payload })
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
        {aiReady && (
          <div className="ff__ai">
            <Button variant="accent-soft" block icon={<Sparkles size={18} aria-hidden />} onClick={() => void fillByAi()} loading={aiBusy} disabled={!d.name.trim()}>
              {AI_PROVIDERS[settings.ai.provider].label} に栄養を推定してもらう
            </Button>
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
