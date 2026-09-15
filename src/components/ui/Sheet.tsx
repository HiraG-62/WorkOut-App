import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Sheet.css'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const KEYBOARD_THRESHOLD_PX = 120
const ROOT_ID = 'root'

/** 開いているシートのスタック。Esc は最上位だけが処理し、背景は inert にする */
const openStack: symbol[] = []

function pushSheet(token: symbol): void {
  openStack.push(token)
  document.getElementById(ROOT_ID)?.setAttribute('inert', '')
  document.body.style.overflow = 'hidden'
}

function popSheet(token: symbol): void {
  const i = openStack.indexOf(token)
  if (i !== -1) openStack.splice(i, 1)
  if (openStack.length === 0) {
    document.getElementById(ROOT_ID)?.removeAttribute('inert')
    document.body.style.overflow = ''
  }
}

function isTopSheet(token: symbol): boolean {
  return openStack[openStack.length - 1] === token
}

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
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const tokenRef = useRef<symbol>(Symbol('sheet'))

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // 開いている間: Esc で閉じる（最上位のみ）、Tab をシート内に閉じ込める、背景を inert にする
  useEffect(() => {
    if (!open) return
    const token = tokenRef.current
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pushSheet(token)
    const onKey = (e: KeyboardEvent) => {
      if (!isTopSheet(token)) return
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      popSheet(token)
      restoreFocusRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    // React の autoFocus で既に入力へフォーカスが移っていればそれを尊重する
    if (!panel.contains(document.activeElement)) panel.focus()
  }, [open])

  // ソフトウェアキーボード表示中はシートの高さを可視領域に合わせ、フッターが隠れないようにする
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    const panel = panelRef.current
    if (!vv || !panel) return
    const apply = () => {
      const keyboardOpen = vv.height < window.innerHeight - KEYBOARD_THRESHOLD_PX
      panel.style.maxHeight = keyboardOpen ? `${vv.height}px` : ''
      panel.style.height = keyboardOpen && panel.classList.contains('sheet--tall') ? `${vv.height}px` : ''
    }
    vv.addEventListener('resize', apply)
    apply()
    return () => {
      vv.removeEventListener('resize', apply)
      panel.style.maxHeight = ''
      panel.style.height = ''
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="sheet-root">
      <div className="sheet__scrim" onClick={() => onCloseRef.current()} aria-hidden />
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
          <button type="button" className="sheet__close" onClick={() => onCloseRef.current()} aria-label="閉じる">
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
