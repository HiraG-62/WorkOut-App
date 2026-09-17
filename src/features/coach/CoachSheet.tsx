import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Dumbbell, History, Loader2, Send, Sparkles, Trash2, Utensils, X } from 'lucide-react'
import { db } from '../../db/db'
import {
  addExercise,
  addFood,
  addRoutine,
  deleteCoachThread,
  DEFAULT_PLAN_REPS,
  DEFAULT_PLAN_SECONDS,
  getLatestWeight,
  logFood,
  pruneCoachThreads,
  putCoachThread,
} from '../../db/repo'
import { createAiClient, AiError } from '../../lib/ai'
import { buildCoachContext, COACH_DAYS, COACH_WEIGHT_DAYS } from '../../lib/coachContext'
import { FALLBACK_WEIGHT_KG } from '../../lib/calories'
import { addDays, formatMonthDay, formatRelative, toDateKey } from '../../lib/date'
import { fmt1 } from '../../lib/nutrition'
import { newId } from '../../lib/id'
import { useSettings } from '../../hooks/useSettings'
import { useToday } from '../../hooks/useToday'
import { useBusy } from '../../hooks/useBusy'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { findExerciseByName, normalizeName } from '../routine/routineUtils'
import { AI_PROVIDERS, type CoachAnswer, type CoachMealIdea, type CoachThread, type CoachTurn, type Food, type RoutineItem, type Settings } from '../../types'
import './CoachSheet.css'

const AI_TIMEOUT_MS = 90_000
const UNDO_MS = 6000
/** スレッド名に使う質問の文字数 */
const TITLE_MAX = 30
/** メニュー名の最大文字数 */
const ROUTINE_NAME_MAX = 20
/** 入力欄の最大高さ（およそ 4 行） */
const INPUT_MAX_HEIGHT_PX = 104
const DEFAULT_UNIT = '1人前'
const DEFAULT_ROUTINE_NAME = 'AI のメニュー'
// AI が返しすぎても表示と登録が崩れないよう、受け取り側で件数を絞る
const MAX_ADVICE = 4
const MAX_MEAL_IDEAS = 4
const MAX_FOLLOW_UPS = 3
const MAX_WORKOUT_ITEMS = 12
/** 新規スレッドで出す定型の相談 */
const STARTERS = ['簡単でバランスの良い献立', 'タンパク質をもっと取りたい', '今の筋トレ頻度は適切？', '停滞を抜けたい'] as const

interface CoachSheetProps {
  open: boolean
  onClose: () => void
  /** 続きを開くスレッド。null なら新規 */
  threadId?: string | null
  /** 料理の提案を記録する日 */
  date: string
  /** 入口ごとの定型文を入力欄に入れておく */
  initialQuestion?: string
}

/** 送信時に Dexie から集めて「今の状況」テキストを作る */
async function collectContext(today: string, settings: Settings): Promise<string> {
  const from = addDays(today, -(COACH_DAYS - 1))
  const weightFrom = addDays(today, -(COACH_WEIGHT_DAYS - 1))
  const [meals, foods, workouts, weights, metrics, exerciseList, routines, latestWeight] = await Promise.all([
    db.meals.where('date').between(from, today, true, true).toArray(),
    db.foods.filter((f) => !f.archived).toArray(),
    db.workouts.where('date').between(from, today, true, true).toArray(),
    db.weights.where('date').between(weightFrom, today, true, true).toArray(),
    db.dailyMetrics.where('date').between(from, today, true, true).toArray(),
    db.exercises.toArray(),
    db.routines.toArray(),
    getLatestWeight(),
  ])
  const sets = workouts.length === 0 ? [] : await db.sets.where('workoutId').anyOf(workouts.map((w) => w.id)).toArray()
  return buildCoachContext({
    today,
    profile: settings.profile,
    targets: settings.targets,
    weightKg: latestWeight?.kg ?? FALLBACK_WEIGHT_KG,
    meals,
    foods,
    workouts,
    sets,
    exercises: new Map(exerciseList.map((e) => [e.id, e])),
    routines,
    weights,
    metrics,
  })
}

/** 会話ログに残す表示用テキスト */
function answerText(answer: CoachAnswer): string {
  return [answer.summary, ...answer.advice.slice(0, MAX_ADVICE)].join('\n')
}

// AI が負の値を返しても 1 件で回答全体が使えなくならないよう、表示・登録の両方で 0 以上に丸める
function toKcal(n: number): number {
  return Math.max(0, Math.round(n))
}

function toMacro(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10)
}

/** AI コーチに相談するシート。実データを添えて質問し、提案をそのまま登録できる */
export function CoachSheet({ open, onClose, threadId = null, date, initialQuestion }: CoachSheetProps) {
  const settings = useSettings()
  const today = useToday()
  const toast = useToast()
  const guard = useBusy()
  const abortRef = useRef<AbortController | null>(null)
  const timedOutRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [activeId, setActiveId] = useState<string | null>(threadId)
  const [input, setInput] = useState(initialQuestion ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** 送信中・失敗中の質問（まだ保存していないユーザーのターン） */
  const [pending, setPending] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  // 開き直したら状態を作り直す（effect ではなくレンダー中に調整する）
  const openKey = open ? `${threadId ?? ''}` : null
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(openKey)
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (open) {
      setActiveId(threadId)
      setInput(initialQuestion ?? '')
      setBusy(false)
      setError('')
      setPending(null)
      setHistoryOpen(false)
    }
  }

  // 閉じている間は一覧を購読しない
  const threads = useLiveQuery(() => (open ? db.coachThreads.orderBy('updatedAt').reverse().toArray() : []), [open]) ?? []
  const thread = useLiveQuery(async () => (activeId ? ((await db.coachThreads.get(activeId)) ?? null) : null), [activeId]) ?? null
  const turns: CoachTurn[] = thread?.turns ?? []

  // 閉じたら進行中の呼び出しを打ち切る（遅れて届いた回答が次回に混ざらないように）
  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
  }, [open])

  // 入力量に合わせて 1〜4 行で伸ばす
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`
  }, [input, open])

  // 新しいやり取りが増えたら末尾へ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [turns.length, pending, busy])

  const send = (question: string) =>
    guard(async () => {
      const q = question.trim()
      if (!q || busy) return
      const client = await createAiClient(settings.ai)
      if (!client) {
        setError('設定画面で AI の API キーを登録してください')
        return
      }
      const base = thread
      const history = (base?.turns ?? []).map((t) => ({ role: t.role, text: t.text }))
      setInput('')
      setPending(q)
      setError('')
      const controller = new AbortController()
      abortRef.current = controller
      timedOutRef.current = false
      const timeout = window.setTimeout(() => {
        timedOutRef.current = true
        controller.abort()
      }, AI_TIMEOUT_MS)
      setBusy(true)
      try {
        // 集計はいつも「今日」まで。記録先の日付（date）とは分ける
        const context = await collectContext(today, settings)
        const answer = await client.askCoach({ context, history, question: q }, controller.signal)
        if (controller.signal.aborted) return
        const now = Date.now()
        const userTurn: CoachTurn = { role: 'user', text: q, createdAt: now }
        const coachTurn: CoachTurn = { role: 'coach', text: answerText(answer), answer, createdAt: now }
        // 待っている間に登録などでスレッドが書き換わっていても取りこぼさないよう、最新を読み直して追記する
        const savedId = await db.transaction('rw', db.coachThreads, async () => {
          const id = base?.id ?? newId()
          const current = await db.coachThreads.get(id)
          const next: CoachThread = current
            ? { ...current, turns: [...current.turns, userTurn, coachTurn], provider: settings.ai.provider, updatedAt: now }
            : { id, title: q.slice(0, TITLE_MAX), turns: [userTurn, coachTurn], provider: settings.ai.provider, createdAt: now, updatedAt: now }
          await putCoachThread(next)
          return id
        })
        await pruneCoachThreads()
        setActiveId(savedId)
        setPending(null)
      } catch (err) {
        if (controller.signal.aborted && abortRef.current !== controller) return
        if (timedOutRef.current) {
          toast.show('時間がかかりすぎたため中断しました', 'error')
        } else if (!controller.signal.aborted) {
          // 手動キャンセルは無言で、質問だけ残して「もう一度」を出す
          setError(err instanceof AiError ? err.message : 'AI の呼び出しに失敗しました')
        }
      } finally {
        window.clearTimeout(timeout)
        abortRef.current = null
        setBusy(false)
      }
    }, 'send')

  const cancel = () => abortRef.current?.abort()

  /** 登録した結果（foodId / routineId）をターンに書き戻して保存する */
  const updateAnswer = async (turnIndex: number, patch: (a: CoachAnswer) => CoachAnswer): Promise<void> => {
    if (!activeId) return
    // 送信の追記と競合しないよう、読み直してから書き戻す
    await db.transaction('rw', db.coachThreads, async () => {
      const current = await db.coachThreads.get(activeId)
      if (!current) return
      const turns = current.turns.map((t, i) => (i === turnIndex && t.answer ? { ...t, answer: patch(t.answer) } : t))
      await putCoachThread({ ...current, turns })
    })
  }

  const registerMeal = (turnIndex: number, ideaIndex: number, idea: CoachMealIdea, log: boolean) =>
    guard(async () => {
      const name = idea.name.trim()
      // 同じ提案を開き直したときに同名フードが増えないよう、生きている既存フードがあれば使い回す
      const existing: Food | undefined = (await db.foods.where('name').equals(name).toArray()).find((f) => !f.archived)
      const food =
        existing ??
        (await addFood({
          name,
          unitLabel: idea.unitLabel.trim() || DEFAULT_UNIT,
          kcal: toKcal(idea.kcal),
          protein: toMacro(idea.protein),
          fat: toMacro(idea.fat),
          carbs: toMacro(idea.carbs),
          source: 'ai',
        }))
      if (log) await logFood(food, 1, date)
      await updateAnswer(turnIndex, (a) => ({
        ...a,
        mealIdeas: a.mealIdeas.map((m, i) => (i === ideaIndex ? { ...m, foodId: food.id } : m)),
      }))
      // 使い回したときは、新しく作っていないことが分かる文言にする
      const message = existing
        ? log
          ? `既にある「${food.name}」で記録しました`
          : `既にある「${food.name}」を使います`
        : log
          ? `「${food.name}」を記録しました`
          : `「${food.name}」をフードに登録しました`
      toast.show(message, 'success')
    }, `meal-${turnIndex}-${ideaIndex}`)

  const saveWorkoutIdea = (turnIndex: number, idea: CoachAnswer['workoutIdea']) =>
    guard(async () => {
      const exercises = await db.exercises.toArray()
      const items: RoutineItem[] = []
      const seen = new Set<string>()
      /** 同じ提案内で同名の未登録種目が複数回出ても、作るのは 1 つ */
      const createdByName = new Map<string, string>()
      for (const it of idea.items.slice(0, MAX_WORKOUT_ITEMS)) {
        const nameKey = normalizeName(it.name)
        let exerciseId = createdByName.get(nameKey) ?? findExerciseByName(it.name, exercises)?.id
        if (!exerciseId) {
          const ex = await addExercise({
            name: it.name,
            type: it.type,
            bodyPart: it.bodyPart,
            useWeight: it.useWeight,
            formFamily: it.formFamily === 'none' ? undefined : it.formFamily,
            met: it.met,
          })
          exercises.push(ex)
          createdByName.set(nameKey, ex.id)
          exerciseId = ex.id
        }
        // 同じ種目が複数回出てきたら最初のものにまとめる
        if (seen.has(exerciseId)) continue
        seen.add(exerciseId)
        const ex = exercises.find((e) => e.id === exerciseId)
        const isTime = ex ? ex.type === 'time' : it.type === 'time'
        items.push(
          isTime
            ? { exerciseId, sets: it.sets, seconds: it.seconds || it.reps || DEFAULT_PLAN_SECONDS }
            : { exerciseId, sets: it.sets, reps: it.reps || it.seconds || DEFAULT_PLAN_REPS },
        )
      }
      if (items.length === 0) {
        toast.show('保存できる種目がありませんでした', 'error')
        return
      }
      const name = (idea.name.trim() || DEFAULT_ROUTINE_NAME).slice(0, ROUTINE_NAME_MAX)
      const r = await addRoutine({ name, items, source: 'ai' })
      await updateAnswer(turnIndex, (a) => ({ ...a, workoutIdea: { ...a.workoutIdea, routineId: r.id } }))
      toast.show(`メニュー「${r.name}」を保存しました`, 'success')
    }, `workout-${turnIndex}`)

  const removeThread = (t: CoachThread) =>
    guard(async () => {
      // 表示中のスレッドだったかを覚えておき、取り消しでその会話に戻す
      const wasActive = activeId === t.id
      await deleteCoachThread(t.id)
      if (wasActive) setActiveId(null)
      toast.show(
        '相談を消しました',
        'info',
        {
          label: '元に戻す',
          onClick: () => {
            // 戻したものが一覧の先頭に来るよう、更新時刻を今にする
            void putCoachThread({ ...t, updatedAt: Date.now() })
            // 猶予中に別の相談を始めていたら、そちらの会話を残す
            if (wasActive) setActiveId((cur) => cur ?? t.id)
          },
        },
        UNDO_MS,
      )
    }, `del-${t.id}`)

  const openThread = (id: string | null) => {
    setActiveId(id)
    setPending(null)
    setError('')
    setHistoryOpen(false)
  }

  const providerLabel = AI_PROVIDERS[settings.ai.provider].label
  const logLabel = date === today ? '登録して今日に記録' : `登録して${formatMonthDay(date)}に記録`
  const lastCoachIndex = turns.reduce((last, t, i) => (t.role === 'coach' ? i : last), -1)
  const isEmpty = turns.length === 0 && pending === null
  const canRetry = pending !== null && !busy

  const renderMealIdeas = (turnIndex: number, ideas: CoachMealIdea[]) => (
    <div className="co__ideas">
      <p className="co__idea-head">
        <Utensils size={14} aria-hidden />
        料理の提案
      </p>
      {ideas.slice(0, MAX_MEAL_IDEAS).map((idea, i) => (
        <div key={`${turnIndex}-${i}`} className="co__idea">
          <p className="co__idea-name">{idea.name}</p>
          <p className="co__idea-how">{idea.howTo}</p>
          <p className="co__idea-pfc num">
            {toKcal(idea.kcal)}kcal · <span style={{ color: 'var(--protein)' }}>P{fmt1(toMacro(idea.protein))}</span>{' '}
            <span style={{ color: 'var(--fat)' }}>F{fmt1(toMacro(idea.fat))}</span> <span style={{ color: 'var(--carbs)' }}>C{fmt1(toMacro(idea.carbs))}</span>
            <span className="faint"> / {idea.unitLabel.trim() || DEFAULT_UNIT}</span>
          </p>
          <p className="co__idea-reason">{idea.reason}</p>
          {idea.foodId ? (
            <p className="co__done">登録済み</p>
          ) : (
            <div className="co__idea-actions">
              <Button size="sm" onClick={() => void registerMeal(turnIndex, i, idea, false)} disabled={busy}>
                フードに登録
              </Button>
              <Button size="sm" variant="accent-soft" onClick={() => void registerMeal(turnIndex, i, idea, true)} disabled={busy}>
                {logLabel}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  const renderWorkoutIdea = (turnIndex: number, idea: CoachAnswer['workoutIdea']) => (
    <div className="co__workout">
      <p className="co__idea-head">
        <Dumbbell size={14} aria-hidden />
        筋トレメニューの提案
      </p>
      <p className="co__idea-name">{idea.name || DEFAULT_ROUTINE_NAME}</p>
      <ul className="co__items">
        {idea.items.slice(0, MAX_WORKOUT_ITEMS).map((it, i) => (
          <li key={`${it.name}-${i}`}>
            <span className="co__item-name">{it.name}</span>
            <span className="co__item-target num">
              {it.sets}×{it.type === 'time' ? `${it.seconds || it.reps}秒` : `${it.reps || it.seconds}回`}
            </span>
          </li>
        ))}
      </ul>
      {idea.routineId ? (
        <p className="co__done">保存済み</p>
      ) : (
        <Button size="sm" variant="accent-soft" onClick={() => void saveWorkoutIdea(turnIndex, idea)} disabled={busy}>
          メニューとして保存
        </Button>
      )}
    </div>
  )

  const renderCoachTurn = (turn: CoachTurn, i: number) => {
    const answer = turn.answer
    if (!answer) return <p className="co__summary">{turn.text}</p>
    return (
      <>
        <p className="co__summary">{answer.summary}</p>
        {answer.advice.length > 0 && (
          <ul className="co__advice">
            {answer.advice.slice(0, MAX_ADVICE).map((a, j) => (
              <li key={`${i}-advice-${j}`}>{a}</li>
            ))}
          </ul>
        )}
        {answer.mealIdeas.length > 0 && renderMealIdeas(i, answer.mealIdeas)}
        {answer.hasWorkoutIdea && answer.workoutIdea.items.length > 0 && renderWorkoutIdea(i, answer.workoutIdea)}
        {i === lastCoachIndex && answer.followUps.length > 0 && (
          <div className="co__chips">
            {answer.followUps.slice(0, MAX_FOLLOW_UPS).map((f, j) => (
              <button key={`${i}-follow-${j}`} type="button" className="co__chip" onClick={() => void send(f)} disabled={busy}>
                {f}
              </button>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="AI コーチ"
      tall
      footer={
        <div className="co__form">
          <textarea
            ref={inputRef}
            className="co__input"
            style={{ maxHeight: INPUT_MAX_HEIGHT_PX }}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
              e.preventDefault()
              void send(input)
            }}
            placeholder="食事や筋トレのことを相談する"
            enterKeyHint="send"
            aria-label="相談を入力"
            disabled={busy}
          />
          {busy ? (
            <Button variant="secondary" icon={<X size={20} aria-hidden />} onClick={cancel} aria-label="キャンセル" />
          ) : (
            <Button variant="primary" icon={<Send size={20} aria-hidden />} onClick={() => void send(input)} disabled={!input.trim()} aria-label="送信" />
          )}
        </div>
      }
    >
      <div className="co__top">
        <p className="faint co__provider">{providerLabel} が、記録した食事と筋トレを見て答えます</p>
        <button type="button" className="co__history-btn" onClick={() => setHistoryOpen(true)} aria-label="過去の相談">
          <History size={20} aria-hidden />
        </button>
      </div>

      <div className="co__log" role="log" aria-live="polite">
        {isEmpty && (
          <div className="co__starters">
            <p className="co__starter-lead">
              <Sparkles size={16} aria-hidden />
              何を相談しますか？
            </p>
            <div className="co__chips">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="co__chip" onClick={() => void send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.role === 'user' ? (
            <p key={`turn-${i}`} className="co__bubble co__bubble--user">
              {turn.text}
            </p>
          ) : (
            <div key={`turn-${i}`} className="co__answer">
              {renderCoachTurn(turn, i)}
            </div>
          ),
        )}

        {pending !== null && <p className="co__bubble co__bubble--user">{pending}</p>}

        {busy && (
          <p className="co__thinking" role="status">
            <Loader2 size={18} className="co__spinner" aria-hidden />
            考え中…
          </p>
        )}

        {error && (
          <p className="co__error" role="alert">
            {error}
          </p>
        )}

        {canRetry && (
          <Button size="sm" variant="ghost" onClick={() => void send(pending)}>
            もう一度
          </Button>
        )}

        <div ref={bottomRef} />
      </div>

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="過去の相談">
        {threads.length === 0 ? (
          <p className="muted co__empty">まだ相談はありません。</p>
        ) : (
          <ul className="co__threads">
            {threads.map((t) => (
              <li key={t.id} className="co__thread">
                <button type="button" className="co__thread-body" onClick={() => openThread(t.id)}>
                  <span className="co__thread-title">{t.title}</span>
                  <span className="co__thread-meta">
                    {AI_PROVIDERS[t.provider].label} · {formatRelative(toDateKey(new Date(t.updatedAt)))} · {t.turns.filter((x) => x.role === 'user').length}往復
                  </span>
                </button>
                <button type="button" className="co__thread-del" onClick={() => void removeThread(t)} aria-label={`${t.title} を消す`}>
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button block variant="ghost" onClick={() => openThread(null)}>
          新しく相談する
        </Button>
      </Sheet>
    </Sheet>
  )
}
