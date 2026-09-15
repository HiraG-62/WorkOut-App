import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import './Toast.css'

const TOAST_MS = 3200

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, action?: ToastItem['action']) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const show = useCallback<ToastApi['show']>((message, kind = 'info', action) => {
    const id = ++seq.current
    setItems((list) => [...list.slice(-2), { id, kind, message, action }])
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), TOAST_MS)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <div key={t.id} className={`toast toast--${t.kind}`} role="status">
              <Icon size={18} aria-hidden />
              <span className="toast__msg">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    t.action?.onClick()
                    setItems((list) => list.filter((x) => x.id !== t.id))
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
