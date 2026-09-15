import { db, DEFAULT_SETTINGS } from './db'
import { newId } from '../lib/id'
import { fromDateKey, timeSlot, todayKey } from '../lib/date'
import type {
  Exercise,
  Food,
  MealEntry,
  MealSet,
  Settings,
  WeightEntry,
  Workout,
  WorkoutSet,
} from '../types'

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 'app' })
}

// ---------- Exercises ----------

export async function addExercise(
  input: Pick<Exercise, 'name' | 'type' | 'bodyPart' | 'useWeight'> & Partial<Pick<Exercise, 'restSec' | 'progressionId'>>,
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

// ---------- Workouts ----------

export async function getTodayWorkout(): Promise<Workout | undefined> {
  return db.workouts.where('date').equals(todayKey()).first()
}

/** 直近の（今日以外の）完了済みワークアウト */
export async function getLastWorkout(excludeId?: string): Promise<Workout | undefined> {
  const list = await db.workouts.orderBy('startedAt').reverse().limit(5).toArray()
  return list.find((w) => w.id !== excludeId)
}

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
    const existing = await db.sets.where('[workoutId+exerciseId]').equals([input.workoutId, input.exerciseId]).count()
    const set: WorkoutSet = {
      id: newId(),
      ...input,
      order: existing,
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
  const slotCounts: Food['slotCounts'] = [...food.slotCounts]
  slotCounts[slot] += 1
  await db.transaction('rw', db.meals, db.foods, async () => {
    await db.meals.add(entry)
    await db.foods.update(food.id, {
      useCount: food.useCount + 1,
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
  const base = entry.quantity > 0 ? entry.quantity : 1
  const per = {
    kcal: entry.kcal / base,
    protein: entry.protein / base,
    fat: entry.fat / base,
    carbs: entry.carbs / base,
  }
  await db.meals.update(entry.id, { quantity, ...scaled(per, quantity) })
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id)
}

/** 指定日の食事を今日にコピーする */
export async function copyMeals(fromDate: string, toDate = todayKey()): Promise<number> {
  const src = await db.meals.where('date').equals(fromDate).sortBy('createdAt')
  if (src.length === 0) return 0
  // 元の時刻（朝・昼・夜）を保ったままコピー先の日付に載せ替える
  const fromStart = fromDateKey(fromDate).getTime()
  const toStart = fromDateKey(toDate).getTime()
  const copies: MealEntry[] = src.map((m) => ({
    ...m,
    id: newId(),
    date: toDate,
    createdAt: toStart + (m.createdAt - fromStart),
  }))
  await db.meals.bulkAdd(copies)
  return copies.length
}

export async function addMealSet(name: string, items: MealSet['items']): Promise<MealSet> {
  const set: MealSet = { id: newId(), name, items, createdAt: Date.now() }
  await db.mealSets.add(set)
  return set
}

export async function deleteMealSet(id: string): Promise<void> {
  await db.mealSets.delete(id)
}

export async function logMealSet(set: MealSet, date = todayKey()): Promise<number> {
  let count = 0
  for (const item of set.items) {
    const food = await db.foods.get(item.foodId)
    if (!food || food.archived) continue
    await logFood(food, item.quantity, date)
    count += 1
  }
  return count
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
