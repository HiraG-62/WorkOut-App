import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, Dumbbell, MessageSquareText, Play, Repeat, Settings, Sparkles, Zap } from 'lucide-react'
import { db } from '../db/db'
import { createWorkout, updateSettings } from '../db/repo'
import { formatDuration, formatLong } from '../lib/date'
import { useToday } from '../hooks/useToday'
import { useBusy } from '../hooks/useBusy'
import { isAiConfigured } from '../lib/ai'
import { useSettings } from '../hooks/useSettings'
import { Card, Section } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { NutritionSummary } from '../components/NutritionSummary'
import { WeightQuick } from '../features/weight/WeightQuick'
import { useDayMeals } from '../features/meals/useDayMeals'
import { useFoods } from '../features/meals/useFoods'
import { QuickFoods } from '../features/meals/QuickFoods'
import { AiMealSheet } from '../features/meals/AiMealSheet'
import { PhotoPickers, usePhotoPicker } from '../features/meals/PhotoPickers'
import { QuickMealSheet } from '../features/meals/QuickMealSheet'
import { FoodFormSheet } from '../features/meals/FoodFormSheet'
import { summarizeSets } from '../features/workout/useWorkoutStats'
import { useDayBurn, useWeightInfo } from '../features/workout/useDayBurn'
import './HomePage.css'

const QUICK_LIMIT = 4

export function HomePage() {
  const navigate = useNavigate()
  const settings = useSettings()
  const today = useToday()
  const guard = useBusy()
  const { totals } = useDayMeals(today)
  const burnKcal = useDayBurn(today)
  const weightInfo = useWeightInfo()
  const { foods } = useFoods()
  const workouts = useLiveQuery(() => db.workouts.orderBy('startedAt').reverse().limit(5).toArray(), [])
  const exerciseList = useLiveQuery(() => db.exercises.toArray(), [])
  const settingsRow = useLiveQuery(async () => (await db.settings.get('app')) ?? null, [])
  // 日をまたいだ進行中のワークアウトも「今日の」扱いにする
  const todayWorkout = workouts?.find((w) => !w.endedAt) ?? workouts?.find((w) => w.date === today)
  const lastWorkout = workouts?.find((w) => w.id !== todayWorkout?.id)
  const ready = workouts !== undefined && exerciseList !== undefined
  const todaySets = useLiveQuery(async () => (todayWorkout ? db.sets.where('workoutId').equals(todayWorkout.id).toArray() : []), [todayWorkout?.id])
  const [photoOpen, setPhotoOpen] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const photo = usePhotoPicker((file) => {
    setPhotoFile(file)
    setPhotoOpen(true)
  })
  const [talkOpen, setTalkOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [foodFormOpen, setFoodFormOpen] = useState(false)
  const exercises = useMemo(() => new Map((exerciseList ?? []).map((e) => [e.id, e])), [exerciseList])
  const aiReady = isAiConfigured(settings.ai)

  const startFromLast = () =>
    guard(async () => {
      if (!lastWorkout) return
      const w = await createWorkout(lastWorkout.exerciseIds.filter((id) => exercises.get(id) && !exercises.get(id)?.archived))
      navigate(`/workout/${w.id}`)
    })

  return (
    <div className="page hp">
      <header className="hp__head">
        <div>
          <p className="hp__date">{formatLong(today)}</p>
          <h1 className="hp__title">今日</h1>
        </div>
        <button type="button" className="hp__settings" onClick={() => navigate('/settings')} aria-label="設定">
          <Settings size={22} aria-hidden />
        </button>
      </header>

      {settingsRow && !settingsRow.onboarded && (
        <Card accent className="hp__welcome">
          <Sparkles size={20} className="hp__welcome-icon" aria-hidden />
          <div className="grow">
            <p className="hp__welcome-title">ようこそ</p>
            <p className="hp__welcome-desc">設定で体重・身長・目的を入れると、カロリーと PFC の目標を自動で計算します。あとで設定しても大丈夫です。</p>
            <div className="row hp__welcome-actions">
              <Button size="sm" variant="accent-soft" onClick={() => navigate('/settings')}>
                目標を設定
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void updateSettings({ onboarded: true })}>
                あとで
              </Button>
            </div>
          </div>
        </Card>
      )}

      <WeightQuick compact />

      <Section title="トレーニング">
        {!ready ? (
          <div className="skeleton skeleton--row" aria-busy="true" />
        ) : todayWorkout ? (
          <button type="button" className="hp__workout hp__workout--active" onClick={() => navigate(`/workout/${todayWorkout.id}`)}>
            <span className="hp__workout-icon">
              <Dumbbell size={22} aria-hidden />
            </span>
            <span className="hp__workout-text">
              <span className="hp__workout-title">{todayWorkout.endedAt ? '今日は完了' : '進行中'}</span>
              <span className="hp__workout-sub">
                {summarizeSets(todaySets ?? [], exercises, todayWorkout.exerciseIds) || '種目未選択'}
                {todayWorkout.endedAt ? ` · ${formatDuration(todayWorkout.endedAt - todayWorkout.startedAt)}` : ''}
              </span>
            </span>
            <ChevronRight size={20} aria-hidden />
          </button>
        ) : lastWorkout ? (
          <button type="button" className="hp__workout hp__workout--primary" onClick={() => void startFromLast()}>
            <span className="hp__workout-icon">
              <Repeat size={22} aria-hidden />
            </span>
            <span className="hp__workout-text">
              <span className="hp__workout-title">前回と同じで開始</span>
              <span className="hp__workout-sub">{lastWorkout.exerciseIds.map((id) => exercises.get(id)?.name).filter(Boolean).join('、')}</span>
            </span>
            <Play size={20} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button type="button" className="hp__workout hp__workout--primary" onClick={() => navigate('/workout?pick=1')}>
            <span className="hp__workout-icon">
              <Dumbbell size={22} aria-hidden />
            </span>
            <span className="hp__workout-text">
              <span className="hp__workout-title">ワークアウトを始める</span>
              <span className="hp__workout-sub">種目を選んで記録開始</span>
            </span>
            <ChevronRight size={20} aria-hidden />
          </button>
        )}
      </Section>

      <Section
        title="食事"
        action={
          <button type="button" className="hp__link" onClick={() => navigate('/meals')}>
            詳しく <ChevronRight size={16} aria-hidden />
          </button>
        }
      >
        <Card>
          <NutritionSummary totals={totals} targets={settings.targets} compact burnKcal={burnKcal} addBurn={settings.addBurnToTarget} weightMissing={!weightInfo.recorded} />
        </Card>
        <div className="hp__meal-actions">
          {aiReady && (
            <>
              <Button variant="primary" icon={<Camera size={18} aria-hidden />} onClick={photo.open} block>
                写真
              </Button>
              <Button variant="primary" icon={<MessageSquareText size={18} aria-hidden />} onClick={() => setTalkOpen(true)} block>
                AIに話す
              </Button>
            </>
          )}
          <Button variant={aiReady ? 'secondary' : 'accent-soft'} icon={<Zap size={18} aria-hidden />} onClick={() => setQuickOpen(true)} block className="hp__meal-quick">
            ざっくり記録
          </Button>
        </div>
        {foods.length > 0 && <QuickFoods foods={foods} date={today} limit={QUICK_LIMIT} onMore={() => navigate('/meals')} onAdd={() => setFoodFormOpen(true)} />}
      </Section>

      <PhotoPickers photo={photo} />
      <AiMealSheet open={photoOpen} onClose={() => setPhotoOpen(false)} date={today} mode="photo" initialFile={photoFile} />
      <AiMealSheet open={talkOpen} onClose={() => setTalkOpen(false)} date={today} mode="text" />
      <QuickMealSheet open={quickOpen} onClose={() => setQuickOpen(false)} date={today} />
      <FoodFormSheet open={foodFormOpen} onClose={() => setFoodFormOpen(false)} />
    </div>
  )
}
