import { Plus } from 'lucide-react'
import { logFood, unlogFood } from '../../db/repo'
import { tapHaptic } from '../../lib/feedback'
import { useToast } from '../../components/ui/Toast'
import type { Food } from '../../types'
import './QuickFoods.css'

const UNDO_MS = 5000

interface QuickFoodsProps {
  foods: Food[]
  date: string
  limit?: number
  onMore?: () => void
  onAdd?: () => void
}

/** ワンタップで記録できるフードのチップ一覧 */
export function QuickFoods({ foods, date, limit, onMore, onAdd }: QuickFoodsProps) {
  const toast = useToast()
  const shown = limit ? foods.slice(0, limit) : foods

  const handleTap = async (food: Food) => {
    tapHaptic()
    const entry = await logFood(food, 1, date)
    toast.show(`${food.name} を記録`, 'success', { label: '取り消す', onClick: () => void unlogFood(entry) }, UNDO_MS)
  }

  return (
    <div className="qf">
      {shown.map((f) => (
        <button key={f.id} type="button" className="qf__chip" onClick={() => void handleTap(f)}>
          <span className="qf__name">{f.name}</span>
          <span className="qf__meta">
            <span className="num">{f.kcal}</span> kcal · P<span className="num">{f.protein}</span>
          </span>
        </button>
      ))}
      {onAdd && (
        <button type="button" className="qf__chip qf__chip--add" onClick={onAdd}>
          <Plus size={18} aria-hidden />
          <span className="qf__name">フード登録</span>
        </button>
      )}
      {onMore && foods.length > shown.length && (
        <button type="button" className="qf__chip qf__chip--more" onClick={onMore}>
          <span className="qf__name">すべて表示</span>
          <span className="qf__meta">他 {foods.length - shown.length} 件</span>
        </button>
      )}
    </div>
  )
}
