import Dexie, { type EntityTable } from 'dexie'
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
import { SEED_EXERCISES } from './seed'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  profile: { sex: 'male', age: 30, heightCm: 170, activity: 'light', goal: 'maintain' },
  targets: { kcal: 2200, protein: 130, fat: 60, carbs: 280 },
  defaultRestSec: 60,
  sound: true,
  vibration: true,
  ai: {
    provider: 'claude',
    keys: { claude: '', openai: '', gemini: '' },
    // 空欄なら AI_PROVIDERS の既定モデルを使う
    models: { claude: '', openai: '', gemini: '' },
  },
  onboarded: false,
}

class WorkoutDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  foods!: EntityTable<Food, 'id'>
  meals!: EntityTable<MealEntry, 'id'>
  mealSets!: EntityTable<MealSet, 'id'>
  weights!: EntityTable<WeightEntry, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('workout-app')
    this.version(1).stores({
      exercises: 'id, name, bodyPart, archived',
      workouts: 'id, date, startedAt',
      sets: 'id, workoutId, exerciseId, [workoutId+exerciseId], completedAt',
      foods: 'id, name, lastUsedAt, useCount, archived',
      meals: 'id, date, createdAt, foodId',
      mealSets: 'id, name',
      weights: 'id, &date',
      settings: 'id',
    })
    // v2: 初期種目に並び順を持たせる（既存DBは id から逆引きして付与）
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const orderById = new Map(SEED_EXERCISES.map((e) => [e.id, e.order]))
        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: Exercise) => {
            const order = orderById.get(ex.id)
            if (order !== undefined) ex.order = order
          })
      })
    this.on('populate', () => {
      void this.exercises.bulkAdd(SEED_EXERCISES)
      void this.settings.add(DEFAULT_SETTINGS)
    })
  }
}

export const db = new WorkoutDB()

/** 起動時に設定行が無ければ作る（populate が走らなかった古いDB向け） */
export async function ensureSettings(): Promise<void> {
  const existing = await db.settings.get('app')
  if (!existing) await db.settings.put(DEFAULT_SETTINGS)
}
