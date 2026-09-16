import { FIGURES, type FormFamily, type Pose, type Prop } from './formGuide'
import './ExerciseFigure.css'

const VIEW_W = 120
const VIEW_H = 80
const HEAD_R = 5

interface ExerciseFigureProps {
  family: FormFamily
  /** 表示幅（px）。高さは 2:3 で自動 */
  width?: number
  /** 2 ポーズを交互に表示するアニメーション */
  animate?: boolean
  className?: string
}

function PoseLines({ pose, dim }: { pose: Pose; dim?: boolean }) {
  const cls = dim ? 'fig__limb fig__limb--dim' : 'fig__limb'
  return (
    <g>
      <line className="fig__limb" x1={pose.neck[0]} y1={pose.neck[1]} x2={pose.hip[0]} y2={pose.hip[1]} />
      {pose.legs.map((leg, i) => (
        <polyline key={`l${i}`} className={i === 0 ? 'fig__limb' : cls} points={`${pose.hip[0]},${pose.hip[1]} ${leg.knee[0]},${leg.knee[1]} ${leg.ankle[0]},${leg.ankle[1]}`} />
      ))}
      {pose.arms.map((arm, i) => (
        <polyline key={`a${i}`} className={i === 0 ? 'fig__limb' : cls} points={`${pose.neck[0]},${pose.neck[1]} ${arm.elbow[0]},${arm.elbow[1]} ${arm.hand[0]},${arm.hand[1]}`} />
      ))}
      <circle className="fig__head" cx={pose.head[0]} cy={pose.head[1]} r={HEAD_R} />
    </g>
  )
}

function PropShape({ prop }: { prop: Prop }) {
  if (prop.kind === 'bench' || prop.kind === 'box') {
    const x = Math.min(prop.from[0], prop.to[0])
    const y = Math.min(prop.from[1], prop.to[1])
    return <rect className="fig__prop fig__prop--solid" x={x} y={y} width={Math.abs(prop.to[0] - prop.from[0])} height={Math.abs(prop.to[1] - prop.from[1])} rx={2} />
  }
  return <line className={`fig__prop fig__prop--${prop.kind}`} x1={prop.from[0]} y1={prop.from[1]} x2={prop.to[0]} y2={prop.to[1]} />
}

/** 種目の動きを表す棒人間ピクトグラム */
export function ExerciseFigure({ family, width = 120, animate = true, className = '' }: ExerciseFigureProps) {
  const fig = FIGURES[family]
  const twoPoses = fig.poses.length > 1
  return (
    <svg
      className={`fig ${twoPoses && animate ? 'fig--animate' : ''} ${className}`}
      viewBox={`0 -4 ${VIEW_W} ${VIEW_H + 4}`}
      width={width}
      height={(width * (VIEW_H + 4)) / VIEW_W}
      role="img"
      aria-hidden
    >
      {fig.props.map((p, i) => (
        <PropShape key={i} prop={p} />
      ))}
      {fig.poses.map((pose, i) => (
        <g key={i} className={`fig__pose fig__pose--${i}`}>
          <PoseLines pose={pose} />
        </g>
      ))}
    </svg>
  )
}
