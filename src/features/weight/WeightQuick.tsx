import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Scale } from 'lucide-react'
import { db } from '../../db/db'
import { upsertWeight } from '../../db/repo'
import { formatRelative } from '../../lib/date'
import { useToday } from '../../hooks/useToday'
import { Stepper } from '../../components/ui/Stepper'
import { Card } from '../../components/ui/Card'
import './WeightQuick.css'

const SAVE_DEBOUNCE_MS = 500
const DEFAULT_WEIGHT = 60
const STEP = 0.1
const MIN = 20
const MAX = 300

interface WeightQuickProps {
  compact?: boolean
}

/** 前回の体重がプリセットされた ± 入力。変更すると自動で今日の記録として保存する */
export function WeightQuick({ compact = false }: WeightQuickProps) {
  const today = useToday()
  const latest = useLiveQuery(async () => (await db.weights.orderBy('date').reverse().first()) ?? null, [])
  const todayEntry = useLiveQuery(() => db.weights.where('date').equals(today).first(), [today])
  const [draft, setDraft] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | null>(null)

  const base = todayEntry?.kg ?? latest?.kg ?? DEFAULT_WEIGHT
  const value = draft ?? base
  const loaded = latest !== undefined

  useEffect(() => {
    if (draft === null) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void upsertWeight(draft, today).then(() => {
        setSaved(true)
        // 保存中にさらに操作していたら、その値を残す
        setDraft((cur) => (cur === draft ? null : cur))
      })
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [draft, today])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), 1800)
    return () => window.clearTimeout(id)
  }, [saved])

  const status = todayEntry
    ? saved
      ? '保存しました'
      : '今日の記録済み'
    : latest
      ? `前回 ${formatRelative(latest.date)} · ${latest.kg.toFixed(1)}kg`
      : 'まだ記録がありません'

  return (
    <Card className={`wq ${compact ? 'wq--compact' : ''}`}>
      <div className="wq__head">
        <span className="wq__icon">
          <Scale size={16} aria-hidden />
        </span>
        <span className="wq__title">体重</span>
        <span className={`wq__status ${saved ? 'wq__status--saved' : ''} ${todayEntry ? 'wq__status--done' : ''}`}>{status}</span>
      </div>
      <Stepper
        name="体重"
        value={value}
        onChange={setDraft}
        step={STEP}
        decimals={1}
        min={MIN}
        max={MAX}
        unit="kg"
        size={compact ? 'md' : 'lg'}
        disabled={!loaded}
      />
    </Card>
  )
}
