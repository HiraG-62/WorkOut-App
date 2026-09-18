import { useEffect, useState } from 'react'
import { msUntilNextDayStart, todayKey } from '../lib/date'

const MS_PER_MINUTE = 60_000

function msUntilNextSwitch(): number {
  return Math.max(MS_PER_MINUTE, msUntilNextDayStart())
}

/**
 * 今日の日付キー（DAY_START_HOUR 時で切り替わる）。
 * 画面を開いたまま日付をまたいでも（PWA のサスペンド復帰を含め）追従する。
 */
export function useToday(): string {
  const [today, setToday] = useState(() => todayKey())

  useEffect(() => {
    const refresh = () => setToday((prev) => (prev === todayKey() ? prev : todayKey()))
    let timer = window.setTimeout(function tick() {
      refresh()
      timer = window.setTimeout(tick, msUntilNextSwitch())
    }, msUntilNextSwitch())
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
