import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db/db'
import { timeSlot } from '../../lib/date'
import type { Food } from '../../types'

const SLOT_WEIGHT = 3
const RECENT_WINDOW_MS = 1000 * 60 * 60 * 24 * 14

/** 今の時間帯によく食べるものが上に来るようにスコアリング */
export function foodScore(food: Food, slot: number, now: number): number {
  const recent = now - food.lastUsedAt < RECENT_WINDOW_MS ? 2 : 0
  return food.slotCounts[slot] * SLOT_WEIGHT + food.useCount + recent
}

export function useFoods(): { foods: Food[]; loaded: boolean } {
  const all = useLiveQuery(() => db.foods.filter((f) => !f.archived).toArray(), [])
  const foods = useMemo(() => {
    if (!all) return []
    const slot = timeSlot()
    const now = Date.now()
    return [...all].sort((a, b) => foodScore(b, slot, now) - foodScore(a, slot, now) || a.name.localeCompare(b.name, 'ja'))
  }, [all])
  return { foods, loaded: all !== undefined }
}
