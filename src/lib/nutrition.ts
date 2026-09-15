import { ACTIVITY_LEVELS, GOALS, type Profile, type Targets } from '../types'

export const KCAL_PER_GRAM = { protein: 4, fat: 9, carbs: 4 } as const

/** タンパク質の目安 g/kg（目的別） */
const PROTEIN_PER_KG = { cut: 2.2, maintain: 1.8, bulk: 2.0 } as const
/** 脂質の割合（総カロリーに対する） */
const FAT_RATIO = 0.25
const MIN_KCAL = 1200

/** Mifflin-St Jeor 式で基礎代謝を求める */
export function bmr(profile: Profile, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age
  return profile.sex === 'male' ? base + 5 : base - 161
}

export function tdee(profile: Profile, weightKg: number): number {
  return bmr(profile, weightKg) * ACTIVITY_LEVELS[profile.activity].factor
}

function round(n: number, step: number): number {
  return Math.round(n / step) * step
}

/** プロフィールと体重から目標値を機械的に算出する */
export function calcTargets(profile: Profile, weightKg: number): Targets {
  const kcal = Math.max(MIN_KCAL, round(tdee(profile, weightKg) + GOALS[profile.goal].kcalDelta, 10))
  const protein = round(weightKg * PROTEIN_PER_KG[profile.goal], 5)
  const fat = round((kcal * FAT_RATIO) / KCAL_PER_GRAM.fat, 5)
  const carbsKcal = kcal - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat
  const carbs = Math.max(0, round(carbsKcal / KCAL_PER_GRAM.carbs, 5))
  return { kcal, protein, fat, carbs }
}

export function pfcToKcal(protein: number, fat: number, carbs: number): number {
  return Math.round(
    protein * KCAL_PER_GRAM.protein + fat * KCAL_PER_GRAM.fat + carbs * KCAL_PER_GRAM.carbs,
  )
}

export function sumNutrition<T extends { kcal: number; protein: number; fat: number; carbs: number }>(
  entries: T[],
): Targets {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  )
}

export function fmt1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
