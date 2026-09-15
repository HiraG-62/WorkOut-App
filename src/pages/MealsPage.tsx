import { useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, CopyPlus, Layers, Search, UtensilsCrossed, Zap } from 'lucide-react'
import { copyMeals } from '../db/repo'
import { addDays, formatRelative, todayKey } from '../lib/date'
import { isAiConfigured } from '../lib/ai'
import { useSettings } from '../hooks/useSettings'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, Section } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import { NutritionSummary } from '../components/NutritionSummary'
import { useDayMeals } from '../features/meals/useDayMeals'
import { useFoods } from '../features/meals/useFoods'
import { QuickFoods } from '../features/meals/QuickFoods'
import { MealEntryList } from '../features/meals/MealEntryList'
import { FoodPickerSheet } from '../features/meals/FoodPickerSheet'
import { FoodFormSheet } from '../features/meals/FoodFormSheet'
import { QuickMealSheet } from '../features/meals/QuickMealSheet'
import { PhotoEstimateSheet } from '../features/meals/PhotoEstimateSheet'
import { MealSetsSheet } from '../features/meals/MealSetsSheet'
import './MealsPage.css'

const QUICK_LIMIT = 6

type SheetKind = 'picker' | 'form' | 'quick' | 'photo' | 'sets' | null

export function MealsPage() {
  const settings = useSettings()
  const toast = useToast()
  const [date, setDate] = useState(todayKey())
  const { entries, totals } = useDayMeals(date)
  const { foods } = useFoods()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const isToday = date === todayKey()
  const aiReady = isAiConfigured(settings.ai)

  const copyYesterday = async () => {
    const n = await copyMeals(addDays(date, -1), date)
    toast.show(n > 0 ? `前日の${n}品をコピーしました` : '前日の記録がありません', n > 0 ? 'success' : 'info')
  }

  return (
    <div className="page mp">
      <PageHeader
        title="食事"
        action={
          <div className="mp__datenav">
            <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="前の日">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button type="button" className="mp__date" onClick={() => setDate(todayKey())} aria-label="今日に戻る">
              {formatRelative(date)}
            </button>
            <button type="button" onClick={() => setDate(addDays(date, 1))} aria-label="次の日" disabled={isToday}>
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        }
      />

      <Card>
        <NutritionSummary totals={totals} targets={settings.targets} />
      </Card>

      <div className="mp__actions">
        {aiReady && (
          <Button variant="primary" icon={<Camera size={18} aria-hidden />} onClick={() => setSheet('photo')}>
            写真
          </Button>
        )}
        <Button icon={<Zap size={18} aria-hidden />} onClick={() => setSheet('quick')}>
          ざっくり
        </Button>
        <Button icon={<Search size={18} aria-hidden />} onClick={() => setSheet('picker')}>
          フード
        </Button>
        <Button icon={<Layers size={18} aria-hidden />} onClick={() => setSheet('sets')}>
          セット
        </Button>
        <Button icon={<CopyPlus size={18} aria-hidden />} onClick={() => void copyYesterday()}>
          前日と同じ
        </Button>
      </div>

      <Section title="よく食べるもの">
        {foods.length === 0 ? (
          <div className="mp__nofood">
            <p className="muted">よく食べるものを登録すると、ここからワンタップで記録できます。</p>
            <Button variant="accent-soft" onClick={() => setSheet('form')}>
              フードを登録する
            </Button>
          </div>
        ) : (
          <QuickFoods foods={foods} date={date} limit={QUICK_LIMIT} onMore={() => setSheet('picker')} onAdd={() => setSheet('form')} />
        )}
      </Section>

      <Section title={`${formatRelative(date)}の記録`}>
        {entries.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed size={24} />} title="まだ記録がありません" description={aiReady ? '写真を撮るか、よく食べるものをタップして記録' : 'よく食べるものをタップするだけで記録できます'} />
        ) : (
          <MealEntryList entries={entries} />
        )}
      </Section>

      <FoodPickerSheet open={sheet === 'picker'} onClose={() => setSheet(null)} foods={foods} date={date} />
      <FoodFormSheet open={sheet === 'form'} onClose={() => setSheet(null)} />
      <QuickMealSheet open={sheet === 'quick'} onClose={() => setSheet(null)} date={date} />
      <PhotoEstimateSheet open={sheet === 'photo'} onClose={() => setSheet(null)} date={date} />
      <MealSetsSheet open={sheet === 'sets'} onClose={() => setSheet(null)} date={date} todayEntries={entries} />
    </div>
  )
}
