import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw } from 'lucide-react'
import { reloadToUpdate, subscribeUpdate } from '../pwa/updater'
import './UpdateBanner.css'

/** 新しいバージョンが用意できたら上部に出す。タップで再読み込み */
export function UpdateBanner() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeUpdate(setShow), [])

  if (!show) return null

  return createPortal(
    <div className="upd" role="status">
      <span className="upd__text">新しいバージョンがあります</span>
      <button
        type="button"
        className="upd__btn"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void reloadToUpdate()
        }}
      >
        <RefreshCw size={16} className={busy ? 'upd__spin' : undefined} aria-hidden />
        更新
      </button>
    </div>,
    document.body,
  )
}
