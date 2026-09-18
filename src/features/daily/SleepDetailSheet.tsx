import { Gauge, Moon } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { Stepper } from '../../components/ui/Stepper'
import { metricStatusText, useMetricDraft } from './useMetricDraft'
import './SleepDetailSheet.css'

const SLEEP_STEP = 0.5
const SLEEP_MIN = 0
const SLEEP_MAX = 16
const DEFAULT_SLEEP_HOURS = 7

const SCORE_STEP = 1
const SCORE_MIN = 0
const SCORE_MAX = 100
export const DEFAULT_SLEEP_SCORE = 75

const formatHours = (v: number) => `${v.toFixed(1)}h`
const formatScore = (v: number) => `${v}`

interface SleepDetailSheetProps {
  open: boolean
  onClose: () => void
  date: string
}

/** 睡眠時間に加えて、スマートウォッチや睡眠アプリの睡眠スコアを記録するシート */
export function SleepDetailSheet({ open, onClose, date }: SleepDetailSheetProps) {
  const hours = useMetricDraft('sleepHours', date, DEFAULT_SLEEP_HOURS)
  const score = useMetricDraft('sleepScore', date, DEFAULT_SLEEP_SCORE)

  const hoursLatestValue = hours.latest?.sleepHours
  const scoreLatestValue = score.latest?.sleepScore
  const hoursStatus = metricStatusText(hours.todayValue, hours.saved, hours.latest, hoursLatestValue, formatHours)
  const scoreStatus = metricStatusText(score.todayValue, score.saved, score.latest, scoreLatestValue, formatScore)

  return (
    <Sheet open={open} onClose={onClose} title="睡眠の詳細">
      <div className="stack">
        <p className="sd__lead faint">スマートウォッチや睡眠アプリの値をそのまま入れられます</p>

        <div className="sd__row">
          <div className="sd__label">
            <span className="sd__icon">
              <Moon size={16} aria-hidden />
            </span>
            <span className="sd__name">睡眠時間</span>
            <span className={`sd__status ${hours.saved ? 'sd__status--saved' : ''} ${hours.todayValue !== undefined ? 'sd__status--done' : ''}`}>{hoursStatus}</span>
          </div>
          <Stepper
            name="睡眠時間"
            value={hours.value}
            onChange={hours.setDraft}
            step={SLEEP_STEP}
            decimals={1}
            min={SLEEP_MIN}
            max={SLEEP_MAX}
            unit="h"
            size="lg"
            disabled={!hours.loaded}
          />
        </div>

        <div className="sd__row">
          <div className="sd__label">
            <span className="sd__icon">
              <Gauge size={16} aria-hidden />
            </span>
            <span className="sd__name">睡眠スコア</span>
            <span className={`sd__status ${score.saved ? 'sd__status--saved' : ''} ${score.todayValue !== undefined ? 'sd__status--done' : ''}`}>{scoreStatus}</span>
          </div>
          <Stepper
            name="睡眠スコア"
            value={score.value}
            onChange={score.setDraft}
            step={SCORE_STEP}
            decimals={0}
            min={SCORE_MIN}
            max={SCORE_MAX}
            size="lg"
            disabled={!score.loaded}
          />
          <p className="sd__hint faint">0〜100 · タップで直接入力</p>
        </div>
      </div>
    </Sheet>
  )
}
