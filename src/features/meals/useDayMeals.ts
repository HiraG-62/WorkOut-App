import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { sumNutrition } from '../../lib/nutrition'
import type { MealEntry, Targets } from '../../types'

interface DayMeals {
  entries: MealEntry[]
  totals: Targets
}

export function useDayMeals(date: string): DayMeals {
  const entries = useLiveQuery(() => db.meals.where('date').equals(date).sortBy('createdAt'), [date])
  return {
    entries: entries ?? [],
    totals: sumNutrition(entries ?? []),
  }
}
