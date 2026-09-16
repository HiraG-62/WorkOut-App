import { useMemo, useState } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { logFood, unlogFood } from '../../db/repo'
import { tapHaptic } from '../../lib/feedback'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { useBusy } from '../../hooks/useBusy'
import { EmptyState } from '../../components/ui/EmptyState'
import { FoodFormSheet } from './FoodFormSheet'
import type { Food } from '../../types'
import './FoodPickerSheet.css'

const UNDO_MS = 5000

interface FoodPickerSheetProps {
  open: boolean
  onClose: () => void
  foods: Food[]
  date: string
}

/** 全フードから検索して記録する。編集・新規登録もここから */
export function FoodPickerSheet({ open, onClose, foods, date }: FoodPickerSheetProps) {
  const toast = useToast()
  const guard = useBusy()
  const [q, setQ] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? foods.filter((f) => f.name.toLowerCase().includes(k)) : foods
  }, [foods, q])

  const log = (food: Food) =>
    guard(async () => {
      tapHaptic()
      const entry = await logFood(food, 1, date)
      toast.show(`${food.name} を記録`, 'success', { label: '取り消す', onClick: () => void unlogFood(entry) }, UNDO_MS)
    }, food.id)

  return (
    <>
      <Sheet open={open} onClose={onClose} title="フード" tall>
        <div className="fp__search">
          <Search size={18} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索" aria-label="フードを検索" />
        </div>
        <Button
          variant="accent-soft"
          block
          icon={<Plus size={18} aria-hidden />}
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          新しいフードを登録
        </Button>
        {filtered.length === 0 ? (
          <EmptyState icon={<Search size={24} />} title={q ? '見つかりません' : 'まだフードがありません'} description="よく食べるものを登録すると、次からワンタップで記録できます" />
        ) : (
          <ul className="fp__list">
            {filtered.map((f) => (
              <li key={f.id} className="fp__item">
                <button type="button" className="fp__main" onClick={() => void log(f)}>
                  <span className="fp__name">{f.name}</span>
                  <span className="fp__meta">
                    {f.unitLabel} · <span className="num">{f.kcal}</span> kcal · P{f.protein} F{f.fat} C{f.carbs}
                  </span>
                </button>
                <button
                  type="button"
                  className="fp__edit"
                  aria-label={`${f.name} を編集`}
                  onClick={() => {
                    setEditing(f)
                    setFormOpen(true)
                  }}
                >
                  <Pencil size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <FoodFormSheet open={formOpen} onClose={() => setFormOpen(false)} food={editing} />
    </>
  )
}
