import { Plus, X } from 'lucide-react'
import { useRestTimer } from '../hooks/useRestTimer'
import { formatDuration } from '../lib/date'
import './RestTimerBar.css'

const EXTEND_SEC = 30

/** 画面下部に浮かぶ休憩タイマー。どの画面にいても見える */
export function RestTimerBar() {
  const timer = useRestTimer()
  if (!timer.running) return null
  const ratio = timer.totalSec > 0 ? timer.remainingSec / timer.totalSec : 0
  return (
    <div className="rest-bar" role="timer" aria-live="off" aria-label={`休憩 残り${timer.remainingSec}秒`}>
      <div className="rest-bar__progress" style={{ transform: `scaleX(${ratio})` }} />
      <div className="rest-bar__inner">
        <div className="rest-bar__text">
          <span className="rest-bar__caption">休憩{timer.label ? ` · ${timer.label}` : ''}</span>
          <span className="display rest-bar__time">{formatDuration(timer.remainingSec * 1000)}</span>
        </div>
        <button type="button" className="rest-bar__btn" onClick={() => timer.extend(EXTEND_SEC)} aria-label={`${EXTEND_SEC}秒延長`}>
          <Plus size={16} aria-hidden />
          {EXTEND_SEC}s
        </button>
        <button type="button" className="rest-bar__btn rest-bar__btn--skip" onClick={timer.stop} aria-label="休憩をスキップ">
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}
