import { addDays, fromDateKey } from '../../lib/date'
import './ActivityCalendar.css'

const DAYS_PER_WEEK = 7
const WEEKS = 12
const WEEKDAY_LABELS = ['', '月', '', '水', '', '金', '']

interface ActivityCalendarProps {
  /** ワークアウトした日付キーの集合 */
  workoutDays: Set<string>
  /** 食事を記録した日付キーの集合 */
  mealDays: Set<string>
  /** 今日の日付キー */
  today: string
}

/** 直近12週間の記録ヒートマップ（GitHub風） */
export function ActivityCalendar({ workoutDays, mealDays, today }: ActivityCalendarProps) {
  const todayDow = fromDateKey(today).getDay()
  // 今週の日曜から遡って WEEKS 週分
  const start = addDays(today, -(todayDow + DAYS_PER_WEEK * (WEEKS - 1)))
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, d) => addDays(start, w * DAYS_PER_WEEK + d)),
  )
  const monthLabels = weeks.map((week, i) => {
    const first = fromDateKey(week[0])
    const prev = i > 0 ? fromDateKey(weeks[i - 1][0]) : null
    const isMonthStart = !prev || prev.getMonth() !== first.getMonth()
    if (!isMonthStart) return ''
    // 次の月ラベルが 2 列以内に来るなら省略して重なりを避ける
    const next = weeks[i + 1] ? fromDateKey(weeks[i + 1][0]) : null
    if (i === 0 && next && next.getMonth() !== first.getMonth()) return ''
    return `${first.getMonth() + 1}月`
  })

  return (
    <div className="acal" role="img" aria-label="直近12週間の記録カレンダー">
      <div className="acal__months">
        {monthLabels.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
      </div>
      <div className="acal__body">
        <div className="acal__weekdays">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="acal__grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="acal__week">
              {week.map((day) => {
                const future = day > today
                const w = workoutDays.has(day)
                const m = mealDays.has(day)
                const cls = future
                  ? 'acal__cell--future'
                  : w && m
                    ? 'acal__cell--both'
                    : w
                      ? 'acal__cell--workout'
                      : m
                        ? 'acal__cell--meal'
                        : ''
                return <span key={day} className={`acal__cell ${cls} ${day === today ? 'acal__cell--today' : ''}`} title={day} />
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="acal__legend">
        <span className="acal__cell acal__cell--workout" /> 筋トレ
        <span className="acal__cell acal__cell--meal" /> 食事
        <span className="acal__cell acal__cell--both" /> 両方
      </div>
    </div>
  )
}
