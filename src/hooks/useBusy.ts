import { useCallback, useRef } from 'react'

/**
 * 非同期処理の実行中は同じ処理を無視するガード。
 * ✓ ボタンの連打で二重登録されるのを防ぐ。
 */
export function useBusy(): (task: () => Promise<void>) => Promise<void> {
  const busy = useRef(false)
  return useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try {
      await task()
    } finally {
      busy.current = false
    }
  }, [])
}
