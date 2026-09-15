import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addFood, archiveFood, updateFood } from '../../db/repo'
import { pfcToKcal } from '../../lib/nutrition'
import { Sheet } from '../../components/ui/Sheet'
import { TextField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import type { Food } from '../../types'
import './FoodFormSheet.css'

interface FoodFormSheetProps {
  open: boolean
  onClose: () => void
  /** 編集対象。未指定なら新規作成 */
  food?: Food | null
  /** AI推定などからの初期値 */
  initial?: Partial<Pick<Food, 'name' | 'unitLabel' | 'kcal' | 'protein' | 'fat' | 'carbs'>>
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

const EMPTY: Draft = { name: '', unitLabel: '1食', kcal: '', protein: '', fat: '', carbs: '' }

function num(s: string): number {
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function FoodFormSheet({ open, onClose, food, initial, onSaved }: FoodFormSheetProps) {
  const [d, setD] = useState<Draft>(EMPTY)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const src = food ?? initial
    setD(
      src
        ? {
            name: src.name ?? '',
            unitLabel: src.unitLabel ?? '1食',
            kcal: src.kcal !== undefined ? String(src.kcal) : '',
            protein: src.protein !== undefined ? String(src.protein) : '',
            fat: src.fat !== undefined ? String(src.fat) : '',
            carbs: src.carbs !== undefined ? String(src.carbs) : '',
          }
        : EMPTY,
    )
    setError('')
  }, [open, food, initial])

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }))

  const fillKcal = () => setD((s) => ({ ...s, kcal: String(pfcToKcal(num(s.protein), num(s.fat), num(s.carbs))) }))

  const save = async () => {
    if (!d.name.trim()) {
      setError('名前を入力してください')
      return
    }
    const payload = {
      name: d.name.trim(),
      unitLabel: d.unitLabel.trim() || '1食',
      kcal: Math.round(num(d.kcal)),
      protein: num(d.protein),
      fat: num(d.fat),
      carbs: num(d.carbs),
    }
    if (food) {
      await updateFood(food.id, payload)
      onSaved?.({ ...food, ...payload })
    } else {
      const created = await addFood(payload)
      onSaved?.(created)
    }
    onClose()
  }

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
        <TextField label="名前" value={d.name} onChange={set('name')} placeholder="例: 鶏むね肉 100g" error={error} autoFocus={!food} />
        <TextField label="1回分の量" value={d.unitLabel} onChange={set('unitLabel')} placeholder="例: 1個, 100g, 1杯" hint="記録は「この量 × 倍率」で行います" />
        <TextField label="カロリー" type="number" inputMode="decimal" value={d.kcal} onChange={set('kcal')} suffix="kcal" placeholder="0" />
        <div className="ff__pfc">
          <TextField label="タンパク質" type="number" inputMode="decimal" value={d.protein} onChange={set('protein')} suffix="g" placeholder="0" />
          <TextField label="脂質" type="number" inputMode="decimal" value={d.fat} onChange={set('fat')} suffix="g" placeholder="0" />
          <TextField label="炭水化物" type="number" inputMode="decimal" value={d.carbs} onChange={set('carbs')} suffix="g" placeholder="0" />
        </div>
        <Button variant="ghost" size="sm" onClick={fillKcal}>
          PFC からカロリーを計算
        </Button>
      </div>
    </Sheet>
  )
}
