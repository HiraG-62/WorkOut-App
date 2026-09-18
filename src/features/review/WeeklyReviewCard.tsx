import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Flame, RefreshCw, Sparkles, X } from 'lucide-react'
import { db } from '../../db/db'
import { deleteWeeklyReview, putWeeklyReview, updateSettings } from '../../db/repo'
import { createAiClient, AiError, isAiConfigured } from '../../lib/ai'
import { addDays, formatMonthDay } from '../../lib/date'
import { clampTargets } from '../../lib/nutrition'
import { achievementRate, DAYS_PER_WEEK, summarizeWeek, weekStartOf, type WeekStats } from '../../lib/weekly'
import { useSettings } from '../../hooks/useSettings'
import { useBusy } from '../../hooks/useBusy'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { AI_PROVIDERS, type DailyMetric, type Exercise, type MealEntry, type WeeklyReview, type WeightEntry, type Workout, type WorkoutSet } from '../../types'
import { useWeightKg } from '../workout/useDayBurn'
import './WeeklyReviewCard.css'

const AI_TIMEOUT_MS = 60_000
const UNDO_MS = 6000

interface WeeklyReviewCardProps {
  today: string
  workouts: Workout[]
  sets: WorkoutSet[]
  meals: MealEntry[]
  weights: WeightEntry[]
  metrics: DailyMetric[]
  exercises: Map<string, Exercise>
}

function signed(n: number, unit = ''): string {
  if (n === 0) return `±0${unit}`
  return `${n > 0 ? '+' : ''}${n}${unit}`
}

function weekLabel(weekStart: string, today: string): string {
  const thisWeek = weekStartOf(today)
  if (weekStart === thisWeek) return '今週'
  if (weekStart === addDays(thisWeek, -DAYS_PER_WEEK)) return '先週'
  return `${formatMonthDay(weekStart)}の週`
}

/** 1週間の筋トレ・食事・体重の集計と、AI の一言 */
export function WeeklyReviewCard({ today, workouts, sets, meals, weights, metrics, exercises }: WeeklyReviewCardProps) {
  const settings = useSettings()
  const weightKg = useWeightKg()
  const toast = useToast()
  const guard = useBusy()
  const abortRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)
  const unmountedRef = useRef(false)
  const [offsetWeeks, setOffsetWeeks] = useState(0)
  const [busy, setBusy] = useState(false)

  // 画面を離れたら進行中の呼び出しを止める（トーストも出さない）
  useEffect(
    () => () => {
      unmountedRef.current = true
      cancelledRef.current = true
      abortRef.current?.abort()
    },
    [],
  )

  const weekStart = addDays(weekStartOf(today), -offsetWeeks * DAYS_PER_WEEK)
  const prevStart = addDays(weekStart, -DAYS_PER_WEEK)
  const isThisWeek = offsetWeeks === 0
  const review = useLiveQuery(async () => (await db.weeklyReviews.get(weekStart)) ?? null, [weekStart])

  const base = useMemo(
    () => ({ today, workouts, sets, meals, weights, metrics, exercises, weightKg }),
    [today, workouts, sets, meals, weights, metrics, exercises, weightKg],
  )
  const current = useMemo<WeekStats>(() => summarizeWeek({ ...base, weekStart }), [base, weekStart])
  const previous = useMemo<WeekStats | null>(() => {
    const p = summarizeWeek({ ...base, weekStart: prevStart })
    return p.workoutDays === 0 && p.intake.days === 0 && p.weightAvg === null && p.sleepAvg === null && p.sleepScoreAvg === null && p.stepsAvg === null ? null : p
  }, [base, prevStart])

  const hasAny =
    current.workoutDays > 0 || current.intake.days > 0 || current.weightAvg !== null || current.sleepAvg !== null || current.sleepScoreAvg !== null || current.stepsAvg !== null
  const aiReady = isAiConfigured(settings.ai)
  const providerLabel = AI_PROVIDERS[settings.ai.provider].label
  const kcalRate = achievementRate(current.intake.kcal, settings.targets.kcal)
  const proteinRate = achievementRate(current.intake.protein, settings.targets.protein)
  const weightDelta = current.weightAvg !== null && previous?.weightAvg != null ? Math.round((current.weightAvg - previous.weightAvg) * 10) / 10 : null
  const sleepDelta = current.sleepAvg !== null && previous?.sleepAvg != null ? Math.round((current.sleepAvg - previous.sleepAvg) * 10) / 10 : null
  const stepsDelta = current.stepsAvg !== null && previous?.stepsAvg != null ? current.stepsAvg - previous.stepsAvg : null

  const ask = () =>
    guard(async () => {
      const client = await createAiClient(settings.ai)
      if (!client) {
        toast.show('設定画面で AI の API キーを登録してください', 'error')
        return
      }
      const controller = new AbortController()
      abortRef.current = controller
      cancelledRef.current = false
      const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
      setBusy(true)
      try {
        const res = await client.reviewWeek({ profile: settings.profile, weightKg, targets: settings.targets, current, previous }, controller.signal)
        await putWeeklyReview({
          id: weekStart,
          summary: res.summary,
          advice: res.advice,
          suggestedTargets: res.changeTargets ? clampTargets(res.suggestedTargets) : undefined,
          provider: settings.ai.provider,
          createdAt: Date.now(),
        })
      } catch (e) {
        if (unmountedRef.current) return
        if (cancelledRef.current) {
          toast.show('中断しました', 'info')
        } else {
          toast.show(controller.signal.aborted ? '時間がかかりすぎたため中断しました' : e instanceof AiError ? e.message : 'AI の呼び出しに失敗しました', 'error')
        }
      } finally {
        window.clearTimeout(timeout)
        abortRef.current = null
        setBusy(false)
      }
    })

  const cancel = () => {
    cancelledRef.current = true
    abortRef.current?.abort()
  }

  const applyTargets = async (r: WeeklyReview) => {
    if (!r.suggestedTargets) return
    const before = settings.targets
    await updateSettings({ targets: clampTargets(r.suggestedTargets) })
    await putWeeklyReview({ ...r, suggestedTargets: undefined })
    toast.show(
      '目標に反映しました',
      'success',
      {
        label: '元に戻す',
        onClick: () => {
          void updateSettings({ targets: before })
          // 猶予中に「もう一度」で作り直していたら、古いレビューで上書きしない
          void db.weeklyReviews.get(r.id).then((now) => {
            if (!now || now.createdAt === r.createdAt) void putWeeklyReview(r)
          })
        },
      },
      UNDO_MS,
    )
  }

  const remove = async (r: WeeklyReview) => {
    await deleteWeeklyReview(r.id)
    toast.show('AI の一言を消しました', 'info', { label: '元に戻す', onClick: () => void putWeeklyReview(r) }, UNDO_MS)
  }

  const rangeText = `${formatMonthDay(weekStart)}〜${formatMonthDay(current.weekEnd)}`

  return (
    <Card className="wr">
      <div className="wr__nav">
        <button type="button" className="wr__nav-btn" onClick={() => setOffsetWeeks((o) => o + 1)} aria-label="前の週">
          <ChevronLeft size={20} aria-hidden />
        </button>
        {isThisWeek ? (
          <span className="wr__range">
            <span className="wr__range-label">{weekLabel(weekStart, today)}</span>
            <span className="faint">{rangeText}</span>
          </span>
        ) : (
          <button type="button" className="wr__range wr__range--btn" onClick={() => setOffsetWeeks(0)} aria-label="今週に戻る">
            <span className="wr__range-label">{weekLabel(weekStart, today)}</span>
            <span className="faint">{rangeText} · 今週へ</span>
          </button>
        )}
        <button type="button" className="wr__nav-btn" onClick={() => setOffsetWeeks((o) => Math.max(0, o - 1))} disabled={isThisWeek} aria-label="次の週">
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {!hasAny ? (
        <p className="muted wr__empty">この週の記録はまだありません。</p>
      ) : (
        <dl className="wr__stats">
          <div className="wr__stat">
            <dt>筋トレ</dt>
            <dd>
              <span className="wr__value">
                <span className="display wr__big">{current.workoutDays}</span>日
              </span>
              <span className="wr__sub">
                {current.totalSets}セット
                {previous && <span className="wr__delta"> {signed(current.workoutDays - previous.workoutDays, '日')}</span>}
              </span>
              {current.burnKcal > 0 && (
                <span className="wr__sub wr__burn">
                  <Flame size={12} aria-hidden />約{current.burnKcal}kcal
                </span>
              )}
            </dd>
          </div>
          <div className="wr__stat">
            <dt>食事{current.intake.days > 0 && <span className="wr__dt-note"> · {current.intake.days}日平均</span>}</dt>
            <dd>
              {current.intake.days === 0 ? (
                <span className="wr__sub">記録なし</span>
              ) : (
                <>
                  <span className="wr__value">
                    <span className="display wr__big">{current.intake.kcal}</span>kcal
                  </span>
                  <span className="wr__sub">
                    <span style={{ color: 'var(--protein)' }}>P{current.intake.protein}</span> <span style={{ color: 'var(--fat)' }}>F{current.intake.fat}</span>{' '}
                    <span style={{ color: 'var(--carbs)' }}>C{current.intake.carbs}</span>
                  </span>
                  <span className="wr__sub">
                    目標 {kcalRate ?? '–'}% · P{proteinRate ?? '–'}%
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="wr__stat">
            <dt>体重</dt>
            <dd>
              {current.weightAvg === null ? (
                <span className="wr__sub">記録なし</span>
              ) : (
                <>
                  <span className="wr__value">
                    <span className="display wr__big">{current.weightAvg}</span>kg
                  </span>
                  <span className="wr__sub">
                    週平均
                    {weightDelta !== null && <span className="wr__delta"> {signed(weightDelta, 'kg')}</span>}
                  </span>
                </>
              )}
            </dd>
          </div>
          <div className="wr__stat">
            <dt>睡眠</dt>
            <dd>
              {current.sleepAvg === null && current.sleepScoreAvg === null ? (
                <span className="wr__sub">記録なし</span>
              ) : (
                <>
                  {current.sleepAvg !== null && (
                    <>
                      <span className="wr__value">
                        <span className="display wr__big">{current.sleepAvg}</span>h
                      </span>
                      <span className="wr__sub">
                        週平均
                        {sleepDelta !== null && <span className="wr__delta"> {signed(sleepDelta, 'h')}</span>}
                      </span>
                    </>
                  )}
                  {/* スコアだけ記録した週は時間の代わりにスコアを大きく出す */}
                  {current.sleepScoreAvg !== null &&
                    (current.sleepAvg === null ? (
                      <>
                        <span className="wr__value">
                          <span className="display wr__big">{current.sleepScoreAvg}</span>
                        </span>
                        <span className="wr__sub">週平均スコア</span>
                      </>
                    ) : (
                      <span className="wr__sub">スコア {current.sleepScoreAvg}</span>
                    ))}
                </>
              )}
            </dd>
          </div>
          <div className="wr__stat">
            <dt>歩数</dt>
            <dd>
              {current.stepsAvg === null ? (
                <span className="wr__sub">記録なし</span>
              ) : (
                <>
                  <span className="wr__value">
                    <span className="display wr__big wr__big--sm">{current.stepsAvg.toLocaleString('ja-JP')}</span>歩
                  </span>
                  <span className="wr__sub">
                    週平均
                    {stepsDelta !== null && <span className="wr__delta"> {signed(stepsDelta, '歩')}</span>}
                  </span>
                </>
              )}
            </dd>
          </div>
        </dl>
      )}

      {review ? (
        <div className="wr__ai">
          <p className="wr__summary">{review.summary}</p>
          <p className="wr__advice">
            <Sparkles size={14} aria-hidden />
            <span>{review.advice}</span>
          </p>
          {review.suggestedTargets && (
            <div className="wr__targets">
              <span className="wr__targets-text">
                目標の提案: <span className="wr__targets-old">{settings.targets.kcal}</span> → {review.suggestedTargets.kcal}kcal · P{review.suggestedTargets.protein} F{review.suggestedTargets.fat} C
                {review.suggestedTargets.carbs}
              </span>
              <Button size="sm" variant="accent-soft" onClick={() => void applyTargets(review)}>
                目標に反映
              </Button>
            </div>
          )}
          <div className="wr__ai-foot">
            <span className="faint">{AI_PROVIDERS[review.provider].label}</span>
            {busy ? (
              <Button size="sm" variant="ghost" icon={<X size={14} aria-hidden />} onClick={cancel}>
                キャンセル
              </Button>
            ) : (
              <Button size="sm" variant="ghost" icon={<RefreshCw size={14} aria-hidden />} onClick={() => void ask()} disabled={!aiReady}>
                もう一度
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void remove(review)} disabled={busy}>
              消す
            </Button>
          </div>
        </div>
      ) : (
        hasAny && (
          <div className="wr__ask">
            {busy ? (
              <Button variant="secondary" block icon={<X size={18} aria-hidden />} onClick={cancel}>
                考え中… キャンセル
              </Button>
            ) : (
              <Button variant="accent-soft" block icon={<Sparkles size={18} aria-hidden />} onClick={() => void ask()} disabled={!aiReady}>
                {providerLabel} に{isThisWeek ? '来週の一言' : '振り返り'}をもらう
              </Button>
            )}
            {!aiReady && <p className="faint wr__note">設定で AI の API キーを登録すると使えます</p>}
          </div>
        )
      )}
    </Card>
  )
}
