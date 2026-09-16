import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, CopyPlus, Layers, MessageSquareText, ScanText, Search, UtensilsCrossed, Zap } from 'lucide-react'
import { copyMeals, uncopyMeals } from '../db/repo'
import { addDays, formatRelative } from '../lib/date'
import { useToday } from '../hooks/useToday'
import { useBusy } from '../hooks/useBusy'
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
import { AiMealSheet } from '../features/meals/AiMealSheet'
import { NutritionLabelSheet } from '../features/meals/NutritionLabelSheet'
import { MealSetsSheet } from '../features/meals/MealSetsSheet'
import './MealsPage.css'

const QUICK_LIMIT = 6
const UNDO_MS = 6000

type SheetKind = 'picker' | 'form' | 'quick' | 'photo' | 'talk' | 'label' | 'sets' | null

export function MealsPage() {
  const settings = useSettings()
  const toast = useToast()
  const guard = useBusy()
  const today = useToday()
  const [date, setDate] = useState(today)
  // 「今日」を見ている最中に日付が変わったら追従する（過去日を見ている時はそのまま）
  const prevToday = useRef(today)
  useEffect(() => {
    if (prevToday.current !== today) {
      setDate((d) => (d === prevToday.current ? today : d))
      prevToday.current = today
    }
  }, [today])
  const { entries, totals } = useDayMeals(date)
  const { foods } = useFoods()
  const [sheet, setSheet] = useState<SheetKind>(null)
  const isToday = date === today
  const aiReady = isAiConfigured(settings.ai)

  const copyYesterday = () =>
    guard(async () => {
      const ids = await copyMeals(addDays(date, -1), date)
      if (ids.length === 0) {
        toast.show('前日の記録がありません', 'info')
        return
      }
      toast.show(`前日の${ids.length}品をコピーしました`, 'success', { label: '取り消す', onClick: () => void uncopyMeals(ids) }, UNDO_MS)
    })

  return (
    <div className="page mp">
      <PageHeader
        title="食事"
        action={
          <div className="mp__datenav">
            <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="前の日">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button type="button" className="mp__date" onClick={() => setDate(today)} aria-label="今日に戻る">
              {formatRelative(date)}
            </button>
            <button type="button" onClick={() => setDate(addDays(date, 1))} aria-label="次の日" disabled={isToday}>
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
        }
      />

      <div className="mp__actions">
        {aiReady && (
          <>
            <Button variant="primary" icon={<Camera size={18} aria-hidden />} onClick={() => setSheet('photo')}>
              写真
            </Button>
            <Button variant="primary" icon={<MessageSquareText size={18} aria-hidden />} onClick={() => setSheet('talk')}>
              AIに話す
            </Button>
            <Button variant="accent-soft" icon={<ScanText size={18} aria-hidden />} onClick={() => setSheet('label')}>
              成分表を撮る
            </Button>
          </>
        )}
        <Button variant={aiReady ? 'secondary' : 'primary'} icon={<Zap size={18} aria-hidden />} onClick={() => setSheet('quick')}>
          ざっくり
        </Button>
        <Button icon={<Search size={18} aria-hidden />} onClick={() => setSheet('picker')}>
          登録済み
        </Button>
        <Button icon={<Layers size={18} aria-hidden />} onClick={() => setSheet('sets')}>
          セット
        </Button>
        <Button icon={<CopyPlus size={18} aria-hidden />} onClick={() => void copyYesterday()}>
          前日と同じ
        </Button>
      </div>

      <Section title="よく食べるもの">
        <QuickFoods foods={foods} date={date} limit={QUICK_LIMIT} onMore={() => setSheet('picker')} onAdd={() => setSheet('form')} />
      </Section>

      <Card>
        <NutritionSummary totals={totals} targets={settings.targets} compact />
      </Card>

      <Section title={`${formatRelative(date)}の記録`}>
        {entries.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed size={24} />}
            title="まだ記録がありません"
            description={aiReady ? '写真を撮るか「AIに話す」で食べたものを伝えるだけ。よく食べるものを登録すると次からワンタップです' : '「ざっくり」なら数値の目安だけで10秒で記録できます。よく食べるものを登録すると次からワンタップです'}
          />
        ) : (
          <MealEntryList entries={entries} />
        )}
      </Section>

      <FoodPickerSheet open={sheet === 'picker'} onClose={() => setSheet(null)} foods={foods} date={date} />
      <FoodFormSheet open={sheet === 'form'} onClose={() => setSheet(null)} />
      <QuickMealSheet open={sheet === 'quick'} onClose={() => setSheet(null)} date={date} />
      <AiMealSheet open={sheet === 'photo'} onClose={() => setSheet(null)} date={date} mode="photo" />
      <AiMealSheet open={sheet === 'talk'} onClose={() => setSheet(null)} date={date} mode="text" />
      <NutritionLabelSheet open={sheet === 'label'} onClose={() => setSheet(null)} date={date} />
      <MealSetsSheet open={sheet === 'sets'} onClose={() => setSheet(null)} date={date} todayEntries={entries} />
    </div>
  )
}
