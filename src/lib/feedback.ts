/** 触覚・音のフィードバック。ユーザー操作の中から呼ぶこと */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  if (!audioCtx) audioCtx = new AudioContext()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

/** iOS はユーザー操作中に AudioContext を作らないと鳴らないため、タップ時に呼んで解錠する */
export function unlockAudio(): void {
  getCtx()
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // 非対応環境では無視
  }
}

export function tapHaptic(): void {
  vibrate(12)
}

function beep(ctx: AudioContext, at: number, freq: number, dur: number, gain = 0.25): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(gain, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, at + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

/** タイマー終了音 */
export function playTimerDone(): void {
  const ctx = getCtx()
  if (!ctx) return
  const t = ctx.currentTime
  beep(ctx, t, 880, 0.12)
  beep(ctx, t + 0.16, 880, 0.12)
  beep(ctx, t + 0.32, 1320, 0.28)
}

/** 残り3秒のカウントダウン音 */
export function playTick(): void {
  const ctx = getCtx()
  if (!ctx) return
  beep(ctx, ctx.currentTime, 660, 0.06, 0.12)
}
