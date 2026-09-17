import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Footprints, Moon } from 'lucide-react'
import { db } from '../../db/db'
import { getLatestDailyMetric, upsertDailyMetric, type DailyMetricField } from '../../db/repo'
import { formatRelative } from '../../lib/date'
import { useToday } from '../../hooks/useToday'
import { Stepper } from '../../components/ui/Stepper'
import { Card } from '../../components/ui/Card'
import './DailyQuick.css'

const SAVE_DEBOUNCE_MS = 500
const SAVED_FLASH_MS = 1800

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
}

/** 睡眠・歩数で共通の ± 入力ブロック。前回値がプリセットされ、変更すると自動で今日の記録として保存する */
function MetricBlock({ field, title, icon, step, decimals, min, max, unit, defaultValue, format }: MetricBlockProps) {
  const today = useToday()
  const todayEntry = useLiveQuery(() => db.dailyMetrics.where('date').equals(today).first(), [today])
  const latest = useLiveQuery(async () => (await getLatestDailyMetric(field)) ?? null, [field])
  const [draft, setDraft] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | null>(null)

  const todayValue = todayEntry?.[field]
  const latestValue = latest?.[field]
  const base = todayValue ?? latestValue ?? defaultValue
  const value = draft ?? base
  const loaded = latest !== undefined

  useEffect(() => {
    if (draft === null) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void upsertDailyMetric(field, draft, today).then(() => {
        setSaved(true)
        // 保存中にさらに操作していたら、その値を残す
        setDraft((cur) => (cur === draft ? null : cur))
      })
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [draft, today, field])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), SAVED_FLASH_MS)
    return () => window.clearTimeout(id)
  }, [saved])

  const status =
    todayValue !== undefined
      ? saved
        ? '保存しました'
        : '今日の記録済み'
      : latest && latestValue !== undefined
        ? `前回 ${formatRelative(latest.date)} · ${format(latestValue)}`
        : 'まだ記録がありません'

  return (
    <div className="dq__block">
      <div className="dq__head">
        <span className="dq__icon">{icon}</span>
        <span className="dq__title">{title}</span>
        <span className={`dq__status ${saved ? 'dq__status--saved' : ''} ${todayValue !== undefined ? 'dq__status--done' : ''}`}>{status}</span>
      </div>
      <Stepper name={title} value={value} onChange={setDraft} step={step} decimals={decimals} min={min} max={max} unit={unit} size="md" disabled={!loaded} />
    </div>
  )
}

/** 睡眠時間・歩数の手入力。前回値がプリセットされた ± 入力で、変更すると自動で今日の記録として保存する */
export function DailyQuick() {
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
    </Card>
  )
}
