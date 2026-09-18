const MS_PER_DAY = 86_400_000
const MS_PER_HOUR = 3_600_000
/** 1 日の切り替わり時刻。深夜の記録は前日扱いにする */
export const DAY_START_HOUR = 4
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** ローカル日付を YYYY-MM-DD にする */
export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 記録日の日付キー。DAY_START_HOUR 時より前はまだ前日として扱う
 * （例: 9/17 2:30 の記録は 9/16 に入る）
 */
export function recordDateKey(at: number | Date = Date.now()): string {
  const ts = typeof at === 'number' ? at : at.getTime()
  return toDateKey(new Date(ts - DAY_START_HOUR * MS_PER_HOUR))
}

export function todayKey(): string {
  return recordDateKey()
}

/** 次に日付が切り替わる時刻（DAY_START_HOUR 時）までのミリ秒 */
export function msUntilNextDayStart(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAY_START_HOUR, 0, 1)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromDateKey(a).getTime() - fromDateKey(b).getTime()) / MS_PER_DAY)
}

/** 例: 9/16 (火) */
export function formatShort(key: string): string {
  const d = fromDateKey(key)
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`
}

/** 例: 9/16 */
export function formatMonthDay(key: string): string {
  const d = fromDateKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 例: 9月16日 火曜日 */
export function formatLong(key: string): string {
  const d = fromDateKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}曜日`
}

/** 今日 / 昨日 / 9/14 (日) */
export function formatRelative(key: string): string {
  const diff = diffDays(todayKey(), key)
  if (diff === 0) return '今日'
  if (diff === 1) return '昨日'
  return formatShort(key)
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${pad(s)}`
}

/** 時間帯スロット [朝, 昼, 夜, 深夜] のインデックス */
export function timeSlot(d: Date = new Date()): 0 | 1 | 2 | 3 {
  const h = d.getHours()
  if (h >= 4 && h < 11) return 0
  if (h >= 11 && h < 16) return 1
  if (h >= 16 && h < 23) return 2
  return 3
}

export const TIME_SLOT_LABELS = ['朝', '昼', '夜', '深夜'] as const

/** 直近 n 日分の日付キー（古い順） */
export function lastNDays(n: number, end: string = todayKey()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)))
}
