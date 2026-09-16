import { db, DEFAULT_SETTINGS } from './db'
import { newId } from '../lib/id'
import { fromDateKey, timeSlot, todayKey } from '../lib/date'
import type { Exercise, Food, MealEntry, MealSet, Settings, WeeklyReview, WeightEntry, Workout, WorkoutSet } from '../types'

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  // 部分更新にして、フォーム保存とタイマー設定の同時更新で後勝ちにならないようにする
  const updated = await db.settings.update('app', patch)
  if (updated === 0) await db.settings.put({ ...DEFAULT_SETTINGS, ...patch, id: 'app' })
}

// ---------- Exercises ----------

export async function addExercise(
  input: Pick<Exercise, 'name' | 'type' | 'bodyPart' | 'useWeight'> & Partial<Pick<Exercise, 'restSec' | 'progressionId' | 'formFamily' | 'met'>>,
): Promise<Exercise> {
  const ex: Exercise = {
    id: newId(),
    ...input,
    isCustom: true,
    archived: false,
    createdAt: Date.now(),
  }
  await db.exercises.add(ex)
  return ex
}

export async function updateExercise(id: string, patch: Partial<Exercise>): Promise<void> {
  await db.exercises.update(id, patch)
}

export async function archiveExercise(id: string): Promise<void> {
  await db.exercises.update(id, { archived: true })
}

export async function unarchiveExercise(id: string): Promise<void> {
  await db.exercises.update(id, { archived: false })
}

// ---------- Workouts ----------

export async function createWorkout(exerciseIds: string[]): Promise<Workout> {
  const w: Workout = {
    id: newId(),
    date: todayKey(),
    startedAt: Date.now(),
    exerciseIds,
  }
  await db.workouts.add(w)
  return w
}

export async function finishWorkout(id: string): Promise<void> {
  await db.workouts.update(id, { endedAt: Date.now() })
}

export async function reopenWorkout(id: string): Promise<void> {
  await db.workouts.update(id, { endedAt: undefined })
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('workoutId').equals(id).delete()
    await db.workouts.delete(id)
  })
}

export async function setWorkoutExercises(id: string, exerciseIds: string[]): Promise<void> {
  await db.workouts.update(id, { exerciseIds })
}

export interface RemovedExercise {
  index: number
  sets: WorkoutSet[]
}

/** 種目をメニューから外す。取り消し用に位置と削除したセットを返す */
export async function removeExerciseFromWorkout(workoutId: string, exerciseId: string): Promise<RemovedExercise> {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId)
    if (!w) return { index: 0, sets: [] }
    const index = w.exerciseIds.indexOf(exerciseId)
    const sets = await db.sets.where('[workoutId+exerciseId]').equals([workoutId, exerciseId]).toArray()
    await db.workouts.update(workoutId, { exerciseIds: w.exerciseIds.filter((e) => e !== exerciseId) })
    await db.sets.bulkDelete(sets.map((s) => s.id))
    return { index: Math.max(0, index), sets }
  })
}

/** removeExerciseFromWorkout の取り消し */
export async function restoreExerciseToWorkout(workoutId: string, exerciseId: string, removed: RemovedExercise): Promise<void> {
  await db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId)
    if (!w || w.exerciseIds.includes(exerciseId)) return
    const ids = [...w.exerciseIds]
    ids.splice(Math.min(removed.index, ids.length), 0, exerciseId)
    await db.workouts.update(workoutId, { exerciseIds: ids })
    await db.sets.bulkAdd(removed.sets)
  })
}

/** 指定種目を最後にやった時のセット一覧（今回のワークアウトは除く） */
export async function getLastSetsForExercise(
  exerciseId: string,
  excludeWorkoutId?: string,
): Promise<WorkoutSet[]> {
  const recent = await db.sets.where('exerciseId').equals(exerciseId).reverse().sortBy('completedAt')
  const last = recent.find((s) => s.workoutId !== excludeWorkoutId)
  if (!last) return []
  return db.sets
    .where('[workoutId+exerciseId]')
    .equals([last.workoutId, exerciseId])
    .sortBy('order')
}

export async function addSet(
  input: Pick<WorkoutSet, 'workoutId' | 'exerciseId' | 'reps' | 'seconds' | 'weightKg'>,
): Promise<WorkoutSet> {
  // order の採番と追加を同一トランザクションにし、連打でも重複しないようにする
  return db.transaction('rw', db.sets, async () => {
    // 削除で欠番が出ても重複しないよう、最大値 + 1 で採番する
    const existing = await db.sets.where('[workoutId+exerciseId]').equals([input.workoutId, input.exerciseId]).toArray()
    const order = existing.reduce((m, s) => Math.max(m, s.order + 1), 0)
    const set: WorkoutSet = {
      id: newId(),
      ...input,
      order,
      completedAt: Date.now(),
    }
    await db.sets.add(set)
    return set
  })
}

export async function updateSet(id: string, patch: Partial<WorkoutSet>): Promise<void> {
  await db.sets.update(id, patch)
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id)
}

// ---------- Foods & Meals ----------

export async function addFood(
  input: Pick<Food, 'name' | 'unitLabel' | 'kcal' | 'protein' | 'fat' | 'carbs'> & Partial<Pick<Food, 'source'>>,
): Promise<Food> {
  const food: Food = {
    id: newId(),
    ...input,
    source: input.source ?? 'manual',
    useCount: 0,
    lastUsedAt: 0,
    slotCounts: [0, 0, 0, 0],
    archived: false,
    createdAt: Date.now(),
  }
  await db.foods.add(food)
  return food
}

export async function updateFood(id: string, patch: Partial<Food>): Promise<void> {
  await db.foods.update(id, patch)
}

export async function archiveFood(id: string): Promise<void> {
  await db.foods.update(id, { archived: true })
}

export async function unarchiveFood(id: string): Promise<void> {
  await db.foods.update(id, { archived: false })
}

function scaled(food: Pick<Food, 'kcal' | 'protein' | 'fat' | 'carbs'>, q: number) {
  const r1 = (n: number) => Math.round(n * q * 10) / 10
  return {
    kcal: Math.round(food.kcal * q),
    protein: r1(food.protein),
    fat: r1(food.fat),
    carbs: r1(food.carbs),
  }
}

export async function logFood(food: Food, quantity: number, date = todayKey()): Promise<MealEntry> {
  const entry: MealEntry = {
    id: newId(),
    date,
    foodId: food.id,
    name: food.name,
    quantity,
    ...scaled(food, quantity),
    createdAt: Date.now(),
  }
  const slot = timeSlot()
  await db.transaction('rw', db.meals, db.foods, async () => {
    await db.meals.add(entry)
    // 連続タップでも取りこぼさないよう、最新の値を読んでから加算する
    const fresh = (await db.foods.get(food.id)) ?? food
    const slotCounts: Food['slotCounts'] = [...fresh.slotCounts]
    slotCounts[slot] += 1
    await db.foods.update(food.id, {
      useCount: fresh.useCount + 1,
      lastUsedAt: Date.now(),
      slotCounts,
    })
  })
  return entry
}

export async function logQuickMeal(
  input: Pick<MealEntry, 'name' | 'kcal' | 'protein' | 'fat' | 'carbs'>,
  date = todayKey(),
): Promise<MealEntry> {
  const entry: MealEntry = {
    id: newId(),
    date,
    quantity: 1,
    ...input,
    createdAt: Date.now(),
  }
  await db.meals.add(entry)
  return entry
}

export async function updateMealQuantity(entry: MealEntry, quantity: number): Promise<void> {
  // フードから記録したものは元の単位値から再計算し、丸め誤差を溜めない
  const food = entry.foodId ? await db.foods.get(entry.foodId) : undefined
  const base = entry.quantity > 0 ? entry.quantity : 1
  const per = food ?? {
    kcal: entry.kcal / base,
    protein: entry.protein / base,
    fat: entry.fat / base,
    carbs: entry.carbs / base,
  }
  await db.meals.update(entry.id, { quantity, ...scaled(per, quantity) })
}

/** logFood の取り消し。使用回数などの統計も戻す */
export async function unlogFood(entry: MealEntry): Promise<void> {
  await db.transaction('rw', db.meals, db.foods, async () => {
    await db.meals.delete(entry.id)
    if (!entry.foodId) return
    const food = await db.foods.get(entry.foodId)
    if (!food) return
    const slot = timeSlot(new Date(entry.createdAt))
    const slotCounts: Food['slotCounts'] = [...food.slotCounts]
    slotCounts[slot] = Math.max(0, slotCounts[slot] - 1)
    await db.foods.update(food.id, { useCount: Math.max(0, food.useCount - 1), slotCounts })
  })
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id)
}

/** 指定日の食事を今日にコピーする。取り消し用にコピーした id を返す */
export async function copyMeals(fromDate: string, toDate = todayKey()): Promise<string[]> {
  const src = await db.meals.where('date').equals(fromDate).sortBy('createdAt')
  if (src.length === 0) return []
  // 元の時刻（朝・昼・夜）を保ったままコピー先の日付に載せ替える
  const fromStart = fromDateKey(fromDate).getTime()
  const toStart = fromDateKey(toDate).getTime()
  const copies: MealEntry[] = src.map((m) => ({
    ...m,
    id: newId(),
    date: toDate,
    createdAt: toStart + (m.createdAt - fromStart),
  }))
  await db.transaction('rw', db.meals, db.foods, async () => {
    await db.meals.bulkAdd(copies)
    // フード由来の記録は使用回数にも数える（取り消し時の unlogFood と対称にする）
    for (const c of copies) {
      if (!c.foodId) continue
      const food = await db.foods.get(c.foodId)
      if (!food) continue
      const slot = timeSlot(new Date(c.createdAt))
      const slotCounts: Food['slotCounts'] = [...food.slotCounts]
      slotCounts[slot] += 1
      await db.foods.update(food.id, { useCount: food.useCount + 1, lastUsedAt: Date.now(), slotCounts })
    }
  })
  return copies.map((c) => c.id)
}

/** copyMeals の取り消し。統計も戻す */
export async function uncopyMeals(ids: string[]): Promise<void> {
  for (const id of ids) {
    const entry = await db.meals.get(id)
    if (entry) await unlogFood(entry)
  }
}

export async function addMealSet(name: string, items: MealSet['items']): Promise<MealSet> {
  const set: MealSet = { id: newId(), name, items, createdAt: Date.now() }
  await db.mealSets.add(set)
  return set
}

export async function deleteMealSet(id: string): Promise<void> {
  await db.mealSets.delete(id)
}

export async function logMealSet(set: MealSet, date = todayKey()): Promise<{ logged: number; skipped: number }> {
  let logged = 0
  let skipped = 0
  for (const item of set.items) {
    const food = await db.foods.get(item.foodId)
    if (!food || food.archived) {
      skipped += 1
      continue
    }
    await logFood(food, item.quantity, date)
    logged += 1
  }
  return { logged, skipped }
}

// ---------- Weights ----------

export async function upsertWeight(kg: number, date = todayKey()): Promise<void> {
  const existing = await db.weights.where('date').equals(date).first()
  if (existing) {
    await db.weights.update(existing.id, { kg })
    return
  }
  const entry: WeightEntry = { id: newId(), date, kg, createdAt: Date.now() }
  await db.weights.add(entry)
}

export async function getLatestWeight(): Promise<WeightEntry | undefined> {
  return db.weights.orderBy('date').reverse().first()
}

export async function putWeeklyReview(review: WeeklyReview): Promise<void> {
  await db.weeklyReviews.put(review)
}

export async function deleteWeeklyReview(id: string): Promise<void> {
  await db.weeklyReviews.delete(id)
}
