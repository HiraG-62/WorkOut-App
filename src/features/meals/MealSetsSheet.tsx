import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { db } from '../../db/db'
import { addMealSet, deleteMealSet, logMealSet } from '../../db/repo'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { EmptyState } from '../../components/ui/EmptyState'
import { TextField } from '../../components/ui/Field'
import type { MealEntry } from '../../types'
import './MealSetsSheet.css'

interface MealSetsSheetProps {
  open: boolean
  onClose: () => void
  date: string
  /** 「今日の食事からセットを作る」の元データ */
  todayEntries: MealEntry[]
}

export function MealSetsSheet({ open, onClose, date, todayEntries }: MealSetsSheetProps) {
  const toast = useToast()
  const sets = useLiveQuery(async () => (await db.mealSets.toArray()).sort((a, b) => a.createdAt - b.createdAt), [])
  const foods = useLiveQuery(() => db.foods.toArray(), [])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const foodName = (id: string) => foods?.find((f) => f.id === id)?.name ?? '(削除済み)'
  const sourceItems = todayEntries.filter((e) => e.foodId)

  const create = async () => {
    if (!name.trim() || sourceItems.length === 0) return
    await addMealSet(
      name.trim(),
      sourceItems.map((e) => ({ foodId: e.foodId as string, quantity: e.quantity })),
    )
    setName('')
    setCreating(false)
    toast.show('セットを作成しました', 'success')
  }

  const apply = async (id: string) => {
    const set = sets?.find((s) => s.id === id)
    if (!set) return
    const n = await logMealSet(set, date)
    toast.show(`${set.name} の${n}品を記録しました`, 'success')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="食事セット">
      <div className="stack">
        {creating ? (
          <div className="ms__create">
            <TextField label="セット名" value={name} onChange={(e) => setName(e.target.value)} placeholder="例: いつもの朝食" autoFocus />
            <p className="ms__source">
              {sourceItems.length > 0 ? `今日の ${sourceItems.length} 品（フード登録済みのもの）をまとめます` : '今日はフードから記録した食事がありません'}
            </p>
            <div className="row">
              <Button onClick={() => setCreating(false)}>やめる</Button>
              <Button variant="primary" block disabled={!name.trim() || sourceItems.length === 0} onClick={() => void create()}>
                作成
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="accent-soft" block icon={<Plus size={18} aria-hidden />} onClick={() => setCreating(true)}>
            今日の食事からセットを作る
          </Button>
        )}

        {sets && sets.length === 0 && !creating && (
          <EmptyState icon={<Layers size={24} />} title="セットはまだありません" description="毎朝同じ組み合わせなど、決まった食事をまとめて1タップで記録できます" />
        )}

        <ul className="ms__list">
          {sets?.map((s) => (
            <li key={s.id} className="ms__item">
              <button type="button" className="ms__main" onClick={() => void apply(s.id)}>
                <span className="ms__name">{s.name}</span>
                <span className="ms__meta">{s.items.map((it) => `${foodName(it.foodId)}${it.quantity !== 1 ? `×${it.quantity}` : ''}`).join('、')}</span>
              </button>
              <button type="button" className="ms__delete" aria-label={`${s.name} を削除`} onClick={() => void deleteMealSet(s.id)}>
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
