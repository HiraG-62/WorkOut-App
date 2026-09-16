import { registerSW } from 'virtual:pwa-register'

/** アプリ復帰時の更新チェック間隔（連続チェックを避ける） */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

type Listener = (needRefresh: boolean) => void

let needRefresh = false
let lastCheck = 0
let registration: ServiceWorkerRegistration | undefined
const listeners = new Set<Listener>()
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null

function notify(): void {
  for (const l of listeners) l(needRefresh)
}

/** Service Worker を登録し、新バージョン検知時に通知する。起動時に一度だけ呼ぶ */
export function setupPwaUpdater(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  applyUpdate = registerSW({
    onNeedRefresh() {
      needRefresh = true
      notify()
    },
    onRegisteredSW(_url, reg) {
      registration = reg
      lastCheck = Date.now()
    },
  })
  // ホーム画面アプリは開きっぱなしになりやすいので、復帰のたびに更新を確認する
  const check = () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return
    lastCheck = Date.now()
    void registration?.update().catch(() => undefined)
  }
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
}

export function subscribeUpdate(listener: Listener): () => void {
  listeners.add(listener)
  listener(needRefresh)
  return () => listeners.delete(listener)
}

/** 新 SW が制御を取ってから再読み込みするまでの保険のタイムアウト */
const RELOAD_FALLBACK_MS = 4000

/**
 * 新しい Service Worker を有効化して再読み込みする。
 * registration.update() で見つけた更新はプラグイン側の自動リロード条件（isUpdate）を満たさないため、
 * controllerchange を自前で待って確実に再読み込みする。
 */
export async function reloadToUpdate(): Promise<void> {
  if (!applyUpdate) {
    window.location.reload()
    return
  }
  let reloading = false
  const reload = () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
  const fallback = window.setTimeout(reload, RELOAD_FALLBACK_MS)
  try {
    await applyUpdate(true)
  } catch {
    window.clearTimeout(fallback)
    reload()
  }
}
