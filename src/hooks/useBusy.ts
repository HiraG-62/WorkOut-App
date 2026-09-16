import { useCallback, useRef } from 'react'

/**
 * 非同期処理の実行中は同じ処理を無視するガード。
 * ✓ ボタンの連打で二重登録されるのを防ぐ。
 */
export function useBusy(): (task: () => Promise<void>, key?: string) => Promise<void> {
  const busy = useRef(new Set<string>())
  // key を渡すとキー単位で判定する（別の食品の連続タップは許可し、同じ食品の連打だけ防ぐ）
  return useCallback(async (task: () => Promise<void>, key = '') => {
    if (busy.current.has(key)) return
    busy.current.add(key)
    try {
      await task()
    } finally {
      busy.current.delete(key)
    }
  }, [])
}
