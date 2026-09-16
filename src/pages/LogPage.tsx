import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { formatMonthDay, lastNDays } from '../lib/date'
import { useToday } from '../hooks/useToday'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, Section } from '../components/ui/Card'
import { Segmented } from '../components/ui/Field'
import { LineChart, type LinePoint } from '../components/charts/LineChart'
import { ActivityCalendar } from '../components/charts/ActivityCalendar'
import { WeightQuick } from '../features/weight/WeightQuick'
import { WeeklyReviewCard } from '../features/review/WeeklyReviewCard'
import './LogPage.css'

const MOVING_AVG_DAYS = 7
const RANGES = { 30: '30日', 90: '90日' } as const
type RangeKey = keyof typeof RANGES
const MAX_SESSIONS = 20

function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null)
    if (slice.length < 2) return null
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10
  })
}

export function LogPage() {
  const today = useToday()
  const [range, setRange] = useState<RangeKey>(30)
  const [metric, setMetric] = useState<'max' | 'total'>('max')
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').toArray(), [])
  const meals = useLiveQuery(() => db.meals.toArray(), [])
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [exerciseId, setExerciseId] = useState('')

  const weightPoints = useMemo<LinePoint[]>(() => {
    const map = new Map((weights ?? []).map((w) => [w.date, w.kg]))
    return lastNDays(range, today).map((d) => ({ x: d, y: map.get(d) ?? null }))
  }, [weights, range, today])
  const weightAvg = useMemo(() => movingAverage(weightPoints.map((p) => p.y), MOVING_AVG_DAYS), [weightPoints])

  const exerciseMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const workoutDays = useMemo(() => new Set((workouts ?? []).map((w) => w.date)), [workouts])
  const mealDays = useMemo(() => new Set((meals ?? []).map((m) => m.date)), [meals])

  // 記録のある種目だけを選択肢にする
  const trackedExercises = useMemo(() => {
    const ids = new Set((sets ?? []).map((s) => s.exerciseId))
    return (exercises ?? []).filter((e) => ids.has(e.id))
  }, [sets, exercises])
  const selectedId = exerciseId || trackedExercises[0]?.id || ''
  const selected = trackedExercises.find((e) => e.id === selectedId)

  const progressPoints = useMemo<LinePoint[]>(() => {
    if (!selected || !sets || !workouts) return []
    const byWorkout = new Map<string, number[]>()
    for (const s of sets) {
      if (s.exerciseId !== selected.id) continue
      const v = selected.type === 'time' ? (s.seconds ?? 0) : (s.reps ?? 0)
      byWorkout.set(s.workoutId, [...(byWorkout.get(s.workoutId) ?? []), v])
    }
    return workouts
      .filter((w) => byWorkout.has(w.id))
      .slice(-MAX_SESSIONS)
      .map((w) => {
        const vals = byWorkout.get(w.id) ?? []
        return { x: w.date, y: metric === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) }
      })
  }, [selected, sets, workouts, metric])

  const weightDelta = useMemo(() => {
    const ys = weightPoints.map((p) => p.y).filter((y): y is number => y !== null)
    if (ys.length < 2) return null
    return Math.round((ys[ys.length - 1] - ys[0]) * 10) / 10
  }, [weightPoints])

  const unit = selected?.type === 'time' ? '秒' : '回'
  // n 日ごとに加えて最終点（今日）にも必ずラベルを出す
  const xLabelEvery = (n: number, total: number) => (x: string, i: number) => (i === total - 1 || (i % n === 0 && i < total - 1 - n / 2) ? formatMonthDay(x) : null)

  return (
    <div className="page lg">
      <PageHeader title="記録" />

      <WeightQuick />

      <Section title="週の振り返り">
        <WeeklyReviewCard today={today} workouts={workouts ?? []} sets={sets ?? []} meals={meals ?? []} weights={weights ?? []} exercises={exerciseMap} />
      </Section>

      <Section
        title="体重の推移"
        action={<Segmented value={String(range) as '30' | '90'} onChange={(v) => setRange(Number(v) as RangeKey)} options={[{ value: '30', label: RANGES[30] }, { value: '90', label: RANGES[90] }]} label="期間" />}
      >
        <Card>
          {weightDelta !== null && (
            <p className="lg__delta">
              期間内の変化 <span className={`num ${weightDelta < 0 ? 'lg__delta--down' : weightDelta > 0 ? 'lg__delta--up' : ''}`}>{weightDelta > 0 ? '+' : ''}{weightDelta} kg</span>
              <span className="faint"> · 点線は7日平均</span>
            </p>
          )}
          <LineChart points={weightPoints} secondary={weightAvg} unit="kg" ariaLabel={`直近${range}日の体重推移`} xLabel={xLabelEvery(range === 30 ? 7 : 21, weightPoints.length)} />
        </Card>
      </Section>

      <Section title="継続">
        <Card>
          <ActivityCalendar workoutDays={workoutDays} mealDays={mealDays} today={today} />
        </Card>
      </Section>

      <Section title="種目の伸び">
        {trackedExercises.length === 0 ? (
          <Card>
            <p className="muted lg__empty">ワークアウトを記録すると、種目ごとの伸びがここに出ます。</p>
          </Card>
        ) : (
          <Card className="stack">
            <div className="lg__controls">
              <select value={selectedId} onChange={(e) => setExerciseId(e.target.value)} aria-label="種目を選ぶ">
                {trackedExercises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <Segmented value={metric} onChange={setMetric} options={[{ value: 'max', label: `最大${unit}数` }, { value: 'total', label: `合計${unit}数` }]} label="指標" />
            </div>
            <LineChart points={progressPoints} unit={unit} ariaLabel={`${selected?.name ?? ''}の${metric === 'max' ? '最大' : '合計'}${unit}数の推移`} xLabel={(x, i) => (progressPoints.length <= 6 || i % Math.ceil(progressPoints.length / 5) === 0 ? formatMonthDay(x) : null)} zeroBased integerTicks />
          </Card>
        )}
      </Section>

    </div>
  )
}
