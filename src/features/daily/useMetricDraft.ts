import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getLatestDailyMetric, upsertDailyMetric, type DailyMetricField } from '../../db/repo'
import { formatRelative } from '../../lib/date'
import type { DailyMetric } from '../../types'

export const SAVE_DEBOUNCE_MS = 500
export const SAVED_FLASH_MS = 1800

export interface MetricDraft {
  value: number
  setDraft: (v: number) => void
  loaded: boolean
  todayValue: number | undefined
  latest: DailyMetric | null | undefined
  saved: boolean
}

/** 日次コンディション1項目の「プリセット + 下書き + デバウンス自動保存」（DailyQuick・睡眠詳細シートで共通） */
export function useMetricDraft(field: DailyMetricField, date: string, defaultValue: number): MetricDraft {
  const todayEntry = useLiveQuery(() => db.dailyMetrics.where('date').equals(date).first(), [date])
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
      void upsertDailyMetric(field, draft, date).then(() => {
        setSaved(true)
        // 保存中にさらに操作していたら、その値を残す
        setDraft((cur) => (cur === draft ? null : cur))
      })
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [draft, date, field])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), SAVED_FLASH_MS)
    return () => window.clearTimeout(id)
  }, [saved])

  return { value, setDraft, loaded, todayValue, latest, saved }
}

/** ± 入力の status 表示文言（DailyQuick・睡眠詳細シートで共通）。extra は保存直後を除いて末尾に付け足す（例: '· スコア 82'。スコアだけ記録した日も出す） */
export function metricStatusText(
  todayValue: number | undefined,
  saved: boolean,
  latest: DailyMetric | null | undefined,
  latestValue: number | undefined,
  format: (value: number) => string,
  extra?: string,
): string {
  if (todayValue !== undefined && saved) return '保存しました'
  const base =
    todayValue !== undefined ? '今日の記録済み' : latest && latestValue !== undefined ? `前回 ${formatRelative(latest.date)} · ${format(latestValue)}` : 'まだ記録がありません'
  return extra ? `${base} ${extra}` : base
}
