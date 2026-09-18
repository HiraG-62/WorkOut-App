import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, Footprints, Moon } from 'lucide-react'
import type { DailyMetricField } from '../../db/repo'
import { useToday } from '../../hooks/useToday'
import { Stepper } from '../../components/ui/Stepper'
import { Card } from '../../components/ui/Card'
import { metricStatusText, useMetricDraft } from './useMetricDraft'
import { DEFAULT_SLEEP_SCORE, SleepDetailSheet } from './SleepDetailSheet'
import './DailyQuick.css'

const SLEEP_STEP = 0.5
const SLEEP_MIN = 0
const SLEEP_MAX = 16
const DEFAULT_SLEEP_HOURS = 7

const STEPS_STEP = 500
const STEPS_MIN = 0
const STEPS_MAX = 100_000
const DEFAULT_STEPS = 6000

interface MetricBlockProps {
  field: DailyMetricField
  title: string
  icon: ReactNode
  step: number
  decimals: number
  min: number
  max: number
  unit: string
  defaultValue: number
  /** status 表示用の値→文字列 */
  format: (value: number) => string
  /** head 末尾に表示する追加要素（睡眠の「詳細」ボタンなど） */
  action?: ReactNode
  /** 今日の記録済み表示に付け足す文言（例: '· スコア 82'）。保存直後は付けない */
  extraStatus?: string
}

/** 睡眠・歩数で共通の ± 入力ブロック。前回値がプリセットされ、変更すると自動で今日の記録として保存する */
function MetricBlock({ field, title, icon, step, decimals, min, max, unit, defaultValue, format, action, extraStatus }: MetricBlockProps) {
  const today = useToday()
  const { value, setDraft, loaded, todayValue, latest, saved } = useMetricDraft(field, today, defaultValue)
  const latestValue = latest?.[field]
  const status = metricStatusText(todayValue, saved, latest, latestValue, format, extraStatus)

  return (
    <div className="dq__block">
      <div className="dq__head">
        <span className="dq__icon">{icon}</span>
        <span className="dq__title">{title}</span>
        <span className={`dq__status ${saved ? 'dq__status--saved' : ''} ${todayValue !== undefined ? 'dq__status--done' : ''}`}>{status}</span>
        {action}
      </div>
      <Stepper name={title} value={value} onChange={setDraft} step={step} decimals={decimals} min={min} max={max} unit={unit} size="md" disabled={!loaded} />
    </div>
  )
}

/** 睡眠時間・歩数の手入力。前回値がプリセットされた ± 入力で、変更すると自動で今日の記録として保存する */
export function DailyQuick() {
  const today = useToday()
  const [detailOpen, setDetailOpen] = useState(false)
  // スコアの表示専用（Stepper は睡眠詳細シート側）。同じフックで今日の値を購読するだけなので保存は発生しない
  const { todayValue: todayScore } = useMetricDraft('sleepScore', today, DEFAULT_SLEEP_SCORE)
  const sleepExtraStatus = todayScore !== undefined ? `· スコア ${todayScore}` : undefined

  return (
    <Card className="dq">
      <MetricBlock
        field="sleepHours"
        title="睡眠"
        icon={<Moon size={16} aria-hidden />}
        step={SLEEP_STEP}
        decimals={1}
        min={SLEEP_MIN}
        max={SLEEP_MAX}
        unit="h"
        defaultValue={DEFAULT_SLEEP_HOURS}
        format={(v) => `${v.toFixed(1)}h`}
        extraStatus={sleepExtraStatus}
        action={
          <button type="button" className="dq__more" aria-label="睡眠の詳細を入力" onClick={() => setDetailOpen(true)}>
            詳細 <ChevronRight size={14} aria-hidden />
          </button>
        }
      />
      <MetricBlock
        field="steps"
        title="歩数"
        icon={<Footprints size={16} aria-hidden />}
        step={STEPS_STEP}
        decimals={0}
        min={STEPS_MIN}
        max={STEPS_MAX}
        unit="歩"
        defaultValue={DEFAULT_STEPS}
        format={(v) => `${v.toLocaleString('ja-JP')}歩`}
      />
      <SleepDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} date={today} />
    </Card>
  )
}
