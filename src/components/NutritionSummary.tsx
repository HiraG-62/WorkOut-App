import { Ring } from './ui/Ring'
import { MacroBar } from './ui/MacroBar'
import type { Targets } from '../types'
import './NutritionSummary.css'

interface NutritionSummaryProps {
  totals: Targets
  targets: Targets
  compact?: boolean
}

export function NutritionSummary({ totals, targets, compact = false }: NutritionSummaryProps) {
  const remain = targets.kcal - totals.kcal
  return (
    <div className={`nutri ${compact ? 'nutri--compact' : ''}`}>
      <Ring
        value={totals.kcal}
        target={targets.kcal}
        size={compact ? 104 : 128}
        stroke={compact ? 9 : 11}
        color="var(--kcal)"
        ariaLabel={`カロリー ${Math.round(totals.kcal)} / ${targets.kcal} kcal`}
        label={String(Math.round(totals.kcal))}
        sub={remain >= 0 ? `残り ${Math.round(remain)}${compact ? '' : ' kcal'}` : `${Math.round(-remain)}${compact ? '' : ' kcal'} 超過`}
      />
      <div className="nutri__bars">
        <MacroBar short="P" label="タンパク質" value={totals.protein} target={targets.protein} color="var(--protein)" />
        <MacroBar short="F" label="脂質" value={totals.fat} target={targets.fat} color="var(--fat)" />
        <MacroBar short="C" label="炭水化物" value={totals.carbs} target={targets.carbs} color="var(--carbs)" />
      </div>
    </div>
  )
}
