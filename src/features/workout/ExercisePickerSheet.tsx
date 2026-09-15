import { useMemo, useState } from 'react'
import { Check, Pencil, Plus, Search } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { ExerciseFormSheet } from './ExerciseFormSheet'
import { BODY_PARTS, EXERCISE_TYPES, type BodyPart, type Exercise } from '../../types'
import './ExercisePickerSheet.css'

interface ExercisePickerSheetProps {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  /** すでに入っている種目（選択済みとして表示） */
  selectedIds: string[]
  /** 最近使った順に上に出すための情報 */
  recentIds?: string[]
  onConfirm: (ids: string[]) => void
  confirmLabel?: string
}

type Filter = 'all' | 'recent' | BodyPart

export function ExercisePickerSheet({ open, onClose, exercises, selectedIds, recentIds = [], onConfirm, confirmLabel = '追加' }: ExercisePickerSheetProps) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>(recentIds.length > 0 ? 'recent' : 'all')
  const [picked, setPicked] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)

  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    const active = exercises.filter((e) => !e.archived)
    const byFilter =
      filter === 'all' ? active : filter === 'recent' ? active.filter((e) => recentIds.includes(e.id)) : active.filter((e) => e.bodyPart === filter)
    const searched = k ? active.filter((e) => e.name.toLowerCase().includes(k)) : byFilter
    const recentRank = (id: string) => {
      const i = recentIds.indexOf(id)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    return [...searched].sort((a, b) => recentRank(a.id) - recentRank(b.id))
  }, [exercises, q, filter, recentIds])

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const confirm = () => {
    onConfirm(picked)
    setPicked([])
    setQ('')
    onClose()
  }

  const filters: { value: Filter; label: string }[] = [
    ...(recentIds.length > 0 ? [{ value: 'recent' as const, label: '最近' }] : []),
    { value: 'all', label: 'すべて' },
    ...(Object.keys(BODY_PARTS) as BodyPart[]).map((k) => ({ value: k, label: BODY_PARTS[k] })),
  ]

  return (
    <>
      <Sheet
        open={open}
        onClose={() => {
          setPicked([])
          onClose()
        }}
        title="種目を選ぶ"
        tall
        footer={
          <Button variant="primary" size="lg" block disabled={picked.length === 0} onClick={confirm}>
            {picked.length > 0 ? `${picked.length}種目を${confirmLabel}` : '種目をタップして選択'}
          </Button>
        }
      >
        <div className="ep__search">
          <Search size={18} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="種目を検索" aria-label="種目を検索" />
        </div>
        <div className="ep__filters" role="tablist" aria-label="部位で絞り込む">
          {filters.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className={`ep__filter ${filter === f.value ? 'ep__filter--on' : ''}`} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ep__new"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus size={18} aria-hidden />
          新しい種目を作る
        </button>
        <ul className="ep__list">
          {list.map((e) => {
            const already = selectedIds.includes(e.id)
            const on = picked.includes(e.id)
            return (
              <li key={e.id} className="ep__item">
                <button type="button" className={`ep__main ${on ? 'ep__main--on' : ''} ${already ? 'ep__main--already' : ''}`} onClick={() => !already && toggle(e.id)} disabled={already} aria-pressed={on}>
                  <span className={`ep__check ${on || already ? 'ep__check--on' : ''}`}>{(on || already) && <Check size={14} strokeWidth={3} aria-hidden />}</span>
                  <span className="ep__body">
                    <span className="ep__name">{e.name}</span>
                    <span className="ep__meta">
                      {BODY_PARTS[e.bodyPart]} · {EXERCISE_TYPES[e.type]}
                      {e.useWeight ? ' · 加重' : ''}
                      {already ? ' · 追加済み' : ''}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="ep__edit"
                  aria-label={`${e.name} を編集`}
                  onClick={() => {
                    setEditing(e)
                    setFormOpen(true)
                  }}
                >
                  <Pencil size={16} aria-hidden />
                </button>
              </li>
            )
          })}
          {list.length === 0 && <li className="ep__empty">該当する種目がありません</li>}
        </ul>
      </Sheet>
      <ExerciseFormSheet open={formOpen} onClose={() => setFormOpen(false)} exercise={editing} allExercises={exercises} onSaved={(ex) => !editing && setPicked((p) => [...p, ex.id])} />
    </>
  )
}
