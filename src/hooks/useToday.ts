import { useEffect, useState } from 'react'
import { todayKey } from '../lib/date'

const MS_PER_MINUTE = 60_000

function msUntilNextMidnight(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
  return Math.max(MS_PER_MINUTE, next.getTime() - now.getTime())
}

/**
 * 今日の日付キー。画面を開いたまま日付をまたいでも（PWA のサスペンド復帰を含め）追従する。
 */
export function useToday(): string {
  const [today, setToday] = useState(() => todayKey())

  useEffect(() => {
    const refresh = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()))
    let timer = window.setTimeout(function tick() {
      refresh()
      timer = window.setTimeout(tick, msUntilNextMidnight())
    }, msUntilNextMidnight())
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
