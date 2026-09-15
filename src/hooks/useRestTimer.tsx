import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { playTick, playTimerDone, vibrate } from '../lib/feedback'
import { useSettings } from './useSettings'

const TICK_MS = 250
const COUNTDOWN_TICK_FROM_SEC = 3
const DONE_VIBRATION = [120, 80, 120, 80, 240]

interface TimerState {
  /** 終了予定時刻 (epoch ms)。null なら停止中 */
  endsAt: number | null
  totalSec: number
  /** 何の種目の休憩か（表示用） */
  label: string
}

interface RestTimerApi {
  running: boolean
  remainingSec: number
  totalSec: number
  label: string
  start: (sec: number, label?: string) => void
  stop: () => void
  extend: (sec: number) => void
}

const RestTimerContext = createContext<RestTimerApi | null>(null)

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const [state, setState] = useState<TimerState>({ endsAt: null, totalSec: 0, label: '' })
  const [now, setNow] = useState(() => Date.now())
  const lastTickSecRef = useRef<number>(-1)
  const soundRef = useRef(settings.sound)
  const vibrationRef = useRef(settings.vibration)

  useEffect(() => {
    soundRef.current = settings.sound
    vibrationRef.current = settings.vibration
  }, [settings.sound, settings.vibration])

  const running = state.endsAt !== null
  const remainingMs = state.endsAt ? Math.max(0, state.endsAt - now) : 0
  const remainingSec = Math.ceil(remainingMs / 1000)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS)
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [running])

  // 残り数秒のカウントダウン音と終了通知
  useEffect(() => {
    if (!running) {
      lastTickSecRef.current = -1
      return
    }
    if (remainingSec === lastTickSecRef.current) return
    lastTickSecRef.current = remainingSec
    if (remainingSec === 0) {
      if (soundRef.current) playTimerDone()
      if (vibrationRef.current) vibrate(DONE_VIBRATION)
      setState({ endsAt: null, totalSec: 0, label: '' })
      return
    }
    if (remainingSec <= COUNTDOWN_TICK_FROM_SEC && soundRef.current) playTick()
  }, [running, remainingSec])

  const start = useCallback((sec: number, label = '') => {
    if (sec <= 0) return
    const t = Date.now()
    setNow(t)
    setState({ endsAt: t + sec * 1000, totalSec: sec, label })
  }, [])

  const stop = useCallback(() => setState({ endsAt: null, totalSec: 0, label: '' }), [])

  const extend = useCallback((sec: number) => {
    setState((s) => {
      if (s.endsAt === null) return s
      const endsAt = Math.max(Date.now() + 1000, s.endsAt + sec * 1000)
      return { ...s, endsAt, totalSec: Math.max(1, s.totalSec + sec) }
    })
  }, [])

  const api = useMemo<RestTimerApi>(
    () => ({ running, remainingSec, totalSec: state.totalSec, label: state.label, start, stop, extend }),
    [running, remainingSec, state.totalSec, state.label, start, stop, extend],
  )

  return <RestTimerContext.Provider value={api}>{children}</RestTimerContext.Provider>
}

export function useRestTimer(): RestTimerApi {
  const ctx = useContext(RestTimerContext)
  if (!ctx) throw new Error('useRestTimer must be used within RestTimerProvider')
  return ctx
}
