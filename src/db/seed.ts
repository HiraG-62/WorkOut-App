import type { Exercise } from '../types'

type SeedExercise = Omit<Exercise, 'isCustom' | 'archived' | 'createdAt' | 'useWeight'> & {
  useWeight?: boolean
}

const seed: SeedExercise[] = [
  // 胸
  { id: 'ex_pushup_wall', name: '壁腕立て伏せ', type: 'reps', bodyPart: 'chest', progressionId: 'ex_pushup_knee' },
  { id: 'ex_pushup_knee', name: '膝つき腕立て伏せ', type: 'reps', bodyPart: 'chest', progressionId: 'ex_pushup' },
  { id: 'ex_pushup', name: '腕立て伏せ', type: 'reps', bodyPart: 'chest', progressionId: 'ex_pushup_diamond' },
  { id: 'ex_pushup_diamond', name: 'ダイヤモンド腕立て', type: 'reps', bodyPart: 'chest', progressionId: 'ex_pushup_decline' },
  { id: 'ex_pushup_decline', name: 'デクライン腕立て', type: 'reps', bodyPart: 'chest', progressionId: 'ex_pushup_archer' },
  { id: 'ex_pushup_archer', name: 'アーチャー腕立て', type: 'reps', bodyPart: 'chest', progressionId: 'ex_pushup_onearm' },
  { id: 'ex_pushup_onearm', name: '片手腕立て', type: 'reps', bodyPart: 'chest' },
  { id: 'ex_pushup_wide', name: 'ワイド腕立て', type: 'reps', bodyPart: 'chest' },
  // 背中
  { id: 'ex_row_table', name: 'テーブルロウ（斜め懸垂）', type: 'reps', bodyPart: 'back', progressionId: 'ex_pullup_negative' },
  { id: 'ex_pullup_negative', name: 'ネガティブ懸垂', type: 'reps', bodyPart: 'back', progressionId: 'ex_pullup' },
  { id: 'ex_pullup', name: '懸垂', type: 'reps', bodyPart: 'back', useWeight: true },
  { id: 'ex_chinup', name: 'チンアップ（逆手懸垂）', type: 'reps', bodyPart: 'back', useWeight: true },
  { id: 'ex_superman', name: 'スーパーマン', type: 'reps', bodyPart: 'back' },
  { id: 'ex_deadhang', name: 'ぶら下がり', type: 'time', bodyPart: 'back' },
  // 脚
  { id: 'ex_squat', name: 'スクワット', type: 'reps', bodyPart: 'legs', progressionId: 'ex_squat_bulgarian' },
  { id: 'ex_squat_bulgarian', name: 'ブルガリアンスクワット', type: 'reps', bodyPart: 'legs', progressionId: 'ex_squat_pistol' },
  { id: 'ex_squat_pistol', name: 'ピストルスクワット', type: 'reps', bodyPart: 'legs' },
  { id: 'ex_squat_jump', name: 'ジャンプスクワット', type: 'reps', bodyPart: 'legs' },
  { id: 'ex_lunge', name: 'ランジ', type: 'reps', bodyPart: 'legs' },
  { id: 'ex_glute_bridge', name: 'ヒップリフト', type: 'reps', bodyPart: 'legs', progressionId: 'ex_glute_bridge_single' },
  { id: 'ex_glute_bridge_single', name: '片脚ヒップリフト', type: 'reps', bodyPart: 'legs' },
  { id: 'ex_calf_raise', name: 'カーフレイズ', type: 'reps', bodyPart: 'legs' },
  { id: 'ex_wall_sit', name: '空気椅子', type: 'time', bodyPart: 'legs' },
  // 体幹
  { id: 'ex_plank', name: 'プランク', type: 'time', bodyPart: 'core', progressionId: 'ex_plank_side' },
  { id: 'ex_plank_side', name: 'サイドプランク', type: 'time', bodyPart: 'core' },
  { id: 'ex_crunch', name: 'クランチ', type: 'reps', bodyPart: 'core' },
  { id: 'ex_leg_raise', name: 'レッグレイズ', type: 'reps', bodyPart: 'core', progressionId: 'ex_hanging_leg_raise' },
  { id: 'ex_hanging_leg_raise', name: 'ハンギングレッグレイズ', type: 'reps', bodyPart: 'core' },
  { id: 'ex_bicycle_crunch', name: 'バイシクルクランチ', type: 'reps', bodyPart: 'core' },
  { id: 'ex_mountain_climber', name: 'マウンテンクライマー', type: 'reps', bodyPart: 'core' },
  { id: 'ex_hollow_hold', name: 'ホローホールド', type: 'time', bodyPart: 'core' },
  // 肩
  { id: 'ex_pike_pushup', name: 'パイクプッシュアップ', type: 'reps', bodyPart: 'shoulders', progressionId: 'ex_hspu_wall' },
  { id: 'ex_hspu_wall', name: '壁倒立腕立て', type: 'reps', bodyPart: 'shoulders' },
  { id: 'ex_handstand_hold', name: '壁倒立キープ', type: 'time', bodyPart: 'shoulders' },
  // 腕
  { id: 'ex_dips_bench', name: 'ベンチディップス', type: 'reps', bodyPart: 'arms', progressionId: 'ex_dips' },
  { id: 'ex_dips', name: 'ディップス', type: 'reps', bodyPart: 'arms', useWeight: true },
  // 全身
  { id: 'ex_burpee', name: 'バーピー', type: 'reps', bodyPart: 'full' },
  { id: 'ex_jumping_jack', name: 'ジャンピングジャック', type: 'reps', bodyPart: 'full' },
]

export const SEED_EXERCISES: Exercise[] = seed.map((e) => ({
  ...e,
  useWeight: e.useWeight ?? false,
  isCustom: false,
  archived: false,
  createdAt: 0,
}))
