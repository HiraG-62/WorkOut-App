import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import './Toast.css'

const DEFAULT_TOAST_MS = 3200

type ToastKind = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, action?: ToastAction, durationMs?: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const

export function ToastProvider({ children }: { children: ReactNode }) {
  // 同時に出すのは1件だけ。新しいものが来たら置き換える
  const [item, setItem] = useState<ToastItem | null>(null)
  const seq = useRef(0)
  const timer = useRef<number | null>(null)

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setItem(null)
  }, [])

  const show = useCallback<ToastApi['show']>(
    (message, kind = 'info', action, durationMs = DEFAULT_TOAST_MS) => {
      const id = ++seq.current
      if (timer.current) window.clearTimeout(timer.current)
      setItem({ id, kind, message, action })
      timer.current = window.setTimeout(() => setItem((cur) => (cur?.id === id ? null : cur)), durationMs)
    },
    [],
  )

  const api = useMemo(() => ({ show }), [show])
  const Icon = item ? ICONS[item.kind] : null

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          {item && Icon && (
            <div key={item.id} className={`toast toast--${item.kind}`} role="status" onClick={item.action ? undefined : dismiss}>
              <Icon size={18} aria-hidden />
              <span className="toast__msg">{item.message}</span>
              {item.action && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    item.action?.onClick()
                    dismiss()
                  }}
                >
                  {item.action.label}
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
