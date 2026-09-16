import { Flame } from 'lucide-react'
import { Ring } from './ui/Ring'
import { MacroBar } from './ui/MacroBar'
import type { Targets } from '../types'
import './NutritionSummary.css'

interface NutritionSummaryProps {
  totals: Targets
  targets: Targets
  compact?: boolean
  /** その日のトレーニングの推定消費カロリー */
  burnKcal?: number
  /** 消費分をカロリー目標に加算する（設定） */
  addBurn?: boolean
  /** 体重が未記録（仮の体重で計算している） */
  weightMissing?: boolean
}

export function NutritionSummary({ totals, targets, compact = false, burnKcal = 0, addBurn = false, weightMissing = false }: NutritionSummaryProps) {
  const kcalTarget = addBurn ? targets.kcal + burnKcal : targets.kcal
  const remain = kcalTarget - totals.kcal
  return (
    <div className={`nutri ${compact ? 'nutri--compact' : ''}`}>
      <Ring
        value={totals.kcal}
        target={kcalTarget}
        size={compact ? 104 : 128}
        stroke={compact ? 9 : 11}
        color="var(--kcal)"
        ariaLabel={`カロリー ${Math.round(totals.kcal)} / ${kcalTarget} kcal`}
        label={String(Math.round(totals.kcal))}
        sub={remain >= 0 ? `残り ${Math.round(remain)}${compact ? '' : ' kcal'}` : `${Math.round(-remain)}${compact ? '' : ' kcal'} 超過`}
      />
      <div className="nutri__bars">
        <MacroBar short="P" label="タンパク質" value={totals.protein} target={targets.protein} color="var(--protein)" />
        <MacroBar short="F" label="脂質" value={totals.fat} target={targets.fat} color="var(--fat)" />
        <MacroBar short="C" label="炭水化物" value={totals.carbs} target={targets.carbs} color="var(--carbs)" />
        {burnKcal > 0 && (
          <p className="nutri__burn">
            <Flame size={13} aria-hidden />
            <span className="nutri__burn-text">
              トレで約<span className="num">{burnKcal}</span>kcal 消費
            </span>
            {addBurn && <span className="nutri__burn-tag">目標 {kcalTarget}kcal に加算中</span>}
            {weightMissing && <span className="nutri__burn-note">体重を記録すると正確になります</span>}
          </p>
        )}
      </div>
    </div>
  )
}
