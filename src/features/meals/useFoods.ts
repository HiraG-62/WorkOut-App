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

export function useFoods(): { foods: Food[] } {
  // クエリ実行時点の時刻と時間帯で並べ替える（描画中に Date.now を呼ばない）
  const result = useLiveQuery(async () => {
    const all = await db.foods.filter((f) => !f.archived).toArray()
    return { all, now: Date.now(), slot: timeSlot() }
  }, [])
  const foods = useMemo(() => {
    if (!result) return []
    const { all, now, slot } = result
    return [...all].sort((a, b) => foodScore(b, slot, now) - foodScore(a, slot, now) || a.name.localeCompare(b.name, 'ja'))
  }, [result])
  return { foods }
}
