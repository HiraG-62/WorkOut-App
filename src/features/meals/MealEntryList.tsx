import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteMeal, updateMealQuantity } from '../../db/repo'
import { formatTime, timeSlot, TIME_SLOT_LABELS } from '../../lib/date'
import { fmt1 } from '../../lib/nutrition'
import { Sheet } from '../../components/ui/Sheet'
import { Stepper } from '../../components/ui/Stepper'
import { Button } from '../../components/ui/Button'
import type { MealEntry } from '../../types'
import './MealEntryList.css'

const QTY_STEP = 0.5
const QTY_MIN = 0.5
const QTY_MAX = 20

interface MealEntryListProps {
  entries: MealEntry[]
}

export function MealEntryList({ entries }: MealEntryListProps) {
  const [editing, setEditing] = useState<MealEntry | null>(null)
  const [qty, setQty] = useState(1)

  const groups = new Map<number, MealEntry[]>()
  for (const e of entries) {
    const slot = timeSlot(new Date(e.createdAt))
    const list = groups.get(slot) ?? []
    list.push(e)
    groups.set(slot, list)
  }

  const open = (e: MealEntry) => {
    setEditing(e)
    setQty(e.quantity)
  }

  const save = async () => {
    if (!editing) return
    if (qty !== editing.quantity) await updateMealQuantity(editing, qty)
    setEditing(null)
  }

  return (
    <>
      <div className="mel">
        {[0, 1, 2, 3].map((slot) => {
          const list = groups.get(slot)
          if (!list) return null
          const sub = list.reduce((s, e) => s + e.kcal, 0)
          return (
            <div key={slot} className="mel__group">
              <div className="mel__group-head">
                <span>{TIME_SLOT_LABELS[slot]}</span>
                <span className="num">{Math.round(sub)} kcal</span>
              </div>
              {list.map((e) => (
                <button key={e.id} type="button" className="mel__row" onClick={() => open(e)}>
                  <span className="mel__time num">{formatTime(e.createdAt)}</span>
                  <span className="mel__name">
                    {e.name}
                    {e.quantity !== 1 && <span className="mel__qty"> ×{fmt1(e.quantity)}</span>}
                  </span>
                  <span className="mel__macros">
                    <span style={{ color: 'var(--protein)' }}>P{fmt1(e.protein)}</span>
                    <span style={{ color: 'var(--fat)' }}>F{fmt1(e.fat)}</span>
                    <span style={{ color: 'var(--carbs)' }}>C{fmt1(e.carbs)}</span>
                  </span>
                  <span className="mel__kcal num">{Math.round(e.kcal)}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.name ?? ''}
        footer={
          <div className="row">
            <Button
              variant="danger"
              icon={<Trash2 size={18} aria-hidden />}
              onClick={() => {
                if (editing) void deleteMeal(editing.id)
                setEditing(null)
              }}
              aria-label="この記録を削除"
            />
            <Button variant="primary" block onClick={() => void save()}>
              保存
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="stack">
            <Stepper value={qty} onChange={setQty} step={QTY_STEP} min={QTY_MIN} max={QTY_MAX} decimals={1} unit="倍" label="分量" size="lg" />
            <p className="muted mel__preview">
              {Math.round((editing.kcal / (editing.quantity || 1)) * qty)} kcal · P{fmt1((editing.protein / (editing.quantity || 1)) * qty)} F
              {fmt1((editing.fat / (editing.quantity || 1)) * qty)} C{fmt1((editing.carbs / (editing.quantity || 1)) * qty)}
            </p>
          </div>
        )}
      </Sheet>
    </>
  )
}
