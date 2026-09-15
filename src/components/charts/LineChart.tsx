import { useMemo } from 'react'
import './LineChart.css'

export interface LinePoint {
  x: string
  y: number | null
}

interface LineChartProps {
  points: LinePoint[]
  /** 副系列（移動平均など） */
  secondary?: (number | null)[]
  color?: string
  height?: number
  unit?: string
  /** x軸ラベルにする index を返す */
  xLabel?: (x: string, i: number) => string | null
  ariaLabel: string
  /** y軸の下限を 0 に固定する */
  zeroBased?: boolean
  /** 目盛りを整数にする（回数・秒数など） */
  integerTicks?: boolean
}

const W = 320
const PAD_L = 34
const PAD_R = 10
const PAD_T = 12
const PAD_B = 22
const GRID_LINES = 3

export function LineChart({
  points,
  secondary,
  color = 'var(--accent)',
  height = 160,
  unit = '',
  xLabel,
  ariaLabel,
  zeroBased = false,
  integerTicks = false,
}: LineChartProps) {
  const model = useMemo(() => {
    const ys = points.map((p) => p.y).filter((y): y is number => y !== null)
    const ys2 = (secondary ?? []).filter((y): y is number => y !== null)
    const all = [...ys, ...ys2]
    if (all.length === 0) return null
    let min = zeroBased ? 0 : Math.min(...all)
    let max = Math.max(...all)
    if (min === max) {
      min -= 1
      max += 1
    }
    const span = max - min
    min -= zeroBased ? 0 : span * 0.15
    max += span * 0.15
    const innerW = W - PAD_L - PAD_R
    const innerH = height - PAD_T - PAD_B
    const n = points.length
    const xAt = (i: number) => PAD_L + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
    const yAt = (v: number) => PAD_T + innerH - ((v - min) / (max - min)) * innerH
    const path = (vals: (number | null)[]) => {
      let d = ''
      let pen = false
      vals.forEach((v, i) => {
        if (v === null) {
          pen = false
          return
        }
        d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)} `
        pen = true
      })
      return d
    }
    const grid = Array.from({ length: GRID_LINES }, (_, i) => {
      const v = min + ((max - min) * (i + 0.5)) / GRID_LINES
      return { y: yAt(v), v }
    })
    const last = [...points].reverse().find((p) => p.y !== null)
    const lastIdx = last ? points.lastIndexOf(last) : -1
    return { xAt, yAt, path, grid, innerH, last, lastIdx, min, max }
  }, [points, secondary, height, zeroBased])

  if (!model) {
    return (
      <div className="chart chart--empty" style={{ height }}>
        <span>まだデータがありません</span>
      </div>
    )
  }

  const labels = points
    .map((p, i) => ({ i, text: xLabel ? xLabel(p.x, i) : null }))
    .filter((l): l is { i: number; text: string } => l.text !== null)

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel}>
        {model.grid.map((g) => (
          <g key={g.y}>
            <line x1={PAD_L} x2={W - PAD_R} y1={g.y} y2={g.y} className="chart__grid" />
            <text x={PAD_L - 6} y={g.y + 3.5} className="chart__ytick" textAnchor="end">
              {integerTicks ? Math.round(g.v) : Math.round(g.v * 10) / 10}
            </text>
          </g>
        ))}
        {secondary && <path d={model.path(secondary)} className="chart__line chart__line--secondary" />}
        <path d={model.path(points.map((p) => p.y))} className="chart__line" style={{ stroke: color }} />
        {points.map((p, i) =>
          p.y === null ? null : (
            <circle key={p.x} cx={model.xAt(i)} cy={model.yAt(p.y)} r={i === model.lastIdx ? 4 : 2.2} style={{ fill: color }} />
          ),
        )}
        {model.last && model.last.y !== null && (
          <text
            x={Math.min(W - PAD_R - 2, model.xAt(model.lastIdx))}
            y={model.yAt(model.last.y) - 9}
            className="chart__last"
            textAnchor={model.lastIdx > points.length / 2 ? 'end' : 'middle'}
          >
            {model.last.y}
            {unit}
          </text>
        )}
        {labels.map((l) => (
          <text key={l.i} x={model.xAt(l.i)} y={height - 6} className="chart__xtick" textAnchor="middle">
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  )
}
