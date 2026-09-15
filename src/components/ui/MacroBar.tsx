import { fmt1 } from '../../lib/nutrition'
import './MacroBar.css'

interface MacroBarProps {
  label: string
  short: string
  value: number
  target: number
  color: string
  unit?: string
}

export function MacroBar({ label, short, value, target, color, unit = 'g' }: MacroBarProps) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0
  const over = target > 0 && value > target
  return (
    <div className="macro" role="group" aria-label={`${label} ${fmt1(value)}/${target}${unit}`}>
      <div className="macro__head">
        <span className="macro__short" style={{ color }}>
          {short}
        </span>
        <span className="macro__label">{label}</span>
        <span className={`num macro__val ${over ? 'macro__val--over' : ''}`}>
          {fmt1(value)}
          <span className="macro__target">/{target}{unit}</span>
        </span>
      </div>
      <div className="macro__track">
        <div
          className="macro__fill"
          style={{ width: `${ratio * 100}%`, background: over ? 'var(--danger)' : color }}
        />
      </div>
    </div>
  )
}
