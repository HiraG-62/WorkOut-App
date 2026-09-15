import './Ring.css'

interface RingProps {
  value: number
  target: number
  size?: number
  stroke?: number
  color: string
  /** 中央に表示する内容 */
  label?: string
  sub?: string
  className?: string
  /** 読み上げ用の説明。未指定なら値/目標から作る */
  ariaLabel?: string
}

export function Ring({ value, target, size = 120, stroke = 10, color, label, sub, className = '', ariaLabel }: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(1, value / target) : 0
  const over = target > 0 && value > target
  const offset = c * (1 - ratio)
  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel ?? `${Math.round(value)} / ${target}（${Math.round(ratio * 100)}%）`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--danger)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring__arc"
        />
      </svg>
      {(label || sub) && (
        <div className="ring__center">
          {label && <span className="display ring__label">{label}</span>}
          {sub && <span className="ring__sub">{sub}</span>}
        </div>
      )}
    </div>
  )
}
