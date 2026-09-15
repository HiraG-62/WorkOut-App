import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Sheet.css'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** 画面いっぱいまで広げる（長いリスト向け） */
  tall?: boolean
  footer?: ReactNode
}

export function Sheet({ open, onClose, title, children, tall = false, footer }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="sheet-root">
      <div className="sheet__scrim" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        className={`sheet ${tall ? 'sheet--tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        <div className="sheet__handle" aria-hidden />
        <div className="sheet__head">
          {title && (
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
          )}
          <button type="button" className="sheet__close" onClick={onClose} aria-label="閉じる">
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
