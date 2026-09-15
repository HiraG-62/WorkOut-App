import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { tapHaptic } from '../../lib/feedback'
import './Stepper.css'

const HOLD_DELAY_MS = 400
const HOLD_REPEAT_MS = 90

interface StepperProps {
  value: number
  onChange: (v: number) => void
  step: number
  min?: number
  max?: number
  /** 小数点以下の桁数 */
  decimals?: number
  unit?: string
  label?: string
  /** 読み上げ用の名前。label を表示したくない時に使う */
  name?: string
  size?: 'md' | 'lg'
  /** 数値をタップして直接入力できるようにする */
  editable?: boolean
  disabled?: boolean
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  decimals = 0,
  unit,
  label,
  name,
  size = 'md',
  editable = true,
  disabled = false,
}: StepperProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const holdTimer = useRef<number | null>(null)
  const holdInterval = useRef<number | null>(null)
  const valueRef = useRef(value)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  const factor = 10 ** decimals
  const apply = (delta: number) => {
    const next = clamp(Math.round((valueRef.current + delta) * factor) / factor, min, max)
    if (next !== valueRef.current) {
      valueRef.current = next
      onChange(next)
      tapHaptic()
    }
  }

  const clearHold = () => {
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    if (holdInterval.current) window.clearInterval(holdInterval.current)
    holdTimer.current = null
    holdInterval.current = null
  }

  const startHold = (delta: number) => {
    apply(delta)
    holdTimer.current = window.setTimeout(() => {
      holdInterval.current = window.setInterval(() => apply(delta), HOLD_REPEAT_MS)
    }, HOLD_DELAY_MS)
  }

  useEffect(() => clearHold, [])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const n = Number(draft)
    if (!Number.isNaN(n) && draft.trim() !== '') onChange(clamp(Math.round(n * factor) / factor, min, max))
    setEditing(false)
  }

  const display = value.toFixed(decimals)
  const a11yName = name ?? label ?? ''
  const unitText = unit ?? ''

  /** キーボード操作（Enter/Space）は pointerdown を発火しないので click で拾う */
  const onKeyboardClick = (delta: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) apply(delta)
  }

  return (
    <div className={`stepper stepper--${size} ${disabled ? 'stepper--disabled' : ''}`}>
      {label && <span className="stepper__label">{label}</span>}
      <div className="stepper__row">
        <button
          type="button"
          className="stepper__btn"
          aria-label={`${a11yName}を${step}${unitText}減らす`}
          disabled={disabled || value <= min}
          onClick={onKeyboardClick(-step)}
          onPointerDown={(e) => {
            e.preventDefault()
            startHold(-step)
          }}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onPointerCancel={clearHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Minus size={size === 'lg' ? 24 : 20} aria-hidden />
        </button>
        {editing ? (
          <input
            ref={inputRef}
            className="stepper__input"
            type="number"
            inputMode="decimal"
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            aria-label={a11yName}
          />
        ) : (
          <button
            type="button"
            className="stepper__value"
            disabled={disabled || !editable}
            onClick={() => {
              setDraft(display)
              setEditing(true)
            }}
            aria-label={`${a11yName} ${display}${unitText}。タップで直接入力`}
          >
            <span className="display stepper__num">{display}</span>
            {unit && <span className="stepper__unit">{unit}</span>}
          </button>
        )}
        <button
          type="button"
          className="stepper__btn"
          aria-label={`${a11yName}を${step}${unitText}増やす`}
          disabled={disabled || value >= max}
          onClick={onKeyboardClick(step)}
          onPointerDown={(e) => {
            e.preventDefault()
            startHold(step)
          }}
          onPointerUp={clearHold}
          onPointerLeave={clearHold}
          onPointerCancel={clearHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Plus size={size === 'lg' ? 24 : 20} aria-hidden />
        </button>
      </div>
    </div>
  )
}
